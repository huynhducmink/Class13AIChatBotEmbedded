# search_index.py
# Search in ChromaDB with SAMPLE_QUERY input

import chromadb
from sentence_transformers import SentenceTransformer

SAMPLE_QUERY="Low-power mode wakeup timings"

CHROMA_DIR = "./chroma_stm32"
COLLECTION_NAME = "stm32_manual_embedding"
EMBEDDING_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


def search_manual(question: str, k: int = 5):
    # 1) Load same embedding model used for indexing
    model = SentenceTransformer(EMBEDDING_MODEL_NAME)

    # 2) Connect to Chroma and collection
    client = chromadb.PersistentClient(path=CHROMA_DIR)
    collection = client.get_collection(
        name=COLLECTION_NAME,
        embedding_function=None,
    )

    # 3) Encode query using the same `.encode`
    query_embedding = model.encode(
        question,
        convert_to_numpy=True
    ).astype("float32").tolist()

    # 4) Query Chroma
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=k,
        include=["documents", "metadatas", "distances"],
    )
    return results


if __name__ == "__main__":
    # Example usage
    question = SAMPLE_QUERY
    res = search_manual(question, k=3)

    if not res["documents"]:
        print("No results found.")
    else:
        print("Question:", question)

        ids = res.get("ids", [[]])[0] if "ids" in res else [None] * len(res["documents"][0])

        for cid, doc, meta, dist in zip(
            ids,
            res["documents"][0],
            res["metadatas"][0],
            res["distances"][0],
        ):
            page = meta.get("page")
            src = meta.get("source")
            print("=" * 80)
            print(f"ID: {cid} | Score: {dist:.4f}")
            print(f"Page {page} | Source: {src}")
            print(doc[:800], "...")
