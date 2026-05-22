import { Injectable, Optional } from "@nestjs/common";
import { DataSource, EntityManager, FindOptionsWhere, In } from "typeorm";
import { CardItem } from "src/entity/card.entity";
import { PoolInfo } from "src/entity/pool.entity";
import { TradeConfig } from "src/entity/tradeConfig.entity";
import {
  TradeListing,
  TradeListingStatus,
} from "src/entity/tradeListing.entity";
import { TradeRecord } from "src/entity/tradeRecord.entity";
import { User } from "src/entity/user.entity";
import { UserCard } from "src/entity/userCard.entity";
import { PointLedgerService } from "src/point-ledger/point-ledger.service";
import { AchievementService } from "src/achievement/achievement.service";

const RARITY_ORDER = ["N", "R", "SR", "SSR", "UR"] as const;
type CardRarity = (typeof RARITY_ORDER)[number];

export interface TradeListQuery {
  page?: number;
  pageSize?: number;
  rarity?: string;
  poolId?: number;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
}

@Injectable()
export class TradeService {
  constructor(
    private readonly dataSource: DataSource,
    @Optional()
    private readonly pointLedgerService?: PointLedgerService,
    @Optional()
    private readonly achievementService?: AchievementService,
  ) {}

  async listListings(uid: string, query: TradeListQuery) {
    const { page, pageSize } = this.normalizePage(query);
    const config = await this.getTradeConfig();
    const queryBuilder = this.dataSource
      .getRepository(TradeListing)
      .createQueryBuilder("listing")
      .where("listing.status = :status", { status: "active" });

    if (query.rarity) {
      queryBuilder.andWhere("listing.card_level = :rarity", {
        rarity: this.normalizeRarity(query.rarity),
      });
    }

    const poolId =
      query.poolId === undefined || query.poolId === null
        ? undefined
        : Number(query.poolId);
    if (poolId !== undefined) {
      if (!Number.isInteger(poolId) || poolId <= 0) {
        throw new Error("卡池ID无效");
      }
      const cards = await this.dataSource.getRepository(CardItem).find({
        where: { pool: poolId },
      });
      const cardIds = cards.map((card) => card.id);
      if (cardIds.length === 0) {
        return this.pageResult([], 0, page, pageSize, config);
      }
      queryBuilder.andWhere("listing.card_id IN (:...cardIds)", { cardIds });
    }

    if (query.minPrice !== undefined) {
      const minPrice = Number(query.minPrice);
      if (!Number.isInteger(minPrice) || minPrice < 0) {
        throw new Error("最低价格无效");
      }
      queryBuilder.andWhere("listing.price >= :minPrice", { minPrice });
    }

    if (query.maxPrice !== undefined) {
      const maxPrice = Number(query.maxPrice);
      if (!Number.isInteger(maxPrice) || maxPrice < 0) {
        throw new Error("最高价格无效");
      }
      queryBuilder.andWhere("listing.price <= :maxPrice", { maxPrice });
    }

    const sort = query.sort || "newest";
    if (sort === "priceAsc") {
      queryBuilder
        .orderBy("listing.price", "ASC")
        .addOrderBy("listing.id", "DESC");
    } else if (sort === "priceDesc") {
      queryBuilder
        .orderBy("listing.price", "DESC")
        .addOrderBy("listing.id", "DESC");
    } else {
      queryBuilder.orderBy("listing.id", "DESC");
    }

    const [listings, total] = await queryBuilder
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return this.pageResult(
      await this.decorateListings(listings, uid, false),
      total,
      page,
      pageSize,
      config,
    );
  }

  async createListing(uid: string, cardUuid: string, price: number) {
    return this.dataSource.transaction(async (manager) => {
      const config = await this.getTradeConfig(manager);
      if (!config.enabled) {
        throw new Error("交易市场暂未开启");
      }

      const normalizedPrice = this.normalizePrice(price, config);
      const userCardRepository = manager.getRepository(UserCard);
      const listingRepository = manager.getRepository(TradeListing);
      const cardRepository = manager.getRepository(CardItem);
      const poolRepository = manager.getRepository(PoolInfo);

      const userCard = await userCardRepository.findOne({
        where: { uid, card_uuid: cardUuid, delete_flag: false },
        lock: { mode: "pessimistic_write" },
      });
      if (!userCard) {
        throw new Error("用户没有这张卡片");
      }
      if (userCard.can_sell !== true) {
        throw new Error("这张卡片不可交易");
      }

      const activeListing = await listingRepository.findOne({
        where: { card_uuid: cardUuid, status: "active" },
        lock: { mode: "pessimistic_write" },
      });
      if (activeListing) {
        throw new Error("这张卡片已在交易中");
      }

      const card = await cardRepository.findOne({
        where: { id: Number(userCard.card_id) },
      });
      if (!card) {
        throw new Error("卡片不存在");
      }
      const pool = await poolRepository.findOne({ where: { id: card.pool } });
      const rarity =
        userCard.card_level || this.getHighestRarity(card.card_level || "");
      const listing = listingRepository.create({
        seller_uid: uid,
        buyer_uid: null,
        card_uuid: userCard.card_uuid,
        card_id: card.id,
        card_level: rarity,
        price: normalizedPrice,
        fee_rate: config.fee_rate,
        status: "active",
        sold_at: null,
        cancelled_at: null,
      });
      const saved = await listingRepository.save(listing);
      return (
        await this.decorateListings(
          [saved],
          uid,
          true,
          manager,
          [card],
          pool ? [pool] : [],
        )
      )[0];
    });
  }

