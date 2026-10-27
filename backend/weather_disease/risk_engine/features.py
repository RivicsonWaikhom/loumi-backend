"""Daily aggregation + weather features (stdlib). Hourly dicts: {time:'YYYY-MM-DDTHH:MM' local, temp_c, rh, precip_mm}."""
from datetime import date, timedelta
def daily(hourly):
    g={}
    for h in hourly: g.setdefault(h["time"][:10],[]).append(h)
    def avg(v): v=[x for x in v if x is not None]; return sum(v)/len(v) if v else None
    out={}
    for d,hs in sorted(g.items()):
        p=[x["precip_mm"] for x in hs if x.get("precip_mm") is not None]
        out[d]={"tmean":avg([x.get("temp_c") for x in hs]),"rh":avg([x.get("rh") for x in hs]),"precip":sum(p) if p else None,"hours":len(hs)}
    return out
def _d(s): return date.fromisoformat(s)
def build(days,today):
    t=_d(today); past=[(d,v) for d,v in days.items() if t-timedelta(days=6)<=_d(d)<=t]
    fut=[(d,v) for d,v in days.items() if t<_d(d)<=t+timedelta(days=3)]
    rain=lambda xs:sum(v["precip"] or 0 for _,v in xs); run=0
    for d in sorted(days,reverse=True):
        if _d(d)>t: continue
        if (days[d]["precip"] or 0)>=1.0: run+=1
        else: break
    return {"rain_7d_mm":rain(past),"rain_fcst_3d_mm":rain(fut),"wet_run_days":run,"days_past":len(past),
            "complete":len(past)>=6 and all(v["hours"]>=20 for _,v in past)}
def window_temps(days,start,end):
    return [v["tmean"] for d,v in days.items() if start<=_d(d)<=end and v["tmean"] is not None]
