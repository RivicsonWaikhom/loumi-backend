import { STATUS_INFO, Farm, Plant, Task } from "./types";

export const MAX_LAYOUT_PLANTS = 5000;

export function cmToM(cm: number): number {
  return Number((cm / 100).toFixed(4));
}

export function mToCm(meters: number): number {
  return Number((meters * 100).toFixed(2));
}

export function layoutRowCount(breadth: number, rowSpacing: number, clearance: number): number {
  const uB = breadth - 2 * clearance;
  if (uB <= 0 || rowSpacing <= 0) return 0;
  return Math.floor(uB / rowSpacing + 1e-9) + 1;
}

export function plantsInRow(usableLength: number, plantSpacing: number, offset: number): number {
  if (usableLength <= 0 || plantSpacing <= 0 || offset > usableLength + 1e-9) return 0;
  return Math.floor((usableLength - offset) / plantSpacing + 1e-9) + 1;
}

export function estimatePlantCount(
  length: number,
  breadth: number,
  rowSpacing: number,
  plantSpacing: number,
  clearance: number = 0.5,
  staggered: boolean = true
): { count: number; rows: number; maxPerRow: number; error?: string } {
  const uL = length - 2 * clearance;
  const uB = breadth - 2 * clearance;
  if (length <= 0 || breadth <= 0) {
    return { count: 0, rows: 0, maxPerRow: 0, error: "Farm length and breadth must be greater than 0." };
  }
  if (clearance < 0) {
    return { count: 0, rows: 0, maxPerRow: 0, error: "Boundary clearance cannot be negative." };
  }
  if (uL <= 0 || uB <= 0) {
    return { count: 0, rows: 0, maxPerRow: 0, error: "Clearance is too large for the farm dimensions." };
  }
  if (!(rowSpacing > 0) || !(plantSpacing > 0)) {
    return { count: 0, rows: 0, maxPerRow: 0, error: "Row spacing and plant spacing must be greater than 0." };
  }

  const rows = layoutRowCount(breadth, rowSpacing, clearance);
  let count = 0;
  let maxPerRow = 0;
  for (let r = 0; r < rows; r++) {
    const offset = staggered && r % 2 === 1 ? plantSpacing / 2 : 0;
    const inRow = plantsInRow(uL, plantSpacing, offset);
    maxPerRow = Math.max(maxPerRow, inRow);
    count += inRow;
  }

  if (count > MAX_LAYOUT_PLANTS || rows * maxPerRow > MAX_LAYOUT_PLANTS) {
    return {
      count,
      rows,
      maxPerRow,
      error: `Calculated layout exceeds ${MAX_LAYOUT_PLANTS.toLocaleString()} plants. Increase spacing or reduce plot size.`,
    };
  }
  if (count < 1) {
    return { count: 0, rows, maxPerRow, error: "This spacing does not fit any plants inside the usable plot area." };
  }
  return { count, rows, maxPerRow };
}

export function calculateLayout(
  farmId: string,
  length: number,
  breadth: number,
  rowSpacing: number,
  plantSpacing: number,
  clearance: number = 0.5,
  staggered: boolean = true
): Plant[] {
  const preview = estimatePlantCount(length, breadth, rowSpacing, plantSpacing, clearance, staggered);
  if (preview.error) {
    if (preview.count > MAX_LAYOUT_PLANTS || preview.rows * preview.maxPerRow > MAX_LAYOUT_PLANTS) {
      throw new Error(preview.error);
    }
    return [];
  }

  const uL = length - 2 * clearance;
  const plants: Plant[] = [];
  let idx = 1;
  for (let r = 0; r < preview.rows; r++) {
    const offset = staggered && r % 2 === 1 ? plantSpacing / 2 : 0;
    for (let p = 0; ; p++) {
      const x = offset + p * plantSpacing;
      if (x > uL + 1e-9) break;
      plants.push({
        id: `P-${String(idx).padStart(4, "0")}`,
        farm_id: farmId,
        row: r + 1,
        pos: p + 1,
        x: Number((clearance + x).toFixed(3)),
        y: Number((clearance + r * rowSpacing).toFixed(3)),
        status: "unknown",
        observations: [],
      });
      idx++;
    }
  }
  return plants;
}

