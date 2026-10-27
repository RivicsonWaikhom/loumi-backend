import os
from pathlib import Path
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, field_validator

from backend.config import PORT, HOST, GEMINI_API_KEY, ML_MODEL_ENDPOINT
from backend.rag.retriever import AgricultureRAG
from backend.gemini_service import gemini_service
from backend.ml.model_runner import classifier
from backend.ml.suitability_runner import suitability_predictor
from backend.chatbot.provider import get_chatbot_provider
from backend.weather_disease import weather_disease_predictor
from backend.disease_detection import disease_inference_service, clip_image_validator
from backend.database import init_db
from backend.auth import (
    validate_email_format,
    create_user_record,
    get_user_by_email,
    verify_password,
    create_access_token,
    get_current_user,
    get_optional_current_user,
)
from backend.farm_service import (
    create_initial_user_farm,
    get_user_farms,
    get_user_farm,
    create_farm_for_user,
    update_farm_for_user,
    create_demo_farm_for_user,
    delete_user_farm,
    record_plant_observation,
    sync_local_farms_for_user,
)
from backend.farm_planner import (
    farm_planner_service,
    FarmPlannerPayload,
    is_model_ready,
    is_class_mapping_verified,
    run_prediction,
    validate_image_bytes,
    get_class_by_id,
    load_knowledge_base,
)

app = FastAPI(
    title="Loumi AI - Manipur Agriculture Chatbot",
    description="Farmer advisory chatbot for Rice & Pineapple farming in Manipur, India",
    version="1.0.0",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize persistent SQLite database
init_db()

@app.on_event("startup")
async def startup_event():
    # Load CLIP image validator and model once during backend startup
    try:
        clip_image_validator.load_model()
    except Exception as e:
        print(f"[Startup] CLIP image validator notice: {e}")

    try:
        disease_inference_service.get_model()
    except Exception as e:
        print(f"[Startup] YOLO model notice: {e}")

class SignUpPayload(BaseModel):
    full_name: str
    email: str
    password: str

class LoginPayload(BaseModel):
    email: str
    password: str

class ObservationPayload(BaseModel):
    status: str
    condition: Optional[str] = None
    confidence: Optional[float] = None
    notes: Optional[str] = None
    observed_at: Optional[str] = None

class FarmCreatePayload(BaseModel):
    name: str
    variety: Optional[str] = "Queen Pineapple"
    length: float
    breadth: float
    row_spacing: float
    plant_spacing: float
    clearance: Optional[float] = 0.5
    staggered: Optional[bool] = False
    planting_date: Optional[str] = None
    location: Optional[Dict[str, Any]] = None
    cor_A: Optional[Dict[str, Any]] = None
    cor_B: Optional[Dict[str, Any]] = None
    cor_C: Optional[Dict[str, Any]] = None
    corner_check: Optional[Dict[str, Any]] = None
    is_demo: Optional[bool] = False

class FarmUpdatePayload(BaseModel):
    name: Optional[str] = None
    variety: Optional[str] = None
    length: Optional[float] = None
    breadth: Optional[float] = None
    row_spacing: Optional[float] = None
    plant_spacing: Optional[float] = None
    clearance: Optional[float] = None
    staggered: Optional[bool] = None
    planting_date: Optional[str] = None
    plants: Optional[List[Dict[str, Any]]] = None

class SyncFarmsPayload(BaseModel):
    farms: List[Dict[str, Any]]

# ----------------- AUTHENTICATION ENDPOINTS -----------------

@app.post("/api/auth/signup")
def signup_endpoint(payload: SignUpPayload):
    name = (payload.full_name or "").strip()
    email = (payload.email or "").strip().lower()
    pwd = payload.password or ""

    if not name or len(name) < 2:
        raise HTTPException(status_code=400, detail="Full name must be at least 2 characters long.")
    if not validate_email_format(email):
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")
    if len(pwd) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")

    existing = get_user_by_email(email)
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email address already exists.")

    user = create_user_record(full_name=name, email=email, password=pwd)

    token = create_access_token({"sub": user["id"], "email": user["email"], "name": user["full_name"]})
    return {
        "token": token,
        "user": user,
        "message": "Account created successfully."
    }

@app.post("/api/auth/login")
def login_endpoint(payload: LoginPayload):
    email = (payload.email or "").strip().lower()
    pwd = payload.password or ""

    if not email or not pwd:
        raise HTTPException(status_code=400, detail="Email and password are required.")

    user = get_user_by_email(email)
    if not user or not verify_password(pwd, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token = create_access_token({"sub": user["id"], "email": user["email"], "name": user["full_name"]})
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "full_name": user["full_name"]
        },
        "message": "Logged in successfully."
    }

