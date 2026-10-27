import { API_ENDPOINTS } from "@/config/api";
import { postJson, postForm, getJson, putJson, deleteJson } from "./apiClient";
import type {
  FarmPlannerRequest,
  FarmPlannerResponse,
  LeafDiagnoseResponse,
} from "@/types/farmPlanner";
import type { Farm, Observation } from "@/pages/farm-planner/types";

export async function generateFarmPlan(
  request: FarmPlannerRequest
): Promise<FarmPlannerResponse> {
  return postJson<FarmPlannerRequest, FarmPlannerResponse>(
    API_ENDPOINTS.farmPlanner,
    request,
    { timeoutMs: 45_000 }
  );
}

export async function diagnoseFarmLeaf(
  file: File
): Promise<LeafDiagnoseResponse> {
  const formData = new FormData();
  formData.append("file", file);
  return postForm<LeafDiagnoseResponse>(
    API_ENDPOINTS.farmPlannerDiagnose,
    formData,
    { timeoutMs: 30_000 }
  );
}

// ----------------- ISOLATED FARMS & PLANTS API -----------------

export async function fetchBackendFarm(farmId: string): Promise<Farm> {
  return getJson<Farm>(`${API_ENDPOINTS.farms}/${farmId}`, { timeoutMs: 20_000 });
}

export async function fetchUserFarms(): Promise<Farm[]> {
  return getJson<Farm[]>(API_ENDPOINTS.farms, { timeoutMs: 20_000 });
}

export async function createBackendFarm(payload: Partial<Farm>): Promise<Farm> {
  return postJson<Partial<Farm>, Farm>(API_ENDPOINTS.farms, payload, {
    timeoutMs: 30_000,
  });
}

export async function updateBackendFarm(
  farmId: string,
  payload: Partial<Farm>
): Promise<Farm> {
  return putJson<Partial<Farm>, Farm>(
    `${API_ENDPOINTS.farms}/${farmId}`,
    payload,
    { timeoutMs: 30_000 }
  );
}

export async function createDemoBackendFarm(): Promise<Farm> {
  return postJson<Record<string, never>, Farm>(
    API_ENDPOINTS.farmsDemo,
    {},
    { timeoutMs: 30_000 }
  );
}

export async function deleteBackendFarm(farmId: string): Promise<void> {
  return deleteJson<void>(`${API_ENDPOINTS.farms}/${farmId}`, {
    timeoutMs: 20_000,
  });
}

export async function recordBackendObservation(
  farmId: string,
  plantId: string,
  payload: {
    status: string;
    condition?: string;
    confidence?: number;
    notes?: string;
    observed_at?: string;
  }
): Promise<Observation> {
  return postJson<typeof payload, Observation>(
    `${API_ENDPOINTS.farms}/${farmId}/plants/${plantId}/observations`,
    payload,
    { timeoutMs: 20_000 }
  );
}

export async function syncLocalFarmsWithBackend(farms: Farm[]): Promise<Farm[]> {
  return postJson<{ farms: Farm[] }, Farm[]>(
    API_ENDPOINTS.farmsSync,
    { farms },
    { timeoutMs: 40_000 }
  );
}
