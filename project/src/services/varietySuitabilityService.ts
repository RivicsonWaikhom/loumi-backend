import { API_ENDPOINTS } from "@/config/api";
import { postJson } from "./apiClient";
import type {
  VarietySuitabilityRequest,
  VarietySuitabilityResponse,
} from "@/types/suitability";

export async function checkSuitability(
  request: VarietySuitabilityRequest
): Promise<VarietySuitabilityResponse> {
  return postJson<VarietySuitabilityRequest, VarietySuitabilityResponse>(
    API_ENDPOINTS.varietySuitability,
    request,
    { timeoutMs: 45_000 }
  );
}
