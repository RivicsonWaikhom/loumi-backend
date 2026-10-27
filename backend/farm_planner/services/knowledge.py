import json
from pathlib import Path
from typing import Dict, Any, List, Optional

KB_PATH = Path(__file__).resolve().parent.parent / "data" / "knowledge_base.json"

_cached_kb: Optional[Dict[str, Any]] = None

def load_knowledge_base() -> Dict[str, Any]:
    global _cached_kb
    if _cached_kb is None:
        if not KB_PATH.exists():
            raise FileNotFoundError(f"Knowledge base file not found at {KB_PATH}")
        with open(KB_PATH, "r", encoding="utf-8") as f:
            _cached_kb = json.load(f)
    return _cached_kb

def get_classes() -> List[Dict[str, Any]]:
    kb = load_knowledge_base()
    return kb.get("classes", [])

def get_class_by_id(class_id: str) -> Optional[Dict[str, Any]]:
    classes = get_classes()
    for c in classes:
        if c.get("id") == class_id or c.get("model_class") == class_id:
            return c
    return None

def get_sources() -> Dict[str, Any]:
    kb = load_knowledge_base()
    return kb.get("sources", {})
