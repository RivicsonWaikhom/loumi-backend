export type SuitabilityStatus =
  | "suitable"
  | "conditionally_suitable"
  | "unsuitable"
  | "insufficient_data";

export type SoilDrainage =
  | "excellent"
  | "good"
  | "moderate"
  | "poor"
  | "unknown";

export type WaterAvailability = "reliable" | "seasonal" | "limited";

export type IntendedUse = "fresh" | "processing" | "both";

export interface VarietySuitabilityRequest {
  state: string;
  district: string;
  village?: string;
  latitude?: number;
  longitude?: number;
  soilType?: string;
  soilPH?: number;
  soilDrainage?: SoilDrainage;
  waterAvailability?: WaterAvailability;
  temperatureMin?: number;
  temperatureMax?: number;
  rainfall?: number;
  plantingSeason?: string;
  elevation?: number;
  farmArea?: number;
  preferredVariety?: string;
  intendedUse?: IntendedUse;
  notes?: string;
  // Soil macronutrients from soil test report (kg/ha)
  nitrogen?: number;
  phosphorus?: number;
  potassium?: number;
}

export interface VarietyRecommendation {
  variety: string;
  score?: number;
  bestUse?: string;
  description?: string;
  advantages?: string[];
  limitations?: string[];
  optimalConditions?: string[];
  reasons: string[];
}

export interface ConditionUsed {
  field: string;
  value: string;
  source: "provided" | "regional_baseline";
  sourceLabel: string;
}

export interface SuitabilityResult {
  status: SuitabilityStatus;
  score?: number; // 0..100
  scoreExplanation?: string;
  workflowType?: "preliminary" | "soil_test";
  recommendedVarieties: VarietyRecommendation[];
  reasons: string[];
  limitations: string[];
  improvements: string[];
  additionalDataNeeded: string[];
  conditionsUsed?: ConditionUsed[];
  dataStillNeeded?: string[];
}

export interface VarietySuitabilityResponse {
  result: SuitabilityResult;
  modelVersion?: string;
}