export function mergeLayoutPlants(existing: Plant[], nextLayout: Plant[]): Plant[] {
  const byId = new Map(existing.map((p) => [p.id, p]));
  return nextLayout.map((np) => {
    const old = byId.get(np.id);
    if (!old) return np;
    return {
      ...np,
      status: old.status,
      observations: old.observations || [],
      retired_at: old.retired_at,
      retired_reason: old.retired_reason,
      approx_gps: old.approx_gps,
    };
  });
}

export interface LayoutChangeImpact {
  currentCount: number;
  nextCount: number;
  removedCount: number;
  addedCount: number;
  recordedRemovedCount: number;
  positionsChanged: boolean;
  requiresConfirmation: boolean;
}

export function layoutChangeImpact(existing: Plant[], nextLayout: Plant[]): LayoutChangeImpact {
  const nextById = new Map(nextLayout.map((p) => [p.id, p]));
  const existingIds = new Set(existing.map((p) => p.id));
  const removed = existing.filter((p) => !nextById.has(p.id));
  const addedCount = nextLayout.filter((p) => !existingIds.has(p.id)).length;
  const recordedRemovedCount = removed.filter(
    (p) => p.status !== "unknown" || (p.observations && p.observations.length > 0)
  ).length;
  const positionsChanged = existing.some((e) => {
    const n = nextById.get(e.id);
    return Boolean(n && (n.x !== e.x || n.y !== e.y || n.row !== e.row || n.pos !== e.pos));
  });
  return {
    currentCount: existing.length,
    nextCount: nextLayout.length,
    removedCount: removed.length,
    addedCount,
    recordedRemovedCount,
    positionsChanged,
    requiresConfirmation: existing.length > 0 && (removed.length > 0 || addedCount > 0 || positionsChanged),
  };
}

const R_EARTH = 6371008.8;
const RAD = Math.PI / 180;

export function toEN(origin: { lat: number; lon: number }, target: { lat: number; lon: number }) {
  const de = (target.lon - origin.lon) * RAD * R_EARTH * Math.cos(origin.lat * RAD);
  const dn = (target.lat - origin.lat) * RAD * R_EARTH;
  return [de, dn];
}

export function cornerTransform(
  length: number,
  breadth: number,
  corA?: { lat: number; lon: number } | null,
  corB?: { lat: number; lon: number } | null,
  corC?: { lat: number; lon: number } | null
) {
  if (!corA || !corB || !corC) return null;
  const b = toEN(corA, corB);
  const k = toEN(corA, corC);
  const lb = Math.hypot(b[0], b[1]);
  const lk = Math.hypot(k[0], k[1]);
  if (lb < 1.0 || lk < 1.0) return null;

  const dot = b[0] * k[0] + b[1] * k[1];
  const cosTheta = Math.max(-1.0, Math.min(1.0, dot / (lb * lk)));
  const ang = Math.acos(cosTheta) / RAD;

  const eL = (lb - length) / length;
  const eB = (lk - breadth) / breadth;
  const is_valid = Math.abs(eL) < 0.1 && Math.abs(eB) < 0.1 && Math.abs(ang - 90) < 10;

  return { b, k, lb, lk, ang, eL, eB, is_valid };
}

export function plantToGps(
  corA: { lat: number; lon: number },
  transform: any,
  farmL: number,
  farmB: number,
  x: number,
  y: number
) {
  if (!transform || !transform.is_valid) return null;
  const e = transform.b[0] * (x / farmL) + transform.k[0] * (y / farmB);
  const n = transform.b[1] * (x / farmL) + transform.k[1] * (y / farmB);
  const lat = corA.lat + n / R_EARTH / RAD;
  const lon = corA.lon + e / (R_EARTH * Math.cos(corA.lat * RAD)) / RAD;
  return { lat: Number(lat.toFixed(6)), lon: Number(lon.toFixed(6)) };
}

