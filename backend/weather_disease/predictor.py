import os
import json
import time
from datetime import date, datetime, timezone
from typing import Dict, Any, Optional, List

from .risk_engine import engine, features
from .weather.openmeteo import OpenMeteo, WeatherError
from .alerts.alerts import AlertStore

DISEASE_RECOMMENDATIONS = {
    "phytophthora_root_heart_rot": [
        "Check field drainage; raised beds of at least 20 cm help prevent waterlogging",
        "Avoid deep planting and keep soil out of plant hearts during cultivation",
        "Inspect plants regularly for yellowing or browning heart leaves",
        "Consult local agriculture extension officer before applying any fungicide"
    ],
    "base_butt_rot": [
        "Cure planting-material bases in the sun or shade before planting to heal cuts",
        "Avoid planting or handling slips/suckers during wet, showery weather",
        "Inspect stored slips and crowns carefully for grey-black rot symptoms"
    ],
    "fruitlet_core_rot": [
        "Inspect developing fruit through the flowering and fruit initiation period",
        "Check for mite damage on leaf hairs and young fruitlets",
        "Consult local agriculture extension officer about biological or mite control"
    ],
    "fusariosis": [
        "Inspect fruit and stems for insect injuries and gum exudate (gummosis)",
        "Use certified clean, disease-free planting material",
        "Consult local agricultural authority for timing of protective measures"
    ],
    "mealybug_wilt": [
        "Scout field for mealybug colonies and associated ant activity",
        "Source slips and suckers from certified wilt-free mother plants",
        "Rogue and remove severely infected plants early to prevent spread"
    ],
    "leaf_blight": [
        "Maintain routine scouting of outer leaves for fungal spots and lesions",
        "Confirm leaf symptoms with photographic leaf diagnosis check"
    ]
}

