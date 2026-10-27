"""Framework-free service logic (shared by stdlib server and FastAPI wrapper)."""
import time
from datetime import date, datetime, timezone
from .risk_engine import engine, features
def assess(wx,store,profiles,body):
    try: lat=float(body.get("latitude")); lon=float(body.get("longitude"))
    except (TypeError,ValueError): raise ValueError("latitude and longitude must be numbers")
    if not(-90<=lat<=90 and -180<=lon<=180): raise ValueError("coordinates out of range")
    if body.get("crop","pineapple")!="pineapple": raise ValueError("only pineapple profiles exist")
    fi=body.get("flower_induction_date") or None
    if fi:
        try: date.fromisoformat(fi)
        except ValueError: raise ValueError("flower_induction_date must be YYYY-MM-DD")
    dr=body.get("drainage") or None
    if dr not in(None,"poor","good"): raise ValueError("drainage must be poor, good or omitted")
    w=wx.hourly(lat,lon)                      # raises WeatherError -> caller returns 503
    days=features.daily(w["hourly"]); today=w["today"]
    ctx={"flower_induction_date":fi,"drainage":dr}
    risks=engine.predict(profiles,days,ctx,today); f=features.build(days,today)
    farm=str(body.get("farm_id","demo"))[:64]
    return {"farm_id":farm,"crop":"pineapple","issued_at":datetime.now(timezone.utc).isoformat(),
      "weather":{"source":w["source"],"timezone":w["timezone"],"local_date":today,"retrieved_age_s":round(time.time()-w["retrieved_at"]),"kind":"forecast/model data, not farm sensors"},
      "current":w["current"],"summary":{"rain_7d_mm":round(f["rain_7d_mm"],1),"rain_fcst_3d_mm":round(f["rain_fcst_3d_mm"],1),"wet_run_days":f["wet_run_days"],"complete":f["complete"]},
      "disease_risks":risks,"alerts":store.evaluate(farm,risks),"engine_version":profiles["version"],
      "note":"Environmental favourability only; not a diagnosis."}
