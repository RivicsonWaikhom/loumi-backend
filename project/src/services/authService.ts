import { API_ENDPOINTS } from "@/config/api";
import { postJson, getJson, setStoredAuthToken, getStoredAuthToken } from "./apiClient";

export interface User {
  id: string;
  email: string;
  full_name: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  message?: string;
}

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  const data = await postJson<{ email: string; password: string }, AuthResponse>(
    API_ENDPOINTS.authLogin,
    { email, password }
  );
  if (data.token) {
    setStoredAuthToken(data.token);
  }
  return data;
}

export async function signupUser(fullName: string, email: string, password: string): Promise<AuthResponse> {
  const data = await postJson<{ full_name: string; email: string; password: string }, AuthResponse>(
    API_ENDPOINTS.authSignup,
    { full_name: fullName, email, password }
  );
  if (data.token) {
    setStoredAuthToken(data.token);
  }
  return data;
}

export async function fetchCurrentUser(): Promise<User | null> {
  const token = getStoredAuthToken();
  if (!token) return null;
  try {
    const data = await getJson<{ user: User }>(API_ENDPOINTS.authMe);
    return data.user;
  } catch (err) {
    setStoredAuthToken(null);
    return null;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await postJson(API_ENDPOINTS.authLogout, {});
  } catch (e) {
    // Ignore network error on logout
  } finally {
    setStoredAuthToken(null);
  }
}
