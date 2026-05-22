import type { ApiResponse } from "./types";

const DEV_API_BASE = "http://localhost:7001";
const API_BASE_KEY = "kesini_api_base";

function getEnvValue(key: string) {
  const value = (import.meta as any).env?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function normalizeBase(value: string | null | undefined) {
  return value?.trim().replace(/\/+$/, "") || "";
}

function getRuntimeApiBase() {
  if (typeof window === "undefined") {
    return "";
  }
  return normalizeBase(window.__KESINI_CONFIG__?.API_BASE);
}

function getStoredApiBase() {
  const storedBase = normalizeBase(localStorage.getItem(API_BASE_KEY));
  if (
    import.meta.env.PROD &&
    /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::|$)/i.test(storedBase)
  ) {
    return "";
  }
  return storedBase;
}

function getDevApiBase() {
  return import.meta.env.DEV ? DEV_API_BASE : "";
}

export function getApiBase() {
  const runtimeBase = getRuntimeApiBase();
  if (runtimeBase) {
    return runtimeBase;
  }
  const envBase = normalizeBase(getEnvValue("PUBLIC_API_BASE"));
  if (envBase) {
    return envBase;
  }
  return getStoredApiBase() || getDevApiBase();
}

export function setApiBase(value: string) {
  const normalized = normalizeBase(value);
  if (normalized) {
    localStorage.setItem(API_BASE_KEY, normalized);
  } else {
    localStorage.removeItem(API_BASE_KEY);
  }
}

export function getToken() {
  return localStorage.getItem("kesini_admin_token") || "";
}

export function setToken(token: string) {
  localStorage.setItem("kesini_admin_token", token);
}

export function clearToken() {
  localStorage.removeItem("kesini_admin_token");
}

export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const response = await fetch(`${getApiBase()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const payload = (await response.json()) as ApiResponse<T>;
  if (!response.ok || payload.code !== 0) {
    throw new Error(payload.msg || "请求失败");
  }
  return payload.data;
}

export function toQuery(params: Record<string, unknown>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });
  const result = query.toString();
  return result ? `?${result}` : "";
}
