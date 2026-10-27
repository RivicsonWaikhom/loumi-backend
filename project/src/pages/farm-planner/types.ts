export const STATUS_INFO: Record<string, { label: string; symbol: string; color: string; bg: string; text: string }> = {
  unknown: { label: "Not inspected", symbol: "○", color: "#64748b", bg: "bg-slate-100", text: "text-slate-700" },
  healthy: { label: "Healthy", symbol: "●", color: "#16a34a", bg: "bg-emerald-100", text: "text-emerald-800" },
  suspected: { label: "Suspected disease", symbol: "◆", color: "#d97706", bg: "bg-amber-100", text: "text-amber-800" },
  disease: { label: "Recorded disease", symbol: "■", color: "#dc2626", bg: "bg-red-100", text: "text-red-800" },
  inspect: { label: "Needs inspection", symbol: "▲", color: "#2563eb", bg: "bg-blue-100", text: "text-blue-800" },
};

export interface LocationPoint {
  lat: number;
  lon: number;
  acc?: number | null;
  how?: string;
  at?: string | null;
}

export interface CornerCheck {
  is_valid: boolean;
  lb: number;
  lk: number;
  ang: number;
  eL: number;
  eB: number;
  max_acc?: number | null;
  has_unknown_acc: boolean;
}

export interface Observation {
  id: string;
  farm_id: string;
  plant_id: string;
  observed_at: string;
  status: string;
  condition?: string | null;
  notes?: string | null;
}

export interface Plant {
  id: string;
  farm_id: string;
  row: number;
  pos: number;
  x: number;
  y: number;
  status: string;
  retired_at?: string | null;
  retired_reason?: string | null;
  observations: Observation[];
  approx_gps?: { lat: number; lon: number } | null;
}

export interface Task {
  id: string;
  farm_id: string;
  plant_id?: string | null;
  title: string;
  due_date: string;
  status: "open" | "done";
  source?: string | null;
  notes?: string | null;
  completed_at?: string | null;
}

export interface Farm {
  id: string;
  name: string;
  variety: string;
  length: number;
  breadth: number;
  row_spacing: number;
  plant_spacing: number;
  clearance: number;
  staggered: boolean;
  planting_date?: string | null;
  location?: LocationPoint | null;
  cor_A?: LocationPoint | null;
  cor_B?: LocationPoint | null;
  cor_C?: LocationPoint | null;
  corner_check?: CornerCheck | null;
  plants: Plant[];
  tasks: Task[];
  total_plants: number;
  active_plants: number;
  is_demo?: boolean;
}
