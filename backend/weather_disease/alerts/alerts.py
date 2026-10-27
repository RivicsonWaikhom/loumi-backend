"""Alert dedupe/resolve. In-memory scaffold: persist before production."""
import time
RANK={"low":0,"moderate":1,"high":2}
class AlertStore:
    def __init__(self,cooldown_s=6*3600): self.active={}; self.cooldown=cooldown_s
    def evaluate(self,farm,risks,now=None):
        now=time.time() if now is None else now; out=[]
        for r in risks:
            k=(farm,r["disease_id"]); lvl=r["risk_level"]; cur=self.active.get(k)
            if lvl in("moderate","high"):
                if cur is None: self.active[k]={"level":lvl,"t":now}; out.append({"disease_id":k[1],"state":"new","level":lvl,"factors":r["contributing_factors"]})
                elif RANK[lvl]>RANK[cur["level"]] or now-cur["t"]>=self.cooldown:
                    cur.update(level=lvl,t=now); out.append({"disease_id":k[1],"state":"continuing","level":lvl,"factors":r["contributing_factors"]})
            elif cur is not None and lvl=="low":
                del self.active[k]; out.append({"disease_id":k[1],"state":"resolved","level":"low","factors":[]})
        return out
