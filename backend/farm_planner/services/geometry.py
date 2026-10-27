import math
from datetime import datetime, date
import calendar
from typing import List, Dict, Any, Optional, Tuple

R_EARTH = 6371008.8
RAD = math.pi / 180.0

STATUS_NAMES = {
    "unknown": "Not inspected",
    "healthy": "Healthy",
    "suspected": "Suspected disease",
    "disease": "Recorded disease",
    "inspect": "Needs inspection",
}

def generate_layout(
    length: float,
    breadth: float,
    row_spacing: float,
    plant_spacing: float,
    clearance: float = 0.0,
    staggered: bool = False
) -> List[Dict[str, Any]]:
    """
    Computes rectangular plant layout with stable permanent IDs (P-0001...).
    Returns a list of plant dicts.
    """
    uL = length - 2.0 * clearance
    uB = breadth - 2.0 * clearance
    if uL < 0 or uB < 0 or row_spacing <= 0 or plant_spacing <= 0 or length <= 0 or breadth <= 0 or clearance < 0:
        return []
    
    num_rows = int(math.floor(uB / row_spacing + 1e-9)) + 1
    max_plants_row = int(math.floor(uL / plant_spacing)) + 1
    if num_rows * max_plants_row > 5000:
        raise ValueError("Calculated layout exceeds 5,000 plants.")

    plants = []
    plant_idx = 1
    for r in range(num_rows):
        offset = (plant_spacing / 2.0) if (staggered and (r % 2 == 1)) else 0.0
        p = 0
        while True:
            x = offset + p * plant_spacing
            if x > uL + 1e-9:
                break
            plants.append({
                "id": f"P-{plant_idx:04d}",
                "row": r + 1,
                "pos": p + 1,
                "x": round(clearance + x, 3),
                "y": round(clearance + r * row_spacing, 3),
                "status": "unknown"
            })
            plant_idx += 1
            p += 1

    return plants

def to_en(origin_lat: float, origin_lon: float, target_lat: float, target_lon: float) -> Tuple[float, float]:
    """
    Computes local East-North coordinates (in meters) relative to an origin GPS point.
    """
    de = (target_lon - origin_lon) * RAD * R_EARTH * math.cos(origin_lat * RAD)
    dn = (target_lat - origin_lat) * RAD * R_EARTH
    return (de, dn)

def corner_transform(
    length: float,
    breadth: float,
    cor_A: Dict[str, Any],
    cor_B: Dict[str, Any],
    cor_C: Dict[str, Any]
) -> Optional[Dict[str, Any]]:
    """
    Computes corner-to-GPS transformation metrics from 3 corners:
      A: origin (x=0, y=0)
      B: end of row 1 (x=L, y=0)
      C: across rows (x=0, y=B)
    """
    if not cor_A or not cor_B or not cor_C:
        return None
    
    b_de, b_dn = to_en(cor_A["lat"], cor_A["lon"], cor_B["lat"], cor_B["lon"])
    k_de, k_dn = to_en(cor_A["lat"], cor_A["lon"], cor_C["lat"], cor_C["lon"])
    
    lb = math.hypot(b_de, b_dn)
    lk = math.hypot(k_de, k_dn)
    
    # Degenerate check: points must be at least 1 meter apart
    if lb < 1.0 or lk < 1.0:
        return None
        
    dot = b_de * k_de + b_dn * k_dn
    cos_theta = max(-1.0, min(1.0, dot / (lb * lk)))
    angle_deg = math.acos(cos_theta) / RAD
    
    eL = (lb - length) / length
    eB = (lk - breadth) / breadth
    
    is_valid = (abs(eL) < 0.10) and (abs(eB) < 0.10) and (abs(angle_deg - 90.0) < 10.0)
    
    acc_list = [c.get("acc") for c in (cor_A, cor_B, cor_C) if c.get("acc") is not None]
    max_acc = max(acc_list) if acc_list else None
    has_unknown_acc = any(c.get("acc") is None for c in (cor_A, cor_B, cor_C))
    
    return {
        "b": (b_de, b_dn),
        "k": (k_de, k_dn),
        "lb": lb,
        "lk": lk,
        "ang": angle_deg,
        "eL": eL,
        "eB": eB,
        "is_valid": is_valid,
        "max_acc": max_acc,
        "has_unknown_acc": has_unknown_acc
    }

