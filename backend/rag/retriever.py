from typing import List, Dict, Any, Optional
from backend.config import DATA_DIRS
from backend.rag.document_loader import load_all_documents, DocumentChunk, detect_crop
from backend.rag.bm25 import BM25Retriever

class AgricultureRAG:
    _instance: Optional["AgricultureRAG"] = None

    def __init__(self):
        self.chunks: List[DocumentChunk] = []
        self.bm25 = BM25Retriever()
        self.indexed_files: List[Dict[str, Any]] = []
        self.reload()

    @classmethod
    def get_instance(cls) -> "AgricultureRAG":
        if cls._instance is None:
            cls._instance = AgricultureRAG()
        return cls._instance

    def reload(self):
        self.chunks = load_all_documents(DATA_DIRS)
        self.bm25.index(self.chunks)

        # Summarize indexed files
        files_map = {}
        for c in self.chunks:
            if c.source not in files_map:
                files_map[c.source] = {
                    "filename": c.source,
                    "crop": c.crop,
                    "chunks_count": 0,
                    "pages": set(),
                }
            files_map[c.source]["chunks_count"] += 1
            files_map[c.source]["pages"].add(c.page)

        self.indexed_files = [
            {
                "filename": v["filename"],
                "crop": v["crop"],
                "chunks_count": v["chunks_count"],
                "pages_count": len(v["pages"]),
            }
            for v in files_map.values()
        ]

    def search(self, query: str, top_k: int = 4) -> List[Dict[str, Any]]:
        # Detect crop context from query
        detected_crop = detect_crop(query, "")
        crop_filter = detected_crop if detected_crop in ["pineapple", "rice"] else None

        results = self.bm25.retrieve(query, top_k=top_k, crop_filter=crop_filter)
        formatted = []
        for chunk, score in results:
            formatted.append({
                "source": chunk.source,
                "page": chunk.page,
                "title": chunk.title,
                "crop": chunk.crop,
                "text": chunk.text,
                "score": round(score, 3),
                "citation": f"[Source: {chunk.source}, Page {chunk.page}]",
            })
        return formatted

    def get_status(self) -> Dict[str, Any]:
        return {
            "total_chunks": len(self.chunks),
            "total_documents": len(self.indexed_files),
            "documents": self.indexed_files,
        }
