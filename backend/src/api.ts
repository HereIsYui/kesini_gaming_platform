import type { ApiResponse } from "./types";

const DEV_API_BASE = "http://localhost:3000";
const LOCAL_API_PORT = "3000";
const API_BASE_KEY = "kesini_api_base";

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

export class UnauthorizedError extends Error {
  constructor() {
    super("登录已失效");
    this.name = "UnauthorizedError";
  }
}

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

function getEnvValue(key: string) {
  const value = import.meta.env?.[key];
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

function getLocalDebugApiBase() {
  if (typeof window === "undefined") {
    return "";
  }
  const hostname = window.location.hostname;
  if (/^(localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|::1)$/i.test(hostname)) {
    return DEV_API_BASE;
  }
  if (
    /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(hostname) ||
    hostname.endsWith(".local")
  ) {
    const apiHost = hostname.includes(":") ? `[${hostname}]` : hostname;
    return `http://${apiHost}:${LOCAL_API_PORT}`;
  }
  return "";
}

function getDevApiBase() {
  return import.meta.env.DEV
    ? getLocalDebugApiBase() || DEV_API_BASE
    : getLocalDebugApiBase();
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

function handleUnauthorized(): never {
  clearToken();
  unauthorizedHandler?.();
  throw new UnauthorizedError();
}

export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  const response = await fetch(`${getApiBase()}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const raw = await response.text();
  let payload: ApiResponse<T>;
  try {
    payload = JSON.parse(raw) as ApiResponse<T>;
  } catch {
    if (response.status === 401) {
      handleUnauthorized();
    }
    const contentType = response.headers.get("Content-Type") || "";
    if (contentType.includes("text/html") || raw.trimStart().startsWith("<")) {
      throw new Error("暂时无法连接");
    }
    throw new Error("请求失败");
  }
  if (response.status === 401) {
    handleUnauthorized();
  }
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
