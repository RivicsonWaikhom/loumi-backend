import os
import csv
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import List, Dict, Any
import pypdf

class DocumentChunk:
    def __init__(
        self,
        doc_id: str,
        chunk_id: int,
        source: str,
        page: int,
        crop: str,
        title: str,
        text: str,
        file_path: str,
    ):
        self.doc_id = doc_id
        self.chunk_id = chunk_id
        self.source = source
        self.page = page
        self.crop = crop
        self.title = title
        self.text = text
        self.file_path = file_path

    def to_dict(self) -> Dict[str, Any]:
        return {
            "doc_id": self.doc_id,
            "chunk_id": self.chunk_id,
            "source": self.source,
            "page": self.page,
            "crop": self.crop,
            "title": self.title,
            "text": self.text,
            "file_path": self.file_path,
        }


def detect_crop(text: str, filename: str) -> str:
    combined = (filename + " " + text[:500]).lower()
    has_pineapple = any(k in combined for k in ["pineapple", "ananas", "kew", "queen", "marbling", "fruitlet"])
    has_rice = any(k in combined for k in ["rice", "paddy", "oryza", "tamphaphou", "chak-hao", "rcm-", "stem borer", "gundhi bug", "blast"])
    if has_pineapple and not has_rice:
        return "pineapple"
    elif has_rice and not has_pineapple:
        return "rice"
    return "general"


def extract_pdf(path: Path) -> List[Dict[str, Any]]:
    pages = []
    try:
        reader = pypdf.PdfReader(str(path))
        for idx, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            if text.strip():
                pages.append({"page": idx + 1, "text": text.strip()})
    except Exception as e:
        print(f"Error reading PDF {path}: {e}")
    return pages


def extract_docx(path: Path) -> List[Dict[str, Any]]:
    text = ""
    try:
        with zipfile.ZipFile(str(path)) as z:
            xml_content = z.read("word/document.xml")
            tree = ET.fromstring(xml_content)
            paragraphs = []
            for node in tree.iter():
                if node.tag.endswith("t") and node.text:
                    paragraphs.append(node.text)
                elif node.tag.endswith("p"):
                    paragraphs.append("\n")
            text = "".join(paragraphs)
    except Exception as e:
        print(f"Error reading DOCX {path}: {e}")
    return [{"page": 1, "text": text.strip()}] if text.strip() else []


def extract_txt(path: Path) -> List[Dict[str, Any]]:
    encodings = ["utf-8", "latin-1", "cp1252"]
    for enc in encodings:
        try:
            with open(path, "r", encoding=enc) as f:
                content = f.read()
            return [{"page": 1, "text": content.strip()}]
        except Exception:
            continue
    return []


def extract_csv(path: Path) -> List[Dict[str, Any]]:
    rows = []
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            reader = csv.reader(f)
            for r in reader:
                rows.append(", ".join(r))
        return [{"page": 1, "text": "\n".join(rows)}]
    except Exception as e:
        print(f"Error reading CSV {path}: {e}")
    return []


def chunk_text(text: str, max_words: int = 350, overlap_words: int = 50) -> List[str]:
    # Split text into paragraphs or sentences
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    if not paragraphs:
        paragraphs = [text.strip()]

    chunks = []
    current_words = []

    for p in paragraphs:
        p_words = p.split()
        if not p_words:
            continue
        if len(current_words) + len(p_words) <= max_words:
            current_words.extend(p_words)
        else:
            if current_words:
                chunks.append(" ".join(current_words))
                current_words = current_words[-overlap_words:] + p_words
            else:
                chunks.append(" ".join(p_words[:max_words]))
                current_words = p_words[max_words - overlap_words:]

    if current_words:
        chunks.append(" ".join(current_words))
    return chunks


def load_all_documents(search_dirs: List[Path]) -> List[DocumentChunk]:
    seen_files = set()
    chunks: List[DocumentChunk] = []
    valid_exts = {".pdf", ".docx", ".txt", ".md", ".csv"}

    for directory in search_dirs:
        if not directory.exists():
            continue
        for root, _, files in os.walk(directory):
            for file in files:
                ext = Path(file).suffix.lower()
                if ext not in valid_exts:
                    continue
                # Skip txt exports of the PDFs if the PDF itself is present
                if file.endswith(".pdf.txt"):
                    continue
                # Skip venv, node_modules, frontend, backend, tests, etc.
                if any(ignored in root for ignored in ["venv", "node_modules", "frontend", "backend", "tests", ".git", "dist", ".system_generated"]):
                    continue

                full_path = Path(root) / file
                canonical_name = file.lower()
                
                # Deduplicate if same filename already indexed from another folder
                if canonical_name in seen_files:
                    continue
                seen_files.add(canonical_name)

                print(f"[RAG] Indexing document: {file} from {full_path}")

                pages: List[Dict[str, Any]] = []
                if ext == ".pdf":
                    pages = extract_pdf(full_path)
                elif ext == ".docx":
                    pages = extract_docx(full_path)
                elif ext in [".txt", ".md"]:
                    pages = extract_txt(full_path)
                elif ext == ".csv":
                    pages = extract_csv(full_path)

                doc_crop = detect_crop("", file)

                chunk_seq = 0
                for page_obj in pages:
                    page_num = page_obj["page"]
                    page_text = page_obj["text"]
                    page_crop = detect_crop(page_text, file) or doc_crop

                    # Extract any title/heading
                    first_line = page_text.splitlines()[0] if page_text.splitlines() else file
                    title = first_line[:80].strip()

                    text_chunks = chunk_text(page_text, max_words=300, overlap_words=40)
                    for t_chunk in text_chunks:
                        chunk_seq += 1
                        chunk = DocumentChunk(
                            doc_id=canonical_name,
                            chunk_id=chunk_seq,
                            source=file,
                            page=page_num,
                            crop=page_crop,
                            title=title,
                            text=t_chunk,
                            file_path=str(full_path),
                        )
                        chunks.append(chunk)

    print(f"[RAG] Successfully loaded {len(chunks)} chunks from {len(seen_files)} documents.")
    return chunks
