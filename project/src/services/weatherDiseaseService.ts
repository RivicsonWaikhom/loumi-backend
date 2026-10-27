import { API_ENDPOINTS, WEATHER_API_URL } from "@/config/api";
import { postJson, ApiError } from "./apiClient";
import type {
  WeatherDiseaseRequest,
  WeatherDiseaseResponse,
} from "@/types/weatherDisease";

export interface GeocodeResult {
  name: string;
  admin?: string;
  country?: string;
  latitude: number;
  longitude: number;
}

export async function predictDiseaseRisk(
  request: WeatherDiseaseRequest
): Promise<WeatherDiseaseResponse> {
  return postJson<WeatherDiseaseRequest, WeatherDiseaseResponse>(
    API_ENDPOINTS.weatherDisease,
    request,
    { timeoutMs: 45_000 }
  );
}

export function isWeatherApiConfigured(): boolean {
  return Boolean(WEATHER_API_URL);
}

export async function fetchWeather(
  latitude: number,
  longitude: number
): Promise<{
  temperatureC: number;
  humidity: number;
  rainfallMm: number;
  temperatureMin?: number;
  temperatureMax?: number;
  periodRainfallMm?: number;
  estimatedAnnualRainfall?: number;
  source?: string;
  timezone?: string;
}> {
  const url = `${WEATHER_API_URL}?lat=${latitude}&lon=${longitude}`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new ApiError(
      errorData.detail || errorData.error || `Weather service error: ${res.status}`,
      res.status
    );
  }
  return res.json();
}

export async function geocodePlace(query: string): Promise<GeocodeResult[]> {
  const url = `${API_ENDPOINTS.weatherGeocode}?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new ApiError(
      errorData.detail || errorData.error || `Geocoding service error: ${res.status}`,
      res.status
    );
  }
  const data = await res.json();
  return data.results ?? [];
}
