import os
import threading
from typing import Dict, Any, List, Optional
from PIL import Image
import torch

MODEL_NAME = os.getenv("CLIP_MODEL_NAME", "openai/clip-vit-base-patch32")
DEVICE = os.getenv("CLIP_DEVICE", "cuda" if torch.cuda.is_available() else "cpu")
LEAF_CONFIDENCE_THRESHOLD = float(os.getenv("CLIP_LEAF_THRESHOLD", "0.50"))
LEAF_MARGIN_THRESHOLD = float(os.getenv("CLIP_LEAF_MARGIN", "0.10"))

VALIDATION_CATEGORIES = {
    "leaf": [
        "a close-up photo of a pineapple leaf",
        "a close-up photo of a green pineapple leaf blade",
        "a close-up photo of a diseased or spotted pineapple leaf",
        "a photo of spiky pineapple leaf foliage",
        "a photo of pineapple leaves with leaf spots or blight",
    ],
    "fruit": [
        "a photo of a pineapple fruit",
        "a close-up photo of a ripe pineapple fruit",
        "a fresh pineapple fruit with crown",
        "sliced or whole pineapple fruit",
    ],
    "plant": [
        "a wide photo of a whole pineapple plant with crown of leaves",
        "a whole pineapple plant growing on soil in a farm",
        "a pineapple plantation field with rows of pineapple plants",
        "a wide shot of pineapple crops in an agricultural field",
    ],
    "invalid": [
        "a photo of a bicycle or bike",
        "a photo of a car, bus, truck, motorcycle, or motor vehicle",
        "a photo of a building, temple, house, or indoor room",
        "a photo of a person, people, or human face",
        "a photo of cabbage plants in a farm field",
        "a photo of a cabbage, cauliflower, lettuce, or leafy vegetable",
        "a photo of a rice paddy, paddy field, or cereal grass",
        "a photo of flowers, roses, tree branches, or non-pineapple plants",
        "an unrelated everyday object, animal, or non-pineapple scene",
    ],
}

CATEGORY_MESSAGES = {
    "leaf": "Pineapple leaf recognized. Proceeding to disease analysis.",
    "fruit": "Pineapple fruit recognized. The disease detection system analyzes pineapple leaves rather than fruit. Please upload a clear photo of an individual pineapple leaf.",
    "plant": "Whole pineapple plant recognized. For accurate disease diagnosis, please photograph an individual pineapple leaf up close.",
    "invalid": "This image does not appear to be a pineapple leaf. Please upload a clear, close-up photo of a pineapple leaf (unrelated objects, vehicles, and other plant species are not supported).",
    "uncertain": "The image could not be clearly verified as a pineapple leaf. Please upload a clear, focused, well-lit, close-up photo of a single pineapple leaf.",
}