@app.get("/api/auth/me")
def get_me_endpoint(user: dict = Depends(get_current_user)):
    return {"user": user}

@app.post("/api/auth/logout")
def logout_endpoint():
    return {"message": "Logged out successfully."}

# ----------------- ISOLATED FARMS & PLANTS ENDPOINTS -----------------

@app.get("/api/farms")
def list_farms_endpoint(user: dict = Depends(get_current_user)):
    """Lists all farms belonging strictly to the authenticated user."""
    return get_user_farms(user["id"])

@app.post("/api/farms")
def create_farm_endpoint(payload: FarmCreatePayload, user: dict = Depends(get_current_user)):
    """Creates a new farm isolated to the authenticated user."""
    data = payload.model_dump() if hasattr(payload, "model_dump") else payload.dict()
    return create_farm_for_user(user["id"], data)

@app.get("/api/farms/{farm_id}")
def get_farm_endpoint(farm_id: str, user: dict = Depends(get_current_user)):
    """Fetches a specific farm with strict ownership verification."""
    farm = get_user_farm(user["id"], farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found or access denied.")
    return farm

@app.put("/api/farms/{farm_id}")
def update_farm_endpoint(farm_id: str, payload: FarmUpdatePayload, user: dict = Depends(get_current_user)):
    """Updates an existing farm ensuring strict user ownership."""
    data = payload.model_dump() if hasattr(payload, "model_dump") else payload.dict()
    clean_data = {k: v for k, v in data.items() if v is not None}
    try:
        updated = update_farm_for_user(user["id"], farm_id, clean_data)
        return updated
    except ValueError as ve:
        msg = str(ve)
        if "not found" in msg.lower() or "access denied" in msg.lower():
            raise HTTPException(status_code=404, detail=msg)
        raise HTTPException(status_code=400, detail=msg)

@app.post("/api/farms/demo")
def create_demo_farm_endpoint(user: dict = Depends(get_current_user)):
    """Creates a sample demo plot clearly marked with is_demo = True."""
    return create_demo_farm_for_user(user["id"], user.get("full_name"))

@app.delete("/api/farms/{farm_id}")
def delete_farm_endpoint(farm_id: str, user: dict = Depends(get_current_user)):
    """Deletes a farm with strict ownership verification."""
    deleted = delete_user_farm(user["id"], farm_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Farm not found or access denied.")
    return {"message": "Farm deleted successfully."}

@app.post("/api/farms/{farm_id}/plants/{plant_id}/observations")
def record_plant_obs_endpoint(
    farm_id: str,
    plant_id: str,
    payload: ObservationPayload,
    user: dict = Depends(get_current_user)
):
    """Records an observation on a plant with strict ownership verification."""
    try:
        obs = record_plant_observation(
            user_id=user["id"],
            farm_id=farm_id,
            plant_id=plant_id,
            status=payload.status,
            condition=payload.condition,
            confidence=payload.confidence,
            notes=payload.notes,
            observed_at=payload.observed_at,
        )
        return obs
    except PermissionError as pe:
        raise HTTPException(status_code=403, detail=str(pe))
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))

@app.post("/api/farms/sync")
def sync_farms_endpoint(payload: SyncFarmsPayload, user: dict = Depends(get_current_user)):
    """Seamlessly imports/migrates existing local farms to user's isolated account."""
    return sync_local_farms_for_user(user["id"], payload.farms)

