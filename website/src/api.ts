import type { ApiResponse } from "./types";

const DEFAULT_API_BASE = "http://localhost:3000";
const API_BASE_KEY = "kesini_website_api_base";
const TOKEN_KEY = "kesini_website_token";
const USER_KEY = "kesini_website_user";

export function getApiBase() {
  const envBase = import.meta.env.VITE_API_BASE;
  return localStorage.getItem(API_BASE_KEY) || envBase || DEFAULT_API_BASE;
}

export function setApiBase(value: string) {
  localStorage.setItem(API_BASE_KEY, value.replace(/\/$/, ""));
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser<T>() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function setStoredUser(value: unknown) {
  localStorage.setItem(USER_KEY, JSON.stringify(value));
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
