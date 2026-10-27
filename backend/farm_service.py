import json
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional

from backend.database import get_db_connection
from backend.farm_planner.services.geometry import generate_layout

def create_initial_user_farm(user_id: str, name: str = "Churachandpur Plot") -> Dict[str, Any]:
    """Generates and persists an initial isolated farm for a newly registered user."""
    farm_id = f"F_{uuid.uuid4().hex[:12]}"
    length = 20.0
    breadth = 12.0
    row_spacing = 0.6
    plant_spacing = 0.45
    clearance = 0.5
    staggered = False
    variety = "Queen Pineapple"
    planting_date = datetime.now().strftime("%Y-%m-%d")

    layout_plants = generate_layout(
        length=length,
        breadth=breadth,
        row_spacing=row_spacing,
        plant_spacing=plant_spacing,
        clearance=clearance,
        staggered=staggered,
    )

    location_json = json.dumps({
        "lat": 24.3333,
        "lon": 93.6667,
        "how": "manual",
        "acc": 5.0,
        "at": datetime.now().isoformat(),
    })

    conn = get_db_connection()
    with conn:
        conn.execute(
            """
            INSERT INTO farms (
                id, user_id, name, variety, length, breadth, row_spacing, plant_spacing,
                clearance, staggered, planting_date, location_json, total_plants, active_plants
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """,
            (
                farm_id, user_id, name, variety, length, breadth, row_spacing, plant_spacing,
                clearance, 1 if staggered else 0, planting_date, location_json,
                len(layout_plants), len(layout_plants)
            ),
        )

        plant_rows = [
            (p["id"], farm_id, p["row"], p["pos"], p["x"], p["y"], "unknown")
            for p in layout_plants
        ]
        conn.executemany(
            """
            INSERT INTO plants (id, farm_id, row, pos, x, y, status)
            VALUES (?, ?, ?, ?, ?, ?, ?);
            """,
            plant_rows,
        )

        # Initial NIPHM recommended task
        conn.execute(
            """
            INSERT INTO tasks (id, farm_id, title, due_date, status, source, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?);
            """,
            (
                f"task_{uuid.uuid4().hex[:8]}",
                farm_id,
                "Soil Preparation & Sucker Treatment",
                datetime.now().strftime("%Y-%m-%d"),
                "open",
                "NIPHM S1",
                "Dip slips/suckers in approved organic bio-formulation prior to planting.",
            ),
        )

    conn.close()
    return get_user_farm(user_id=user_id, farm_id=farm_id)

def get_user_farms(user_id: str) -> List[Dict[str, Any]]:
    """Returns all farms owned strictly by user_id."""
    conn = get_db_connection()
    rows = conn.execute(
        "SELECT * FROM farms WHERE user_id = ? ORDER BY created_at DESC;",
        (user_id,),
    ).fetchall()

    farms_list = []
    for r in rows:
        farm_dict = _build_farm_dict(conn, r)
        farms_list.append(farm_dict)
    conn.close()
    return farms_list

def get_user_farm(user_id: str, farm_id: str) -> Optional[Dict[str, Any]]:
    """Fetches a specific farm ensuring it belongs strictly to user_id."""
    conn = get_db_connection()
    row = conn.execute(
        "SELECT * FROM farms WHERE id = ? AND user_id = ?;",
        (farm_id, user_id),
    ).fetchone()

    if not row:
        conn.close()
        return None

    farm_dict = _build_farm_dict(conn, row)
    conn.close()
    return farm_dict

