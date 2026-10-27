import math
from datetime import datetime, date
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, field_validator

from backend.farm_planner.services.geometry import generate_layout, add_months_clamped
from backend.farm_planner.services.knowledge import load_knowledge_base, get_classes

class FarmPlannerPayload(BaseModel):
    area: float
    unit: str = "acres"
    location: str
    soilType: Optional[str] = "loamy"
    plantingDate: Optional[str] = None
    plantingSeason: Optional[str] = None
    waterAvailability: Optional[str] = "adequate"
    irrigationMethod: Optional[str] = "drip"
    budget: Optional[float] = None
    goals: Optional[str] = None

    @field_validator("area")
    @classmethod
    def validate_area(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Farm area must be greater than zero.")
        if v > 10000:
            raise ValueError("Farm area exceeds maximum supported limit (10,000).")
        return v

    @field_validator("unit")
    @classmethod
    def validate_unit(cls, v: str) -> str:
        u = v.strip().lower()
        if u not in ("acres", "acre", "hectares", "hectare", "ha"):
            raise ValueError("Area unit must be either 'acres' or 'hectares'.")
        return "acres" if "acre" in u else "hectares"

    @field_validator("location")
    @classmethod
    def validate_location(cls, v: str) -> str:
        loc = v.strip()
        if not loc:
            raise ValueError("Location or district is required.")
        return loc


class FarmPlannerService:
    def __init__(self):
        self.kb = load_knowledge_base()

    def generate_plan(self, data: Dict[str, Any]) -> Dict[str, Any]:
        area = float(data.get("area", 1.0))
        unit = str(data.get("unit", "acres")).lower()
        location = str(data.get("location", "")).strip()
        soil_type = str(data.get("soilType", "loamy")).lower()
        planting_season = str(data.get("plantingSeason", "")).strip()
        water_avail = str(data.get("waterAvailability", "adequate")).lower()
        irrigation_method = str(data.get("irrigationMethod", "drip")).lower()
        budget = data.get("budget")
        if budget is not None:
            try:
                budget = float(budget)
            except (ValueError, TypeError):
                budget = None
        goals = str(data.get("goals", "")).strip()
        planting_date_str = data.get("plantingDate") or date.today().strftime("%Y-%m-%d")

        # Convert area to square meters
        # 1 acre = 4046.8564 m2; 1 hectare = 10000 m2
        area_acres = area if "acre" in unit else (area * 2.47105)
        area_m2 = area_acres * 4046.8564

        # Density based on ICAR NEH Manipur double-row planting system:
        # Trench/bed spacing: 90 cm (0.9m), Row spacing: 60 cm (0.6m), Plant spacing: 30 cm (0.3m)
        # Average area per plant = 0.225 m2 -> ~17,600 plants/acre or ~43,500 plants/ha
        plants_per_acre = 17600
        estimated_plants = int(round(area_acres * plants_per_acre))

        # Calculate approximate dimensions for rectangular plot (aspect ratio 1.5:1)
        length_m = round(math.sqrt(area_m2 * 1.5), 1)
        breadth_m = round(area_m2 / length_m, 1)

        # Generate sample grid points for visualization (capped to 200 for frontend rendering efficiency)
        sample_length = min(length_m, 30.0)
        sample_breadth = min(breadth_m, 15.0)
        try:
            sample_plants = generate_layout(
                length=sample_length,
                breadth=sample_breadth,
                row_spacing=0.6,
                plant_spacing=0.3,
                clearance=0.5,
                staggered=True
            )
        except Exception:
            sample_plants = []

        # Timeline Phases tailored to Manipur pineapple cultivation (Queen & Kew)
        timeline = [
            {
                "phase": "Phase 1: Land Preparation & Bed Formation",
                "timeframe": "Month -2 to Month 0 (April–May or Aug–Sept)",
                "activities": [
                    f"Contour terracing and deep trenching along slopes in {location} to prevent soil erosion.",
                    f"Incorporate 20–25 tonnes/ha of well-rotted Farmyard Manure (FYM) or compost into {soil_type} soil.",
                    "Apply agricultural lime or dolomite at 1.5–2 tonnes/ha if soil pH is below 5.0 (common in Manipur hill tracts).",
                    "Form double-row raised beds: 90 cm bed width, 60 cm between rows, and 40–50 cm deep drainage trenches."
                ]
            },
            {
                "phase": "Phase 2: Planting & Initial Establishment",
                "timeframe": "Month 1 to Month 2",
                "activities": [
                    "Procure healthy suckers (450–500g) or slips (350–400g) from certified nurseries (ICAR NEH / MOMA).",
                    "Cure planting material in shade for 2–3 days; strip lower dried leaves and trim dead root tissue.",
                    "Dip suckers in Trichoderma viride / Pseudomonas fluorescens bio-formulation prior to planting.",
                    f"Plant at 60 cm x 30 cm spacing (~{estimated_plants:,} plants) with double-row contour alignment."
                ]
            },
            {
                "phase": "Phase 3: Vegetative Growth & S1 Nutrient Dosing",
                "timeframe": "Month 3 to Month 10",
                "activities": [
                    f"Conduct weekly field scouting for mealybugs, ants, and leaf spot symptoms as per NIPHM S1 protocol.",
                    "Apply first split nutrient dose at Month 2 (timing aligned with national IPM package).",
                    "Execute scheduled weeding round 1; apply dry straw/biomass mulch to preserve soil moisture.",
                    "Apply second split nutrient dose at Month 5; inspect drainage furrows before heavy monsoon runoff.",
                    f"Monitor water status under {irrigation_method} irrigation; maintain field capacity during dry spells."
                ]
            },
            {
                "phase": "Phase 4: Flower Induction & Fruit Development",
                "timeframe": "Month 11 to Month 14",
                "activities": [
                    "Apply third split nutrient dose at Month 8 based on vegetative leaf vigor and soil test.",
                    "Apply approved floral induction (25 ppm ethephon with 2% urea) in the heart of mature 35–40 leaf plants.",
                    "Shield developing fruit against sunscald using dried pineapple leaves or paddy straw wrap.",
                    "Monitor ant colonies and honeydew around heart leaves to prevent mealybug wilt outbreaks."
                ]
            },
            {
                "phase": "Phase 5: Harvest & Post-Harvest Handling",
                "timeframe": "Month 15 to Month 18",
                "activities": [
                    "Harvest when the base eye color shifts from dark green to golden yellow (25–50% eye maturity).",
                    "Cut fruit with 5–7 cm peduncle using a clean, sanitized harvesting knife.",
                    "Grade by fruit size: Grade A (Queen 1.0–1.5 kg, Kew 1.8–2.5 kg) for fresh retail and processing.",
                    "Select vigorous ratoons/slips for the next crop cycle; compost residual leaf matter."
                ]
            }
        ]

        # Specific recommendations by field
        land_prep = [
            f"Thoroughly plough and harrow 2–3 times to create a fine tilth in {soil_type} soil.",
            "Construct contour bunds and drainage trenches across the slope to prevent waterlogging and collar rot.",
            "Incorporate 8–10 tonnes of FYM/compost per acre during the final ploughing pass.",
            "Apply neem cake (100 kg/acre) to deter soil nematodes and white grubs naturally."
        ]

        planting_sched = [
            f"Optimal planting window for {location}: May–July (monsoon planting) or Sept–Oct (autumn planting).",
            f"Use double-row system: 90 cm between double beds, 60 cm between rows, and 30 cm between plants.",
            f"Total plant requirement for {area:.1f} {unit}: approximately {estimated_plants:,} suckers/slips.",
            "Plant suckers upright to a depth of 7–10 cm; firmly press soil around the base to prevent water stagnation."
        ]

        # Irrigation recommendations
        if irrigation_method in ("drip", "sprinkler"):
            irrig = [
                f"{irrigation_method.capitalize()} irrigation system recommended: delivers 20–25 mm water every 10–14 days in dry winter months (Nov–March).",
                "Maintain emitter lines along the inner center of each double-row bed for targeted root zone hydration.",
                "Reduces water consumption by 35–45% compared to surface flooding while maintaining uniform fruit sizing."
            ]
        else:
            irrig = [
                "Under rainfed/furrow management, ensure deep drainage furrows to evacuate excess monsoon precipitation.",
                "Provide supplemental protective irrigation at 15–20 day intervals during severe winter dry spells.",
                "Use thick organic straw or dry grass mulching (6–8 cm) along bed rows to minimize evaporative moisture loss."
            ]

        # Nutrient & fertilizer recommendations
        fert = [
            "Baseline recommendation (per plant): 12g N, 4g P2O5, 12g K2O applied in 3 split doses across growth stages.",
            "Month 2 (Early Vegetative): Apply 1/3 Nitrogen + full Phosphorus + 1/3 Potassium (timing from NIPHM S1).",
            "Month 5 (Mid Vegetative): Apply 1/3 Nitrogen + 1/3 Potassium; incorporate biofertilizers (Azospirillum & PSB).",
            "Month 8 (Pre-Induction): Apply remaining 1/3 Nitrogen + 1/3 Potassium to support flower bud differentiation.",
            "Foliar micronutrient spray: 0.5% Zinc Sulphate + 0.2% Ferrous Sulphate at Month 4 and Month 7 if chlorosis appears."
        ]

        # Tasks by growth stage (aligned with NIPHM S1)
        tasks_by_stage = [
            {
                "stage": "Stage 1: Field Prep & Planting",
                "tasks": [
                    "Soil testing and contour terrace layout",
                    "Trench excavation and organic FYM incorporation",
                    "Sucker sorting, shade curing, and bio-protective dip",
                    "Precision double-row bed planting"
                ]
            },
            {
                "stage": "Stage 2: Early Vegetative (Months 1–4)",
                "tasks": [
                    "Gap filling of unestablished suckers within 30 days",
                    "Weekly field scouting (stem base, leaf hearts, ant colonies)",
                    "Month 2 split nutrient application and earthing up",
                    "First manual weeding and organic mulching"
                ]
            },
            {
                "stage": "Stage 3: Active Growth & Monitoring (Months 5–10)",
                "tasks": [
                    "Month 5 split nutrient application",
                    "Second weeding round and contour trench clearing",
                    "Mealybug wilt vector monitoring using S1 guidelines",
                    "Month 8 nutrient application check before winter dormancy"
                ]
            },
            {
                "stage": "Stage 4: Flower Induction & Maturation (Months 11–18)",
                "tasks": [
                    "Floral induction spray in cool morning or evening hours",
                    "De-crowning or straw shade tie-up to prevent sunburn",
                    "Fruit maturity inspection (eye flattening and color break)",
                    "Selective manual harvesting and crate packing"
                ]
            }
        ]

        harvest_timing = [
            "Main crop harvest: 15–18 months after sucker planting (12–14 months if large slips are planted).",
            "Color indicator: Harvest for distant market when 20% of basal eyes turn yellow; for local market when 50–75% yellow.",
            "Optimum harvesting hours: Early morning to minimize fruit core temperature and post-harvest respiration.",
            f"Expected fruit yield for {area:.1f} {unit}: approximately {round(area_acres * 18, 1)} to {round(area_acres * 25, 1)} metric tonnes."
        ]

        # Cost breakdown estimation
        cost_breakdown = [
            {
                "category": "Planting Material (Suckers/Slips)",
                "estimatedCost": int(estimated_plants * 3.5),
                "currency": "₹"
            },
            {
                "category": "Land Prep, Trenching & Terracing",
                "estimatedCost": int(area_acres * 12000),
                "currency": "₹"
            },
            {
                "category": "Manure, Biofertilizers & Nutrients",
                "estimatedCost": int(area_acres * 15000),
                "currency": "₹"
            },
            {
                "category": "Labor (Planting, Weeding, Scouting)",
                "estimatedCost": int(area_acres * 18000),
                "currency": "₹"
            },
            {
                "category": "Irrigation, Mulching & Plant Protection",
                "estimatedCost": int(area_acres * 10000),
                "currency": "₹"
            }
        ]
        total_estimated = sum(c["estimatedCost"] for c in cost_breakdown)

        notes = [
            f"Plan customized for {area:.1f} {unit} in {location} with {soil_type} soil and {water_avail} water availability.",
            "Plant spacing and layout follow the ICAR NEH Manipur double-row contour system.",
            "Pest management adheres strictly to NIPHM S1 IPM non-chemical guidelines. Chemical controls are withheld; consult local KVK or extension officer for prescribed labels."
        ]
        if budget and budget < total_estimated:
            notes.append(
                f"Note: Your stated budget (₹{budget:,.0f}) is lower than the standard estimated establishment cost (₹{total_estimated:,.0f}). Consider phased planting or exploring state horticulture mission subsidies (MIDH / MOMA)."
            )

        return {
            "plan": {
                "timeline": timeline,
                "landPreparation": land_prep,
                "plantingSchedule": planting_sched,
                "plantSpacing": "Double-row: 90 cm bed, 60 cm between rows, 30 cm between plants",
                "estimatedPlantCount": estimated_plants,
                "irrigation": irrig,
                "fertilizer": fert,
                "tasksByStage": tasks_by_stage,
                "harvestTiming": harvest_timing,
                "costBreakdown": cost_breakdown,
                "notes": notes,
                "geometry": {
                    "lengthMeters": length_m,
                    "breadthMeters": breadth_m,
                    "samplePlants": sample_plants[:120]  # preview subset for plot mapping
                }
            },
            "generatedAt": datetime.now().isoformat(),
            "modelVersion": "Loumi-FarmPlanner-YOLOv8-S1 (Geometry + NIPHM AESA Engine)"
        }

farm_planner_service = FarmPlannerService()