def plant_to_gps(
    cor_A: Dict[str, Any],
    transform: Dict[str, Any],
    farm_L: float,
    farm_B: float,
    plant_x: float,
    plant_y: float
) -> Optional[Dict[str, float]]:
    """
    Maps plant local coordinates (x, y) to approximate GPS latitude and longitude
    if and only if corner check passed.
    """
    if not transform or not transform.get("is_valid"):
        return None
        
    b = transform["b"]
    k = transform["k"]
    
    e = b[0] * (plant_x / farm_L) + k[0] * (plant_y / farm_B)
    n = b[1] * (plant_x / farm_L) + k[1] * (plant_y / farm_B)
    
    lat = cor_A["lat"] + (n / R_EARTH) / RAD
    lon = cor_A["lon"] + (e / (R_EARTH * math.cos(cor_A["lat"] * RAD))) / RAD
    
    return {"lat": round(lat, 7), "lon": round(lon, 7)}

def add_months_clamped(date_str: str, months: int) -> str:
    """
    Adds n months with end-of-month clamping (e.g. Jan 31 + 1 month -> Feb 28/29).
    """
    dt = datetime.strptime(date_str, "%Y-%m-%d").date()
    year = dt.year + (dt.month - 1 + months) // 12
    month = (dt.month - 1 + months) % 12 + 1
    _, max_days = calendar.monthrange(year, month)
    day = min(dt.day, max_days)
    return date(year, month, day).strftime("%Y-%m-%d")

