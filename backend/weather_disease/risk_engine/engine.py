"""Evidence-based environmental favourability engine. NOT a validated outbreak probability."""
import json
from datetime import date, timedelta
from . import features as F
LV=["low","moderate","high"]
def load_profiles(path): return json.load(open(path))
def _res(pid,p,level,factors,lim,target="weather_favorability"):
    return {"disease_id":pid,"name":p["name"],"risk_level":level,"probability":None,"risk_score":None,"prediction_target":target,
      "contributing_factors":factors,"evidence_sources":p["evidence"],"limitations":lim+p["limitations"],"params_validated":p.get("params_validated")}
def evaluate(pid,p,days,ctx,today):
    if not p["assessable"]: return _res(pid,p,"not_assessable",[],["Weather alone cannot assess this disease."],"none")
    f=F.build(days,today); lim=[]
    if f["days_past"]<4: return _res(pid,p,"insufficient_data",[f"only {f['days_past']} past days of weather"],[])
    if not f["complete"]: lim.append("Recent weather has gaps; result less reliable.")
    r=p["rule"]; a=p["params"]
    if r=="wet_persistence":
        lvl=0; fac=[f"rain last 7d: {f['rain_7d_mm']:.1f} mm",f"consecutive wet days: {f['wet_run_days']}",f"forecast rain next 3d: {f['rain_fcst_3d_mm']:.1f} mm"]
        if f["rain_7d_mm"]>=a["rain_7d_mm_moderate"]: lvl=1
        if f["rain_7d_mm"]>=a["rain_7d_mm_high"] and f["wet_run_days"]>=a["wet_run_days_high"]: lvl=2
        if pid=="phytophthora_root_heart_rot":
            dr=ctx.get("drainage")
            if dr=="poor" and lvl<2: lvl+=1; fac.append("poor drainage raises risk one level (qualitative; Joy & Sindhu p.2)")
            if dr is None: lim.append("Drainage unknown; supply 'drainage' for a better assessment.")
        return _res(pid,p,LV[lvl],fac,lim)
    need=ctx.get("flower_induction_date")
    if not need: return _res(pid,p,"insufficient_data",["flower_induction_date not provided"],["Risk is stage-dependent."])
    fi=date.fromisoformat(need); t=date.fromisoformat(today); wk=(t-fi).days/7
    active=[w for w in a["windows_weeks"] if w[0]<=wk<=w[1]]
    if not active: return _res(pid,p,"low",[f"{wk:.1f} weeks after induction: outside susceptible windows"],lim)
    w=active[0]; ts=F.window_temps(days,fi+timedelta(weeks=w[0]),min(t,fi+timedelta(weeks=w[1])))
    if not ts: return _res(pid,p,"insufficient_data",["no temperature data in window"],lim)
    m=sum(ts)/len(ts)
    if r=="cool_window": ok=a["temp_lo"]<=m<=a["temp_hi"]; fac=[f"mean temp {m:.1f} C in window (weeks {w[0]}-{w[1]}); favourable band {a['temp_lo']}-{a['temp_hi']} C"]
    else: ok=m>=a["temp_warm"]; fac=[f"mean temp {m:.1f} C in window (weeks {w[0]}-{w[1]}); 'warm' placeholder >= {a['temp_warm']} C"]
    return _res(pid,p,"moderate" if ok else "low",fac+["level capped at moderate: sporadic disease"],lim)
def predict(profiles,days,ctx,today): return [evaluate(k,v,days,ctx,today) for k,v in profiles["diseases"].items()]
