import { EntityManager } from "typeorm";
import { CardItem } from "src/entity/card.entity";
import { PoolInfo } from "src/entity/pool.entity";
import { CARD_POOL_DOCUMENT_ROWS } from "./card-pool-document";

const DEFAULT_CARD_LEVELS = ["N", "R", "SR", "SSR"] as const;
const VALID_CARD_LEVELS = ["N", "R", "SR", "SSR", "UR"] as const;
const VALID_CARD_LEVEL_SET = new Set<string>(VALID_CARD_LEVELS);
const IMPORTED_POOL_DESC = "由腾讯文档导入";

export interface ParsedCard {
  rawName: string;
  cardName: string;
  cardLevel: string;
  cardDesc: string;
  cardType: number;
  specialRule?: string;
}

export interface ParsedPool {
  poolName: string;
  cardDesc: string;
  cardType: number;
  cards: ParsedCard[];
}

export interface ImportCardPoolsOptions {
  dryRun: boolean;
  pools?: ParsedPool[];
}

export interface ImportCardPoolsResult {
  mode: "dry-run" | "apply";
  totalPools: number;
  totalCards: number;
  pools: {
    created: number;
    updated: number;
    unchanged: number;
  };
  cards: {
    created: number;
    updated: number;
    unchanged: number;
  };
  missingDescriptions: string[];
  specialRules: string[];
}

interface ParsedNameResult {
  cardName: string;
  cardLevel: string;
  specialRule?: string;
}

export function parseCardName(rawName: string): ParsedNameResult {
  const normalized = rawName.trim();
  if (["冥王星(隐藏款)", "冥王星（隐藏款）"].includes(normalized)) {
    return {
      cardName: "冥王星",
      cardLevel: "UR",
      specialRule: `${normalized} => 冥王星[UR]`,
    };
  }

  const match = normalized.match(/^(.*?)[（(]([^（）()]+)[）)]\s*$/);
  if (!match) {
    return {
      cardName: normalized,
      cardLevel: DEFAULT_CARD_LEVELS.join(","),
    };
  }

  const levels = match[2]
    .split(/[、,，/|\s]+/)
    .map((level) => level.trim().toUpperCase())
    .filter(Boolean);
  if (
    levels.length > 0 &&
    levels.every((level) => VALID_CARD_LEVEL_SET.has(level))
  ) {
    return {
      cardName: match[1].trim(),
      cardLevel: levels.join(","),
      specialRule: `${normalized} => ${match[1].trim()}[${levels.join(",")}]`,
    };
  }

  return {
    cardName: normalized,
    cardLevel: DEFAULT_CARD_LEVELS.join(","),
  };
}

export function parseCardPoolRows(
  rows: string[][] = CARD_POOL_DOCUMENT_ROWS,
): ParsedPool[] {
  return rows
    .slice(1)
    .filter((row) => row[0]?.trim())
    .map((row, index, poolRows) => {
      const sourceIndex = rows.indexOf(row);
      const nextRow = rows[sourceIndex + 1] || [];
      const hasDescriptionRow = !nextRow[0]?.trim();
      const cards = row
        .slice(1)
        .map((rawName, cardIndex): ParsedCard | undefined => {
          const name = rawName.trim();
          if (!name) {
            return undefined;
          }
          const parsedName = parseCardName(name);
          const card: ParsedCard = {
            rawName: name,
            cardName: parsedName.cardName,
            cardLevel: parsedName.cardLevel,
            cardDesc: hasDescriptionRow ? nextRow[cardIndex + 1]?.trim() || "" : "",
            cardType: 0,
          };
          if (parsedName.specialRule) {
            card.specialRule = parsedName.specialRule;
          }
          return card;
        })
        .filter((card): card is ParsedCard => card !== undefined);

      return {
        poolName: poolRows[index][0].trim(),
        cardDesc: IMPORTED_POOL_DESC,
        cardType: 0,
        cards,
      };
    });
}

