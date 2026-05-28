import type { CardRarity } from "src/types/api";
import type { UserCard } from "src/entity/userCard.entity";

export const CULTIVATION_CONFIG: Record<
  CardRarity,
  { maxLevel: number; costBase: number; powerBase: number; powerGrowth: number }
> = {
  N: { maxLevel: 20, costBase: 4, powerBase: 100, powerGrowth: 12 },
  R: { maxLevel: 30, costBase: 8, powerBase: 180, powerGrowth: 22 },
  SR: { maxLevel: 40, costBase: 16, powerBase: 320, powerGrowth: 38 },
  SSR: { maxLevel: 50, costBase: 30, powerBase: 600, powerGrowth: 72 },
  UR: { maxLevel: 60, costBase: 50, powerBase: 1000, powerGrowth: 120 },
};

const CULTIVATION_RARITIES = ["N", "R", "SR", "SSR", "UR"] as const;

export function normalizeCultivationRarity(rarity: string): CardRarity {
  const normalized = String(rarity || "").trim().toUpperCase();
  if (!CULTIVATION_RARITIES.includes(normalized as CardRarity)) {
    throw new Error("稀有度参数无效");
  }
  return normalized as CardRarity;
}

export function getCultivationLevel(userCard: Pick<UserCard, "cultivation_level">) {
  const level = Number(userCard.cultivation_level || 1);
  return Number.isInteger(level) && level > 0 ? level : 1;
}

export function getCultivationExp(userCard: Pick<UserCard, "cultivation_exp">) {
  const exp = Number(userCard.cultivation_exp || 0);
  return Number.isInteger(exp) && exp > 0 ? exp : 0;
}

export function getCultivationMaxLevel(rarity: string): number {
  const normalized = normalizeCultivationRarity(rarity);
  return CULTIVATION_CONFIG[normalized].maxLevel;
}

export function getCultivationUpgradeCost(
  rarity: CardRarity,
  currentLevel: number,
): number {
  const config = CULTIVATION_CONFIG[rarity];
  return config.costBase * Math.max(1, currentLevel);
}

export function calculateCultivationPower(rarity: string, level: number): number {
  const normalized = normalizeCultivationRarity(rarity);
  const config = CULTIVATION_CONFIG[normalized];
  const safeLevel = Math.max(
    1,
    Math.min(config.maxLevel, Math.floor(Number(level || 1))),
  );
  return config.powerBase + (safeLevel - 1) * config.powerGrowth;
}