class CLIPImageValidator:
    """
    CLIP-based image validation layer using openai/clip-vit-base-patch32.
    Ensures only valid pineapple leaf images proceed to YOLO classification.
    Rejects bicycles, unrelated objects, non-pineapple crops, fruits, and whole plants.
    """
    def __init__(self, model_name: str = MODEL_NAME, device: str = DEVICE):
        self.model_name = model_name
        self.device = device
        self._model = None
        self._processor = None
        self._text_features = None
        self._prompt_cat_map: List[str] = []
        self._lock = threading.Lock()
        self._init_error: Optional[str] = None

    def load_model(self):
        """Initializes and caches the CLIP processor, model, and precomputed text features."""
        with self._lock:
            if self._model is not None and self._processor is not None:
                return
            try:
                from transformers import CLIPProcessor, CLIPModel  # type: ignore
                print(f"[CLIP Validator] Loading CLIP model '{self.model_name}' on {self.device}...")
                self._processor = CLIPProcessor.from_pretrained(self.model_name)
                self._model = CLIPModel.from_pretrained(self.model_name)
                self._model.to(self.device)
                self._model.eval()

                # Precompute normalized text features for all category prompts
                all_prompts = []
                self._prompt_cat_map = []
                for cat, prompts in VALIDATION_CATEGORIES.items():
                    for p in prompts:
                        all_prompts.append(p)
                        self._prompt_cat_map.append(cat)

                text_inputs = self._processor(text=all_prompts, return_tensors="pt", padding=True)
                for k, v in text_inputs.items():
                    text_inputs[k] = v.to(self.device)

                with torch.no_grad():
                    tf = self._model.get_text_features(**text_inputs)
                    if hasattr(tf, "pooler_output"):
                        tf = tf.pooler_output
                    tf = tf / tf.norm(dim=-1, keepdim=True)
                    self._text_features = tf

                self._init_error = None
                print(f"[CLIP Validator] Ready with {len(all_prompts)} prompts across 4 categories.")
            except Exception as e:
                self._init_error = str(e)
                print(f"[CLIP Validator] Initialization error: {e}")
                raise RuntimeError(f"Failed to initialize CLIP validator: {e}")

    def is_ready(self) -> bool:
        return self._model is not None and self._processor is not None and self._text_features is not None

    def get_status(self) -> Dict[str, Any]:
        return {
            "ready": self.is_ready(),
            "model_name": self.model_name,
            "device": self.device,
            "categories": list(VALIDATION_CATEGORIES.keys()),
            "leaf_threshold": LEAF_CONFIDENCE_THRESHOLD,
            "leaf_margin": LEAF_MARGIN_THRESHOLD,
            "error": self._init_error,
        }

    def validate_image(self, image: Image.Image) -> Dict[str, Any]:
        """
        Validates an RGB PIL image against CLIP text embeddings.
        Returns category ('leaf', 'fruit', 'plant', 'invalid'), isValidLeaf bool,
        confidence, categoryScores, and a user-facing explanation message.
        """
        if not self.is_ready():
            try:
                self.load_model()
            except Exception as e:
                # If model fails to initialize, safely fail closed. Never bypass validation!
                return {
                    "category": "invalid",
                    "is_valid_leaf": False,
                    "confidence": 0.0,
                    "category_scores": {"leaf": 0.0, "fruit": 0.0, "plant": 0.0, "invalid": 1.0},
                    "message": f"Image validation service unavailable: {e}. Please contact support.",
                    "error": str(e),
                }

        try:
            # Ensure RGB format
            if image.mode != "RGB":
                image = image.convert("RGB")

            inputs = self._processor(images=image, return_tensors="pt")
            for k, v in inputs.items():
                inputs[k] = v.to(self.device)

            with self._lock:
                with torch.no_grad():
                    img_feat = self._model.get_image_features(**inputs)
                    if hasattr(img_feat, "pooler_output"):
                        img_feat = img_feat.pooler_output
                    img_feat = img_feat / img_feat.norm(dim=-1, keepdim=True)

                    # Cosine similarity scaled by logit scale
                    logit_scale = self._model.logit_scale.exp()
                    sim = (img_feat @ self._text_features.T) * logit_scale
                    probs = sim.softmax(dim=-1).cpu().numpy()[0]

            # Aggregate probabilities by category
            cat_scores: Dict[str, float] = {c: 0.0 for c in VALIDATION_CATEGORIES}
            for prob, cat in zip(probs, self._prompt_cat_map):
                cat_scores[cat] += float(prob)

            # Round scores for clean presentation
            cat_scores = {k: round(v, 4) for k, v in cat_scores.items()}

            # Determine top category and margin
            sorted_cats = sorted(cat_scores.items(), key=lambda x: x[1], reverse=True)
            top_cat, top_score = sorted_cats[0]
            runner_up_cat, runner_up_score = sorted_cats[1] if len(sorted_cats) > 1 else ("", 0.0)
            margin = top_score - runner_up_score

            # Evaluation logic
            if top_cat == "leaf":
                if top_score >= LEAF_CONFIDENCE_THRESHOLD and margin >= LEAF_MARGIN_THRESHOLD:
                    category = "leaf"
                    is_valid = True
                    msg = CATEGORY_MESSAGES["leaf"]
                else:
                    # Ambiguous reading between leaf and other category
                    category = "invalid"
                    is_valid = False
                    msg = CATEGORY_MESSAGES["uncertain"]
            elif top_cat == "fruit":
                category = "fruit"
                is_valid = False
                msg = CATEGORY_MESSAGES["fruit"]
            elif top_cat == "plant":
                category = "plant"
                is_valid = False
                msg = CATEGORY_MESSAGES["plant"]
            else:
                category = "invalid"
                is_valid = False
                msg = CATEGORY_MESSAGES["invalid"]

            return {
                "category": category,
                "is_valid_leaf": is_valid,
                "confidence": top_score,
                "category_scores": cat_scores,
                "message": msg,
            }

        except Exception as e:
            # Safe failure on any processing error
            return {
                "category": "invalid",
                "is_valid_leaf": False,
                "confidence": 0.0,
                "category_scores": {"leaf": 0.0, "fruit": 0.0, "plant": 0.0, "invalid": 1.0},
                "message": f"Image validation failed: {str(e)}",
                "error": str(e),
            }

# Module-level singleton
clip_image_validator = CLIPImageValidator()
