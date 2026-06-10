import type {
  MonthlyCardSubscription,
  MonthlyCardType,
} from "src/entity/monthlyCardSubscription.entity";
import type { GameVipTier } from "src/vip/game-vip";

export const MONTHLY_CARD_CONFIG_KEY = "monthly_card_config";
export const MONTHLY_CARD_DURATION_DAYS = 30;
export const MONTHLY_CARD_TYPES = ["ice", "platinum"] as const;

export interface MonthlyCardPlanConfig {
  enabled: boolean;
  price: number;
  vipLevel: 3 | 4;
  label: string;
}

export interface MonthlyCardConfig {
  enabled: boolean;
  durationDays: number;
  plans: Record<MonthlyCardType, MonthlyCardPlanConfig>;
}

export interface MonthlyCardPlanView extends MonthlyCardPlanConfig {
  cardType: MonthlyCardType;
  durationDays: number;
}

export interface MonthlyCardStatusView extends MonthlyCardPlanView {
  active: boolean;
  permanent: boolean;
  expiresAt: string | null;
  statusLabel: string;
  actionLabel: string;
  canPurchase: boolean;
  unavailableReason: string;
}

export const DEFAULT_MONTHLY_CARD_CONFIG: MonthlyCardConfig = {
  enabled: false,
  durationDays: MONTHLY_CARD_DURATION_DAYS,
  plans: {
    ice: {
      enabled: false,
      price: 0,
      vipLevel: 3,
      label: "星穹月卡",
    },
    platinum: {
      enabled: false,
      price: 0,
      vipLevel: 4,
      label: "星耀月卡",
    },
  },
};

export function normalizeMonthlyCardConfig(value: unknown): MonthlyCardConfig {
  const raw = (value && typeof value === "object" ? value : {}) as Record<
    string,
    any
  >;
  const rawPlans =
    raw.plans && typeof raw.plans === "object"
      ? (raw.plans as Record<string, any>)
      : {};
  const durationDays = normalizePositiveInt(
    raw.durationDays,
    MONTHLY_CARD_DURATION_DAYS,
  );
  const plans = MONTHLY_CARD_TYPES.reduce(
    (result, cardType) => {
      const fallback = DEFAULT_MONTHLY_CARD_CONFIG.plans[cardType];
      const rawPlan =
        rawPlans[cardType] && typeof rawPlans[cardType] === "object"
          ? rawPlans[cardType]
          : {};
      result[cardType] = {
        enabled:
          rawPlan.enabled === undefined
            ? raw[`${cardType}_enabled`] === undefined
              ? fallback.enabled
              : raw[`${cardType}_enabled`] === true
            : rawPlan.enabled === true,
        price: normalizeNonNegativeInt(
          rawPlan.price ?? raw[`${cardType}_price`],
          fallback.price,
        ),
        vipLevel: fallback.vipLevel,
        label: fallback.label,
      };
      return result;
    },
    {} as Record<MonthlyCardType, MonthlyCardPlanConfig>,
  );
  return {
    enabled:
      raw.enabled === undefined
        ? DEFAULT_MONTHLY_CARD_CONFIG.enabled
        : raw.enabled === true,
    durationDays,
    plans,
  };
}

export function flattenMonthlyCardConfig(config: MonthlyCardConfig) {
  const normalized = normalizeMonthlyCardConfig(config);
  return {
    enabled: normalized.enabled,
    durationDays: normalized.durationDays,
    ice_enabled: normalized.plans.ice.enabled,
    ice_price: normalized.plans.ice.price,
    platinum_enabled: normalized.plans.platinum.enabled,
    platinum_price: normalized.plans.platinum.price,
  };
}

export function monthlyCardPlans(config: MonthlyCardConfig) {
  const normalized = normalizeMonthlyCardConfig(config);
  return MONTHLY_CARD_TYPES.map((cardType) => ({
    cardType,
    ...normalized.plans[cardType],
    durationDays: normalized.durationDays,
  }));
}

export function monthlyCardVipTier(
  subscriptions: MonthlyCardSubscription[],
  now = new Date(),
): GameVipTier {
  return subscriptions.reduce<GameVipTier>((tier, subscription) => {
    if (!isMonthlyCardActive(subscription, now)) {
      return tier;
    }
    return Math.max(tier, normalizeMonthlyVipLevel(subscription.vip_level)) as
      | 0
      | 1
      | 2
      | 3
      | 4;
  }, 0);
}

export function isMonthlyCardActive(
  subscription: MonthlyCardSubscription | null | undefined,
  now = new Date(),
) {
  if (!subscription?.expires_at) {
    return false;
  }
  return new Date(subscription.expires_at).getTime() > now.getTime();
}

export function normalizeMonthlyCardType(value: unknown): MonthlyCardType {
  const text = String(value || "").trim();
  if (MONTHLY_CARD_TYPES.includes(text as MonthlyCardType)) {
    return text as MonthlyCardType;
  }
  throw new Error("月卡类型无效");
}

export function normalizeMonthlyVipLevel(value: unknown): GameVipTier {
  const level = Number(value || 0);
  return level === 3 || level === 4 ? (level as GameVipTier) : 0;
}

export function toMonthlyCardPlanView(
  config: MonthlyCardConfig,
): MonthlyCardPlanView[] {
  return monthlyCardPlans(config);
}

function normalizePositiveInt(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function normalizeNonNegativeInt(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}
