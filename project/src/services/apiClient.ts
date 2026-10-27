import { API_CONFIG } from "@/config/api";

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

const DEFAULT_TIMEOUT = API_CONFIG.timeoutMs;
const TOKEN_KEY = "loumi_auth_token";

export function getStoredAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredAuthToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch (e) {
    console.error("Failed to update auth token in localStorage:", e);
  }
}

async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs = DEFAULT_TIMEOUT
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

export interface RequestOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
}

function buildHeaders(custom?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getStoredAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return { ...headers, ...(custom ?? {}) };
}

function buildFormHeaders(custom?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = getStoredAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return { ...headers, ...(custom ?? {}) };
}

function asMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unexpected error occurred.";
}

export async function getJson<TRes>(
  url: string,
  opts: RequestOptions = {}
): Promise<TRes> {
  try {
    return await withTimeout<TRes>(async (signal) => {
      const res = await fetch(url, {
        method: "GET",
        headers: buildHeaders(opts.headers),
        signal,
      });
      return (await parseResponse<TRes>(res)) as TRes;
    }, opts.timeoutMs);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(asMessage(err), 0, "network_error");
  }
}

export async function postJson<TReq, TRes>(
  url: string,
  body: TReq,
  opts: RequestOptions = {}
): Promise<TRes> {
  try {
    return await withTimeout<TRes>(async (signal) => {
      const res = await fetch(url, {
        method: "POST",
        headers: buildHeaders(opts.headers),
        body: JSON.stringify(body),
        signal,
      });
      return (await parseResponse<TRes>(res)) as TRes;
    }, opts.timeoutMs);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(asMessage(err), 0, "network_error");
  }
}

export async function putJson<TReq, TRes>(
  url: string,
  body: TReq,
  opts: RequestOptions = {}
): Promise<TRes> {
  try {
    return await withTimeout<TRes>(async (signal) => {
      const res = await fetch(url, {
        method: "PUT",
        headers: buildHeaders(opts.headers),
        body: JSON.stringify(body),
        signal,
      });
      return (await parseResponse<TRes>(res)) as TRes;
    }, opts.timeoutMs);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(asMessage(err), 0, "network_error");
  }
}

export async function deleteJson<TRes>(
  url: string,
  opts: RequestOptions = {}
): Promise<TRes> {
  try {
    return await withTimeout<TRes>(async (signal) => {
      const res = await fetch(url, {
        method: "DELETE",
        headers: buildHeaders(opts.headers),
        signal,
      });
      return (await parseResponse<TRes>(res)) as TRes;
    }, opts.timeoutMs);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(asMessage(err), 0, "network_error");
  }
}

export async function postForm<TRes>(
  url: string,
  form: FormData,
  opts: RequestOptions = {}
): Promise<TRes> {
  try {
    return await withTimeout<TRes>(async (signal) => {
      const res = await fetch(url, {
        method: "POST",
        // Note: Do not set Content-Type header on FormData so browser sets boundary
        headers: buildFormHeaders(opts.headers),
        body: form,
        signal,
      });
      return (await parseResponse<TRes>(res)) as TRes;
    }, opts.timeoutMs);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(asMessage(err), 0, "network_error");
  }
}

async function parseResponse<TRes>(res: Response): Promise<TRes> {
  const isJson = (res.headers.get("content-type") ?? "").includes(
    "application/json"
  );
  const payload = isJson ? await res.json().catch(() => undefined) : undefined;
  if (!res.ok) {
    const message =
      (payload && (payload.detail || payload.error || payload.message)) ||
      `Request failed with status ${res.status}`;
    throw new ApiError(message, res.status, payload?.code);
  }
  if (payload === undefined && res.status !== 204) {
    throw new ApiError("Server returned an empty or non-JSON response.", res.status, "bad_response");
  }
  return payload as TRes;
}
