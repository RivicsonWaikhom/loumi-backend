export type DiseaseClassification = "healthy" | "diseased" | "uncertain";

export interface DiseaseDetectionRequest {
  captureSource?: "upload" | "camera";
  notes?: string;
  farmId?: string;
  plantId?: string;
}

export interface DiseaseResult {
  diseaseName: string;
  classification: DiseaseClassification;
  confidence?: number; // 0..1
  symptoms: string[];
  nextSteps: string[];
  prevention: string[];
}

export interface RankedClass {
  className: string;
  displayName: string;
  score: number;
  percentage: number;
}

export interface PlantObservation {
  id: string;
  farm_id: string;
  plant_id: string;
  observed_at: string;
  status: string;
  condition?: string | null;
  confidence?: number;
  notes?: string | null;
}

export interface DiseaseSource {
  title: string;
  org?: string;
  url?: string;
  date?: string;
  quality?: string;
  limits?: string;
}

export type ValidationCategory = "leaf" | "fruit" | "plant" | "invalid";

export interface ImageValidationDetails {
  category: ValidationCategory;
  is_valid_leaf: boolean;
  confidence: number;
  category_scores: Record<ValidationCategory, number>;
  message: string;
  error?: string;
}

export interface DiseaseDetectionResponse {
  validation?: ImageValidationDetails;
  result?: DiseaseResult | null;
  scores?: Record<string, number>;
  rankedClasses?: RankedClass[];
  topClass?: string | null;
  displayName?: string | null;
  topScore?: number | null;
  isUncertain?: boolean;
  uncertaintyThreshold?: number;
  warnings?: string[];
  limitationText?: string;
  modelVersion?: string;
  observation?: PlantObservation | null;
  sources?: Record<string, DiseaseSource>;
}

export interface DiseaseDetectionErrorResponse {
  error?: string;
  detail?: string;
  code?: string;
}
