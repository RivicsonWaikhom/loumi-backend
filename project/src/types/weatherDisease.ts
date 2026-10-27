export type RiskLevel =
  | "low"
  | "moderate"
  | "high"
  | "insufficient_data"
  | "not_assessable";

export interface WeatherConditions {
  temperatureC?: number;
  humidity?: number;
  rainfallMm?: number;
  soilMoisture?: number;
  windSpeedKmh?: number;
  cloudCover?: number;
  observed?: boolean; // true = observed, false = forecast
  source?: string;
  timezone?: string;
  localDate?: string;
}

export interface DiseaseRisk {
  disease: string;
  diseaseId?: string;
  riskLevel: RiskLevel;
  probability?: number | null;
  riskScore?: number;
  contributingConditions: string[];
  riskFactors: string[];
  preventiveActions: string[];
  monitoringRecommendations: string[];
  evidenceSources?: Array<{ src: string; page?: string; claim: string }>;
  limitations?: string[];
  paramsValidated?: boolean;
}

export interface WeatherDiseaseRequest {
  state?: string;
  district?: string;
  village?: string;
  latitude?: number;
  longitude?: number;
  crop?: string;
  farm_id?: string;
  flower_induction_date?: string;
  drainage?: "poor" | "good" | "";
  forecastDays?: number;
  weather?: WeatherConditions;
}

export interface WeatherDiseaseResponse {
  risks: DiseaseRisk[];
  weather: WeatherConditions;
  predictionTimestamp?: string;
  forecastPeriod?: string;
  notes?: string[];
  farm_id?: string;
  crop?: string;
  latitude?: number;
  longitude?: number;
  summary?: {
    rain_7d_mm: number;
    rain_fcst_3d_mm: number;
    wet_run_days: number;
    complete: boolean;
  };
  engine_version?: string;
  note?: string;
}
