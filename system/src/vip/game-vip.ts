import type { RedeemRewards } from "src/entity/redeemCode.entity";

export const GAME_VIP_CONFIG_KEY = "game_vip_benefits";
export const GAME_VIP_TIERS = [1, 2, 3, 4] as const;

export type GameVipTier = 0 | (typeof GAME_VIP_TIERS)[number];
export type GameVipTierKey = `${(typeof GAME_VIP_TIERS)[number]}`;
export type GameVipSource = "fishpi" | "badge";

export interface GameVipBenefit {
  sweepLimit: number;
  tradeFeeDiscount: number;
  dailyRewards: RedeemRewards;
}

export interface GameVipConfig {
  tiers: Record<GameVipTierKey, GameVipBenefit>;
}

export interface GameVipStatusView {
  checked: boolean;
  active: boolean;
  tier: GameVipTier;
  label: string;
  sources: GameVipSource[];
  sourceLabels: string[];
  sweepLimit: number;
  tradeFeeDiscount: number;
  dailyRewards: RedeemRewards;
  dailyClaimed: boolean;
  dailyClaimDate: string;
}

export const DEFAULT_GAME_VIP_CONFIG: GameVipConfig = {
  tiers: {
    "1": {
      sweepLimit: 5,
      tradeFeeDiscount: 0.02,
      dailyRewards: { points: 10, items: [] },
    },
    "2": {
      sweepLimit: 10,
      tradeFeeDiscount: 0.04,
      dailyRewards: { points: 15, items: [] },
    },
    "3": {
      sweepLimit: 20,
      tradeFeeDiscount: 0.06,
      dailyRewards: { points: 25, items: [] },
    },
    "4": {
      sweepLimit: 50,
      tradeFeeDiscount: 0.08,
      dailyRewards: { points: 40, items: [] },
    },
  },
};

export const GAME_VIP_FRAGMENT_DEFAULTS: Record<
  GameVipTierKey,
  Array<{ name: string; num: number }>
> = {
  "1": [{ name: "R碎片", num: 2 }],
  "2": [
    { name: "R碎片", num: 4 },
    { name: "SR碎片", num: 1 },
  ],
  "3": [{ name: "SR碎片", num: 2 }],
  "4": [
    { name: "SR碎片", num: 3 },
    { name: "SSR碎片", num: 1 },
  ],
};

export function normalizeGameVipConfig(value: unknown): GameVipConfig {
  const raw = (value && typeof value === "object" ? value : {}) as Record<
    string,
    any
  >;
  const rawTiers =
    raw.tiers && typeof raw.tiers === "object"
      ? (raw.tiers as Record<string, any>)
      : raw;
  const tiers = GAME_VIP_TIERS.reduce(
    (result, tier) => {
      const key = String(tier) as GameVipTierKey;
      const fallback = DEFAULT_GAME_VIP_CONFIG.tiers[key];
      const flatPrefix = `vip${tier}_`;
      const tierValue =
        rawTiers[key] && typeof rawTiers[key] === "object"
          ? rawTiers[key]
          : {};
      result[key] = {
        sweepLimit: normalizeNonNegativeInt(
          tierValue.sweepLimit ?? raw[`${flatPrefix}sweepLimit`],
          fallback.sweepLimit,
        ),
        tradeFeeDiscount: normalizeDiscount(
          tierValue.tradeFeeDiscount ?? raw[`${flatPrefix}tradeFeeDiscount`],
          fallback.tradeFeeDiscount,
        ),
        dailyRewards: normalizeVipRewards(
          tierValue.dailyRewards ?? raw[`${flatPrefix}dailyRewards`],
          fallback.dailyRewards,
        ),
      };
      return result;
    },
    {} as Record<GameVipTierKey, GameVipBenefit>,
  );
  return { tiers };
}

