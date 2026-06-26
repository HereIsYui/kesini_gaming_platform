import type { CardRarity } from "../types";

export const rarityOrder: CardRarity[] = ["N", "R", "SR", "SSR", "UR"];

export const rarityRank: Record<string, number> = {
  N: 1,
  R: 2,
  SR: 3,
  SSR: 4,
  UR: 5,
};

export function normalizeRarity(value?: string): CardRarity {
  return rarityOrder.includes(value as CardRarity) ? (value as CardRarity) : "N";
}

export function rarityClass(value?: string) {
  return `rarity-${normalizeRarity(value).toLowerCase()}`;
}

export function parseCardRarities(levels?: string): CardRarity[] {
  return String(levels || "N")
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is CardRarity =>
      rarityOrder.includes(item as CardRarity),
    );
}

export function strongestRarityClass(rarities: CardRarity[] = []) {
  const strongest = [...rarities].sort(
    (a, b) => (rarityRank[b] || 0) - (rarityRank[a] || 0),
  )[0];
  return rarityClass(strongest);
}

export function requiredFragmentsForRarity(rarity?: string) {
  const normalized = normalizeRarity(rarity);
  const costs: Record<string, number> = {
    N: 80,
    R: 160,
    SR: 320,
    SSR: 1000,
    UR: 0,
  };
  return costs[normalized] || 0;
}

export function synthesisCostLabel(rarity?: string) {
  const normalized = normalizeRarity(rarity);
  const cost = requiredFragmentsForRarity(normalized);
  return normalized === "UR" ? "UR 不可合成" : `${cost} ${normalized}碎片`;
}
