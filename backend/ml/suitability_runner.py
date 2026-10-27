import os
import joblib
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

VARIETY_PROFILES = {
    "Queen": {
        "optimal_temp_min": 15.0,
        "optimal_temp_max": 32.0,
        "optimal_rainfall_min": 1200.0,
        "optimal_rainfall_max": 2500.0,
        "optimal_soil_ph_min": 5.0,
        "optimal_soil_ph_max": 6.0,
        "preferred_soil_types": ["Red Sandy Loam", "Laterite", "Clay Loam", "Sandy Loam"],
        "preferred_drainage": "Excellent",
        "description": "Highly aromatic, golden yellow flesh, high sweetness. Best for fresh consumption; thrives on hill slopes and well-drained tracts of Manipur (Thoubal, Churachandpur).",
        "source": "ICAR Manipur Centre & MOMA Organic Cultivation Guidelines",
    },
    "Kew": {
        "optimal_temp_min": 18.0,
        "optimal_temp_max": 35.0,
        "optimal_rainfall_min": 1500.0,
        "optimal_rainfall_max": 3000.0,
        "optimal_soil_ph_min": 4.5,
        "optimal_soil_ph_max": 5.5,
        "preferred_soil_types": ["Loamy", "Sandy Loam", "Clay Loam"],
        "preferred_drainage": "Good",
        "description": "Large-sized, fiberless, juice-rich variety highly suitable for canning and processing. Thrives in valley floors and foothills.",
        "source": "Central Agricultural University (CAU), Imphal & KAU Pineapple Research Station",
    },
}

