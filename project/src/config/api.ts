const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

const WEATHER_API_BASE_URL =
  import.meta.env.VITE_WEATHER_API_BASE_URL ?? "";

const withBase = (path: string): string =>
  path.startsWith("http") ? path : `${API_BASE_URL}${path}`;

export const API_ENDPOINTS = {
  authSignup: withBase("/api/auth/signup"),
  authLogin: withBase("/api/auth/login"),
  authMe: withBase("/api/auth/me"),
  authLogout: withBase("/api/auth/logout"),
  farms: withBase("/api/farms"),
  farmsDemo: withBase("/api/farms/demo"),
  farmsSync: withBase("/api/farms/sync"),
  diseaseDetection: withBase("/api/disease-detection"),
  farmPlanner: withBase("/api/farm-planner"),
  farmPlannerDiagnose: withBase("/api/farm-planner/diagnose"),
  chatbot: withBase("/api/chat"),
  chatConversation: withBase("/api/chat/conversation"),
  chatConversations: withBase("/api/chat/conversations"),
  chatDiagnose: withBase("/api/chat/diagnose"),
  varietySuitability: withBase("/api/variety-suitability"),
  weatherDisease: withBase("/api/weather-disease-prediction"),
  weatherGeocode: withBase("/api/weather/geocode"),
  marketplaceCategories: withBase("/api/marketplace/categories"),
  marketplaceProducts: withBase("/api/marketplace/products"),
  marketplaceShops: withBase("/api/marketplace/shops"),
  marketplaceRecommendations: withBase("/api/marketplace/recommendations"),
  marketplaceCart: withBase("/api/marketplace/cart"),
  marketplaceOrders: withBase("/api/marketplace/orders"),
  marketplaceAdminOrders: withBase("/api/marketplace/admin/orders"),
  marketplaceAdminProducts: withBase("/api/marketplace/admin/products"),
};

export const WEATHER_API_URL = WEATHER_API_BASE_URL
  ? (WEATHER_API_BASE_URL.startsWith("http") ? WEATHER_API_BASE_URL : withBase(WEATHER_API_BASE_URL))
  : withBase("/api/weather");

export const API_CONFIG = {
  baseURL: API_BASE_URL,
  timeoutMs: 30_000,
};
