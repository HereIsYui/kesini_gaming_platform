export const PVE_RISK_CONFIG_KEY = "pve_risk_control";

/**
 * PVE 挑战/自动战斗接口的频率风控配置。
 * 存储于 SystemConfig 表（key = pve_risk_control），由后台维护。
 */
export interface PveRiskConfig {
  /** 风控总开关，关闭后所有挑战/自动战斗不再限流 */
  enabled: boolean;
  /** 计数窗口长度（秒） */
  windowSeconds: number;
  /** 单个窗口内允许的最大调用次数，超过即封禁 */
  limit: number;
  /** 触发后封禁时长（秒） */
  banSeconds: number;
}

export const DEFAULT_PVE_RISK_CONFIG: PveRiskConfig = {
  enabled: true,
  windowSeconds: 60,
  limit: 50,
  banSeconds: 300,
};

function normalizePositiveInt(value: unknown, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  const int = Math.floor(num);
  return int >= 1 ? int : fallback;
}

/**
 * 归一化风控配置：非法或缺失字段回退默认值，数值字段最小为 1。
 */
export function normalizePveRiskConfig(value: unknown): PveRiskConfig {
  const raw = (value && typeof value === "object" ? value : {}) as Record<
    string,
    unknown
  >;
  return {
    enabled: raw.enabled === undefined ? DEFAULT_PVE_RISK_CONFIG.enabled : raw.enabled !== false,
    windowSeconds: normalizePositiveInt(
      raw.windowSeconds,
      DEFAULT_PVE_RISK_CONFIG.windowSeconds,
    ),
    limit: normalizePositiveInt(raw.limit, DEFAULT_PVE_RISK_CONFIG.limit),
    banSeconds: normalizePositiveInt(
      raw.banSeconds,
      DEFAULT_PVE_RISK_CONFIG.banSeconds,
    ),
  };
}