export function flattenGameVipConfig(config: GameVipConfig) {
  const normalized = normalizeGameVipConfig(config);
  return GAME_VIP_TIERS.reduce<Record<string, unknown>>((result, tier) => {
    const key = String(tier) as GameVipTierKey;
    const benefit = normalized.tiers[key];
    result[`vip${tier}_sweepLimit`] = benefit.sweepLimit;
    result[`vip${tier}_tradeFeeDiscount`] = benefit.tradeFeeDiscount;
    result[`vip${tier}_dailyRewards`] = cloneRewards(benefit.dailyRewards);
    return result;
  }, {});
}

export function getGameVipBenefit(
  config: GameVipConfig,
  tier: number,
): GameVipBenefit {
  const normalizedTier = normalizeGameVipTier(tier);
  if (normalizedTier <= 0) {
    return {
      sweepLimit: 0,
      tradeFeeDiscount: 0,
      dailyRewards: { points: 0, items: [] },
    };
  }
  return normalizeGameVipConfig(config).tiers[
    String(normalizedTier) as GameVipTierKey
  ];
}

export function normalizeGameVipTier(value: unknown): GameVipTier {
  const tier = Number(value || 0);
  return GAME_VIP_TIERS.includes(tier as any) ? (tier as GameVipTier) : 0;
}

export function gameVipLabel(tier: number) {
  const normalized = normalizeGameVipTier(tier);
  return normalized > 0 ? `VIP${normalized}` : "非VIP";
}

export function fishpiVipTier(levelCode: string, active: boolean): GameVipTier {
  if (!active) {
    return 0;
  }
  const match = String(levelCode || "")
    .trim()
    .toUpperCase()
    .match(/^VIP([1-4])(?:[_-].*)?$/);
  return match ? normalizeGameVipTier(Number(match[1])) : 0;
}

export function badgeVipTier(profile: unknown): GameVipTier {
  const medals = collectMedalTexts(profile).map(normalizeMedalText);
  if (medals.some((text) => text.includes("小冰白金vip"))) {
    return 4;
  }
  if (medals.some((text) => text.includes("小冰vip"))) {
    return 3;
  }
  return 0;
}

export function cloneRewards(rewards: RedeemRewards): RedeemRewards {
  return {
    points: Number(rewards.points || 0),
    items: (rewards.items || []).map((item) => ({
      itemId: Number(item.itemId),
      num: Number(item.num),
    })),
    ...(rewards.cards?.length
      ? {
          cards: rewards.cards.map((card) => ({
            cardId: Number(card.cardId),
            rarity: String(card.rarity || "").trim().toUpperCase(),
            num: Number(card.num),
          })),
        }
      : {}),
  };
}

function normalizeVipRewards(
  value: unknown,
  fallback: RedeemRewards,
): RedeemRewards {
  const raw = (value && typeof value === "object" ? value : {}) as Partial<
    RedeemRewards
  >;
  const points = normalizeNonNegativeInt(raw.points, fallback.points || 0);
  const items = Array.isArray(raw.items)
    ? raw.items
        .map((item) => ({
          itemId: Number(item.itemId),
          num: Number(item.num),
        }))
        .filter(
          (item) =>
            Number.isInteger(item.itemId) &&
            item.itemId > 0 &&
            Number.isInteger(item.num) &&
            item.num > 0,
        )
    : cloneRewards(fallback).items;
  return {
    points,
    items,
  };
}

function normalizeNonNegativeInt(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}

function normalizeDiscount(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 1
    ? number
    : fallback;
}

function collectMedalTexts(value: unknown, depth = 0): string[] {
  if (!value || depth > 4) {
    return [];
  }
  if (typeof value === "string" || typeof value === "number") {
    return [String(value)];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectMedalTexts(item, depth + 1));
  }
  if (typeof value !== "object") {
    return [];
  }
  const record = value as Record<string, unknown>;
  const directKeys = [
    "sysMetal",
    "allMetals",
    "metals",
    "metal",
    "metalName",
    "name",
    "title",
    "label",
    "description",
    "displayName",
  ];
  return directKeys.flatMap((key) => collectMedalTexts(record[key], depth + 1));
}

function normalizeMedalText(value: string) {
  return value.replace(/\s+/g, "").toLowerCase();
}
