export type AreaUnit = "acres" | "hectares";
export type SoilType =
  | "loamy"
  | "sandy"
  | "clay"
  | "silty"
  | "peaty"
  | "chalky"
  | "unknown";
export type IrrigationMethod =
  | "drip"
  | "sprinkler"
  | "furrow"
  | "rainfed"
  | "manual"
  | "none";
export type WaterAvailability = "abundant" | "adequate" | "limited" | "scarce";

export interface FarmPlannerRequest {
  area: number;
  unit: AreaUnit;
  location: string;
  soilType: SoilType;
  plantingDate?: string;
  plantingSeason?: string;
  waterAvailability: WaterAvailability;
  irrigationMethod: IrrigationMethod;
  budget?: number;
  goals?: string;
}

export interface FarmStageTask {
  stage: string;
  tasks: string[];
}

export interface TimelinePhase {
  phase: string;
  timeframe: string;
  activities: string[];
}

export interface CostBreakdownItem {
  category: string;
  estimatedCost: number;
  currency?: string;
}

export interface FarmPlan {
  timeline: TimelinePhase[];
  landPreparation: string[];
  plantingSchedule: string[];
  plantSpacing?: string;
  estimatedPlantCount?: number;
  irrigation: string[];
  fertilizer: string[];
  tasksByStage: FarmStageTask[];
  harvestTiming: string[];
  costBreakdown?: CostBreakdownItem[];
  notes?: string[];
  geometry?: {
    lengthMeters: number;
    breadthMeters: number;
    samplePlants?: Array<{
      id: string;
      row: number;
      pos: number;
      x: number;
      y: number;
      status: string;
    }>;
  };
}

export interface FarmPlannerResponse {
  plan: FarmPlan;
  generatedAt?: string;
  modelVersion?: string;
}

export interface LeafDiagnoseResponse {
  scores: Record<string, number>;
  top_class: string;
  top_class_display: string;
  top_score: number;
  uncertainty_threshold: number;
  is_uncertain: boolean;
  model_version: string;
  limitation_text: string;
  knowledge_base?: {
    display_name?: string;
    explanation?: string;
    symptoms?: Array<{ text: string; evidence: string; sources: string[] }>;
    look_alikes?: Array<{ text: string; evidence: string; sources: string[] }>;
    field_actions?: Array<{ text: string; evidence: string; sources: string[] }>;
    prevention?: Array<{ text: string; evidence: string; sources: string[] }>;
    diagnostic_questions?: string[];
  };
}

