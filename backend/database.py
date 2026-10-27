import sqlite3
import json
from pathlib import Path
from typing import Dict, Any, List, Optional

DB_PATH = Path(__file__).resolve().parent / "loumi.db"

def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db():
    conn = get_db_connection()
    with conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            full_name TEXT NOT NULL,
            hashed_password TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

        CREATE TABLE IF NOT EXISTS farms (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            variety TEXT NOT NULL DEFAULT 'Pineapple',
            length REAL NOT NULL,
            breadth REAL NOT NULL,
            row_spacing REAL NOT NULL,
            plant_spacing REAL NOT NULL,
            clearance REAL NOT NULL DEFAULT 0.0,
            staggered INTEGER NOT NULL DEFAULT 0,
            planting_date TEXT,
            location_json TEXT,
            cor_A_json TEXT,
            cor_B_json TEXT,
            cor_C_json TEXT,
            corner_check_json TEXT,
            total_plants INTEGER NOT NULL DEFAULT 0,
            active_plants INTEGER NOT NULL DEFAULT 0,
            is_demo INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_farms_user_id ON farms(user_id);

        CREATE TABLE IF NOT EXISTS plants (
            id TEXT NOT NULL,
            farm_id TEXT NOT NULL,
            row INTEGER NOT NULL,
            pos INTEGER NOT NULL,
            x REAL NOT NULL,
            y REAL NOT NULL,
            status TEXT NOT NULL DEFAULT 'unknown',
            retired_at TEXT,
            retired_reason TEXT,
            approx_gps_json TEXT,
            PRIMARY KEY (farm_id, id),
            FOREIGN KEY (farm_id) REFERENCES farms (id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_plants_farm_id ON plants(farm_id);

        CREATE TABLE IF NOT EXISTS observations (
            id TEXT PRIMARY KEY,
            farm_id TEXT NOT NULL,
            plant_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            observed_at TEXT NOT NULL,
            status TEXT NOT NULL,
            condition TEXT,
            confidence REAL,
            notes TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (farm_id, plant_id) REFERENCES plants (farm_id, id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_observations_user_farm ON observations(user_id, farm_id);

        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            farm_id TEXT NOT NULL,
            plant_id TEXT,
            title TEXT NOT NULL,
            due_date TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'open',
            source TEXT,
            notes TEXT,
            completed_at TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (farm_id) REFERENCES farms (id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_tasks_farm_id ON tasks(farm_id);
        """)

        # Migration: Add is_demo column if missing in older databases
        cols = [c[1] for c in conn.execute("PRAGMA table_info(farms);").fetchall()]
        if "is_demo" not in cols:
            conn.execute("ALTER TABLE farms ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0;")

    conn.close()

if __name__ == "__main__":
    init_db()
    print("Database initialized at", DB_PATH)