class ChatHistoryItem(BaseModel):
    role: str
    content: str

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        r = v.strip().lower()
        if r not in ["user", "assistant", "model", "human"]:
            raise ValueError("Role must be 'user' or 'assistant'.")
        return "user" if r in ["user", "human"] else "assistant"

    @field_validator("content")
    @classmethod
    def validate_content(cls, v: str) -> str:
        cleaned = v.strip()
        if len(cleaned) > 4000:
            return cleaned[:4000]
        return cleaned

class ChatRequest(BaseModel):
    message: Optional[str] = None
    query: Optional[str] = None  # backward compatibility
    history: Optional[List[ChatHistoryItem]] = None
    language: Optional[str] = "en"
    top_k: Optional[int] = 4

    @field_validator("message", "query")
    @classmethod
    def validate_length(cls, v: Optional[str]) -> Optional[str]:
        if v and len(v) > 2000:
            raise ValueError("Message exceeds maximum allowed length of 2,000 characters.")
        return v

class ChatResponse(BaseModel):
    reply: str
    answer: str  # backward compatibility
    language: Optional[str] = "en"
    citations: Optional[List[Dict[str, Any]]] = None
    sources: Optional[List[str]] = None

@app.get("/api/health")
def health_check():
    rag = AgricultureRAG.get_instance()
    ml_status = classifier.get_status()
    provider = get_chatbot_provider()

    return {
        "status": "online",
        "service": "Loumi AI Agriculture MVP",
        "region": "Manipur, India",
        "crops": ["Rice (Paddy)", "Pineapple"],
        "gemini_api_configured": bool(GEMINI_API_KEY),
        "chatbot_provider_ready": provider.is_available(),
        "knowledge_base": rag.get_status(),
        "custom_ml_model": ml_status,
        "disease_detection_model": disease_inference_service.get_status(),
        "clip_image_validator": clip_image_validator.get_status(),
        "pineapple_suitability_model": suitability_predictor.get_status(),
        "weather_disease_early_warning": weather_disease_predictor.get_status(),
        "farm_planner_model": {
            "ready": is_model_ready(),
            "class_mapping_verified": is_class_mapping_verified(),
            "model_type": "YOLOv8n-cls (PyTorch)",
            "supported_classes": [
                "Pineapple__leaf_blight",
                "Pineapple_fusarium",
                "Pineapple_healthy",
                "Pineapple_mealybug_wilt"
            ]
        },
    }

@app.get("/api/documents")
def get_documents():
    rag = AgricultureRAG.get_instance()
    return rag.get_status()

@app.post("/api/documents/reindex")
def reindex_documents():
    rag = AgricultureRAG.get_instance()
    rag.reload()
    return {
        "message": "Knowledge base reindexed successfully.",
        "status": rag.get_status()
    }

@app.post("/api/chat", response_model=ChatResponse)
@app.post("/api/chatbot", response_model=ChatResponse)
def chat_endpoint(req: ChatRequest):
    user_text = (req.message or req.query or "").strip()
    if not user_text:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    provider = get_chatbot_provider()
    if not provider.is_available():
        raise HTTPException(
            status_code=503,
            detail="AI Chatbot provider is not configured. Please set CHATBOT_API_KEY (or GEMINI_API_KEY) in the backend .env file."
        )

    # Sanitize and truncate conversation history to most recent 20 turns
    history_turns = []
    if req.history:
        for turn in req.history[-20:]:
            history_turns.append({"role": turn.role, "content": turn.content})

    try:
        result = provider.generate_reply(
            message=user_text,
            history=history_turns,
            language=req.language or "en",
            top_k=req.top_k or 4,
        )
        reply_text = (result.get("reply") or result.get("answer") or "").strip()
        if not reply_text:
            raise HTTPException(status_code=502, detail="AI provider returned an empty response. Please try again.")

        citations_list = result.get("citations", [])
        sources_list = result.get("sources")
        if not sources_list and citations_list:
            sources_list = [
                f"{c['source']} (Page {c['page']})" if isinstance(c, dict) and "source" in c and "page" in c else str(c)
                for c in citations_list
            ]

        return ChatResponse(
            reply=reply_text,
            answer=reply_text,
            language=req.language or "en",
            citations=citations_list,
            sources=sources_list,
        )
    except HTTPException:
        raise
    except Exception as e:
        err_str = str(e)
        safe_msg = "An error occurred while communicating with the AI service. Please try again."
        if "429" in err_str or "quota" in err_str.lower():
            safe_msg = "AI provider rate limit reached. Please wait a moment and try again."
        elif "timeout" in err_str.lower():
            safe_msg = "AI provider request timed out. Please try again."
        elif "API_KEY" in err_str or "unauthorized" in err_str.lower() or "403" in err_str:
            safe_msg = "AI provider authentication failed. Please check provider credentials on the server."
        print(f"[Chatbot] Safe handled error: {err_str[:160]}")
        raise HTTPException(status_code=502, detail=safe_msg)

