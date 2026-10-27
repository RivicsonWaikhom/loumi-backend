import os
import io
from pathlib import Path
from typing import Dict, Any, Tuple
from PIL import Image

MODEL_PATH = Path(os.getenv("FARM_PLANNER_MODEL_PATH", Path(__file__).resolve().parent.parent / "models" / "model2_best.pt"))
UNCERTAINTY_THRESHOLD = float(os.getenv("UNCERTAINTY_THRESHOLD", "0.60"))
MAX_IMAGE_SIZE_BYTES = int(os.getenv("MAX_IMAGE_SIZE_BYTES", str(15 * 1024 * 1024))) # 15MB

EXPECTED_CLASSES = {
    0: "Pineapple__leaf_blight",
    1: "Pineapple_fusarium",
    2: "Pineapple_healthy",
    3: "Pineapple_mealybug_wilt"
}

CLASS_DISPLAY_NAMES = {
    "Pineapple__leaf_blight": "Pineapple leaf blight",
    "Pineapple_fusarium": "Pineapple Fusarium-related disease",
    "Pineapple_healthy": "Healthy pineapple leaf",
    "Pineapple_mealybug_wilt": "Pineapple mealybug wilt"
}

LIMITATION_TEXT = (
    "Model scores are uncalibrated and provide a preliminary AI-assisted assessment only, not a confirmed diagnosis. "
    "The classifier covers four classes only and can misclassify other pests, diseases, crops, or poor-quality photos."
)

_model_instance = None

def get_model():
    global _model_instance
    if _model_instance is None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(f"Farm Planner model checkpoint not found at {MODEL_PATH}")
        from ultralytics import YOLO
        _model_instance = YOLO(str(MODEL_PATH))
    return _model_instance

def is_model_ready() -> bool:
    try:
        m = get_model()
        return m is not None
    except Exception:
        return False

def is_class_mapping_verified() -> bool:
    try:
        model = get_model()
        if not hasattr(model, 'names') or not isinstance(model.names, dict):
            return False
        for idx, expected_name in EXPECTED_CLASSES.items():
            if model.names.get(idx) != expected_name:
                return False
        return True
    except Exception:
        return False

def validate_image_bytes(data: bytes, content_type: str = "") -> Image.Image:
    if len(data) == 0:
        raise ValueError("Image file is empty (0 bytes).")
    if len(data) > MAX_IMAGE_SIZE_BYTES:
        raise ValueError(f"Image exceeds maximum allowable size of {MAX_IMAGE_SIZE_BYTES // (1024*1024)} MB.")
    
    allowed_types = {"image/jpeg", "image/jpg", "image/png", "image/webp", "application/octet-stream"}
    if content_type and content_type.lower() not in allowed_types:
        raise ValueError(f"Unsupported image MIME type: {content_type}. Use JPEG, PNG, or WebP.")

    try:
        test_stream = io.BytesIO(data)
        with Image.open(test_stream) as img:
            img.verify()
    except Exception as e:
        raise ValueError(f"Corrupted or invalid image file: {e}")

    try:
        decode_stream = io.BytesIO(data)
        img = Image.open(decode_stream)
        rgb_img = img.convert("RGB")
        return rgb_img
    except Exception as e:
        raise ValueError(f"Failed to decode image data into RGB: {e}")

def run_prediction(image: Image.Image, threshold: float = UNCERTAINTY_THRESHOLD) -> Dict[str, Any]:
    # CLIP Image Validation
    from backend.disease_detection.validator import clip_image_validator
    val = clip_image_validator.validate_image(image)
    if not val["is_valid_leaf"]:
        return {
            "validation": val,
            "error": val["message"],
            "scores": {},
            "top_class": None,
            "top_class_display": None,
            "top_score": None,
            "uncertainty_threshold": threshold,
            "is_uncertain": True,
            "model_version": "YOLOv8n-cls (224x224)",
            "limitation_text": LIMITATION_TEXT,
        }

    model = get_model()
    results = model(image, imgsz=224, verbose=False)
    if not results or len(results) == 0:
        raise RuntimeError("Model returned no inference results.")
        
    probs = results[0].probs
    raw_scores = probs.data.cpu().numpy()
    
    scores_dict: Dict[str, float] = {}
    for idx in range(len(EXPECTED_CLASSES)):
        class_name = model.names[idx]
        scores_dict[class_name] = round(float(raw_scores[idx]), 4)
        
    top1_idx = int(probs.top1)
    top_class = model.names[top1_idx]
    top_score = round(float(raw_scores[top1_idx]), 4)
    is_uncertain = top_score < threshold

    return {
        "validation": val,
        "scores": scores_dict,
        "top_class": top_class,
        "top_class_display": CLASS_DISPLAY_NAMES.get(top_class, top_class),
        "top_score": top_score,
        "uncertainty_threshold": threshold,
        "is_uncertain": is_uncertain,
        "model_version": "YOLOv8n-cls (224x224)",
        "limitation_text": LIMITATION_TEXT
    }