class WeatherDiseasePredictor:
    """
    Integrates the evidence-based Pineapple Weather Disease Early Warning Model
    with Open-Meteo local weather forecasts, geocoding, and alert tracking.
    """

    def __init__(self, profiles_path: Optional[str] = None):
        if not profiles_path:
            pkg_dir = os.path.dirname(__file__)
            candidate_1 = os.path.join(pkg_dir, "configs", "disease_profiles.json")
            candidate_2 = r"D:\LoumiWebsite\Models\weather_disease_early_warning\configs\disease_profiles.json"
            profiles_path = candidate_1 if os.path.exists(candidate_1) else candidate_2

        if not os.path.exists(profiles_path):
            raise FileNotFoundError(f"Disease profiles config not found at: {profiles_path}")

        self.profiles = engine.load_profiles(profiles_path)
        self.wx = OpenMeteo(ttl=900)
        self.store = AlertStore(cooldown_s=6 * 3600)
        self.profiles_path = profiles_path

    def is_ready(self) -> bool:
        return bool(self.profiles and "diseases" in self.profiles)

    def get_status(self) -> Dict[str, Any]:
        return {
            "ready": self.is_ready(),
            "engine": "evidence-based rules",
            "version": self.profiles.get("version", "unknown"),
            "crop": self.profiles.get("crop", "pineapple"),
            "diseases_count": len(self.profiles.get("diseases", {})),
            "classifier_map": self.profiles.get("classifier_map", {}),
        }

    def predict(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Assesses pineapple disease risk using location and Open-Meteo weather.
        Supports automatic geocoding from state/district/village if lat/lon is omitted.
        """
        lat = payload.get("latitude")
        lon = payload.get("longitude")

        # Automatic geocoding if lat/lon not directly provided
        if lat is None or lon is None:
            village = (payload.get("village") or "").strip()
            district = (payload.get("district") or "").strip()
            state = (payload.get("state") or "").strip()

            candidates = []
            if village:
                candidates.append(village)
            if district:
                candidates.append(district)
                # Strip cardinal suffixes (e.g. "Imphal West" -> "Imphal")
                for sfx in [" West", " East", " North", " South", " District", " Central"]:
                    if sfx in district:
                        simplified = district.replace(sfx, "").strip()
                        if simplified:
                            candidates.append(simplified)
            if state:
                candidates.append(state)

            for cand in candidates:
                try:
                    geo_results = self.wx.geocode(cand, count=1)
                    if geo_results:
                        lat = geo_results[0]["latitude"]
                        lon = geo_results[0]["longitude"]
                        break
                except Exception:
                    continue

        if lat is None or lon is None:
            raise ValueError("Coordinates are required. Please provide latitude & longitude or enter a searchable location (e.g. State / District).")

        try:
            lat = float(lat)
            lon = float(lon)
        except (TypeError, ValueError):
            raise ValueError("Latitude and longitude must be valid numbers.")

        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            raise ValueError(f"Coordinates out of range: lat={lat}, lon={lon}")

        crop = payload.get("crop", "pineapple")
        if crop != "pineapple":
            raise ValueError(f"Only pineapple profiles currently exist. Received: {crop}")

        fi = payload.get("flower_induction_date") or None
        if fi:
            try:
                date.fromisoformat(fi)
            except ValueError:
                raise ValueError("flower_induction_date must be formatted as YYYY-MM-DD")

        dr = payload.get("drainage") or None
        if dr not in (None, "poor", "good"):
            raise ValueError("drainage must be 'poor', 'good', or omitted")

        farm_id = str(payload.get("farm_id") or "default_farm")[:64]

        # Retrieve weather via OpenMeteo
        try:
            w = self.wx.hourly(lat, lon)
        except WeatherError as we:
            # Check if user provided manual weather fallback in payload
            manual_wx = payload.get("weather") or {}
            if manual_wx.get("temperatureC") is not None and manual_wx.get("rainfallMm") is not None:
                w = self._synthetic_weather_from_manual(manual_wx)
            else:
                raise we

        days = features.daily(w["hourly"])
        today = w["today"]
        ctx = {"flower_induction_date": fi, "drainage": dr}

        raw_risks = engine.predict(self.profiles, days, ctx, today)
        f = features.build(days, today)
        alerts = self.store.evaluate(farm_id, raw_risks)

        # Build formatted risks for both Loumi frontend contract and raw model consumers
        formatted_risks: List[Dict[str, Any]] = []
        for r in raw_risks:
            disease_id = r["disease_id"]
            rec_actions = DISEASE_RECOMMENDATIONS.get(disease_id, [])
            if r["risk_level"] == "insufficient_data":
                rec_actions = ["Provide the missing crop parameters (e.g. flower induction date) or await complete weather data."]

            formatted_risks.append({
                "disease": r["name"],
                "diseaseId": disease_id,
                "riskLevel": r["risk_level"],
                "probability": r["probability"],
                "riskScore": self._calculate_risk_score(r["risk_level"]),
                "contributingConditions": r["contributing_factors"],
                "riskFactors": r.get("limitations", []),
                "preventiveActions": rec_actions,
                "monitoringRecommendations": [
                    f"Evidence: {ev['claim']} ({ev['src']})"
                    for ev in r.get("evidence_sources", [])
                ],
                "evidenceSources": r.get("evidence_sources", []),
                "limitations": r.get("limitations", []),
                "paramsValidated": r.get("params_validated", False),
            })

        current_wx = w.get("current") or {}
        weather_conditions = {
            "temperatureC": current_wx.get("temp_c"),
            "humidity": current_wx.get("rh"),
            "rainfallMm": round(f.get("rain_7d_mm", 0), 1),
            "observed": True,
            "source": w.get("source"),
            "timezone": w.get("timezone"),
            "localDate": today,
        }

        issued_time = datetime.now(timezone.utc).isoformat()

        return {
            # Loumi Web API contract
            "risks": formatted_risks,
            "weather": weather_conditions,
            "predictionTimestamp": issued_time,
            "forecastPeriod": "Past 7 days to next 3 days",
            "notes": [
                "Environmental favourability only; not a diagnosis.",
                f"Rain in last 7 days: {f.get('rain_7d_mm', 0):.1f} mm | Forecast next 3 days: {f.get('rain_fcst_3d_mm', 0):.1f} mm | Consecutive wet days: {f.get('wet_run_days', 0)}"
            ],
            # Raw model transparency
            "farm_id": farm_id,
            "crop": crop,
            "latitude": lat,
            "longitude": lon,
            "disease_risks": raw_risks,
            "alerts": alerts,
            "summary": {
                "rain_7d_mm": round(f["rain_7d_mm"], 1),
                "rain_fcst_3d_mm": round(f["rain_fcst_3d_mm"], 1),
                "wet_run_days": f["wet_run_days"],
                "complete": f["complete"],
            },
            "engine_version": self.profiles.get("version"),
            "note": "Environmental favourability only; not a diagnosis.",
        }

    def _calculate_risk_score(self, risk_level: str) -> int:
        scores = {
            "high": 92,
            "moderate": 55,
            "low": 18,
            "insufficient_data": 0,
            "not_assessable": 0,
        }
        return scores.get(risk_level, 0)

    def _synthetic_weather_from_manual(self, manual: Dict[str, Any]) -> Dict[str, Any]:
        """Constructs synthetic 10-day hourly weather for offline testing with user inputs."""
        today = date.today().isoformat()
        temp = float(manual.get("temperatureC") or 25.0)
        rh = float(manual.get("humidity") or 75.0)
        rain_total = float(manual.get("rainfallMm") or 0.0)

        hourly = []
        for day_offset in range(-7, 4):
            day_d = date.fromordinal(date.today().toordinal() + day_offset)
            d_str = day_d.isoformat()
            p_hour = (rain_total / 7.0) / 24.0 if day_offset <= 0 else 0.0
            for h in range(24):
                hourly.append({
                    "time": f"{d_str}T{h:02d}:00",
                    "temp_c": temp,
                    "rh": rh,
                    "precip_mm": p_hour,
                })

        return {
            "today": today,
            "current": {"time": f"{today}T12:00", "temp_c": temp, "rh": rh, "precip_mm": 0.0},
            "timezone": "UTC",
            "retrieved_at": time.time(),
            "source": "Manual user weather input",
            "hourly": hourly,
        }

# Global singleton instance
weather_disease_predictor = WeatherDiseasePredictor()