@app.post("/api/disease-detection")
@app.post("/api/disease-detection/diagnose")
@app.post("/api/predict")
async def disease_detection_endpoint(
    image: Optional[UploadFile] = File(None),
    file: Optional[UploadFile] = File(None),
    notes: Optional[str] = Form(None),
    farm_id: Optional[str] = Form(None),
    plant_id: Optional[str] = Form(None),
    captureSource: Optional[str] = Form(None),
    auth_user: Optional[dict] = Depends(get_optional_current_user),
):
    """
    Dedicated inference endpoint for pineapple disease detection using the trained
    YOLOv8n-cls model (model2_best.pt). Never returns simulated or hardcoded predictions.
    Supports secure user data isolation when associating results with farm plants.
    """
    upload = image or file
    if upload is None:
        raise HTTPException(
            status_code=400,
            detail="Image file is required. Upload an image using form field 'image' or 'file'."
        )

    # When associating observation with a specific farm plant, enforce authentication and ownership
    if farm_id and plant_id:
        if not auth_user:
            raise HTTPException(
                status_code=401,
                detail="Authentication required to associate plant observations with a farm."
            )
        farm = get_user_farm(auth_user["id"], farm_id)
        if not farm:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to record observations on this farm."
            )

    try:
        content = await upload.read()
        res = disease_inference_service.predict(
            image_bytes=content,
            content_type=upload.content_type or "",
            filename=upload.filename or "leaf.jpg",
            notes=notes,
            farm_id=farm_id,
            plant_id=plant_id,
        )

        # If farm and plant specified and user authenticated, persist observation in DB
        if farm_id and plant_id and auth_user and res.get("observation"):
            obs_info = res["observation"]
            try:
                db_obs = record_plant_observation(
                    user_id=auth_user["id"],
                    farm_id=farm_id,
                    plant_id=plant_id,
                    status=obs_info["status"],
                    condition=obs_info.get("condition"),
                    confidence=obs_info.get("confidence"),
                    notes=obs_info.get("notes"),
                    observed_at=obs_info.get("observed_at"),
                )
                res["observation"] = db_obs
            except Exception as e:
                print(f"[DiseaseDetection] DB observation notice: {e}")

        return res
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")

