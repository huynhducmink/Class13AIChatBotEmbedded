# build_index.py
# Embed pdf file in document_source folder and save to ChromaDB

import os
os.environ["TOKENIZERS_PARALLELISM"] = "false" # Avoid huggingface complaint
import glob
import pymupdf
from typing import List, Dict

from sentence_transformers import SentenceTransformer
import chromadb

# --------- Config ---------
DOCUMENT_DIR = "./document_source"           # folder containing your PDFs
CHROMA_DIR = "./chroma_stm32"               # Chroma persistent directory
COLLECTION_NAME = "stm32_manual_embedding"  # Chroma collection name

EMBEDDING_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

MAX_CHARS = 1500
OVERLAP = 200


def load_and_chunk_pdf(pdf_path: str,
                       max_chars: int = MAX_CHARS,
                       overlap: int = OVERLAP) -> List[Dict]:
    """
    Load a PDF and split each page into overlapping text chunks.
    Returns a list of dicts: {page, text, source}
    """
    doc = pymupdf.open(pdf_path)
    pages = []
    for i, page in enumerate(doc):
        text = page.get_text("text")
        pages.append({"page": i + 1, "text": text})

    def split_into_chunks(text: str,
                          max_chars: int = max_chars,
                          overlap: int = overlap) -> List[str]:
        paras = [p.strip() for p in text.split("\n") if p.strip()]
        chunks, current = [], ""
        for p in paras:
            if len(current) + len(p) + 1 > max_chars:
                chunks.append(current)
                # keep some tail as overlap
                current = current[-overlap:] + "\n" + p
            else:
                current += "\n" + p if current else p
        if current:
            chunks.append(current)
        return chunks

    all_chunks = []
    src_name = os.path.basename(pdf_path)
    for page in pages:
        for chunk in split_into_chunks(page["text"]):
            all_chunks.append({
                "page": page["page"],
                "text": chunk,
                "source": src_name,  # use filename as source
            })

    print(f"[{src_name}] Pages: {len(pages)}, Chunks: {len(all_chunks)}")
    return all_chunks


def main():
    # ----- 1) Collect all chunks from all PDFs -----
    if not os.path.isdir(DOCUMENT_DIR):
        raise FileNotFoundError(
            f"DOCUMENT_DIR '{DOCUMENT_DIR}' not found. Create it and put PDFs inside."
        )

    pdf_files = sorted(glob.glob(os.path.join(DOCUMENT_DIR, "*.pdf")))
    if not pdf_files:
        raise FileNotFoundError(
            f"No PDFs found in '{DOCUMENT_DIR}'. Put some .pdf files there."
        )

    all_texts: List[str] = []
    all_metadatas: List[Dict] = []
    all_ids: List[str] = []

    chunk_idx = 0
    for pdf_path in pdf_files:
        chunks = load_and_chunk_pdf(pdf_path)
        for c in chunks:
            all_texts.append(c["text"])
            all_metadatas.append({
                "page": c["page"],
                "source": c["source"],
                "file_path": pdf_path,
            })
            all_ids.append(f"chunk_{chunk_idx}")
            chunk_idx += 1

    print("Total chunks collected:", len(all_texts))
    if not all_texts:
        print("No text chunks collected, nothing to index.")
        return

    # ----- 2) Load embedding model -----
    print(f"Loading embedding model: {EMBEDDING_MODEL_NAME} ...")
    model = SentenceTransformer(EMBEDDING_MODEL_NAME)

    print("Encoding document chunks...")
    # For this model we just use `.encode` for documents
    doc_embeddings = model.encode(
        all_texts,
        convert_to_numpy=True,
        show_progress_bar=True
    )
    # Ensure float32 for Chroma
    doc_embeddings = doc_embeddings.astype("float32")

    print("Embeddings shape:", doc_embeddings.shape)

    # ----- 3) Create Chroma collection and store embeddings -----
    client = chromadb.PersistentClient(path=CHROMA_DIR)
    collection = client.get_or_create_collection(
        name=COLLECTION_NAME,
        embedding_function=None,  # we provide precomputed embeddings
    )

    # Optional: clear old data if re-indexing
    if collection.count() > 0:
        existing = collection.get()
        existing_ids = existing.get("ids", [])
        if existing_ids:
            print(f"Clearing old data from collection '{COLLECTION_NAME}' "
                  f"({len(existing_ids)} items)...")
            collection.delete(ids=existing_ids)

    print("Adding chunks to Chroma...")
    collection.add(
        ids=all_ids,
        documents=all_texts,
        metadatas=all_metadatas,
        embeddings=doc_embeddings.tolist(),
    )

    print("Done.")
    print("Chroma collection size:", collection.count())


if __name__ == "__main__":
    main()
