"""FastAPI wrapper (NOT RUN in build env: fastapi missing). Run: uvicorn app.main:app  (from this folder)"""
import os
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from .risk_engine import engine, features
from .weather.openmeteo import OpenMeteo, WeatherError
from .alerts.alerts import AlertStore
ROOT=os.path.join(os.path.dirname(__file__),"..")
PROFILES=engine.load_profiles(os.path.join(ROOT,"configs","disease_profiles.json"))
app=FastAPI(title="Weather Disease Early Warning",version="0.1.0"); wx=OpenMeteo(); store=AlertStore()
class Req(BaseModel):
    latitude:float=Field(ge=-90,le=90); longitude:float=Field(ge=-180,le=180)
    crop:str="pineapple"; farm_id:str="demo"; flower_induction_date:str|None=None; drainage:str|None=None
@app.get("/health")
def health(): return {"service":"up","profiles":PROFILES["version"],"weather_provider":"open-meteo (unverified)","ml_model":"none trained"}
@app.get("/api/v1/models/info")
def info(): return {"engine":"evidence-based rules","trained_model":None,"profiles_version":PROFILES["version"],"classifier_map":PROFILES["classifier_map"]}
@app.post("/api/v1/disease-risk/predict")
def predict(r:Req):
    if r.crop!="pineapple": raise HTTPException(422,"only pineapple profiles exist")
    try: w=wx.hourly(r.latitude,r.longitude)
    except WeatherError as e: raise HTTPException(503,str(e))
    days=features.daily(w["hourly"]); today=w["today"]
    risks=engine.predict(PROFILES,days,r.model_dump(),today)
    return {"farm_id":r.farm_id,"crop":r.crop,"issued_at":datetime.now(timezone.utc).isoformat(),"weather":{"source":w["source"],"timezone":w["timezone"],"retrieved_at":w["retrieved_at"]},
            "disease_risks":risks,"alerts":store.evaluate(r.farm_id,risks),"engine_version":PROFILES["version"],"note":"Environmental favourability only; not a diagnosis."}
@app.get("/")
def ui(): return FileResponse(os.path.join(ROOT,"frontend","index.html"))
