import chromadb
from sentence_transformers import SentenceTransformer
from typing import Dict, Any, Optional

class SearchService:
    def __init__(self):
        self.chroma_dir = "./chroma_stm32"
        self.collection_name = "stm32_manual_embedding"
        self.embedding_model_name = "sentence-transformers/all-MiniLM-L6-v2"
        
        # Initialize model and client (lazy load collection)
        self.model = SentenceTransformer(self.embedding_model_name)
        self.client = chromadb.PersistentClient(path=self.chroma_dir)
        self._collection: Optional[Any] = None
    
    def _get_collection(self):
        """Lazy load the collection on first use."""
        if self._collection is None:
            self._collection = self.client.get_or_create_collection(
                name=self.collection_name,
                embedding_function=None,
            )
        return self._collection
    
    @property
    def collection(self):
        """Property to access collection with lazy loading."""
        return self._get_collection()
    
    def search(self, query: str, k: int = 5) -> Dict[str, Any]:
        """
        Search the document collection for relevant chunks.
        
        Args:
            query: Search query text
            k: Number of results to return
            
        Returns:
            Dictionary containing search results
        """
        # Encode query
        query_embedding = self.model.encode(
            query,
            convert_to_numpy=True
        ).astype("float32").tolist()
        
        # Query Chroma
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=k,
            include=["documents", "metadatas", "distances"],
        )
        
        return results
    
    def get_collection_stats(self) -> Dict[str, Any]:
        """Get statistics about the document collection."""
        count = self.collection.count()
        
        # Get ALL documents to determine all available sources
        if count > 0:
            sample = self.collection.get()
        else:
            sample = {"metadatas": []}
        
        sources = set()
        if sample.get("metadatas"):
            for meta in sample["metadatas"]:
                if "source" in meta:
                    sources.add(meta["source"])
        
        return {
            "total_chunks": count,
            "collection_name": self.collection_name,
            "embedding_model": self.embedding_model_name,
            "sources": sorted(list(sources))
        }
