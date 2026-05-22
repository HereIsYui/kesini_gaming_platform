import type { ApiResponse } from "./types";

const DEFAULT_API_BASE = "http://localhost:7001";
const API_BASE_KEY = "kesini_api_base";

function getEnvValue(key: string) {
  const value = (import.meta as any).env?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function normalizeBase(value: string | null | undefined) {
  return value?.trim().replace(/\/+$/, "") || "";
}

export function getApiBase() {
  const envBase = normalizeBase(getEnvValue("PUBLIC_API_BASE"));
  if (envBase) {
    return envBase;
  }
  return (
    normalizeBase(localStorage.getItem(API_BASE_KEY)) ||
    DEFAULT_API_BASE
  );
}

export function setApiBase(value: string) {
  localStorage.setItem(API_BASE_KEY, normalizeBase(value));
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
