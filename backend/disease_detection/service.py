import os
import io
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional
from PIL import Image

UNCERTAINTY_THRESHOLD = float(os.getenv("UNCERTAINTY_THRESHOLD", "0.60"))
MAX_IMAGE_SIZE_BYTES = int(os.getenv("MAX_IMAGE_SIZE_BYTES", str(15 * 1024 * 1024)))  # 15 MB
MIN_IMAGE_DIMENSION = 16  # pixels

EXPECTED_CLASSES = {
    0: "Pineapple__leaf_blight",
    1: "Pineapple_fusarium",
    2: "Pineapple_healthy",
    3: "Pineapple_mealybug_wilt",
}

CLASS_DISPLAY_NAMES = {
    "Pineapple__leaf_blight": "Pineapple leaf blight",
    "Pineapple_fusarium": "Pineapple Fusarium",
    "Pineapple_healthy": "Healthy pineapple leaf",
    "Pineapple_mealybug_wilt": "Pineapple mealybug wilt",
}

LIMITATION_TEXT = (
    "Model scores are uncalibrated and provide a preliminary AI-assisted assessment only, not a confirmed diagnosis. "
    "The classifier covers four classes only and can misclassify other pests, diseases, crops, or poor-quality photos."
)

def resolve_model_path() -> Path:
    env_path = os.getenv("DISEASE_MODEL_PATH") or os.getenv("PINEAPPLE_DISEASE_MODEL_PATH")
    if env_path and Path(env_path).exists():
        return Path(env_path)

    base_dir = Path(__file__).resolve().parent.parent
    candidates = [
        base_dir / "ml" / "weights" / "pineapple_disease_yolov8n_best.pt",
        base_dir / "ml" / "weights" / "model2_best.pt",
        base_dir / "farm_planner" / "models" / "pineapple_disease_yolov8n_best.pt",
        base_dir / "farm_planner" / "models" / "model2_best.pt",
        base_dir / "models" / "pineapple_disease_yolov8n_best.pt",
        base_dir / "models" / "model2_best.pt",
        base_dir / "models" / "best.pt",
        Path("E:/projects/WebApp/LoumiPrototype01/LoumiWebsite01/Models/New Pine apple Disease Detection Model/best (12).pt"),
        Path("E:/projects/WebApp/LoumiPrototype01/LoumiWebsite01/Models/disease detection pineapple/disease detection pineapple/backend/models/model2_best.pt"),
        Path("E:/projects/WebApp/LoumiPrototype01/LoumiWebsite01/Models/disease detection pineapple/disease detection pineapple/best.pt"),
        Path("D:/Loumi/backend/ml/weights/pineapple_disease_yolov8n_best.pt"),
        Path("D:/Loumi/backend/ml/weights/model2_best.pt"),
        Path("D:/Loumi/backend/farm_planner/models/model2_best.pt"),
    ]
    for c in candidates:
        if c.exists():
            return c
    return base_dir / "ml" / "weights" / "model2_best.pt"

def resolve_kb_path() -> Path:
    base_dir = Path(__file__).resolve().parent.parent
    candidates = [
        base_dir / "farm_planner" / "data" / "knowledge_base.json",
        base_dir / "data" / "knowledge_base.json",
        Path("E:/projects/WebApp/LoumiPrototype01/LoumiWebsite01/Models/disease detection pineapple/disease detection pineapple/backend/data/knowledge_base.json"),
        Path("D:/Loumi/backend/farm_planner/data/knowledge_base.json"),
    ]
    for c in candidates:
        if c.exists():
            return c
    return base_dir / "farm_planner" / "data" / "knowledge_base.json"

_cached_kb: Optional[Dict[str, Any]] = None

def load_knowledge_base() -> Dict[str, Any]:
    global _cached_kb
    if _cached_kb is None:
        path = resolve_kb_path()
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                _cached_kb = json.load(f)
        else:
            _cached_kb = {"classes": [], "sources": {}}
    return _cached_kb