  async cancelListing(uid: string, listingId: number) {
    return this.dataSource.transaction(async (manager) =>
      this.cancelListingInternal(manager, listingId, uid),
    );
  }

  async adminCancelListing(listingId: number) {
    return this.dataSource.transaction(async (manager) =>
      this.cancelListingInternal(manager, listingId),
    );
  }

  async buyListing(uid: string, listingId: number) {
    return this.dataSource.transaction(async (manager) => {
      const listingRepository = manager.getRepository(TradeListing);
      const recordRepository = manager.getRepository(TradeRecord);
      const userCardRepository = manager.getRepository(UserCard);
      const userRepository = manager.getRepository(User);
      const cardRepository = manager.getRepository(CardItem);
      const poolRepository = manager.getRepository(PoolInfo);
      const config = await this.getTradeConfig(manager);
      if (!config.enabled) {
        throw new Error("交易市场暂未开启");
      }

      const listing = await listingRepository.findOne({
        where: { id: listingId, status: "active" },
        lock: { mode: "pessimistic_write" },
      });
      if (!listing) {
        throw new Error("挂单不存在或已失效");
      }
      if (listing.seller_uid === uid) {
        throw new Error("不能购买自己的挂单");
      }

      const userCard = await userCardRepository.findOne({
        where: { card_uuid: listing.card_uuid, delete_flag: false },
        lock: { mode: "pessimistic_write" },
      });
      if (!userCard || userCard.uid !== listing.seller_uid) {
        throw new Error("挂单卡片状态已变化");
      }

      const buyer = await userRepository.findOne({
        where: { uid },
        lock: { mode: "pessimistic_write" },
      });
      const seller = await userRepository.findOne({
        where: { uid: listing.seller_uid },
        lock: { mode: "pessimistic_write" },
      });
      if (!buyer) {
        throw new Error("买家不存在");
      }
      if (!seller) {
        throw new Error("卖家不存在");
      }
      if ((buyer.point || 0) < listing.price) {
        throw new Error(
          `星穹币不足，需要${listing.price}，当前${buyer.point || 0}`,
        );
      }

      const card = await cardRepository.findOne({
        where: { id: listing.card_id },
      });
      if (!card) {
        throw new Error("卡片不存在");
      }
      const pool = await poolRepository.findOne({ where: { id: card.pool } });
      const feeAmount = this.calculateFee(listing.price, listing.fee_rate);
      const sellerIncome = listing.price - feeAmount;

      if (this.pointLedgerService) {
        await this.pointLedgerService.applyChange(
          manager,
          buyer,
          -listing.price,
          {
            sourceType: "trade_buy",
            sourceId: listing.id,
            title: `购买卡片：${card.card_name}`,
            metadata: {
              listingId: listing.id,
              cardUuid: listing.card_uuid,
              cardId: listing.card_id,
              cardName: card.card_name,
              cardLevel: listing.card_level,
              price: listing.price,
            },
          },
        );
        if (sellerIncome > 0) {
          await this.pointLedgerService.applyChange(
            manager,
            seller,
            sellerIncome,
            {
              sourceType: "trade_sell",
              sourceId: listing.id,
              title: `出售卡片：${card.card_name}`,
              metadata: {
                listingId: listing.id,
                cardUuid: listing.card_uuid,
                cardId: listing.card_id,
                cardName: card.card_name,
                cardLevel: listing.card_level,
                price: listing.price,
                feeAmount,
                sellerIncome,
              },
            },
          );
        }
      } else {
        buyer.point = (buyer.point || 0) - listing.price;
        seller.point = (seller.point || 0) + sellerIncome;
        await userRepository.save([buyer, seller]);
      }
      userCard.uid = uid;
      listing.status = "sold";
      listing.buyer_uid = uid;
      listing.sold_at = new Date();

      await userCardRepository.save(userCard);
      await listingRepository.save(listing);
      const record = await recordRepository.save(
        recordRepository.create({
          listing_id: listing.id,
          seller_uid: listing.seller_uid,
          buyer_uid: uid,
          card_uuid: listing.card_uuid,
          card_id: listing.card_id,
          card_level: listing.card_level,
          price: listing.price,
          fee_rate: listing.fee_rate,
          fee_amount: feeAmount,
          seller_income: sellerIncome,
          card_snapshot: {
            cardName: card.card_name,
            cardDesc: card.card_desc,
            cardType: card.card_type,
            poolId: card.pool,
            poolName: pool?.pool_name,
          },
        }),
      );
      await this.achievementService?.evaluateAndUnlock(manager, uid);
      await this.achievementService?.evaluateAndUnlock(
        manager,
        listing.seller_uid,
      );

      return {
        listingId: listing.id,
        recordId: record.id,
        cardUuid: userCard.card_uuid,
        cardId: card.id,
        cardName: card.card_name,
        cardLevel: listing.card_level,
        price: listing.price,
        feeAmount,
        sellerIncome,
        buyerPoint: buyer.point,
      };
    });
  }

