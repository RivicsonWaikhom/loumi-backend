import os
from pathlib import Path
from typing import Dict, Any, Optional
import requests
from backend.config import ML_MODEL_PATH, ML_MODEL_ENDPOINT

class PineappleDiseaseClassifier:
    """
    Modular interface for custom machine learning pineapple disease model.
    Never fakes predictions: if no model or weights exist, it honestly reports
    the unloaded status and instructions to connect the friend's model.
    """
    def __init__(self):
        self.weights_dir = Path(ML_MODEL_PATH)
        self.endpoint = ML_MODEL_ENDPOINT
        self.loaded_model = None
        self.model_type = None
        self._init_model()

    def _init_model(self):
        if self.endpoint:
            self.model_type = f"Remote API ({self.endpoint})"
            print(f"[ML Model] Configured remote inference endpoint: {self.endpoint}")
            return

        if not self.weights_dir.exists():
            return

        # Check for PyTorch or YOLO weights (.pt)
        pt_files = list(self.weights_dir.glob("*.pt"))
        if pt_files:
            self.model_path = pt_files[0]
            try:
                # Attempt to import ultralytics or torch if installed
                from ultralytics import YOLO  # type: ignore
                self.loaded_model = YOLO(str(self.model_path))
                self.model_type = f"YOLOv8/v9 ({self.model_path.name})"
                print(f"[ML Model] Successfully loaded custom YOLO model: {self.model_path.name}")
                return
            except ImportError:
                print(f"[ML Model] Weights '{self.model_path.name}' found, but 'ultralytics' library is not installed.")
                self.model_type = f"Unloaded Weights ({self.model_path.name})"
                return
            except Exception as e:
                print(f"[ML Model] Error loading weights: {e}")
                return

        # Check for ONNX weights (.onnx)
        onnx_files = list(self.weights_dir.glob("*.onnx"))
        if onnx_files:
            self.model_path = onnx_files[0]
            try:
                import onnxruntime as ort  # type: ignore
                self.loaded_model = ort.InferenceSession(str(self.model_path))
                self.model_type = f"ONNX Runtime ({self.model_path.name})"
                print(f"[ML Model] Successfully loaded ONNX model: {self.model_path.name}")
                return
            except ImportError:
                print(f"[ML Model] ONNX model found, but 'onnxruntime' is not installed.")
                self.model_type = f"Unloaded ONNX ({self.model_path.name})"
                return
            except Exception as e:
                print(f"[ML Model] Error loading ONNX: {e}")
                return

    def get_status(self) -> Dict[str, Any]:
        is_ready = self.loaded_model is not None or bool(self.endpoint)
        classes = (
            list(self.loaded_model.names.values())
            if self.loaded_model and hasattr(self.loaded_model, "names") and isinstance(self.loaded_model.names, dict)
            else [
                "Pineapple__leaf_blight",
                "Pineapple_fusarium",
                "Pineapple_healthy",
                "Pineapple_mealybug_wilt"
            ]
        )
        return {
            "custom_model_ready": is_ready,
            "model_type": self.model_type if is_ready else None,
            "status_message": (
                f"Custom model active: {self.model_type}"
                if is_ready
                else "Custom ML model (e.g., YOLOv8, PyTorch .pt, or ONNX) not connected yet. Place weights in backend/ml/weights/ or set ML_MODEL_ENDPOINT in .env."
            ),
            "expected_classes": classes
        }

    def predict(self, image_bytes: bytes, filename: str = "leaf.jpg") -> Dict[str, Any]:
        """
        Runs real prediction if custom model is connected.
        NEVER fakes predictions if no model is loaded.
        """
        # 1. If remote endpoint configured
        if self.endpoint:
            try:
                files = {"file": (filename, image_bytes, "image/jpeg")}
                resp = requests.post(self.endpoint, files=files, timeout=10)
                if resp.status_code == 200:
                    data = resp.json()
                    return {
                        "custom_model_loaded": True,
                        "source": self.endpoint,
                        "prediction": data.get("prediction"),
                        "confidence": data.get("confidence"),
                        "detections": data.get("detections", []),
                        "raw_output": data,
                    }
                else:
                    return {
                        "custom_model_loaded": True,
                        "error": f"Remote model returned status {resp.status_code}: {resp.text}"
                    }
            except Exception as e:
                return {
                    "custom_model_loaded": True,
                    "error": f"Failed to query remote ML endpoint: {str(e)}"
                }

        # 2. If local YOLO model loaded
        if self.loaded_model is not None and "YOLO" in str(self.model_type):
            try:
                from PIL import Image
                import io
                from backend.disease_detection.validator import clip_image_validator

                img = Image.open(io.BytesIO(image_bytes))
                val = clip_image_validator.validate_image(img)
                if not val["is_valid_leaf"]:
                    return {
                        "custom_model_loaded": True,
                        "validated": False,
                        "validation": val,
                        "error": val["message"],
                        "prediction": None,
                        "confidence": None,
                    }

                results = self.loaded_model(img, imgsz=224, verbose=False)
                # Check for Classification head (YOLOv8-cls)
                if hasattr(results[0], "probs") and results[0].probs is not None:
                    probs = results[0].probs
                    top1_idx = int(probs.top1)
                    top_pred = self.loaded_model.names.get(top1_idx, f"Class {top1_idx}")
                    top_conf = round(float(probs.top1conf.cpu().numpy()), 4)
                    raw_scores = probs.data.cpu().numpy()
                    scores_dict = {
                        self.loaded_model.names[i]: round(float(raw_scores[i]), 4)
                        for i in range(len(self.loaded_model.names))
                    }
                    return {
                        "custom_model_loaded": True,
                        "validated": True,
                        "validation": val,
                        "source": "Local YOLO Model",
                        "model_task": "classify",
                        "prediction": top_pred,
                        "confidence": top_conf,
                        "scores": scores_dict
                    }

                # Check for Detection head (YOLOv8-det)
                detections = []
                for r in results:
                    if hasattr(r, "boxes") and r.boxes is not None:
                        for box in r.boxes:
                            cls_id = int(box.cls[0])
                            cls_name = r.names.get(cls_id, f"Class {cls_id}")
                            conf = float(box.conf[0])
                            detections.append({
                                "class": cls_name,
                                "confidence": round(conf, 4),
                                "box": [float(x) for x in box.xyxy[0]]
                            })
                top_pred = detections[0]["class"] if detections else "Unknown"
                top_conf = detections[0]["confidence"] if detections else 0.0
                return {
                    "custom_model_loaded": True,
                    "source": "Local YOLO Model",
                    "model_task": "detect",
                    "prediction": top_pred,
                    "confidence": top_conf,
                    "detections": detections
                }
            except Exception as e:
                return {
                    "custom_model_loaded": True,
                    "error": f"Error running local model inference: {str(e)}"
                }

        # 3. Honest unloaded response - NEVER FAKE PREDICTIONS
        return {
            "custom_model_loaded": False,
            "prediction": None,
            "confidence": None,
            "status_message": "Custom ML model (e.g. friend's YOLOv8/ONNX classifier) is not connected yet. Predictions are NOT simulated or faked. Please add weights to backend/ml/weights/ or provide ML_MODEL_ENDPOINT.",
            "guide": "Compatible with models trained on Roboflow / IEEE 2026 Pineapple Health Detection dataset."
        }

# Global singleton
classifier = PineappleDiseaseClassifier()