class PineappleSuitabilityPredictor:
    """
    Pineapple Variety Suitability Predictor.
    Loads and runs the trained RandomForestClassifier model (pineapple_suitability_model.pkl)
    and pairs it with transparent agronomic variety matching for Queen and Kew pineapples.
    Never fabricates predictions if the model is not loaded.
    """
    def __init__(self, model_path: Optional[str] = None):
        self.model_path = self._resolve_model_path(model_path)
        self.model = None
        self.feature_columns: List[str] = []
        self.load_error: Optional[str] = None
        self._load_model()

    def _resolve_model_path(self, override_path: Optional[str]) -> Path:
        if override_path:
            return Path(override_path)
        env_path = os.getenv("SUITABILITY_MODEL_PATH")
        if env_path:
            return Path(env_path)
        base_dir = Path(__file__).resolve().parent.parent
        candidates = [
            base_dir / "ml" / "weights" / "pineapple_suitability_model.pkl",
            Path(r"D:\Loumi\backend\ml\weights\pineapple_suitability_model.pkl"),
            Path(r"D:\LoumiWebsite\backend\ml\weights\pineapple_suitability_model.pkl"),
            Path(r"D:\VArietyPineapple\pineapple_suitability_model.pkl"),
        ]
        for c in candidates:
            if c.exists():
                return c
        return candidates[0]

    def _load_model(self):
        try:
            if not self.model_path.exists():
                self.load_error = f"Model file not found at {self.model_path}"
                print(f"[Suitability ML] Warning: {self.load_error}")
                return

            self.model = joblib.load(self.model_path)
            if hasattr(self.model, "feature_names_in_"):
                self.feature_columns = list(self.model.feature_names_in_)
            else:
                self.feature_columns = []
            print(f"[Suitability ML] Successfully loaded model from {self.model_path} ({len(self.feature_columns)} features)")
        except Exception as e:
            self.load_error = f"Failed to load model: {str(e)}"
            self.model = None
            print(f"[Suitability ML] Error: {self.load_error}")

    def is_ready(self) -> bool:
        return self.model is not None

    def get_status(self) -> Dict[str, Any]:
        return {
            "model_ready": self.is_ready(),
            "model_path": str(self.model_path) if self.model_path else None,
            "crop": "Pineapple",
            "supported_varieties": ["Queen", "Kew"],
            "features_count": len(self.feature_columns),
            "error": self.load_error,
        }

    def _normalize_soil_type(self, raw: Optional[str]) -> str:
        if not raw:
            return "Clay Loam"
        s = raw.lower().replace("-", " ").replace("_", " ").strip()
        if "red" in s and "sandy" in s:
            return "Red Sandy Loam"
        if "sandy loam" in s or s == "sandy_loam":
            return "Sandy Loam"
        if "sandy" in s:
            return "Sandy Loam"
        if "clay loam" in s or s == "clay_loam":
            return "Clay Loam"
        if "heavy clay" in s or "clay" in s:
            return "Heavy Clay"
        if "laterite" in s:
            return "Laterite"
        if "loam" in s:
            return "Loamy"
        if "gravel" in s:
            return "Gravelly"
        return "Clay Loam"

    def _normalize_drainage(self, raw: Optional[str]) -> str:
        if not raw:
            return "Good"
        d = raw.lower().strip()
        if d in ["excellent"]:
            return "Excellent"
        if d in ["good"]:
            return "Good"
        if d in ["moderate", "fair"]:
            return "Fair"
        if d in ["poor"]:
            return "Poor"
        return "Good"

    def _normalize_month(self, planting_season: Optional[str], default_month: str = "April") -> str:
        if not planting_season:
            return default_month
        s = planting_season.lower().strip()
        month_map = {
            "january": "January", "february": "February", "march": "March",
            "april": "April", "may": "May", "june": "June",
            "july": "July", "august": "August", "september": "September",
            "october": "October", "november": "November", "december": "December",
            "pre_monsoon": "March",
            "monsoon": "July",
            "post_monsoon": "October",
            "current_season": "October",
            "other": "April",
        }
        return month_map.get(s, default_month)

    def predict(self, data: Dict[str, Any]) -> Dict[str, Any]:
        if not self.is_ready():
            raise RuntimeError(
                f"Pineapple suitability model is not loaded: {self.load_error or 'Weights file missing'}"
            )

        missing_measurements: List[str] = []

        # 1. Extract numerical inputs with realistic agro-climatic fallbacks for Manipur
        # Tracking what was explicitly supplied vs defaulted
        is_temp_min_prov = data.get("temperatureMin") is not None or data.get("temp_min") is not None
        temp_min = data.get("temperatureMin") or data.get("temp_min")
        if not is_temp_min_prov:
            temp_min = 17.5  # Manipur valley average min temp
            missing_measurements.append("Minimum temperature (used regional agro-climatic baseline 17.5°C)")
        else:
            temp_min = float(temp_min)

        is_temp_max_prov = data.get("temperatureMax") is not None or data.get("temp_max") is not None
        temp_max = data.get("temperatureMax") or data.get("temp_max")
        if not is_temp_max_prov:
            temp_max = 30.0  # Manipur valley average max temp
            missing_measurements.append("Maximum temperature (used regional agro-climatic baseline 30.0°C)")
        else:
            temp_max = float(temp_max)

        is_rainfall_prov = data.get("rainfall") is not None
        rainfall = data.get("rainfall")
        if not is_rainfall_prov:
            rainfall = 1600.0  # Manipur valley normal annual precipitation
            missing_measurements.append("Annual rainfall (used regional normal 1600 mm)")
        else:
            rainfall = float(rainfall)

        is_ph_prov = data.get("soilPH") is not None or data.get("soil_ph") is not None
        soil_ph = data.get("soilPH") or data.get("soil_ph")
        if not is_ph_prov:
            soil_ph = 5.2  # Typical acidic red/valley soil of Manipur
            missing_measurements.append("Soil pH (used representative regional baseline 5.2; laboratory soil test advised)")
        else:
            soil_ph = float(soil_ph)

        is_elevation_prov = data.get("elevation") is not None
        elevation = data.get("elevation")
        if not is_elevation_prov:
            elevation = 780.0  # Imphal valley baseline elevation in meters
        else:
            elevation = float(elevation)

        # Standard secondary soil metrics (incorporating NPK from soil test report when provided)
        humidity = float(data.get("humidity") if data.get("humidity") is not None else 80.0)

        is_n_prov = data.get("nitrogen") is not None
        if is_n_prov:
            try:
                nitrogen = float(data.get("nitrogen"))
            except (ValueError, TypeError):
                nitrogen = 80.0
                is_n_prov = False
        else:
            nitrogen = 80.0  # Regional baseline for Manipur soils

        is_p_prov = data.get("phosphorus") is not None
        if is_p_prov:
            try:
                phosphorus = float(data.get("phosphorus"))
            except (ValueError, TypeError):
                phosphorus = 40.0
                is_p_prov = False
        else:
            phosphorus = 40.0

        is_k_prov = data.get("potassium") is not None
        if is_k_prov:
            try:
                potassium = float(data.get("potassium"))
            except (ValueError, TypeError):
                potassium = 100.0
                is_k_prov = False
        else:
            potassium = 100.0

        soil_moisture = float(data.get("soil_moisture") if data.get("soil_moisture") is not None else 45.0)

        untested_nutrients = []
        if not is_n_prov:
            untested_nutrients.append("Nitrogen (N)")
        if not is_p_prov:
            untested_nutrients.append("Phosphorus (P)")
        if not is_k_prov:
            untested_nutrients.append("Potassium (K)")

        if untested_nutrients:
            missing_measurements.append(
                f"Laboratory soil test for {', '.join(untested_nutrients)} (used regional baseline)"
            )

        # 2. Extract categoricals
        is_soil_prov = bool(data.get("soilType") or data.get("soil_type"))
        user_soil = self._normalize_soil_type(data.get("soilType") or data.get("soil_type"))

        is_drainage_prov = bool(data.get("soilDrainage") or data.get("drainage"))
        user_drainage = self._normalize_drainage(data.get("soilDrainage") or data.get("drainage"))

        is_season_prov = bool(data.get("plantingSeason") or data.get("planting_month"))
        user_month = self._normalize_month(data.get("plantingSeason") or data.get("planting_month"))

        # 3. Farm conditions used metadata (distinguishing farmer-provided vs regional baseline)
        conditions_used = [
            {
                "field": "Minimum Temperature",
                "value": f"{temp_min:.1f} °C",
                "source": "provided" if is_temp_min_prov else "regional_baseline",
                "sourceLabel": "Farmer provided" if is_temp_min_prov else "Regional baseline",
            },
            {
                "field": "Maximum Temperature",
                "value": f"{temp_max:.1f} °C",
                "source": "provided" if is_temp_max_prov else "regional_baseline",
                "sourceLabel": "Farmer provided" if is_temp_max_prov else "Regional baseline",
            },
            {
                "field": "Annual Rainfall",
                "value": f"{rainfall:.0f} mm",
                "source": "provided" if is_rainfall_prov else "regional_baseline",
                "sourceLabel": "Farmer provided" if is_rainfall_prov else "Regional baseline",
            },
            {
                "field": "Soil pH",
                "value": f"{soil_ph:.1f}",
                "source": "provided" if is_ph_prov else "regional_baseline",
                "sourceLabel": "Farmer provided" if is_ph_prov else "Regional baseline",
            },
            {
                "field": "Soil Type",
                "value": user_soil,
                "source": "provided" if is_soil_prov else "regional_baseline",
                "sourceLabel": "Farmer provided" if is_soil_prov else "Regional baseline",
            },
            {
                "field": "Soil Drainage",
                "value": user_drainage,
                "source": "provided" if is_drainage_prov else "regional_baseline",
                "sourceLabel": "Farmer provided" if is_drainage_prov else "Regional baseline",
            },
            {
                "field": "Planting Season / Month",
                "value": f"{data.get('plantingSeason')} ({user_month})" if is_season_prov else user_month,
                "source": "provided" if is_season_prov else "regional_baseline",
                "sourceLabel": "Farmer provided" if is_season_prov else "Regional baseline",
            },
            {
                "field": "Elevation",
                "value": f"{elevation:.0f} m",
                "source": "provided" if is_elevation_prov else "regional_baseline",
                "sourceLabel": "Farmer provided" if is_elevation_prov else "Regional baseline",
            },
            {
                "field": "Available Nitrogen (N)",
                "value": f"{nitrogen:.1f} kg/ha" if is_n_prov else f"{nitrogen:.1f} kg/ha (Baseline)",
                "source": "provided" if is_n_prov else "regional_baseline",
                "sourceLabel": "Farmer provided (Soil Test)" if is_n_prov else "Regional baseline",
            },
            {
                "field": "Available Phosphorus (P)",
                "value": f"{phosphorus:.1f} kg/ha" if is_p_prov else f"{phosphorus:.1f} kg/ha (Baseline)",
                "source": "provided" if is_p_prov else "regional_baseline",
                "sourceLabel": "Farmer provided (Soil Test)" if is_p_prov else "Regional baseline",
            },
            {
                "field": "Available Potassium (K)",
                "value": f"{potassium:.1f} kg/ha" if is_k_prov else f"{potassium:.1f} kg/ha (Baseline)",
                "source": "provided" if is_k_prov else "regional_baseline",
                "sourceLabel": "Farmer provided (Soil Test)" if is_k_prov else "Regional baseline",
            },
        ]

        # Information still needed for more precise future assessment
        data_still_needed: List[str] = [
            "In-situ volumetric soil moisture measurement",
        ]
        if untested_nutrients:
            data_still_needed.insert(
                0,
                f"Laboratory soil test for {', '.join(untested_nutrients)} nutrient content (currently using baseline)"
            )
        if not is_ph_prov:
            data_still_needed.append("On-site soil pH laboratory test (currently using regional baseline 5.2)")
        if not is_rainfall_prov:
            data_still_needed.append("Farm-specific annual precipitation or rain-gauge records (currently using regional normal 1,600 mm)")
        if not is_temp_min_prov or not is_temp_max_prov:
            data_still_needed.append("Localized minimum and maximum temperature observations (currently using regional normals 17.5°C / 30.0°C)")
        if not is_elevation_prov:
            data_still_needed.append("Accurate farm elevation or GPS topographic survey (currently using Imphal valley baseline 780 m)")

        # 4. Construct input DataFrame matching exact feature_columns of model
        input_dict = {
            "temp_min": temp_min,
            "temp_max": temp_max,
            "humidity": humidity,
            "rainfall": rainfall,
            "soil_ph": soil_ph,
            "nitrogen": nitrogen,
            "phosphorus": phosphorus,
            "potassium": potassium,
            "soil_moisture": soil_moisture,
            "elevation": elevation,
        }

        input_df = pd.DataFrame(0.0, index=[0], columns=self.feature_columns)
        for k, v in input_dict.items():
            if k in input_df.columns:
                input_df.at[0, k] = float(v)

        # One-hot encoded categorical indicator columns
        soil_col = f"soil_type_{user_soil}"
        drainage_col = f"drainage_{user_drainage}"
        month_col = f"planting_month_{user_month}"

        if soil_col in input_df.columns:
            input_df.at[0, soil_col] = 1.0
        if drainage_col in input_df.columns:
            input_df.at[0, drainage_col] = 1.0
        if month_col in input_df.columns:
            input_df.at[0, month_col] = 1.0

        # 5. Model Prediction
        pred_class = int(self.model.predict(input_df)[0])
        probabilities = self.model.predict_proba(input_df)[0]
        # Class 1 is Suitable
        suitability_prob = float(probabilities[1]) if len(probabilities) > 1 else float(pred_class)
        suitability_score = round(suitability_prob * 100.0, 1)

        # Determine workflow type
        has_measured_soil_test = is_n_prov and is_p_prov and is_k_prov
        workflow_type = "soil_test" if has_measured_soil_test else "preliminary"
        workflow_label = (
            "Soil-Test Verified Assessment"
            if has_measured_soil_test
            else "Preliminary Assessment (Regional Baseline Nutrients)"
        )

        # Classify status based strictly on model output
        if pred_class == 1 and suitability_score >= 60.0:
            status = "suitable"
            status_desc = f"Suitable for pineapple cultivation (Model confidence: {suitability_score}%) — {workflow_label}"
        elif pred_class == 1 or suitability_score >= 45.0:
            status = "conditionally_suitable"
            status_desc = f"Conditionally suitable for pineapple cultivation (Model score: {suitability_score}%) — {workflow_label}"
        else:
            status = "unsuitable"
            status_desc = f"Unsuitable for pineapple cultivation under current parameters (Model score: {suitability_score}%) — {workflow_label}"

        # 6. Agronomic rule-based reasoning, risks, and improvements
        reasons: List[str] = []
        limitations: List[str] = []
        improvements: List[str] = []

        # Soil nutrient observations distinguishing Workflow A vs Workflow B
        if has_measured_soil_test:
            reasons.append(
                f"Laboratory soil-test macronutrients (N: {nitrogen:.1f} kg/ha, P: {phosphorus:.1f} kg/ha, K: {potassium:.1f} kg/ha) were evaluated by the model. Note that phosphorus/potassium interpretation depends on laboratory extraction methods (e.g. Bray/Olsen P, neutral ammonium acetate K), and nitrogen availability varies with soil organic matter."
            )
        else:
            reasons.append(
                f"Preliminary evaluation conducted using documented regional baseline estimates for soil macronutrients (N: {nitrogen:.1f} kg/ha, P: {phosphorus:.1f} kg/ha, K: {potassium:.1f} kg/ha). A field laboratory soil test is recommended before commercial planting."
            )

        # Soil pH checks
        if 4.5 <= soil_ph <= 6.5:
            reasons.append(f"Soil pH ({soil_ph:.1f}) is within the optimal acidic range (4.5–6.5) required by pineapples.")
        elif soil_ph < 4.5:
            limitations.append(f"Soil is strongly acidic (pH {soil_ph:.1f}). Extreme acidity restricts nutrient uptake.")
            improvements.append("Apply agricultural lime or dolomite 2–3 months prior to planting to moderate soil pH above 4.5.")
        else:
            limitations.append(f"Soil pH ({soil_ph:.1f}) is higher than optimal. Alkaline soils induce chlorosis and nutrient lockout.")
            improvements.append("Incorporate sulfur or organic compost to acidify the root zone.")

        # Drainage checks
        if user_drainage in ["Excellent", "Good"]:
            reasons.append(f"{user_drainage} soil drainage provides healthy aeration and prevents Phytophthora root rot.")
        elif user_drainage == "Fair":
            limitations.append("Moderate soil drainage may risk waterlogging during heavy monsoon rains.")
            improvements.append("Plant on raised beds (20–30 cm high) and excavate perimeter drainage channels.")
        else:
            limitations.append("Poor soil drainage presents severe risk of root rot and crop failure for pineapple.")
            improvements.append("Install deep trench drainage or avoid low-lying waterlogged patches.")

        # Rainfall checks
        if 1200.0 <= rainfall <= 3000.0:
            reasons.append(f"Annual precipitation ({rainfall:.0f} mm) is well suited for rainfed pineapple farming.")
        elif rainfall < 1200.0:
            limitations.append(f"Annual rainfall ({rainfall:.0f} mm) is below optimal. Pineapple requires at least 1,200 mm/year.")
            improvements.append("Implement supplementary drip or furrow irrigation during the dry winter and pre-monsoon months.")
        else:
            limitations.append(f"Excessive rainfall ({rainfall:.0f} mm) increases fungal disease pressure.")
            improvements.append("Ensure excellent soil drainage and apply prophylactic copper-based sprays during peak monsoon.")

        # Temperature checks
        if 15.0 <= temp_min and temp_max <= 35.0:
            reasons.append(f"Temperature range ({temp_min:.1f}°C to {temp_max:.1f}°C) matches tropical pineapple physiological requirements.")
        if temp_max > 36.0:
            limitations.append(f"High peak temperature ({temp_max:.1f}°C) can cause sunburn damage to developing fruit.")
            improvements.append("Use straw mulching and thatch cover or shade netting to protect developing fruit.")
        if temp_min < 12.0:
            limitations.append(f"Low winter temperature ({temp_min:.1f}°C) will slow plant vegetative growth.")

        # Soil type checks
        if user_soil in ["Sandy Loam", "Red Sandy Loam", "Loamy"]:
            reasons.append(f"{user_soil} soil provides optimal balance of drainage, aeration, and root anchorage.")
        elif user_soil in ["Heavy Clay", "Gravelly"]:
            limitations.append(f"{user_soil} soil poses structural and drainage challenges for root expansion.")
            improvements.append("Incorporate generous organic matter (FYM / vermicompost) to loosen clay or improve moisture retention.")

        # 7. Variety Recommendations
        # As instructed: "Show the recommended pineapple variety only if the model's output supports that conclusion."
        recommended_varieties = []
        if status in ["suitable", "conditionally_suitable"]:
            for v_name, profile in VARIETY_PROFILES.items():
                v_score = 100
                v_limitations: List[str] = []
                v_advantages: List[str] = []

                if v_name == "Queen":
                    v_advantages.append("High sweetness, rich golden-yellow flesh, and strong pleasant aroma favored for fresh fruit markets.")
                    v_advantages.append("Highly adapted to well-drained slopes and red sandy loam soils of Manipur (e.g. Thoubal, Churachandpur).")
                else:
                    v_advantages.append("Large cylindrical fruit (1.5–2.5 kg) with fiberless, juice-rich flesh ideal for canning and juice processing.")
                    v_advantages.append("Thrives in fertile valley floors and foothills with good water retention.")

                if temp_min < profile["optimal_temp_min"]:
                    v_score -= min(20, (profile["optimal_temp_min"] - temp_min) * 4)
                    v_limitations.append(f"Minimum temp ({temp_min:.1f}°C) is below Queen's ideal {profile['optimal_temp_min']}°C." if v_name == "Queen" else f"Minimum temp ({temp_min:.1f}°C) is below Kew's ideal {profile['optimal_temp_min']}°C.")
                if temp_max > profile["optimal_temp_max"]:
                    v_score -= min(20, (temp_max - profile["optimal_temp_max"]) * 4)
                    v_limitations.append(f"Maximum temp ({temp_max:.1f}°C) exceeds ideal {profile['optimal_temp_max']}°C.")

                if rainfall < profile["optimal_rainfall_min"]:
                    v_score -= min(25, ((profile["optimal_rainfall_min"] - rainfall) / 100) * 5)
                    v_limitations.append(f"Annual rainfall ({rainfall:.0f} mm) is below optimal ({profile['optimal_rainfall_min']:.0f} mm).")
                elif rainfall > profile["optimal_rainfall_max"]:
                    v_score -= min(20, ((rainfall - profile["optimal_rainfall_max"]) / 100) * 3)

                if user_drainage != profile["preferred_drainage"]:
                    v_score -= 15 if user_drainage != "Poor" else 45
                    v_limitations.append(f"Prefers {profile['preferred_drainage']} drainage; current field has {user_drainage} drainage.")

                if user_soil not in profile["preferred_soil_types"]:
                    v_score -= 10
                    v_limitations.append(f"Soil type '{user_soil}' is non-standard for {v_name} (prefers {', '.join(profile['preferred_soil_types'])}).")

                if v_name == "Queen":
                    v_limitations.append("Smaller fruit size and deeper eyes make it less economical for commercial canning factories.")
                else:
                    v_limitations.append("Higher susceptibility to waterlogging and leaf spot diseases in poorly aerated lowlands.")

                v_score = max(0.0, min(100.0, v_score))
                reasons_list = [f"Suitability match score: {round(v_score)}/100", profile["description"]]
                if v_advantages:
                    reasons_list.append(v_advantages[0])

                recommended_varieties.append({
                    "variety": f"{v_name} Pineapple",
                    "score": round(v_score, 1),
                    "bestUse": "Fresh table consumption" if v_name == "Queen" else "Commercial canning, juice & processing",
                    "description": profile["description"],
                    "advantages": v_advantages,
                    "limitations": v_limitations,
                    "optimalConditions": [
                        f"Temperature: {profile['optimal_temp_min']}°C – {profile['optimal_temp_max']}°C",
                        f"Annual Rainfall: {profile['optimal_rainfall_min']} – {profile['optimal_rainfall_max']} mm",
                        f"Soil pH: {profile['optimal_soil_ph_min']} – {profile['optimal_soil_ph_max']}",
                        f"Drainage: {profile['preferred_drainage']}",
                    ],
                    "reasons": reasons_list,
                })

            # Sort varieties by score descending
            recommended_varieties.sort(key=lambda x: x["score"], reverse=True)

            # Preference weighting if user stated preference or intended use
            pref = (data.get("preferredVariety") or "").lower()
            intended = (data.get("intendedUse") or "").lower()
            if pref == "queen" or intended == "fresh":
                recommended_varieties.sort(key=lambda x: 0 if "Queen" in x["variety"] else 1)
            elif pref == "kew" or intended == "processing":
                recommended_varieties.sort(key=lambda x: 0 if "Kew" in x["variety"] else 1)
        else:
            limitations.append("Because overall environmental conditions are unsuitable, no variety is currently recommended.")

        return {
            "result": {
                "status": status,
                "score": suitability_score,
                "scoreExplanation": status_desc,
                "workflowType": workflow_type,
                "recommendedVarieties": recommended_varieties,
                "reasons": reasons,
                "limitations": limitations,
                "improvements": improvements,
                "additionalDataNeeded": missing_measurements,
                "conditionsUsed": conditions_used,
                "dataStillNeeded": data_still_needed,
            },
            "modelVersion": "PineappleSuitability-RF-v1.0 (ICAR NEH Manipur / MOMA Agro-Climatic Dataset)",
        }

# Singleton instance
suitability_predictor = PineappleSuitabilityPredictor()