  async listMyListings(uid: string, query: TradeListQuery) {
    const { page, pageSize } = this.normalizePage(query);
    const where: FindOptionsWhere<TradeListing> = { seller_uid: uid };
    const [listings, total] = await this.dataSource
      .getRepository(TradeListing)
      .findAndCount({
        where,
        order: { id: "DESC" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      });
    return {
      list: await this.decorateListings(listings, uid, true),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async listMyRecords(uid: string, query: TradeListQuery) {
    const { page, pageSize } = this.normalizePage(query);
    const queryBuilder = this.dataSource
      .getRepository(TradeRecord)
      .createQueryBuilder("record")
      .where("record.seller_uid = :uid OR record.buyer_uid = :uid", { uid })
      .orderBy("record.id", "DESC")
      .skip((page - 1) * pageSize)
      .take(pageSize);
    const [records, total] = await queryBuilder.getManyAndCount();
    return {
      list: records.map((record) => ({
        id: record.id,
        listingId: record.listing_id,
        role: record.seller_uid === uid ? "seller" : "buyer",
        cardUuid: record.card_uuid,
        cardId: record.card_id,
        cardName: record.card_snapshot?.cardName || `卡片#${record.card_id}`,
        cardLevel: record.card_level,
        poolId: record.card_snapshot?.poolId,
        poolName: record.card_snapshot?.poolName || "",
        price: record.price,
        feeRate: record.fee_rate,
        feeAmount: record.fee_amount,
        sellerIncome: record.seller_income,
        createdAt: record.createdAt,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getTradeConfig(manager?: EntityManager): Promise<TradeConfig> {
    const repository = (manager || this.dataSource).getRepository(TradeConfig);
    let config = await repository.findOne({ where: { id: 1 } });
    if (!config) {
      config = repository.create({
        id: 1,
        enabled: true,
        fee_rate: 0,
        min_price: 1,
        max_price: 999999,
      });
      config = await repository.save(config);
    }
    return this.normalizeConfig(config);
  }

  async updateTradeConfig(body: Partial<TradeConfig>): Promise<TradeConfig> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(TradeConfig);
      const config = await this.getTradeConfig(manager);
      const next = Object.assign(config, {
        enabled:
          body.enabled === undefined ? config.enabled : body.enabled === true,
        fee_rate:
          body.fee_rate === undefined ? config.fee_rate : Number(body.fee_rate),
        min_price:
          body.min_price === undefined
            ? config.min_price
            : Number(body.min_price),
        max_price:
          body.max_price === undefined
            ? config.max_price
            : Number(body.max_price),
      });
      this.assertValidConfig(next);
      return repository.save(next);
    });
  }

  private async cancelListingInternal(
    manager: EntityManager,
    listingId: number,
    uid?: string,
  ) {
    const listingRepository = manager.getRepository(TradeListing);
    const listing = await listingRepository.findOne({
      where: { id: listingId, status: "active" },
      lock: { mode: "pessimistic_write" },
    });
    if (!listing) {
      throw new Error("挂单不存在或已失效");
    }
    if (uid && listing.seller_uid !== uid) {
      throw new Error("只能取消自己的挂单");
    }
    listing.status = "cancelled";
    listing.cancelled_at = new Date();
    await listingRepository.save(listing);
    return {
      id: listing.id,
      status: listing.status,
      cancelledAt: listing.cancelled_at,
    };
  }

  private normalizePage(query: TradeListQuery) {
    const page = Math.max(1, Number(query.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize || 20)));
    return { page, pageSize };
  }

  private pageResult(
    list: unknown[],
    total: number,
    page: number,
    pageSize: number,
    config: TradeConfig,
  ) {
    return {
      list,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      config: this.publicConfig(config),
    };
  }

  private async decorateListings(
    listings: TradeListing[],
    uid: string,
    includePrivate: boolean,
    manager?: EntityManager,
    preloadedCards?: CardItem[],
    preloadedPools?: PoolInfo[],
  ) {
    if (listings.length === 0) {
      return [];
    }
    const cardRepository = (manager || this.dataSource).getRepository(CardItem);
    const poolRepository = (manager || this.dataSource).getRepository(PoolInfo);
    const cardIds = [...new Set(listings.map((listing) => listing.card_id))];
    const cards =
      preloadedCards ||
      (await cardRepository.find({ where: { id: In(cardIds) } }));
    const poolIds = [...new Set(cards.map((card) => card.pool))];
    const pools =
      preloadedPools ||
      (poolIds.length
        ? await poolRepository.find({ where: { id: In(poolIds) } })
        : []);
    const cardMap = new Map(cards.map((card) => [card.id, card]));
    const poolMap = new Map(pools.map((pool) => [pool.id, pool]));

    return listings.map((listing) => {
      const card = cardMap.get(listing.card_id);
      const pool = card ? poolMap.get(card.pool) : undefined;
      const feeAmount = this.calculateFee(listing.price, listing.fee_rate);
      const base = {
        id: listing.id,
        cardId: listing.card_id,
        cardName: card?.card_name || `卡片#${listing.card_id}`,
        cardDesc: card?.card_desc || "",
        cardType: card?.card_type || 0,
        cardLevel: listing.card_level,
        poolId: card?.pool,
        poolName: pool?.pool_name || "",
        price: listing.price,
        feeRate: listing.fee_rate,
        feeAmount,
        sellerIncome: listing.price - feeAmount,
        status: listing.status,
        isMine: listing.seller_uid === uid,
        createdAt: listing.createdAt,
        soldAt: listing.sold_at,
        cancelledAt: listing.cancelled_at,
      };
      return includePrivate
        ? {
            ...base,
            cardUuid: listing.card_uuid,
          }
        : base;
    });
  }

  private normalizePrice(price: number, config: TradeConfig): number {
    const value = Number(price);
    if (!Number.isInteger(value)) {
      throw new Error("交易价格必须为整数");
    }
    if (value < config.min_price || value > config.max_price) {
      throw new Error(
        `交易价格必须在${config.min_price}-${config.max_price}之间`,
      );
    }
    return value;
  }

  private normalizeConfig(config: TradeConfig): TradeConfig {
    config.enabled = config.enabled !== false;
    config.fee_rate = Number(config.fee_rate || 0);
    config.min_price = Number(config.min_price || 1);
    config.max_price = Number(config.max_price || 999999);
    this.assertValidConfig(config);
    return config;
  }

  private assertValidConfig(config: TradeConfig) {
    if (
      !Number.isFinite(config.fee_rate) ||
      config.fee_rate < 0 ||
      config.fee_rate > 1
    ) {
      throw new Error("交易手续费率必须在0-1之间");
    }
    if (!Number.isInteger(config.min_price) || config.min_price < 1) {
      throw new Error("最低交易价格必须为正整数");
    }
    if (
      !Number.isInteger(config.max_price) ||
      config.max_price < config.min_price ||
      config.max_price > 999999
    ) {
      throw new Error("最高交易价格必须大于等于最低价格且不超过999999");
    }
  }

  private publicConfig(config: TradeConfig) {
    return {
      enabled: config.enabled,
      feeRate: config.fee_rate,
      minPrice: config.min_price,
      maxPrice: config.max_price,
    };
  }

  private calculateFee(price: number, feeRate: number): number {
    return Math.floor(Number(price || 0) * Number(feeRate || 0));
  }

  private normalizeRarity(rarity: string): CardRarity {
    const normalized = String(rarity || "")
      .trim()
      .toUpperCase();
    if (!RARITY_ORDER.includes(normalized as CardRarity)) {
      throw new Error("稀有度参数无效");
    }
    return normalized as CardRarity;
  }

  private parseCardLevels(cardLevel: string): CardRarity[] {
    return String(cardLevel || "")
      .split(",")
      .map((level) => level.trim().toUpperCase())
      .filter((level): level is CardRarity =>
        RARITY_ORDER.includes(level as CardRarity),
      );
  }

  private getHighestRarity(cardLevel: string): CardRarity {
    const levels = this.parseCardLevels(cardLevel);
    if (levels.length === 0) {
      throw new Error("未知的卡片等级");
    }
    return levels.sort(
      (left, right) => RARITY_ORDER.indexOf(right) - RARITY_ORDER.indexOf(left),
    )[0];
  }
}
