"""Zero-dependency server: python -m app.server  ->  http://127.0.0.1:8000"""
import json,os,sys
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from urllib.parse import urlparse,parse_qs
from .risk_engine import engine
from .weather.openmeteo import OpenMeteo,WeatherError
from .alerts.alerts import AlertStore
from . import service
ROOT=os.path.join(os.path.dirname(__file__),"..")
def make_handler(wx,store,profiles):
    class H(BaseHTTPRequestHandler):
        def _send(self,code,obj=None,raw=None,ct="application/json"):
            b=raw if raw is not None else json.dumps(obj).encode()
            self.send_response(code); self.send_header("Content-Type",ct); self.send_header("Content-Length",str(len(b))); self.end_headers(); self.wfile.write(b)
        def do_GET(self):
            u=urlparse(self.path)
            if u.path=="/": return self._send(200,raw=open(os.path.join(ROOT,"frontend","index.html"),"rb").read(),ct="text/html; charset=utf-8")
            if u.path=="/health": return self._send(200,{"service":"up","profiles":profiles["version"],"ml_model":"none trained (no labelled data)"})
            if u.path=="/api/v1/geocode":
                try: return self._send(200,{"results":wx.geocode(parse_qs(u.query).get("q",[""])[0])})
                except WeatherError as e: return self._send(503,{"error":str(e)})
            self._send(404,{"error":"not found"})
        def do_POST(self):
            if urlparse(self.path).path!="/api/v1/disease-risk/predict": return self._send(404,{"error":"not found"})
            try:
                n=int(self.headers.get("Content-Length",0))
                if n>10_000: return self._send(413,{"error":"payload too large"})
                body=json.loads(self.rfile.read(n) or b"{}")
                self._send(200,service.assess(wx,store,profiles,body))
            except (ValueError,json.JSONDecodeError) as e: self._send(400,{"error":str(e)})
            except WeatherError as e: self._send(503,{"error":str(e)})
        def log_message(self,*a): pass
    return H
if __name__=="__main__":
    P=engine.load_profiles(os.path.join(ROOT,"configs","disease_profiles.json"))
    port=int(os.environ.get("PORT",8000)); print(f"LOUMI on http://127.0.0.1:{port}")
    ThreadingHTTPServer(("127.0.0.1",port),make_handler(OpenMeteo(),AlertStore(),P)).serve_forever()
