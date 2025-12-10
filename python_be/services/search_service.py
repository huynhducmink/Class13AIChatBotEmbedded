from typing import Dict, Any, Optional, List
import chromadb
from sentence_transformers import SentenceTransformer

class SearchService:
    def __init__(self):
        self.chroma_dir = "./chroma_stm32"
        self.collection_name = "stm32_manual_embedding"
        self.embedding_model_name = "sentence-transformers/all-MiniLM-L6-v2"
        
        # Initialize model and client
        self.model = SentenceTransformer(self.embedding_model_name)
        self.client = chromadb.PersistentClient(path=self.chroma_dir)
        self.collection = self.client.get_or_create_collection(
            name=self.collection_name,
            embedding_function=None,
        )

    def _get_all_sources(self, limit: Optional[int] = None) -> List[str]:
        """
        Collect unique sources from collection metadata.
        If limit is None, attempts to fetch all metadatas.
        """
        # Some chroma versions accept no limit to get all.
        # If your dataset is huge, you may want to set a cap.
        kwargs = {"include": ["metadatas"]}
        if limit is not None:
            kwargs["limit"] = limit

        sample = self.collection.get()
        sources = set()
        if sample["metadatas"]:
            for meta in sample["metadatas"]:
                if "source" in meta:
                    sources.add(meta["source"])

        return sorted(sources)

    def _match_sources_partial(self, source) -> List[str]:
        if source is None:
            return []

        if isinstance(source, str):
            needles = [source.strip().lower()] if source.strip() else []
        elif isinstance(source, list):
            needles = [s.strip().lower() for s in source if isinstance(s, str) and s.strip()]
            # needles = list(dict.fromkeys(needles))
        else:
            needles = []

        if not needles:
            return []

        sources = self._get_all_sources()
        print(f"Available sources: {sources}")
        print(f"Matching needles: {needles}")
        matched = []
        for s in sources:
            if any(n in s.lower() for n in needles):
                matched.append(s)
                print(f"Matched source: {s} for needles {needles}")
        # matched = [s for s in sources if any(n in s.lower() for n in needles)]
        print(f"Matched sources for filter {source}: {matched}")
        return list(dict.fromkeys(matched))


    def search(self, query: str, k: int = 5, source: Optional[str] = None) -> Dict[str, Any]:
        """
        Search the document collection for relevant chunks.

        If source is provided:
          - Treat it as PARTIAL match (case-insensitive).
          - Restrict search to all sources containing that substring.

        Example:
          source="stm" -> searches across stm32, stm8, etc.
        """
        query_embedding = self.model.encode(
            query,
            convert_to_numpy=True
        ).astype("float32").tolist()

        matched_sources: List[str] = []
        if source and str(source).strip():
            matched_sources = self._match_sources_partial(source)

            # If user asked for a source filter but nothing matched,
            # return empty results in a stable shape.
            if not matched_sources:
                return {"documents": [[]], "metadatas": [[]], "distances": [[]]}

        # If no source filter, normal search
        if not matched_sources:
            return self.collection.query(
                query_embeddings=[query_embedding],
                n_results=k,
                include=["documents", "metadatas", "distances"],
            )

        # With source filter:
        # Try using Chroma's $in operator (if supported).
        where_in = {"source": {"$in": matched_sources}}

        # Oversample in case we must fallback to manual filtering
        oversample_k = max(k * 5, 20)

        try:
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=oversample_k,
                include=["documents", "metadatas", "distances"],
                where=where_in
            )
            # Trim to k just in case backend returns more
            return self._trim_results(results, k)

        except Exception:
            # Fallback: query without where, then manual filter
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=oversample_k,
                include=["documents", "metadatas", "distances"],
            )

            return self._filter_results_by_sources(results, matched_sources, k)

    def _trim_results(self, results: Dict[str, Any], k: int) -> Dict[str, Any]:
        docs0 = (results.get("documents") or [[]])[0]
        metas0 = (results.get("metadatas") or [[]])[0]
        dists0 = (results.get("distances") or [[]])[0]

        docs0 = docs0[:k]
        metas0 = metas0[:k]
        dists0 = dists0[:k]

        return {
            "documents": [docs0],
            "metadatas": [metas0],
            "distances": [dists0],
        }

    def _filter_results_by_sources(
        self,
        results: Dict[str, Any],
        allowed_sources: List[str],
        k: int
    ) -> Dict[str, Any]:
        allowed = set(allowed_sources)

        docs0 = (results.get("documents") or [[]])[0]
        metas0 = (results.get("metadatas") or [[]])[0]
        dists0 = (results.get("distances") or [[]])[0]

        filtered = []
        for doc, md, dist in zip(docs0, metas0, dists0):
            if isinstance(md, dict) and md.get("source") in allowed:
                filtered.append((doc, md, dist))
            if len(filtered) >= k:
                break

        return {
            "documents": [[x[0] for x in filtered]],
            "metadatas": [[x[1] for x in filtered]],
            "distances": [[x[2] for x in filtered]],
        }


    def list_documents(self, filter: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        List documents available in the collection with basic metadata.

        Output:
            {"source": [<unique sources>]}

        Filter behavior (UPDATED):
            filter = {"source": "<partial string>"}

        Example:
            {"source": "stm"} -> returns all sources containing "stm"
        """
        filter = filter or {}
        requested_source = filter.get("source") if isinstance(filter, dict) else None

        # Pull all metadatas (you can keep it simple)
        sample = self.collection.get(include=["metadatas"])

        sources = set()
        for meta in (sample.get("metadatas") or []):
            if isinstance(meta, dict):
                s = meta.get("source")
                if s:
                    sources.add(s)

        sources_list = sorted(sources)

        # NEW: partial/contains matching (case-insensitive)
        if requested_source and str(requested_source).strip():
            needle = str(requested_source).strip().lower()
            matched = [s for s in sources_list if needle in s.lower()]
            return {"source": matched}

        return {"source": sources_list}

    
    def get_collection_stats(self) -> Dict[str, Any]:
        """Get statistics about the document collection."""
        count = self.collection.count()
        
        # Get a sample to determine available sources
        sample = self.collection.get()
        sources = set()
        if sample["metadatas"]:
            for meta in sample["metadatas"]:
                if "source" in meta:
                    sources.add(meta["source"])
        
        return {
            "total_chunks": count,
            "collection_name": self.collection_name,
            "embedding_model": self.embedding_model_name,
            "sources": list(sources)
        }


if __name__ == "__main__":
    # Simple test
    service = SearchService()
    stats = service.get_collection_stats()
    print("Collection stats:", stats)