def generate_suggested_tasks(farm: Dict[str, Any], current_date: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Generates evidence-backed task suggestions from NIPHM S1:
    - 4 weekly field scouting tasks
    - Month 2, 5, 8 nutrient checks if planting date is recorded
    - Weeding round (date chosen by farmer)
    Flowering and harvest dates are intentionally omitted due to conflicting source estimates.
    """
    cur = datetime.strptime(current_date or date.today().strftime("%Y-%m-%d"), "%Y-%m-%d").date()
    cur_str = cur.strftime("%Y-%m-%d")
    tasks = []
    
    # 4 weekly field scouting tasks
    for i in range(1, 5):
        due = cur + datetime.resolution * (i * 7 * 86400) # days addition
        due_str = due.strftime("%Y-%m-%d")
        tasks.append({
            "title": "Weekly field scouting",
            "due_date": due_str,
            "source": "S1",
            "notes": "leaves, stem base, roots; count mealybugs and ants",
            "requires_date": False
        })
        
    # Nutrient application checks (+2, +5, +8 months)
    planting_date = farm.get("planting_date")
    if planting_date:
        for m in (2, 5, 8):
            due_str = add_months_clamped(planting_date, m)
            tasks.append({
                "title": f"Nutrient application check (month {m})",
                "due_date": due_str,
                "source": "S1",
                "notes": "timing from the national IPM package; amounts must come from your soil test",
                "requires_date": False,
                "is_past": due_str < cur_str
            })
            
    # Weeding round
    tasks.append({
        "title": "Weeding round",
        "due_date": "",
        "source": "S1",
        "notes": "the package says at least 3–4 times a year; you choose the date",
        "requires_date": True
    })
    
    return tasks

def csv_escape_value(val: Any) -> str:
    """
    Escapes a CSV cell value with formula-injection guard:
    Cells starting with =, +, -, @, \\t, or \\r are prefixed with a single quote.
    Standard RFC 4180 double-quoting is applied.
    """
    s = "" if val is None else str(val)
    if s and s[0] in ('=', '+', '-', '@', '\t', '\r'):
        s = "'" + s
    s = s.replace('"', '""')
    return f'"{s}"'

def generate_csv_text(farms_data: List[Dict[str, Any]], include_gps: bool = False) -> str:
    """
    Generates CSV text representation of all plants and observations across farms.
    Approximate GPS columns appear only if include_gps=True AND corner check passed.
    """
    headers = [
        "farm", "plant_id", "row", "position", "x_m", "y_m",
        "status", "retired", "observations", "last_observation", "last_note"
    ]
    if include_gps:
        headers.extend(["approx_lat", "approx_lon"])
        
    lines = [",".join(csv_escape_value(h) for h in headers)]
    
    for farm in farms_data:
        xform = None
        if include_gps and farm.get("cor_A") and farm.get("cor_B") and farm.get("cor_C"):
            xform = corner_transform(farm["length"], farm["breadth"], farm["cor_A"], farm["cor_B"], farm["cor_C"])
            
        for plant in farm.get("plants", []):
            obs_list = plant.get("observations", [])
            last_obs = obs_list[-1] if obs_list else {}
            
            row = [
                farm["name"],
                plant["id"],
                plant["row"],
                plant["pos"],
                plant["x"],
                plant["y"],
                plant["status"],
                plant.get("retired_at", ""),
                len(obs_list),
                last_obs.get("observed_at", ""),
                last_obs.get("notes", "")
            ]
            
            if include_gps:
                gps_pt = plant_to_gps(farm.get("cor_A"), xform, farm["length"], farm["breadth"], plant["x"], plant["y"]) if xform and xform.get("is_valid") else None
                row.append(f"{gps_pt['lat']:.6f}" if gps_pt else "")
                row.append(f"{gps_pt['lon']:.6f}" if gps_pt else "")
                
            lines.append(",".join(csv_escape_value(c) for c in row))
            
    return "\n".join(lines)

def validate_backup_payload(data: Any) -> Optional[str]:
    """
    Validates imported backup JSON payload against schema constraints.
    Returns None if valid, or an error string if invalid.
    """
    if not isinstance(data, dict) or "farms" not in data or not isinstance(data["farms"], list):
        return "Missing a farms list."
        
    for f in data["farms"]:
        if not isinstance(f, dict):
            return "Farm item must be an object."
        if not isinstance(f.get("id"), str) or not isinstance(f.get("name"), str):
            return "A farm has no valid id or name."
            
        for key in ("length", "breadth", "row_spacing", "plant_spacing"):
            val = f.get(key)
            if not isinstance(val, (int, float)) or val <= 0:
                return f"Farm “{f.get('name')}” has invalid measurements."
                
        if not isinstance(f.get("plants"), list) or not isinstance(f.get("tasks"), list):
            return f"Farm “{f.get('name')}” is missing plants or tasks list."
            
        for p in f["plants"]:
            if not isinstance(p, dict):
                return f"Farm “{f.get('name')}” contains a non-object plant record."
            pid = str(p.get("id", ""))
            if not (pid.startswith("P-") and len(pid) >= 6 and pid[2:].isdigit()):
                return f"Farm “{f.get('name')}” has a bad plant record ({pid})."
            if not isinstance(p.get("x"), (int, float)) or not isinstance(p.get("y"), (int, float)):
                return f"Farm “{f.get('name')}” has invalid coordinates for plant {pid}."
            if p.get("status") not in STATUS_NAMES:
                return f"Farm “{f.get('name')}” has unknown status for plant {pid}."
                
        for t in f["tasks"]:
            if not isinstance(t, dict) or not isinstance(t.get("title"), str):
                return f"Farm “{f.get('name')}” has a bad task."
            due = str(t.get("due_date", ""))
            if len(due) != 10 or due[4] != '-' or due[7] != '-':
                return f"Farm “{f.get('name')}” has a task with invalid due date."
            if t.get("status") not in ("open", "done"):
                return f"Farm “{f.get('name')}” has a task with invalid status."
                
    return None