def create_farm_for_user(user_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Creates a new farm for user_id with layout generation and DB persistence."""
    farm_id = f"F_{uuid.uuid4().hex[:12]}"
    name = str(payload.get("name") or "New Farm Plot").strip()
    if not name:
        raise ValueError("Plot name cannot be empty.")

    try:
        length = float(payload.get("length", 20.0))
        breadth = float(payload.get("breadth", 12.0))
    except (TypeError, ValueError):
        raise ValueError("Plot length and breadth must be numbers.")

    if length <= 0 or breadth <= 0:
        raise ValueError("Plot length and breadth must be positive numbers greater than 0.")

    variety = str(payload.get("variety") or "Queen Pineapple").strip()
    row_spacing = float(payload.get("row_spacing", 0.6))
    plant_spacing = float(payload.get("plant_spacing", 0.45))
    clearance = float(payload.get("clearance", 0.5))
    staggered = bool(payload.get("staggered", False))
    planting_date = payload.get("planting_date") or datetime.now().strftime("%Y-%m-%d")
    is_demo = 1 if payload.get("is_demo") else 0

    if row_spacing <= 0 or plant_spacing <= 0:
        raise ValueError("Row spacing and plant spacing must be greater than 0.")

    layout_plants = generate_layout(
        length=length,
        breadth=breadth,
        row_spacing=row_spacing,
        plant_spacing=plant_spacing,
        clearance=clearance,
        staggered=staggered,
    )

    loc = payload.get("location")
    cor_A = payload.get("cor_A")
    cor_B = payload.get("cor_B")
    cor_C = payload.get("cor_C")
    corner_check = payload.get("corner_check")

    conn = get_db_connection()
    with conn:
        conn.execute(
            """
            INSERT INTO farms (
                id, user_id, name, variety, length, breadth, row_spacing, plant_spacing,
                clearance, staggered, planting_date, location_json, cor_A_json, cor_B_json,
                cor_C_json, corner_check_json, total_plants, active_plants, is_demo
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """,
            (
                farm_id, user_id, name, variety, length, breadth, row_spacing, plant_spacing,
                clearance, 1 if staggered else 0, planting_date,
                json.dumps(loc) if loc else None,
                json.dumps(cor_A) if cor_A else None,
                json.dumps(cor_B) if cor_B else None,
                json.dumps(cor_C) if cor_C else None,
                json.dumps(corner_check) if corner_check else None,
                len(layout_plants), len(layout_plants),
                is_demo
            ),
        )

        plant_rows = [
            (p["id"], farm_id, p["row"], p["pos"], p["x"], p["y"], "unknown")
            for p in layout_plants
        ]
        conn.executemany(
            """
            INSERT INTO plants (id, farm_id, row, pos, x, y, status)
            VALUES (?, ?, ?, ?, ?, ?, ?);
            """,
            plant_rows,
        )
    conn.close()

    return get_user_farm(user_id=user_id, farm_id=farm_id)

def update_farm_for_user(user_id: str, farm_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Updates an existing farm owned strictly by user_id, persisting name and dimensions."""
    conn = get_db_connection()
    row = conn.execute(
        "SELECT * FROM farms WHERE id = ? AND user_id = ?;",
        (farm_id, user_id),
    ).fetchone()

    if not row:
        conn.close()
        raise ValueError("Farm not found or access denied.")

    existing_farm = dict(row)

    # Validate name
    name = str(payload.get("name") if "name" in payload else existing_farm["name"]).strip()
    if not name:
        conn.close()
        raise ValueError("Plot name cannot be empty.")

    # Validate dimensions
    try:
        length = float(payload.get("length", existing_farm["length"]))
        breadth = float(payload.get("breadth", existing_farm["breadth"]))
    except (TypeError, ValueError):
        conn.close()
        raise ValueError("Plot length and breadth must be valid numbers.")

    if length <= 0 or breadth <= 0:
        conn.close()
        raise ValueError("Plot length and breadth must be positive numbers greater than 0.")

    variety = str(payload.get("variety") if "variety" in payload else existing_farm["variety"]).strip() or "Queen Pineapple"
    row_spacing = float(payload.get("row_spacing", existing_farm["row_spacing"]))
    plant_spacing = float(payload.get("plant_spacing", existing_farm["plant_spacing"]))
    clearance = float(payload.get("clearance", existing_farm["clearance"]))
    staggered = bool(payload.get("staggered", existing_farm["staggered"]))
    planting_date = payload.get("planting_date", existing_farm.get("planting_date"))

    if row_spacing <= 0 or plant_spacing <= 0:
        conn.close()
        raise ValueError("Row spacing and plant spacing must be greater than 0.")

    dimensions_changed = (
        abs(length - existing_farm["length"]) > 1e-4 or
        abs(breadth - existing_farm["breadth"]) > 1e-4 or
        abs(row_spacing - existing_farm["row_spacing"]) > 1e-4 or
        abs(plant_spacing - existing_farm["plant_spacing"]) > 1e-4 or
        abs(clearance - existing_farm["clearance"]) > 1e-4 or
        staggered != bool(existing_farm["staggered"])
    )

    with conn:
        client_plants = payload.get("plants")
        if client_plants and isinstance(client_plants, list) and len(client_plants) > 0:
            new_plant_ids = {p["id"] for p in client_plants}
            for p in client_plants:
                pid = p["id"]
                conn.execute(
                    """
                    INSERT INTO plants (id, farm_id, row, pos, x, y, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(farm_id, id) DO UPDATE SET
                        row = excluded.row,
                        pos = excluded.pos,
                        x = excluded.x,
                        y = excluded.y,
                        status = COALESCE(excluded.status, plants.status);
                    """,
                    (pid, farm_id, int(p["row"]), int(p["pos"]), float(p["x"]), float(p["y"]), p.get("status", "unknown")),
                )
            old_plants = conn.execute("SELECT id FROM plants WHERE farm_id = ?;", (farm_id,)).fetchall()
            for op in old_plants:
                opid = op["id"]
                if opid not in new_plant_ids:
                    obs_count = conn.execute(
                        "SELECT COUNT(*) as c FROM observations WHERE farm_id = ? AND plant_id = ?;",
                        (farm_id, opid)
                    ).fetchone()["c"]
                    if obs_count > 0:
                        conn.execute(
                            "UPDATE plants SET retired_at = datetime('now'), retired_reason = 'Plot resized' WHERE farm_id = ? AND id = ?;",
                            (farm_id, opid)
                        )
                    else:
                        conn.execute("DELETE FROM plants WHERE farm_id = ? AND id = ?;", (farm_id, opid))
        elif dimensions_changed:
            layout_plants = generate_layout(
                length=length,
                breadth=breadth,
                row_spacing=row_spacing,
                plant_spacing=plant_spacing,
                clearance=clearance,
                staggered=staggered,
            )
            new_plant_ids = {p["id"] for p in layout_plants}
            for p in layout_plants:
                pid = p["id"]
                conn.execute(
                    """
                    INSERT INTO plants (id, farm_id, row, pos, x, y, status)
                    VALUES (?, ?, ?, ?, ?, ?, 'unknown')
                    ON CONFLICT(farm_id, id) DO UPDATE SET
                        row = excluded.row,
                        pos = excluded.pos,
                        x = excluded.x,
                        y = excluded.y;
                    """,
                    (pid, farm_id, int(p["row"]), int(p["pos"]), float(p["x"]), float(p["y"])),
                )
            old_plants = conn.execute("SELECT id FROM plants WHERE farm_id = ?;", (farm_id,)).fetchall()
            for op in old_plants:
                opid = op["id"]
                if opid not in new_plant_ids:
                    obs_count = conn.execute(
                        "SELECT COUNT(*) as c FROM observations WHERE farm_id = ? AND plant_id = ?;",
                        (farm_id, opid)
                    ).fetchone()["c"]
                    if obs_count > 0:
                        conn.execute(
                            "UPDATE plants SET retired_at = datetime('now'), retired_reason = 'Plot resized' WHERE farm_id = ? AND id = ?;",
                            (farm_id, opid)
                        )
                    else:
                        conn.execute("DELETE FROM plants WHERE farm_id = ? AND id = ?;", (farm_id, opid))

        total_p = conn.execute("SELECT COUNT(*) as c FROM plants WHERE farm_id = ?;", (farm_id,)).fetchone()["c"]
        active_p = conn.execute("SELECT COUNT(*) as c FROM plants WHERE farm_id = ? AND retired_at IS NULL;", (farm_id,)).fetchone()["c"]

        conn.execute(
            """
            UPDATE farms SET
                name = ?,
                variety = ?,
                length = ?,
                breadth = ?,
                row_spacing = ?,
                plant_spacing = ?,
                clearance = ?,
                staggered = ?,
                planting_date = ?,
                total_plants = ?,
                active_plants = ?,
                updated_at = datetime('now')
            WHERE id = ? AND user_id = ?;
            """,
            (
                name,
                variety,
                length,
                breadth,
                row_spacing,
                plant_spacing,
                clearance,
                1 if staggered else 0,
                planting_date,
                total_p,
                active_p,
                farm_id,
                user_id,
            ),
        )

    conn.close()
    return get_user_farm(user_id=user_id, farm_id=farm_id)

def create_demo_farm_for_user(user_id: str, user_name: Optional[str] = None) -> Dict[str, Any]:
    """Creates a sample demo plot clearly marked with is_demo = 1."""
    clean_name = (user_name or "Farmer").split()[0].strip() or "Farmer"
    demo_farm_name = f"{clean_name}'s Demo Plot"

    farm_id = f"demo_{uuid.uuid4().hex[:10]}"
    length = 20.0
    breadth = 12.0
    row_spacing = 0.6
    plant_spacing = 0.45
    clearance = 0.5
    staggered = True
    variety = "Queen Pineapple (Demo)"
    planting_date = datetime.now().strftime("%Y-%m-%d")

    layout_plants = generate_layout(
        length=length,
        breadth=breadth,
        row_spacing=row_spacing,
        plant_spacing=plant_spacing,
        clearance=clearance,
        staggered=staggered,
    )

    location_json = json.dumps({
        "lat": 24.8170,
        "lon": 93.9368,
        "how": "manual",
        "acc": 5.0,
        "at": datetime.now().isoformat(),
    })

    conn = get_db_connection()
    with conn:
        conn.execute(
            """
            INSERT INTO farms (
                id, user_id, name, variety, length, breadth, row_spacing, plant_spacing,
                clearance, staggered, planting_date, location_json, total_plants, active_plants, is_demo
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1);
            """,
            (
                farm_id, user_id, demo_farm_name, variety, length, breadth, row_spacing, plant_spacing,
                clearance, 1 if staggered else 0, planting_date, location_json,
                len(layout_plants), len(layout_plants)
            ),
        )

        plant_rows = [
            (p["id"], farm_id, p["row"], p["pos"], p["x"], p["y"], "unknown")
            for p in layout_plants
        ]
        conn.executemany(
            """
            INSERT INTO plants (id, farm_id, row, pos, x, y, status)
            VALUES (?, ?, ?, ?, ?, ?, ?);
            """,
            plant_rows,
        )

        # Seed 2 sample demonstration observations
        if layout_plants:
            demo_p1 = layout_plants[0]["id"]
            conn.execute(
                """
                INSERT INTO observations (id, farm_id, plant_id, user_id, observed_at, status, condition, confidence, notes)
                VALUES (?, ?, ?, ?, ?, 'healthy', 'Vigorous', 0.96, 'Sample Demo: Healthy crown growth, zero disease spotting.');
                """,
                (f"obs_demo_1_{uuid.uuid4().hex[:6]}", farm_id, demo_p1, user_id, planting_date),
            )
            conn.execute("UPDATE plants SET status = 'healthy' WHERE farm_id = ? AND id = ?;", (farm_id, demo_p1))

        if len(layout_plants) > 5:
            demo_p2 = layout_plants[5]["id"]
            conn.execute(
                """
                INSERT INTO observations (id, farm_id, plant_id, user_id, observed_at, status, condition, confidence, notes)
                VALUES (?, ?, ?, ?, ?, 'suspected', 'Leaf yellowing', 0.88, 'Sample Demo: Suspected nutrient deficiency or water stress.');
                """,
                (f"obs_demo_2_{uuid.uuid4().hex[:6]}", farm_id, demo_p2, user_id, planting_date),
            )
            conn.execute("UPDATE plants SET status = 'suspected' WHERE farm_id = ? AND id = ?;", (farm_id, demo_p2))

        # Sample demonstration task
        conn.execute(
            """
            INSERT INTO tasks (id, farm_id, title, due_date, status, source, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?);
            """,
            (
                f"task_demo_{uuid.uuid4().hex[:6]}",
                farm_id,
                "Explore Double-Row Farm Map & Plant Observations",
                planting_date,
                "open",
                "Loumi Tour",
                "Click individual plant nodes to view health logs or export complete plot reports in PDF/Excel.",
            ),
        )

    conn.close()
    return get_user_farm(user_id=user_id, farm_id=farm_id)

def delete_user_farm(user_id: str, farm_id: str) -> bool:
    """Deletes a farm owned by user_id. Returns True if deleted, False if not found."""
    conn = get_db_connection()
    with conn:
        cur = conn.execute(
            "DELETE FROM farms WHERE id = ? AND user_id = ?;",
            (farm_id, user_id),
        )
        deleted = cur.rowcount > 0
    conn.close()
    return deleted

def record_plant_observation(
    user_id: str,
    farm_id: str,
    plant_id: str,
    status: str,
    condition: Optional[str] = None,
    confidence: Optional[float] = None,
    notes: Optional[str] = None,
    observed_at: Optional[str] = None,
) -> Dict[str, Any]:
    """Records an observation for a plant, verifying that the farm belongs strictly to user_id."""
    conn = get_db_connection()
    # Verify farm ownership
    farm_row = conn.execute(
        "SELECT id FROM farms WHERE id = ? AND user_id = ?;",
        (farm_id, user_id),
    ).fetchone()

    if not farm_row:
        conn.close()
        raise PermissionError(f"Farm {farm_id} does not exist or does not belong to user {user_id}.")

    # Verify plant exists
    plant_row = conn.execute(
        "SELECT id, status FROM plants WHERE farm_id = ? AND id = ?;",
        (farm_id, plant_id),
    ).fetchone()

    if not plant_row:
        conn.close()
        raise ValueError(f"Plant {plant_id} not found in farm {farm_id}.")

    obs_id = f"obs_{int(datetime.now().timestamp() * 1000)}_{uuid.uuid4().hex[:6]}"
    obs_date = observed_at or datetime.now().strftime("%Y-%m-%d")

    with conn:
        conn.execute(
            """
            INSERT INTO observations (id, farm_id, plant_id, user_id, observed_at, status, condition, confidence, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
            """,
            (obs_id, farm_id, plant_id, user_id, obs_date, status, condition, confidence, notes),
        )
        conn.execute(
            "UPDATE plants SET status = ? WHERE farm_id = ? AND id = ?;",
            (status, farm_id, plant_id),
        )

    conn.close()
    return {
        "id": obs_id,
        "farm_id": farm_id,
        "plant_id": plant_id,
        "user_id": user_id,
        "observed_at": obs_date,
        "status": status,
        "condition": condition,
        "confidence": confidence,
        "notes": notes,
    }

def sync_local_farms_for_user(user_id: str, local_farms: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Migrates/imports local farms from localStorage for user_id without losing data."""
    if not local_farms:
        return get_user_farms(user_id)

    conn = get_db_connection()
    existing_count = conn.execute("SELECT COUNT(*) as c FROM farms WHERE user_id = ?;", (user_id,)).fetchone()["c"]
    conn.close()

    # If user already has farms in DB, don't overwrite blindly
    if existing_count == 0:
        for f in local_farms:
            try:
                create_farm_for_user(user_id, f)
            except Exception as e:
                print(f"[Sync] Error syncing farm {f.get('name')}: {e}")

    return get_user_farms(user_id)

def _build_farm_dict(conn: Any, farm_row: Any) -> Dict[str, Any]:
    f = dict(farm_row)
    farm_id = f["id"]

    # Load plants
    plant_rows = conn.execute(
        "SELECT * FROM plants WHERE farm_id = ? ORDER BY row ASC, pos ASC;",
        (farm_id,),
    ).fetchall()

    # Load all observations for this farm
    obs_rows = conn.execute(
        "SELECT * FROM observations WHERE farm_id = ? ORDER BY observed_at DESC, created_at DESC;",
        (farm_id,),
    ).fetchall()

    obs_by_plant: Dict[str, List[Dict[str, Any]]] = {}
    for obs in obs_rows:
        pid = obs["plant_id"]
        if pid not in obs_by_plant:
            obs_by_plant[pid] = []
        obs_by_plant[pid].append({
            "id": obs["id"],
            "farm_id": obs["farm_id"],
            "plant_id": obs["plant_id"],
            "observed_at": obs["observed_at"],
            "status": obs["status"],
            "condition": obs["condition"],
            "confidence": obs["confidence"],
            "notes": obs["notes"],
        })

    plants = []
    for pr in plant_rows:
        pid = pr["id"]
        plants.append({
            "id": pid,
            "farm_id": farm_id,
            "row": pr["row"],
            "pos": pr["pos"],
            "x": pr["x"],
            "y": pr["y"],
            "status": pr["status"],
            "retired_at": pr["retired_at"],
            "retired_reason": pr["retired_reason"],
            "approx_gps": json.loads(pr["approx_gps_json"]) if pr["approx_gps_json"] else None,
            "observations": obs_by_plant.get(pid, []),
        })

    # Load tasks
    task_rows = conn.execute(
        "SELECT * FROM tasks WHERE farm_id = ? ORDER BY due_date ASC;",
        (farm_id,),
    ).fetchall()

    tasks = [
        {
            "id": t["id"],
            "farm_id": t["farm_id"],
            "plant_id": t["plant_id"],
            "title": t["title"],
            "due_date": t["due_date"],
            "status": t["status"],
            "source": t["source"],
            "notes": t["notes"],
            "completed_at": t["completed_at"],
        }
        for t in task_rows
    ]

    return {
        "id": farm_id,
        "user_id": f["user_id"],
        "name": f["name"],
        "variety": f["variety"],
        "length": f["length"],
        "breadth": f["breadth"],
        "row_spacing": f["row_spacing"],
        "plant_spacing": f["plant_spacing"],
        "clearance": f["clearance"],
        "staggered": bool(f["staggered"]),
        "planting_date": f.get("planting_date"),
        "location": json.loads(f["location_json"]) if f["location_json"] else None,
        "cor_A": json.loads(f["cor_A_json"]) if f["cor_A_json"] else None,
        "cor_B": json.loads(f["cor_B_json"]) if f["cor_B_json"] else None,
        "cor_C": json.loads(f["cor_C_json"]) if f["cor_C_json"] else None,
        "corner_check": json.loads(f["corner_check_json"]) if f["corner_check_json"] else None,
        "plants": plants,
        "tasks": tasks,
        "total_plants": len(plants),
        "active_plants": len([p for p in plants if not p.get("retired_at")]),
        "is_demo": bool(f.get("is_demo", 0)),
    }
