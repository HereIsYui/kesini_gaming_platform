import { Injectable } from "@nestjs/common";
import { DataSource, EntityManager, In } from "typeorm";
import { CardItem } from "src/entity/card.entity";
import { PointLedgerRecord } from "src/entity/pointLedgerRecord.entity";
import { SystemConfig } from "src/entity/systemConfig.entity";
import { TradeListing } from "src/entity/tradeListing.entity";
import { User } from "src/entity/user.entity";
import { UserCard } from "src/entity/userCard.entity";
import { PointLedgerService } from "src/point-ledger/point-ledger.service";

const SHOP_RECYCLE_CONFIG_KEY = "shopRecycleConfig";
const RARITIES = ["N", "R", "SR", "SSR", "UR"] as const;

export type ShopRecycleRarity = (typeof RARITIES)[number];

export interface ShopRecycleConfigView {
  enabled: boolean;
  priceN: number;
  priceR: number;
  priceSR: number;
  priceSSR: number;
  priceUR: number;
}

export interface ShopRecycleCardsInput {
  cardId: number;
  rarity: string;
  poolId: number;
  count: number;
}

interface StoredShopRecycleConfig {
  enabled: boolean;
  prices: Record<ShopRecycleRarity, number>;
}

const DEFAULT_SHOP_RECYCLE_CONFIG: StoredShopRecycleConfig = {
  enabled: true,
  prices: {
    N: 1,
    R: 2,
    SR: 5,
    SSR: 15,
    UR: 50,
  },
};