export async function importCardPools(
  manager: EntityManager,
  options: ImportCardPoolsOptions,
): Promise<ImportCardPoolsResult> {
  const pools = options.pools || parseCardPoolRows();
  const result: ImportCardPoolsResult = {
    mode: options.dryRun ? "dry-run" : "apply",
    totalPools: pools.length,
    totalCards: pools.reduce((sum, pool) => sum + pool.cards.length, 0),
    pools: { created: 0, updated: 0, unchanged: 0 },
    cards: { created: 0, updated: 0, unchanged: 0 },
    missingDescriptions: [],
    specialRules: [],
  };

  const existingPools = await manager.find(PoolInfo);
  const poolMap = new Map(
    existingPools.map((pool) => [pool.pool_name, pool] as const),
  );
  const existingCards = await manager.find(CardItem);
  const cardMap = new Map(
    existingCards.map((card) => [createCardKey(card.pool, card.card_name), card]),
  );

  for (const parsedPool of pools) {
    let pool = poolMap.get(parsedPool.poolName);
    const poolExists = Boolean(pool);

    if (!pool) {
      result.pools.created += 1;
      pool = manager.create(PoolInfo, {
        pool_name: parsedPool.poolName,
        card_desc: parsedPool.cardDesc,
        card_type: parsedPool.cardType,
      });
      if (!options.dryRun) {
        pool = await manager.save(PoolInfo, pool);
      }
      poolMap.set(parsedPool.poolName, pool);
    } else if (isPoolChanged(pool, parsedPool)) {
      result.pools.updated += 1;
      pool.card_desc = parsedPool.cardDesc;
      pool.card_type = parsedPool.cardType;
      if (!options.dryRun) {
        pool = await manager.save(PoolInfo, pool);
      }
    } else {
      result.pools.unchanged += 1;
    }

    for (const parsedCard of parsedPool.cards) {
      if (!parsedCard.cardDesc) {
        result.missingDescriptions.push(
          `${parsedPool.poolName}/${parsedCard.rawName}`,
        );
      }
      if (parsedCard.specialRule) {
        result.specialRules.push(
          `${parsedPool.poolName}/${parsedCard.specialRule}`,
        );
      }

      const existingCard =
        poolExists && pool.id
          ? cardMap.get(createCardKey(pool.id, parsedCard.cardName))
          : undefined;
      if (!existingCard) {
        result.cards.created += 1;
        if (!options.dryRun) {
          const card = manager.create(CardItem, {
            card_name: parsedCard.cardName,
            card_level: parsedCard.cardLevel,
            drop_item: "",
            card_desc: parsedCard.cardDesc,
            card_type: parsedCard.cardType,
            pool: pool.id,
          });
          const savedCard = await manager.save(CardItem, card);
          cardMap.set(createCardKey(savedCard.pool, savedCard.card_name), savedCard);
        }
        continue;
      }

      if (isCardChanged(existingCard, parsedCard)) {
        result.cards.updated += 1;
        existingCard.card_level = parsedCard.cardLevel;
        existingCard.card_desc = parsedCard.cardDesc;
        existingCard.card_type = parsedCard.cardType;
        if (!options.dryRun) {
          await manager.save(CardItem, existingCard);
        }
      } else {
        result.cards.unchanged += 1;
      }
    }
  }

  return result;
}

function createCardKey(poolId: number, cardName: string): string {
  return `${poolId}:${cardName}`;
}

function isPoolChanged(pool: PoolInfo, parsedPool: ParsedPool): boolean {
  return (
    pool.card_desc !== parsedPool.cardDesc || pool.card_type !== parsedPool.cardType
  );
}

function isCardChanged(card: CardItem, parsedCard: ParsedCard): boolean {
  return (
    card.card_level !== parsedCard.cardLevel ||
    card.card_desc !== parsedCard.cardDesc ||
    card.card_type !== parsedCard.cardType
  );
}
