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
  UR: { maxLevel: 60, costBase: 5, powerBase: 1000, powerGrowth: 120 },
};

export const STAR_MAX_LEVEL = 5;

export const STAR_POWER_CONFIG: Record<CardRarity, number> = {
  N: 20,
  R: 36,
  SR: 64,
  SSR: 120,
  UR: 200,
};

const CULTIVATION_RARITIES = ["N", "R", "SR", "SSR", "UR"] as const;
export const BATTLE_ROLES = ["attack", "guard", "support", "control"] as const;
export type BattleRole = (typeof BATTLE_ROLES)[number];

const POTENTIAL_RANGE_BP: Record<CardRarity, { min: number; max: number }> = {
  N: { min: 0, max: 600 },
  R: { min: 0, max: 800 },
  SR: { min: 100, max: 1000 },
  SSR: { min: 200, max: 1200 },
  UR: { min: 300, max: 1200 },
};

export function normalizeCultivationRarity(rarity: string): CardRarity {
  const normalized = String(rarity || "")
    .trim()
    .toUpperCase();
  if (!CULTIVATION_RARITIES.includes(normalized as CardRarity)) {
    throw new Error("稀有度参数无效");
  }
  return normalized as CardRarity;
}

export function getCultivationLevel(
  userCard: Pick<UserCard, "cultivation_level">,
) {
  const level = Number(userCard.cultivation_level || 1);
  return Number.isInteger(level) && level > 0 ? level : 1;
}

export function getCultivationExp(userCard: Pick<UserCard, "cultivation_exp">) {
  const exp = Number(userCard.cultivation_exp || 0);
  return Number.isInteger(exp) && exp > 0 ? exp : 0;
}

export function getCardStarLevel(userCard: { star_level?: number | null }) {
  const level = Number(userCard.star_level || 0);
  if (!Number.isInteger(level) || level <= 0) {
    return 0;
  }
  return Math.min(STAR_MAX_LEVEL, level);
}

export function getCardStarMaxLevel() {
  return STAR_MAX_LEVEL;
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

export function calculateCultivationPower(
  rarity: string,
  level: number,
): number {
  const normalized = normalizeCultivationRarity(rarity);
  const config = CULTIVATION_CONFIG[normalized];
  const safeLevel = Math.max(
    1,
    Math.min(config.maxLevel, Math.floor(Number(level || 1))),
  );
  return config.powerBase + (safeLevel - 1) * config.powerGrowth;
}

export function calculateCardStarPower(
  rarity: string,
  starLevel: number,
): number {
  const normalized = normalizeCultivationRarity(rarity);
  const safeStarLevel = Math.max(
    0,
    Math.min(STAR_MAX_LEVEL, Math.floor(Number(starLevel || 0))),
  );
  return STAR_POWER_CONFIG[normalized] * safeStarLevel;
}

export function calculateCardPower(
  rarity: string,
  level: number,
  starLevel: number,
): number {
  return (
    calculateCultivationPower(rarity, level) +
    calculateCardStarPower(rarity, starLevel)
  );
}

export function normalizeBattleRole(value: unknown): BattleRole {
  const normalized = String(value || "").trim();
  return BATTLE_ROLES.includes(normalized as BattleRole)
    ? (normalized as BattleRole)
    : "attack";
}

export function getPotentialRange(rarity: string) {
  return POTENTIAL_RANGE_BP[normalizeCultivationRarity(rarity)];
}

export function normalizePotentialBp(value: unknown) {
  const number = Number(value || 0);
  if (!Number.isInteger(number) || number < 0) {
    return 0;
  }
  return Math.min(1200, number);
}

export function getPotentialGrade(potentialBp: number): "S" | "A" | "B" | "C" {
  const normalized = normalizePotentialBp(potentialBp);
  if (normalized >= 1000) {
    return "S";
  }
  if (normalized >= 700) {
    return "A";
  }
  if (normalized >= 400) {
    return "B";
  }
  return "C";
}

export function calculatePotentialPower(
  basePower: number,
  potentialBp: number,
) {
  return Math.floor(
    (Math.max(0, Number(basePower || 0)) * normalizePotentialBp(potentialBp)) /
      10000,
  );
}

export function calculateCardPowerWithPotential(
  rarity: string,
  level: number,
  starLevel: number,
  potentialBp: number,
) {
  const basePower = calculateCardPower(rarity, level, starLevel);
  const potentialPower = calculatePotentialPower(basePower, potentialBp);
  return {
    basePower,
    potentialPower,
    power: basePower + potentialPower,
  };
}

export function deterministicPotentialBp(seed: string, rarity: string) {
  const range = getPotentialRange(rarity);
  const width = range.max - range.min + 1;
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return range.min + (Math.abs(hash) % width);
}

export function resolveUserCardPotential(
  userCard: Pick<UserCard, "card_uuid" | "card_level"> & {
    potential_bp?: number | null;
  },
  rarity: string,
) {
  const potentialBp = normalizePotentialBp(userCard.potential_bp || 0);
  return {
    potentialBp,
    potentialGrade: getPotentialGrade(potentialBp),
    potentialPercent: potentialBp / 100,
  };
}