@Injectable()
export class ShopRecycleService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly pointLedgerService: PointLedgerService,
  ) {}

  async getConfig(): Promise<ShopRecycleConfigView> {
    return this.toView(await this.getStoredConfig());
  }

  async updateConfig(
    input: Partial<ShopRecycleConfigView>,
  ): Promise<ShopRecycleConfigView> {
    const current = await this.getStoredConfig();
    const next: StoredShopRecycleConfig = {
      enabled:
        input.enabled === undefined || input.enabled === null
          ? current.enabled
          : input.enabled === true,
      prices: {
        N: this.normalizePrice(input.priceN, current.prices.N, "N"),
        R: this.normalizePrice(input.priceR, current.prices.R, "R"),
        SR: this.normalizePrice(input.priceSR, current.prices.SR, "SR"),
        SSR: this.normalizePrice(input.priceSSR, current.prices.SSR, "SSR"),
        UR: this.normalizePrice(input.priceUR, current.prices.UR, "UR"),
      },
    };
    await this.saveStoredConfig(next);
    return this.toView(next);
  }

  async recycleCards(uid: string, input: ShopRecycleCardsInput) {
    const cardId = this.normalizePositiveInteger(input.cardId, "卡片无效");
    const poolId = this.normalizePositiveInteger(input.poolId, "卡池无效");
    const count = this.normalizePositiveInteger(input.count, "回收数量无效");
    const rarity = this.normalizeRarity(input.rarity);
    const config = await this.getStoredConfig();
    if (!config.enabled) {
      throw new Error("商店暂未开启");
    }

    return this.dataSource.transaction(async (manager) => {
      const cardRepository = manager.getRepository(CardItem);
      const userRepository = manager.getRepository(User);
      const userCardRepository = manager.getRepository(UserCard);
      const listingRepository = manager.getRepository(TradeListing);

      const card = await cardRepository.findOne({ where: { id: cardId } });
      if (!card || Number(card.pool) !== poolId) {
        throw new Error("卡片不存在");
      }
      if (!this.cardSupportsRarity(card, rarity)) {
        throw new Error("稀有度无效");
      }

      const user = await userRepository.findOne({ where: { uid } });
      if (!user) {
        throw new Error("用户不存在");
      }

      const ownedCards = await userCardRepository.find({
        where: {
          uid,
          card_id: String(cardId),
          delete_flag: false,
          can_sell: true,
        },
      });
      const sameRarityCards = ownedCards.filter(
        (userCard) => this.getEffectiveUserCardRarity(userCard, card) === rarity,
      );
      if (sameRarityCards.length <= 1) {
        throw new Error("至少保留一张");
      }

      const activeListings =
        sameRarityCards.length > 0
          ? await listingRepository.find({
              where: {
                card_uuid: In(sameRarityCards.map((item) => item.card_uuid)),
                status: "active",
              },
            })
          : [];
      const listedUuidSet = new Set(
        activeListings.map((listing) => listing.card_uuid),
      );
      const recyclableCards = sameRarityCards.filter(
        (userCard) =>
          userCard.locked !== true && !listedUuidSet.has(userCard.card_uuid),
      );
      const maxCount = Math.max(0, recyclableCards.length - 1);
      if (count > maxCount) {
        throw new Error("可回收数量不足");
      }

      const selectedCards = this.pickRandomCards(recyclableCards, count);
      selectedCards.forEach((userCard) => {
        userCard.delete_flag = true;
      });
      await userCardRepository.save(selectedCards);

      const unitPrice = config.prices[rarity];
      const rewardPoints = unitPrice * count;
      const pointBefore = Number(user.point || 0);
      let pointAfter = pointBefore;
      let ledger: PointLedgerRecord | null = null;
      if (rewardPoints > 0) {
        ledger = await this.pointLedgerService.applyChange(
          manager,
          user,
          rewardPoints,
          {
            sourceType: "shop_recycle",
            sourceId: `${cardId}:${rarity}`,
            title: `商店回收：${card.card_name}`,
            metadata: {
              cardId,
              cardName: card.card_name,
              rarity,
              poolId,
              count,
              unitPrice,
              rewardPoints,
            },
          },
        );
        pointAfter = ledger.point_after;
      } else {
        const ledgerRepository = manager.getRepository(PointLedgerRecord);
        ledger = await ledgerRepository.save(
          ledgerRepository.create({
            uid: user.uid,
            change_amount: 0,
            point_before: pointBefore,
            point_after: pointAfter,
            source_type: "shop_recycle",
            source_id: `${cardId}:${rarity}`,
            title: `商店回收：${card.card_name}`,
            metadata: {
              cardId,
              cardName: card.card_name,
              rarity,
              poolId,
              count,
              unitPrice,
              rewardPoints,
            },
          }),
        );
      }

      return {
        cardId,
        cardName: card.card_name,
        rarity,
        poolId,
        count,
        unitPrice,
        rewardPoints,
        pointBefore,
        pointAfter,
        ledgerId: ledger?.id || null,
      };
    });
  }

  async getRecyclePreview(uid: string, cardId: number, rarity: string) {
    const card = await this.dataSource.getRepository(CardItem).findOne({
      where: { id: this.normalizePositiveInteger(cardId, "卡片无效") },
    });
    if (!card) {
      throw new Error("卡片不存在");
    }
    const normalizedRarity = this.normalizeRarity(rarity);
    const userCards = await this.dataSource.getRepository(UserCard).find({
      where: {
        uid,
        card_id: String(card.id),
        delete_flag: false,
        can_sell: true,
      },
    });
    const sameRarityCards = userCards.filter(
      (userCard) =>
        this.getEffectiveUserCardRarity(userCard, card) === normalizedRarity,
    );
    const activeListings = sameRarityCards.length
      ? await this.dataSource.getRepository(TradeListing).find({
          where: {
            card_uuid: In(sameRarityCards.map((item) => item.card_uuid)),
            status: "active",
          },
        })
      : [];
    const listedUuidSet = new Set(
      activeListings.map((listing) => listing.card_uuid),
    );
    const unlistedCount = sameRarityCards.filter(
      (userCard) =>
        userCard.locked !== true && !listedUuidSet.has(userCard.card_uuid),
    ).length;
    return {
      cardId: card.id,
      rarity: normalizedRarity,
      availableCount: Math.max(0, unlistedCount - 1),
    };
  }

  private async getStoredConfig(
    manager?: EntityManager,
  ): Promise<StoredShopRecycleConfig> {
    const repository = (manager || this.dataSource).getRepository(SystemConfig);
    const row = await repository.findOne({
      where: { key: SHOP_RECYCLE_CONFIG_KEY },
    });
    if (!row?.value) {
      return this.cloneConfig(DEFAULT_SHOP_RECYCLE_CONFIG);
    }
    try {
      return this.normalizeStoredConfig(JSON.parse(row.value));
    } catch {
      return this.cloneConfig(DEFAULT_SHOP_RECYCLE_CONFIG);
    }
  }

  private async saveStoredConfig(config: StoredShopRecycleConfig) {
    const repository = this.dataSource.getRepository(SystemConfig);
    let row = await repository.findOne({
      where: { key: SHOP_RECYCLE_CONFIG_KEY },
    });
    if (!row) {
      row = repository.create({
        key: SHOP_RECYCLE_CONFIG_KEY,
        description: "商店卡片回收配置",
      });
    }
    row.value = JSON.stringify(config);
    row.description = "商店卡片回收配置";
    await repository.save(row);
  }

  private normalizeStoredConfig(input: any): StoredShopRecycleConfig {
    const prices = input?.prices || {};
    return {
      enabled: input?.enabled !== false,
      prices: {
        N: this.normalizePrice(prices.N, DEFAULT_SHOP_RECYCLE_CONFIG.prices.N, "N"),
        R: this.normalizePrice(prices.R, DEFAULT_SHOP_RECYCLE_CONFIG.prices.R, "R"),
        SR: this.normalizePrice(
          prices.SR,
          DEFAULT_SHOP_RECYCLE_CONFIG.prices.SR,
          "SR",
        ),
        SSR: this.normalizePrice(
          prices.SSR,
          DEFAULT_SHOP_RECYCLE_CONFIG.prices.SSR,
          "SSR",
        ),
        UR: this.normalizePrice(
          prices.UR,
          DEFAULT_SHOP_RECYCLE_CONFIG.prices.UR,
          "UR",
        ),
      },
    };
  }

  private toView(config: StoredShopRecycleConfig): ShopRecycleConfigView {
    return {
      enabled: config.enabled,
      priceN: config.prices.N,
      priceR: config.prices.R,
      priceSR: config.prices.SR,
      priceSSR: config.prices.SSR,
      priceUR: config.prices.UR,
    };
  }

  private cloneConfig(config: StoredShopRecycleConfig): StoredShopRecycleConfig {
    return {
      enabled: config.enabled,
      prices: { ...config.prices },
    };
  }

  private normalizePrice(value: unknown, fallback: number, rarity: string) {
    if (value === undefined || value === null || value === "") {
      return fallback;
    }
    const price = Number(value);
    if (!Number.isInteger(price) || price < 0) {
      throw new Error(`${rarity} 回收价无效`);
    }
    return price;
  }

  private normalizePositiveInteger(value: unknown, message: string) {
    const next = Number(value);
    if (!Number.isInteger(next) || next <= 0) {
      throw new Error(message);
    }
    return next;
  }

  private normalizeRarity(value: unknown): ShopRecycleRarity {
    const rarity = String(value || "").trim().toUpperCase();
    if (!RARITIES.includes(rarity as ShopRecycleRarity)) {
      throw new Error("稀有度无效");
    }
    return rarity as ShopRecycleRarity;
  }

  private parseCardLevels(card: CardItem): ShopRecycleRarity[] {
    return String(card.card_level || "")
      .split(",")
      .map((item) => item.trim().toUpperCase())
      .filter((item): item is ShopRecycleRarity =>
        RARITIES.includes(item as ShopRecycleRarity),
      );
  }

  private cardSupportsRarity(card: CardItem, rarity: ShopRecycleRarity) {
    return this.parseCardLevels(card).includes(rarity);
  }

  private getEffectiveUserCardRarity(
    userCard: UserCard,
    card: CardItem,
  ): ShopRecycleRarity | null {
    try {
      return userCard.card_level
        ? this.normalizeRarity(userCard.card_level)
        : this.getHighestRarity(card);
    } catch {
      return null;
    }
  }

  private getHighestRarity(card: CardItem): ShopRecycleRarity | null {
    const levels = this.parseCardLevels(card);
    return levels.length ? levels[levels.length - 1] : null;
  }

  private pickRandomCards(cards: UserCard[], count: number) {
    const pool = [...cards];
    for (let index = pool.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
    }
    return pool.slice(0, count);
  }
}
