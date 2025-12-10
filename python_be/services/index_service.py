import os
os.environ["TOKENIZERS_PARALLELISM"] = "false"  # Avoid huggingface complaint
import glob
import pymupdf
from typing import List, Dict, Any
from sentence_transformers import SentenceTransformer
import chromadb
from pathlib import Path


class IndexService:
    def __init__(self):
        self.document_dir = "./document_source"
        self.chroma_dir = "./chroma_stm32"
        self.collection_name = "stm32_manual_embedding"
        self.embedding_model_name = "sentence-transformers/all-MiniLM-L6-v2"
        self.max_chars = 1500
        self.overlap = 200
        
        # Initialize model
        self.model = None
    
    def _load_model(self):
        """Lazy load the embedding model."""
        if self.model is None:
            self.model = SentenceTransformer(self.embedding_model_name)
        return self.model
    
    def _split_into_chunks(self, text: str) -> List[str]:
        """Split text into overlapping chunks."""
        paras = [p.strip() for p in text.split("\n") if p.strip()]
        chunks, current = [], ""
        for p in paras:
            if len(current) + len(p) + 1 > self.max_chars:
                chunks.append(current)
                # keep some tail as overlap
                current = current[-self.overlap:] + "\n" + p
            else:
                current += "\n" + p if current else p
        if current:
            chunks.append(current)
        return chunks
    
    def _load_and_chunk_pdf(self, pdf_path: str) -> tuple[List[Dict], int]:
        """
        Load a PDF and split each page into overlapping text chunks.
        Returns a list of dicts: {page, text, source} and page count.
        """
        doc = pymupdf.open(pdf_path)
        pages = []
        for i, page in enumerate(doc):
            text = page.get_text("text")
            pages.append({"page": i + 1, "text": text})
        
        all_chunks = []
        src_name = os.path.basename(pdf_path)
        for page in pages:
            for chunk in self._split_into_chunks(page["text"]):
                all_chunks.append({
                    "page": page["page"],
                    "text": chunk,
                    "source": src_name,
                })
        
        return all_chunks, len(pages)
    
    def _load_and_chunk_txt(self, txt_path: str) -> tuple[List[Dict], int]:
        """
        Load a TXT file and split into overlapping text chunks.
        Returns a list of dicts: {page, text, source} and "page" count (always 1).
        """
        with open(txt_path, 'r', encoding='utf-8', errors='ignore') as f:
            text = f.read()
        
        all_chunks = []
        src_name = os.path.basename(txt_path)
        for chunk in self._split_into_chunks(text):
            all_chunks.append({
                "page": 1,  # TXT files don't have pages
                "text": chunk,
                "source": src_name,
            })
        
        return all_chunks, 1
    
    def _load_and_chunk_docx(self, docx_path: str) -> tuple[List[Dict], int]:
        """
        Load a DOCX file and split into overlapping text chunks.
        Returns a list of dicts: {page, text, source} and "page" count (paragraph count).
        """
        try:
            from docx import Document
        except ImportError:
            raise ImportError("python-docx is required for DOCX support. Install: pip install python-docx")
        
        doc = Document(docx_path)
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        text = "\n".join(paragraphs)
        
        # Debug: log extracted text length
        print(f"[DEBUG] Extracted {len(text)} chars from {os.path.basename(docx_path)}")
        print(f"[DEBUG] First 200 chars: {text[:200]}")
        
        if not text.strip():
            print(f"[WARNING] No text extracted from {docx_path}")
            return [], 0
        
        all_chunks = []
        src_name = os.path.basename(docx_path)
        for chunk in self._split_into_chunks(text):
            all_chunks.append({
                "page": 1,  # DOCX files don't have traditional pages
                "text": chunk,
                "source": src_name,
            })
        
        print(f"[DEBUG] Created {len(all_chunks)} chunks from {src_name}")
        return all_chunks, len(paragraphs)
    
    def _load_and_chunk_file(self, file_path: str) -> tuple[List[Dict], int]:
        """
        Load and chunk a file based on its extension.
        Returns chunks and page/section count.
        """
        ext = Path(file_path).suffix.lower()
        
        if ext == '.pdf':
            return self._load_and_chunk_pdf(file_path)
        elif ext == '.txt':
            return self._load_and_chunk_txt(file_path)
        elif ext in ['.docx', '.doc']:
            return self._load_and_chunk_docx(file_path)
        else:
            raise ValueError(f"Unsupported file type: {ext}")
    
    def build_index(self, rebuild: bool = False) -> Dict[str, Any]:
        """
        Build the search index from all PDFs in the document_source directory.
        
        Args:
            rebuild: If True, clears and rebuilds the entire index from scratch.
                    If False, only indexes new files (incremental).
        
        Returns:
            Dictionary containing build statistics and status
        """
        # Check if document directory exists
        if not os.path.isdir(self.document_dir):
            return {
                "success": False,
                "error": f"Document directory '{self.document_dir}' not found.",
                "message": "Please create the directory and add PDF files."
            }
        
        # Find all supported document files
        supported_extensions = ['*.pdf', '*.txt', '*.docx', '*.doc']
        all_files = []
        for ext in supported_extensions:
            all_files.extend(glob.glob(os.path.join(self.document_dir, ext)))
        
        doc_files = sorted(all_files)
        if not doc_files:
            return {
                "success": False,
                "error": f"No supported files found in '{self.document_dir}'.",
                "message": "Please add PDF, TXT, or DOCX files to the document_source directory."
            }
        
        # Connect to collection
        try:
            client = chromadb.PersistentClient(path=self.chroma_dir)
            collection = client.get_or_create_collection(
                name=self.collection_name,
                embedding_function=None,
            )
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to connect to ChromaDB: {str(e)}"
            }
        
        # Get list of already indexed sources (if not rebuilding)
        indexed_sources = set()
        if not rebuild:
            try:
                existing_data = collection.get()
                if existing_data.get("metadatas"):
                    for meta in existing_data["metadatas"]:
                        if "source" in meta:
                            indexed_sources.add(meta["source"])
            except Exception:
                pass  # Collection is empty or new
        
        # Collect chunks from PDFs
        all_texts: List[str] = []
        all_metadatas: List[Dict] = []
        all_ids: List[str] = []
        file_stats = []
        
        # Get the highest existing chunk index
        chunk_idx = 0
        if not rebuild:
            try:
                existing_ids = collection.get().get("ids", [])
                if existing_ids:
                    chunk_idx = max(int(id.split("_")[1]) for id in existing_ids if "_" in id) + 1
            except (ValueError, IndexError, AttributeError):
                chunk_idx = len(collection.get().get("ids", []))
        
        for file_path in doc_files:
            file_name = os.path.basename(file_path)
            
            # Skip if already indexed (when not rebuilding)
            if not rebuild and file_name in indexed_sources:
                continue
            
            try:
                chunks, pages = self._load_and_chunk_file(file_path)
                file_stats.append({
                    "filename": file_name,
                    "pages": pages,
                    "chunks": len(chunks)
                })
                
                for c in chunks:
                    all_texts.append(c["text"])
                    all_metadatas.append({
                        "page": c["page"],
                        "source": c["source"],
                        "file_path": file_path,
                    })
                    all_ids.append(f"chunk_{chunk_idx}")
                    chunk_idx += 1
            except Exception as e:
                return {
                    "success": False,
                    "error": f"Error processing {file_name}: {str(e)}",
                    "files_processed": file_stats
                }
        
        if not all_texts:
            old_count = collection.count()
            if rebuild:
                return {
                    "success": False,
                    "error": "No text chunks collected from documents.",
                    "message": "Documents may be empty or unreadable."
                }
            else:
                return {
                    "success": True,
                    "message": "No new files to index",
                    "total_chunks": old_count,
                    "previous_chunks": old_count,
                    "files_processed": file_stats,
                    "embedding_model": self.embedding_model_name,
                    "collection_name": self.collection_name
                }
        
        # Load embedding model
        try:
            model = self._load_model()
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to load embedding model: {str(e)}"
            }
        
        # Encode document chunks
        try:
            doc_embeddings = model.encode(
                all_texts,
                convert_to_numpy=True,
                show_progress_bar=False
            )
            doc_embeddings = doc_embeddings.astype("float32")
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to encode documents: {str(e)}",
                "files_processed": file_stats
            }
        
        # Update Chroma collection
        try:
            old_count = collection.count()
            
            # Clear all data if rebuilding
            if rebuild and old_count > 0:
                try:
                    existing = collection.get()
                    existing_ids = existing.get("ids", [])
                    if existing_ids:
                        collection.delete(ids=existing_ids)
                except Exception:
                    pass
                old_count = 0
            
            # Add new data to collection
            collection.add(
                ids=all_ids,
                documents=all_texts,
                metadatas=all_metadatas,
                embeddings=doc_embeddings.tolist(),
            )
            
            new_count = collection.count()
            
            return {
                "success": True,
                "message": "Index built successfully",
                "total_chunks": new_count,
                "previous_chunks": old_count,
                "files_processed": file_stats,
                "embedding_model": self.embedding_model_name,
                "collection_name": self.collection_name
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to update ChromaDB collection: {str(e)}",
                "files_processed": file_stats
            }
