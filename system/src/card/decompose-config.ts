import type { CardRarity } from "src/types/api";

export const DECOMPOSE_CONFIG_KEY = "decomposeConfig";
export const DECOMPOSE_CONFIG_RARITIES = ["N", "R", "SR", "SSR"] as const;

export type DecomposeConfigRarity = (typeof DECOMPOSE_CONFIG_RARITIES)[number];

export interface DecomposeDropConfig {
  itemId: number;
  min: number;
  max: number;
}

export interface DecomposeRuleConfig {
  drops: DecomposeDropConfig[];
}

export interface DecomposeConfig {
  rules: Record<DecomposeConfigRarity, DecomposeRuleConfig>;
}

export const DEFAULT_DECOMPOSE_CONFIG: DecomposeConfig = {
  rules: {
    N: { drops: [{ itemId: 0, min: 1, max: 10 }] },
    R: { drops: [{ itemId: 0, min: 10, max: 20 }] },
    SR: { drops: [{ itemId: 0, min: 20, max: 40 }] },
    SSR: { drops: [{ itemId: 0, min: 40, max: 80 }] },
  },
};

export function normalizeDecomposeConfig(input: unknown): DecomposeConfig {
  const record = (input || {}) as Partial<DecomposeConfig>;
  const rulesInput = (record.rules || {}) as Record<string, unknown>;

  return {
    rules: DECOMPOSE_CONFIG_RARITIES.reduce(
      (result, rarity) => {
        const defaultRule = DEFAULT_DECOMPOSE_CONFIG.rules[rarity];
        const rawRule = (rulesInput[rarity] || {}) as
          | Partial<DecomposeRuleConfig>
          | Partial<DecomposeDropConfig>;
        const rawDrops = getRawDrops(rawRule, defaultRule);
        const drops = rawDrops.map((drop, index) =>
          normalizeDrop(drop, defaultRule.drops[index] || defaultRule.drops[0]),
        );
        result[rarity] = {
          drops:
            drops.length > 0
              ? drops
              : defaultRule.drops.map((drop) => ({ ...drop })),
        };
        return result;
      },
      {} as Record<DecomposeConfigRarity, DecomposeRuleConfig>,
    ),
  };
}

export function isDecomposeConfigRarity(
  rarity: CardRarity,
): rarity is DecomposeConfigRarity {
  return DECOMPOSE_CONFIG_RARITIES.includes(rarity as DecomposeConfigRarity);
}

function normalizeInteger(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isInteger(number) ? number : fallback;
}

function getRawDrops(
  rawRule: Partial<DecomposeRuleConfig> | Partial<DecomposeDropConfig>,
  defaultRule: DecomposeRuleConfig,
) {
  if (
    "drops" in rawRule &&
    Array.isArray(rawRule.drops) &&
    rawRule.drops.length > 0
  ) {
    return rawRule.drops as Partial<DecomposeDropConfig>[];
  }
  if ("itemId" in rawRule || "min" in rawRule || "max" in rawRule) {
    return [rawRule as Partial<DecomposeDropConfig>];
  }
  return defaultRule.drops;
}

function normalizeDrop(
  rawDrop: Partial<DecomposeDropConfig>,
  defaultDrop: DecomposeDropConfig,
): DecomposeDropConfig {
  const itemId = normalizeInteger(rawDrop.itemId, defaultDrop.itemId);
  const min = Math.max(1, normalizeInteger(rawDrop.min, defaultDrop.min));
  const max = normalizeInteger(rawDrop.max, defaultDrop.max);
  return {
    itemId: Math.max(0, itemId),
    min,
    max: Math.max(min, max),
  };
}
