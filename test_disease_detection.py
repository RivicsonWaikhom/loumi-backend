import io
import sys
from pathlib import Path
from PIL import Image
import pytest
from fastapi.testclient import TestClient

# Ensure project root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.main import app
from backend.disease_detection import disease_inference_service

client = TestClient(app)

SAMPLE_DIR = Path("E:/projects/WebApp/LoumiPrototype01/LoumiWebsite01/Models/disease detection pineapple/disease detection pineapple/backend/test_assets/samples")

def test_model_loading_and_architecture():
    """Verify that the model checkpoint loads, matches YOLOv8-cls, and has all 4 expected classes."""
    assert disease_inference_service.is_ready() is True
    assert disease_inference_service.is_class_mapping_verified() is True
    
    status = disease_inference_service.get_status()
    assert status["ready"] is True
    assert status["class_mapping_verified"] is True
    assert "YOLOv8n-cls" in status["model_type"]
    assert status["supported_classes"] == [
        "Pineapple__leaf_blight",
        "Pineapple_fusarium",
        "Pineapple_healthy",
        "Pineapple_mealybug_wilt"
    ]
    assert status["input_dimensions"] == "224x224 RGB"

def test_api_missing_file():
    """Verify that calling the endpoint without an image file returns 400."""
    resp = client.post("/api/disease-detection")
    assert resp.status_code == 400
    assert "image file is required" in resp.json()["detail"].lower()

def test_api_empty_file():
    """Verify that uploading an empty 0-byte file returns 400."""
    resp = client.post(
        "/api/disease-detection",
        files={"image": ("empty.jpg", b"", "image/jpeg")}
    )
    assert resp.status_code == 400
    assert "empty" in resp.json()["detail"].lower()

def test_api_corrupt_file():
    """Verify that uploading a corrupted image file returns 400."""
    resp = client.post(
        "/api/disease-detection",
        files={"image": ("corrupted.jpg", b"INVALID_HEADER_GARBAGE_BYTES_12345", "image/jpeg")}
    )
    assert resp.status_code == 400
    assert "corrupted" in resp.json()["detail"].lower()

def test_api_unsupported_mime():
    """Verify that non-image MIME types return 400."""
    resp = client.post(
        "/api/disease-detection",
        files={"image": ("doc.pdf", b"%PDF-1.4 header", "application/pdf")}
    )
    assert resp.status_code == 400
    assert "unsupported image mime type" in resp.json()["detail"].lower()

def test_api_synthetic_image():
    """Verify inference on a valid synthetic RGB image."""
    img = Image.new("RGB", (224, 224), color=(34, 139, 34))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)

    resp = client.post(
        "/api/disease-detection",
        files={"image": ("synthetic.jpg", buf.getvalue(), "image/jpeg")}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "result" in data
    assert "scores" in data
    assert len(data["scores"]) == 4
    assert len(data["rankedClasses"]) == 4
    assert 0.0 <= data["topScore"] <= 1.0
    assert data["limitationText"] != ""
    assert "YOLOv8n-cls" in data["modelVersion"]

def test_api_all_four_sample_classes():
    """Verify that the model accurately predicts real samples for all 4 trained pineapple classes."""
    if not SAMPLE_DIR.exists():
        pytest.skip("Sample test assets directory not found")

    sample_tests = {
        "blight_sample.jpg": "Pineapple__leaf_blight",
        "fusarium_sample.jpg": "Pineapple_fusarium",
        "healthy_sample.jpg": "Pineapple_healthy",
        "mealybug_wilt_sample.jpg": "Pineapple_mealybug_wilt",
    }

    for filename, expected_class in sample_tests.items():
        sample_path = SAMPLE_DIR / filename
        if not sample_path.exists():
            continue

        with open(sample_path, "rb") as f:
            resp = client.post(
                "/api/disease-detection",
                files={"image": (filename, f.read(), "image/jpeg")},
                data={"notes": f"Testing {filename}"}
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["topClass"] == expected_class
        assert data["topScore"] >= 0.85
        assert data["result"]["diseaseName"] != ""
        assert len(data["result"]["symptoms"]) > 0
        assert len(data["result"]["nextSteps"]) > 0
        assert len(data["result"]["prevention"]) > 0
        assert len(data["sources"]) > 0

def test_api_farm_and_plant_observation_association():
    """Verify that providing farm_id and plant_id generates a complete plant observation record."""
    if not SAMPLE_DIR.exists():
        pytest.skip("Sample test assets directory not found")

    sample_path = SAMPLE_DIR / "healthy_sample.jpg"
    with open(sample_path, "rb") as f:
        resp = client.post(
            "/api/disease-detection",
            files={"image": ("healthy_leaf.jpg", f.read(), "image/jpeg")},
            data={"farm_id": "farm-pineapple-plot", "plant_id": "R1-P5", "notes": "Row 1 inspection"}
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["observation"] is not None
    obs = data["observation"]
    assert obs["farm_id"] == "farm-pineapple-plot"
    assert obs["plant_id"] == "R1-P5"
    assert obs["status"] == "healthy"
    assert "Healthy pineapple leaf" in obs["condition"]
    assert "Row 1 inspection" in obs["notes"]

def test_health_check_endpoint():
    """Verify that GET /api/health returns complete status with both models active."""
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "online"
    assert data["custom_ml_model"]["custom_model_ready"] is True
    assert data["disease_detection_model"]["ready"] is True
    assert data["pineapple_suitability_model"]["model_ready"] is True
    assert data["farm_planner_model"]["ready"] is True
