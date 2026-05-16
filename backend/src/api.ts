import type { ApiResponse } from "./types";

const DEFAULT_API_BASE = "http://localhost:3000";

export function getApiBase() {
  const envBase = (import.meta as any).env?.PUBLIC_API_BASE;
  return localStorage.getItem("kesini_api_base") || envBase || DEFAULT_API_BASE;
}

export function setApiBase(value: string) {
  localStorage.setItem("kesini_api_base", value.replace(/\/$/, ""));
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
