import { API_ENDPOINTS } from "@/config/api";
import { postForm } from "./apiClient";
import type {
  DiseaseDetectionResponse,
  DiseaseDetectionErrorResponse,
} from "@/types/disease";

const ENDPOINT = API_ENDPOINTS.diseaseDetection;

export interface AnalyzeImageOptions {
  captureSource?: "upload" | "camera";
  notes?: string;
  farmId?: string;
  plantId?: string;
}

export async function analyzeImage(
  file: File,
  options: AnalyzeImageOptions = {}
): Promise<DiseaseDetectionResponse> {
  const form = new FormData();
  form.append("image", file, file.name);
  if (options.captureSource) form.append("captureSource", options.captureSource);
  if (options.notes) form.append("notes", options.notes);
  if (options.farmId) form.append("farm_id", options.farmId);
  if (options.plantId) form.append("plant_id", options.plantId);

  return postForm<DiseaseDetectionResponse>(ENDPOINT, form, {
    timeoutMs: 60_000,
  });
}

export function isDiseaseServiceUnreachable(error: unknown): boolean {
  if (!(error instanceof Error)) return true;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("load failed") ||
    (error as { code?: string }).code === "network_error"
  );
}

export type DiseaseDetectionErrorResponse_ = DiseaseDetectionErrorResponse;