def get_class_knowledge(model_class: str) -> Optional[Dict[str, Any]]:
    kb = load_knowledge_base()
    classes = kb.get("classes", [])
    for c in classes:
        if c.get("model_class") == model_class or c.get("id") == model_class:
            return c
    return None

class PineappleDiseaseInferenceService:
    def __init__(self):
        self._model = None
        self._model_path = None
        self._load_error = None

    def get_model(self):
        if self._model is None:
            path = resolve_model_path()
            if not path.exists():
                raise FileNotFoundError(f"Trained pineapple disease model checkpoint not found at {path}")
            try:
                from ultralytics import YOLO  # type: ignore
                self._model = YOLO(str(path))
                self._model_path = path
                self._load_error = None
            except Exception as e:
                self._load_error = str(e)
                raise RuntimeError(f"Failed to load YOLO disease classification model: {e}")
        return self._model

    def is_ready(self) -> bool:
        try:
            m = self.get_model()
            return m is not None
        except Exception:
            return False

    def is_class_mapping_verified(self) -> bool:
        try:
            model = self.get_model()
            if not hasattr(model, "names") or not isinstance(model.names, dict):
                return False
            for idx, expected_name in EXPECTED_CLASSES.items():
                if model.names.get(idx) != expected_name:
                    return False
            return True
        except Exception:
            return False

    def get_status(self) -> Dict[str, Any]:
        ready = self.is_ready()
        mapping_ok = self.is_class_mapping_verified() if ready else False
        from backend.disease_detection.validator import clip_image_validator
        return {
            "ready": ready,
            "class_mapping_verified": mapping_ok,
            "model_type": "YOLOv8n-cls (PyTorch)",
            "model_path": str(self._model_path) if self._model_path else str(resolve_model_path()),
            "supported_classes": list(EXPECTED_CLASSES.values()),
            "input_dimensions": "224x224 RGB",
            "uncertainty_threshold": UNCERTAINTY_THRESHOLD,
            "error": self._load_error,
            "clip_validator": clip_image_validator.get_status(),
        }

    def validate_image_bytes(self, data: bytes, content_type: str = "") -> Image.Image:
        """
        Validates image file size, MIME type, and tests for file corruption.
        Returns decoded PIL Image in RGB format.
        """
        if len(data) == 0:
            raise ValueError("Uploaded image file is empty (0 bytes).")
        if len(data) > MAX_IMAGE_SIZE_BYTES:
            raise ValueError(f"Image exceeds maximum allowable size of {MAX_IMAGE_SIZE_BYTES // (1024*1024)} MB.")

        if content_type:
            clean_mime = content_type.split(";")[0].strip().lower()
            if not clean_mime.startswith("image/") and clean_mime not in {"application/octet-stream", "binary/octet-stream", ""}:
                raise ValueError(f"Unsupported image MIME type: {content_type}. Please upload a JPEG, PNG, or WebP image.")

        try:
            test_stream = io.BytesIO(data)
            with Image.open(test_stream) as img:
                img.verify()
        except Exception as e:
            raise ValueError(f"Corrupted or invalid image file: {e}")

        try:
            decode_stream = io.BytesIO(data)
            img = Image.open(decode_stream)
            if img.width < MIN_IMAGE_DIMENSION or img.height < MIN_IMAGE_DIMENSION:
                raise ValueError(f"Image resolution too small ({img.width}x{img.height}). Minimum {MIN_IMAGE_DIMENSION}x{MIN_IMAGE_DIMENSION} required.")
            rgb_img = img.convert("RGB")
            return rgb_img
        except ValueError:
            raise
        except Exception as e:
            raise ValueError(f"Failed to decode image data into RGB: {e}")

    def predict(
        self,
        image_bytes: bytes,
        content_type: str = "",
        filename: str = "leaf.jpg",
        notes: Optional[str] = None,
        farm_id: Optional[str] = None,
        plant_id: Optional[str] = None,
        threshold: float = UNCERTAINTY_THRESHOLD,
    ) -> Dict[str, Any]:
        """
        Runs model inference on uploaded image bytes.
        Never returns hardcoded or fabricated predictions.
        """
        image = self.validate_image_bytes(image_bytes, content_type=content_type)

        # 1. CLIP-Based Image Validation
        # Validate that the image is a valid pineapple leaf before running YOLO classification.
        from backend.disease_detection.validator import clip_image_validator
        val = clip_image_validator.validate_image(image)
        if not val["is_valid_leaf"]:
            return {
                "validation": val,
                "result": None,
                "scores": {},
                "rankedClasses": [],
                "topClass": None,
                "displayName": None,
                "topScore": None,
                "isUncertain": False,
                "uncertaintyThreshold": threshold,
                "warnings": [val["message"]],
                "limitationText": LIMITATION_TEXT,
                "modelVersion": f"YOLOv8n-cls (checkpoint: {resolve_model_path().name}, imgsz: 224)",
                "observation": None,
                "sources": {},
            }

        # 2. YOLO leaf disease classification (Only executed for validated pineapple leaves!)
        model = self.get_model()

        results = model(image, imgsz=224, verbose=False)
        if not results or len(results) == 0:
            raise RuntimeError("Model returned no inference results.")

        probs = results[0].probs
        raw_scores = probs.data.cpu().numpy()

        scores_dict: Dict[str, float] = {}
        ranked_classes: List[Dict[str, Any]] = []

        for idx in range(len(EXPECTED_CLASSES)):
            class_name = model.names[idx]
            score_val = round(float(raw_scores[idx]), 4)
            scores_dict[class_name] = score_val
            ranked_classes.append({
                "className": class_name,
                "displayName": CLASS_DISPLAY_NAMES.get(class_name, class_name),
                "score": score_val,
                "percentage": round(score_val * 100, 1),
            })

        ranked_classes.sort(key=lambda x: x["score"], reverse=True)

        top1_idx = int(probs.top1)
        top_class = model.names[top1_idx]
        top_score = round(float(probs.top1conf.cpu().numpy()), 4)
        display_name = CLASS_DISPLAY_NAMES.get(top_class, top_class)

        is_uncertain = top_score < threshold

        # Determine high-level classification
        if is_uncertain:
            classification = "uncertain"
        elif top_class == "Pineapple_healthy":
            classification = "healthy"
        else:
            classification = "diseased"

        # Extract agricultural guidance from verified knowledge base
        kb_entry = get_class_knowledge(top_class)
        symptoms: List[str] = []
        next_steps: List[str] = []
        prevention: List[str] = []

        if kb_entry:
            for s in kb_entry.get("symptoms", []):
                text = s.get("text") if isinstance(s, dict) else str(s)
                if text:
                    symptoms.append(text)

            for act in kb_entry.get("field_actions", []) or kb_entry.get("immediate_actions", []):
                text = act.get("text") if isinstance(act, dict) else str(act)
                if text:
                    next_steps.append(text)

            for p in kb_entry.get("prevention", []):
                text = p.get("text") if isinstance(p, dict) else str(p)
                if text:
                    prevention.append(text)

        # Fallback evidence-based guidance if knowledge base entry was sparse
        if not symptoms:
            if top_class == "Pineapple_healthy":
                symptoms = ["Vigorous green foliage with no evident necrotic lesions or wilt symptoms."]
            elif top_class == "Pineapple_mealybug_wilt":
                symptoms = [
                    "Leaf reddening beginning from margins, progressing to reflexing and leaf-tip dieback.",
                    "Roots often collapse; ant activity (Pheidole / Solenopsis) frequently observed near stem base (NIPHM IPM package)."
                ]
            elif top_class == "Pineapple_fusarium":
                symptoms = [
                    "General leaf chlorosis and curvature; stem or heart tissues can develop internal brown discoloration.",
                    "Note: In literature, Fusarium guttiforme typically presents in stems/fruits. Leaf symptoms require confirmation."
                ]
            elif top_class == "Pineapple__leaf_blight":
                symptoms = [
                    "Banded or irregular leaf spot lesions with dark brown to straw-colored centers (similar to white leaf spot / Curvularia).",
                    "Lesions may expand longitudinally along leaf blades under humid conditions."
                ]

        if not next_steps:
            if top_class == "Pineapple_healthy":
                next_steps = [
                    "Continue standard crop management: balanced fertilizer (NPK) according to growth stage.",
                    "Scout plots every 7 to 14 days for early pest or disease signs."
                ]
            elif is_uncertain:
                next_steps = [
                    "Do not apply broad-spectrum chemical fungicides or pesticides based on an uncertain AI reading.",
                    "Tag the affected plant and inspect adjacent rows for similar symptom patterns.",
                    "Collect a fresh leaf specimen and consult your district Krishi Vigyan Kendra (KVK) or Horticulture Officer for physical verification."
                ]
            else:
                next_steps = [
                    "Isolate or mark the affected plant to monitor spread rate across the row.",
                    "Avoid overhead irrigation or field operations during wet weather to minimize spore transmission.",
                    "Sanitize pruning knives, sickles, and planting tools with 70% alcohol or 1% sodium hypochlorite.",
                    "Consult local agricultural extension (KVK) before applying any registered treatment."
                ]

        if not prevention:
            if top_class == "Pineapple_healthy":
                prevention = [
                    "Ensure adequate field drainage; avoid water stagnation in furrows.",
                    "Maintain recommended double-row spacing to allow airflow."
                ]
            else:
                prevention = [
                    "Use certified, disease-free suckers or slips from verified nurseries.",
                    "Dip planting materials in approved prophylactic dip if recommended locally.",
                    "Maintain weed-free borders to suppress mealybug and vector ant colonies.",
                    "Rotate fields or solarize planting beds prior to replanting."
                ]

        warnings: List[str] = []
        if is_uncertain:
            warnings.append(
                f"Prediction confidence ({round(top_score * 100, 1)}%) is below the reliable threshold ({int(threshold * 100)}%). "
                "This reading is uncertain and should be verified in person before making management decisions."
            )

        # Formulate observation if farm and plant are specified
        observation = None
        if farm_id and plant_id:
            obs_id = f"obs-{int(datetime.now().timestamp() * 1000)}"
            obs_status = "healthy" if top_class == "Pineapple_healthy" else ("suspected" if is_uncertain else "disease")
            observation = {
                "id": obs_id,
                "farm_id": farm_id,
                "plant_id": plant_id,
                "observed_at": datetime.now().strftime("%Y-%m-%d"),
                "status": obs_status,
                "condition": display_name,
                "confidence": top_score,
                "notes": f"Diagnosed {display_name} ({round(top_score * 100, 1)}% confidence)." + (f" Farmer note: {notes}" if notes else ""),
            }

        kb_sources = load_knowledge_base().get("sources", {})

        return {
            "validation": val,
            "result": {
                "diseaseName": display_name,
                "classification": classification,
                "confidence": top_score,
                "symptoms": symptoms,
                "nextSteps": next_steps,
                "prevention": prevention,
            },
            "scores": scores_dict,
            "rankedClasses": ranked_classes,
            "topClass": top_class,
            "displayName": display_name,
            "topScore": top_score,
            "isUncertain": is_uncertain,
            "uncertaintyThreshold": threshold,
            "warnings": warnings,
            "limitationText": LIMITATION_TEXT,
            "modelVersion": f"YOLOv8n-cls (checkpoint: {resolve_model_path().name}, imgsz: 224)",
            "observation": observation,
            "sources": kb_sources,
        }

# Global singleton instance
disease_inference_service = PineappleDiseaseInferenceService()
