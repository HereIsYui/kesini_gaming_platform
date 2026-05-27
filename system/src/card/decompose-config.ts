import type { CardRarity } from "src/types/api";

export const DECOMPOSE_CONFIG_KEY = "decomposeConfig";
export const DECOMPOSE_CONFIG_RARITIES = ["N", "R", "SR", "SSR"] as const;

export type DecomposeConfigRarity = (typeof DECOMPOSE_CONFIG_RARITIES)[number];

export interface DecomposeRuleConfig {
  itemId: number;
  min: number;
  max: number;
}

export interface DecomposeConfig {
  rules: Record<DecomposeConfigRarity, DecomposeRuleConfig>;
}

export const DEFAULT_DECOMPOSE_CONFIG: DecomposeConfig = {
  rules: {
    N: { itemId: 0, min: 1, max: 10 },
    R: { itemId: 0, min: 10, max: 20 },
    SR: { itemId: 0, min: 20, max: 40 },
    SSR: { itemId: 0, min: 40, max: 80 },
  },
};

export function normalizeDecomposeConfig(input: unknown): DecomposeConfig {
  const record = (input || {}) as Partial<DecomposeConfig>;
  const rulesInput = (record.rules || {}) as Record<string, unknown>;

  return {
    rules: DECOMPOSE_CONFIG_RARITIES.reduce(
      (result, rarity) => {
        const defaultRule = DEFAULT_DECOMPOSE_CONFIG.rules[rarity];
        const rawRule = (rulesInput[rarity] || {}) as Partial<DecomposeRuleConfig>;
        const itemId = normalizeInteger(rawRule.itemId, defaultRule.itemId);
        const min = normalizeInteger(rawRule.min, defaultRule.min);
        const max = normalizeInteger(rawRule.max, defaultRule.max);
        result[rarity] = {
          itemId: Math.max(0, itemId),
          min: Math.max(1, min),
          max: Math.max(Math.max(1, min), max),
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