export function generateS1Tasks(farmId: string, plantingDate?: string): Task[] {
  const baseDate = plantingDate ? new Date(plantingDate) : new Date();
  const tasks: Task[] = [];
  
  const addDays = (d: Date, days: number) => {
    const next = new Date(d);
    next.setDate(next.getDate() + days);
    return next.toISOString().split("T")[0];
  };

  tasks.push({
    id: `T-${farmId}-1`,
    farm_id: farmId,
    title: "Weekly field scouting (leaves, stem base, root collar)",
    due_date: addDays(baseDate, 7),
    status: "open",
    source: "Scouting",
    notes: "NIPHM S1: Check for mealybugs, ants, and leaf spot symptoms",
  });

  tasks.push({
    id: `T-${farmId}-2`,
    farm_id: farmId,
    title: "Gap filling & sucker establishment check",
    due_date: addDays(baseDate, 21),
    status: "open",
    source: "Maintenance",
    notes: "Replace unrooted or rotting suckers within 30 days",
  });

  tasks.push({
    id: `T-${farmId}-3`,
    farm_id: farmId,
    title: "First split nutrient application (Month 2)",
    due_date: addDays(baseDate, 60),
    status: "open",
    source: "Fertilizer",
    notes: "1/3 Nitrogen + full Phosphorus + 1/3 Potassium per plant",
  });

  tasks.push({
    id: `T-${farmId}-4`,
    farm_id: farmId,
    title: "Scheduled weeding round 1 & organic mulching",
    due_date: addDays(baseDate, 75),
    status: "open",
    source: "Sanitation",
    notes: "Hand weed bed furrows and lay straw mulch to conserve moisture",
  });

  tasks.push({
    id: `T-${farmId}-5`,
    farm_id: farmId,
    title: "Second split nutrient application (Month 5)",
    due_date: addDays(baseDate, 150),
    status: "open",
    source: "Fertilizer",
    notes: "1/3 Nitrogen + 1/3 Potassium with Azospirillum biofertilizer",
  });

  tasks.push({
    id: `T-${farmId}-6`,
    farm_id: farmId,
    title: "Floral induction preparation check (Month 11)",
    due_date: addDays(baseDate, 330),
    status: "open",
    source: "Maintenance",
    notes: "Verify plant maturity (35-40 functional leaves) before induction",
  });

  tasks.push({
    id: `T-${farmId}-7`,
    farm_id: farmId,
    title: "Harvest maturity inspection (Month 16)",
    due_date: addDays(baseDate, 480),
    status: "open",
    source: "Harvest",
    notes: "Selective harvest when eye base shifts to golden yellow",
  });

  return tasks;
}

export function createInitialFarms(): Farm[] {
  // Farm 1: Ocean (20x12m, 817 plants) matching user reference screenshot!
  const farm1Id = "farm-ocean";
  const plants1 = calculateLayout(farm1Id, 20.0, 12.0, 0.6, 0.3, 0.5, true);
  // Mark P-0226 as healthy observed on 2026-10-19 matching screenshot
  const p226 = plants1.find((p) => p.id === "P-0226");
  if (p226) {
    p226.status = "healthy";
    p226.observations.push({
      id: "obs-1",
      farm_id: farm1Id,
      plant_id: "P-0226",
      observed_at: "2026-10-19",
      status: "healthy",
      notes: "Vigorous heart leaves, no mealybug wilt signs.",
    });
  }

  // Farm 2: My pineapple plot (20x12m, 817 plants)
  const farm2Id = "farm-pineapple-plot";
  const plants2 = calculateLayout(farm2Id, 20.0, 12.0, 0.6, 0.3, 0.5, true);

  const farm1: Farm = {
    id: farm1Id,
    name: "Ocean",
    variety: "Kew Pineapple",
    length: 20.0,
    breadth: 12.0,
    row_spacing: 0.6,
    plant_spacing: 0.3,
    clearance: 0.5,
    staggered: true,
    planting_date: "2026-06-15",
    location: { lat: 24.817, lon: 93.948, how: "manual" },
    total_plants: plants1.length,
    active_plants: plants1.length,
    plants: plants1,
    tasks: generateS1Tasks(farm1Id, "2026-06-15"),
  };

  const farm2: Farm = {
    id: farm2Id,
    name: "My pineapple plot",
    variety: "Queen Pineapple",
    length: 20.0,
    breadth: 12.0,
    row_spacing: 0.6,
    plant_spacing: 0.3,
    clearance: 0.5,
    staggered: true,
    planting_date: "2026-05-10",
    location: { lat: 24.3333, lon: 93.6833, how: "manual" },
    total_plants: plants2.length,
    active_plants: plants2.length,
    plants: plants2,
    tasks: generateS1Tasks(farm2Id, "2026-05-10"),
  };

  return [farm1, farm2];
}

export function escapeCsvValue(val: any): string {
  let s = val === null || val === undefined ? "" : String(val);
  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }
  return `"${s.replace(/"/g, '""')}"`;
}