@app.post("/api/diagnose")
async def diagnose_image(
    file: UploadFile = File(...),
    notes: Optional[str] = Form(""),
    language: Optional[str] = Form("en"),
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be an image.")

    image_bytes = await file.read()
    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty image file received.")

    # 1. Run Custom ML Model classifier (Never fakes predictions!)
    ml_result = classifier.predict(image_bytes, filename=file.filename or "leaf.jpg")

    # 2. Run Gemini Multimodal Visual advisory (with clear disclaimers)
    ai_obs = gemini_service.diagnose_leaf_image(
        image_bytes=image_bytes,
        mime_type=file.content_type,
        user_notes=notes or "",
        language=language or "en",
    )

    return {
        "filename": file.filename,
        "custom_ml_prediction": ml_result,
        "ai_visual_observation": ai_obs,
        "disclaimer": (
            "Integrity notice: The custom ML classifier slot is modular and awaits model weights "
            "from the friend's training pipeline. No predictions are fabricated. "
            "AI visual observation provides agronomic symptom guidance referencing official guidebooks."
        )
    }

class VarietySuitabilityPayload(BaseModel):
    state: Optional[str] = "Manipur"
    district: Optional[str] = "Imphal West"
    village: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    soilType: Optional[str] = None
    soilPH: Optional[float] = None
    soilDrainage: Optional[str] = None
    waterAvailability: Optional[str] = None
    temperatureMin: Optional[float] = None
    temperatureMax: Optional[float] = None
    rainfall: Optional[float] = None
    plantingSeason: Optional[str] = None
    elevation: Optional[float] = None
    farmArea: Optional[float] = None
    preferredVariety: Optional[str] = None
    intendedUse: Optional[str] = None
    notes: Optional[str] = None
    nitrogen: Optional[float] = None
    phosphorus: Optional[float] = None
    potassium: Optional[float] = None

    @field_validator("nitrogen", "phosphorus", "potassium")
    @classmethod
    def validate_nutrients(cls, v):
        if v is not None:
            if v < 0:
                raise ValueError("Soil nutrient value cannot be negative.")
        return v

@app.post("/api/variety-suitability")
def variety_suitability_endpoint(payload: VarietySuitabilityPayload):
    """
    Evaluates pineapple farming suitability using the trained Random Forest classifier
    and recommends optimal pineapple varieties (Queen and Kew) based on ICAR/MOMA guidelines.
    Never fabricates predictions if the model is not loaded.
    """
    if not suitability_predictor.is_ready():
        raise HTTPException(
            status_code=503,
            detail=(
                "Pineapple variety suitability model is not loaded. "
                "Ensure pineapple_suitability_model.pkl is placed in backend/ml/weights/."
            )
        )

    try:
        data = payload.model_dump() if hasattr(payload, "model_dump") else payload.dict()
        response = suitability_predictor.predict(data)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")


# -------------------------------------------------------------
# Weather & Weather Disease Early Warning Endpoints
# -------------------------------------------------------------

@app.get("/api/weather")
def get_weather_endpoint(
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
):
    actual_lat = lat if lat is not None else latitude
    actual_lon = lon if lon is not None else longitude
    if actual_lat is None or actual_lon is None:
        raise HTTPException(400, "latitude and longitude parameters are required.")
    try:
        w = weather_disease_predictor.wx.hourly(actual_lat, actual_lon)
        c = w.get("current") or {}
        hourly = w.get("hourly") or []
        temps = [h["temp_c"] for h in hourly if h.get("temp_c") is not None]
        precips = [h["precip_mm"] for h in hourly if h.get("precip_mm") is not None]
        temp_min = min(temps) if temps else c.get("temp_c")
        temp_max = max(temps) if temps else c.get("temp_c")
        period_rain = sum(precips) if precips else (c.get("precip_mm") or 0.0)

        # Regional annual rainfall baseline (Manipur agro-climatic normal ~1650-1850mm)
        if 23.5 <= actual_lat <= 26.0 and 92.5 <= actual_lon <= 95.0:
            annual_est = 1650.0 if actual_lat < 24.8 else 1850.0
        else:
            annual_est = 1500.0

        return {
            "temperatureC": c.get("temp_c"),
            "humidity": c.get("rh"),
            "rainfallMm": c.get("precip_mm"),
            "temperatureMin": round(temp_min, 1) if temp_min is not None else None,
            "temperatureMax": round(temp_max, 1) if temp_max is not None else None,
            "periodRainfallMm": round(period_rain, 1),
            "estimatedAnnualRainfall": round(annual_est, 1),
            "current": c,
            "timezone": w.get("timezone"),
            "source": w.get("source"),
        }
    except Exception as e:
        raise HTTPException(503, f"Weather service error: {str(e)}")


@app.get("/api/weather/geocode")
def geocode_endpoint(q: str):
    if not q or not q.strip():
        raise HTTPException(400, "Query parameter 'q' cannot be empty.")
    try:
        results = weather_disease_predictor.wx.geocode(q.strip())
        return {"results": results}
    except Exception as e:
        raise HTTPException(503, f"Geocoding error: {str(e)}")


class WeatherDiseasePayload(BaseModel):
    state: Optional[str] = None
    district: Optional[str] = None
    village: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    crop: Optional[str] = "pineapple"
    farm_id: Optional[str] = "demo"
    flower_induction_date: Optional[str] = None
    drainage: Optional[str] = None
    forecastDays: Optional[int] = 7
    weather: Optional[Dict[str, Any]] = None


@app.post("/api/weather-disease-prediction")
@app.post("/api/v1/disease-risk/predict")
def weather_disease_prediction_endpoint(payload: WeatherDiseasePayload):
    """
    Evaluates pineapple disease early-warning risk based on local weather conditions,
    crop stage (flower induction date), and soil drainage.
    """
    if not weather_disease_predictor.is_ready():
        raise HTTPException(
            503,
            "Weather disease early warning model is not loaded. Ensure disease_profiles.json is present."
        )

    try:
        data = payload.model_dump() if hasattr(payload, "model_dump") else payload.dict()
        res = weather_disease_predictor.predict(data)
        return res
    except ValueError as ve:
        raise HTTPException(400, str(ve))
    except Exception as e:
        raise HTTPException(503, f"Weather disease prediction service error: {str(e)}")


# -------------------------------------------------------------
# Farm Planner Endpoints
# -------------------------------------------------------------

@app.post("/api/farm-planner")
def farm_planner_endpoint(payload: FarmPlannerPayload):
    """
    Generates tailored pineapple farm plan, double-row bed geometry,
    timeline, NIPHM S1 tasks, and budget estimates.
    """
    try:
        data = payload.model_dump() if hasattr(payload, "model_dump") else payload.dict()
        res = farm_planner_service.generate_plan(data)
        return res
    except ValueError as ve:
        raise HTTPException(400, str(ve))
    except Exception as e:
        raise HTTPException(500, f"Farm planner service error: {str(e)}")


@app.post("/api/farm-planner/diagnose")
@app.post("/api/farm-planner/leaf-check")
async def farm_planner_diagnose_endpoint(file: UploadFile = File(...)):
    """
    Runs leaf diagnosis using the trained YOLOv8n-cls model checkpoint (model2_best.pt).
    Returns class probabilities, uncalibrated score assessment, and non-chemical
    advisory from the NIPHM/ICAR knowledge base.
    """
    if not is_model_ready():
        raise HTTPException(
            503,
            "Farm Planner leaf disease classifier is not ready. Ensure model2_best.pt is in backend/farm_planner/models/."
        )
    try:
        content = await file.read()
        image = validate_image_bytes(content, file.content_type or "")
        pred = run_prediction(image)

        if pred.get("validation") and not pred["validation"].get("is_valid_leaf"):
            return pred

        top_class = pred.get("top_class", "")
        kb_entry = get_class_by_id(top_class)
        if kb_entry:
            pred["knowledge_base"] = {
                "display_name": kb_entry.get("display_name"),
                "explanation": kb_entry.get("explanation"),
                "symptoms": kb_entry.get("symptoms", []),
                "look_alikes": kb_entry.get("look_alikes", []),
                "field_actions": kb_entry.get("field_actions", []),
                "prevention": kb_entry.get("prevention", []),
                "diagnostic_questions": kb_entry.get("diagnostic_questions", [])
            }

        return pred
    except ValueError as ve:
        raise HTTPException(400, str(ve))
    except Exception as e:
        raise HTTPException(500, f"Inference error: {str(e)}")


@app.get("/api/farm-planner/knowledge-base")
def farm_planner_kb_endpoint():
    """Returns the verified knowledge base metadata and classes."""
    try:
        kb = load_knowledge_base()
        return {
            "schema_version": kb.get("schema_version"),
            "last_verified": kb.get("last_verified"),
            "classes": kb.get("classes", []),
            "sources": kb.get("sources", {})
        }
    except Exception as e:
        raise HTTPException(500, f"Failed to load knowledge base: {str(e)}")


# Mount static frontend files if built
frontend_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host=HOST, port=PORT, reload=True)
