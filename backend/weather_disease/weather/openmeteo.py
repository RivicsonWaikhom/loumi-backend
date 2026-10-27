"""Open-Meteo adapter. Forecast/model data, not farm sensors."""
import json, urllib.request, urllib.parse, time

class WeatherError(Exception): pass

class OpenMeteo:
    attribution = "Weather data by Open-Meteo.com (model/forecast data, not farm sensors)"
    def __init__(self, ttl=900):
        self.ttl = ttl
        self.cache = {}

    def _open_url(self, url: str):
        req = urllib.request.Request(url, headers={"User-Agent": "LoumiAgricultureApp/1.0"})
        for attempt in range(3):
            try:
                with urllib.request.urlopen(req, timeout=12) as response:
                    return json.load(response)
            except Exception as e:
                if attempt == 2:
                    raise
                time.sleep(0.6 * (attempt + 1))

    def hourly(self, lat, lon, past_days=7, forecast_days=3):
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            raise WeatherError("invalid coordinates")
        k = (round(lat, 2), round(lon, 2))
        if k in self.cache and time.time() - self.cache[k][0] < self.ttl:
            return self.cache[k][1]

        q = urllib.parse.urlencode({
            "latitude": lat,
            "longitude": lon,
            "hourly": "temperature_2m,relative_humidity_2m,precipitation",
            "current": "temperature_2m,relative_humidity_2m,precipitation",
            "past_days": past_days,
            "forecast_days": forecast_days,
            "timezone": "auto",
        })
        try:
            j = self._open_url("https://api.open-meteo.com/v1/forecast?" + q)
        except Exception as e:
            # If cached data is available (even if expired), fallback to it
            if k in self.cache:
                return self.cache[k][1]
            raise WeatherError(f"provider unavailable: {e}")

        h = j.get("hourly", {})
        c = j.get("current") or {}
        if not c.get("time"):
            raise WeatherError("provider response missing current time")
        data = {
            "today": c["time"][:10],
            "current": {
                "time": c["time"],
                "temp_c": c.get("temperature_2m"),
                "rh": c.get("relative_humidity_2m"),
                "precip_mm": c.get("precipitation"),
            },
            "timezone": j.get("timezone"),
            "retrieved_at": time.time(),
            "source": self.attribution,
            "hourly": [
                {"time": t, "temp_c": a, "rh": b, "precip_mm": p}
                for t, a, b, p in zip(
                    h.get("time", []),
                    h.get("temperature_2m", []),
                    h.get("relative_humidity_2m", []),
                    h.get("precipitation", []),
                )
            ],
        }
        self.cache[k] = (time.time(), data)
        return data

    def geocode(self, name, count=5):
        if not name or len(name) > 100:
            raise WeatherError("invalid place name")
        u = "https://geocoding-api.open-meteo.com/v1/search?" + urllib.parse.urlencode({
            "name": name,
            "count": count,
        })
        try:
            j = self._open_url(u)
        except Exception as e:
            raise WeatherError(f"geocoding unavailable: {e}")
        return [
            {
                "name": r["name"],
                "admin": r.get("admin1"),
                "country": r.get("country"),
                "latitude": r["latitude"],
                "longitude": r["longitude"],
            }
            for r in j.get("results", [])
        ]

