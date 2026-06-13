import { Injectable, Optional } from "@nestjs/common";
import { DataSource, EntityManager, In } from "typeorm";
import { CardItem } from "src/entity/card.entity";
import { DropItem } from "src/entity/drop.entity";
import type { RedeemRewards } from "src/entity/redeemCode.entity";
import { SeasonConfig } from "src/entity/seasonConfig.entity";
import {
  SeasonPointRecord,
  SeasonPointSourceType,
} from "src/entity/seasonPointRecord.entity";
import { SeasonShopItem } from "src/entity/seasonShopItem.entity";
import { SeasonShopUsage } from "src/entity/seasonShopUsage.entity";
import { User } from "src/entity/user.entity";
import { UserSeasonProgress } from "src/entity/userSeasonProgress.entity";
import { RewardService } from "src/reward/reward.service";
import { RedisUtil } from "src/utils/redis";
import {
  ensureUsersPublicIds,
  getUserPublicId,
} from "src/utils/user-public-id";

export interface SeasonPointContext {
  sourceType: SeasonPointSourceType;
  sourceId?: string | number | null;
  title: string;
  metadata?: Record<string, unknown> | null;
}

export interface SeasonTaskActivityInput {
  periodKey: string;
  taskId: string;
  taskName: string;
  activityPoints: number;
}

interface SeasonLeaderboardEntry {
  rank: number;
  uid: string;
  publicId: string;
  nickname: string;
  avatar: string;
  value: number;
}

@Injectable()
export class SeasonService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly rewardService: RewardService,
    @Optional()
    private readonly redis?: RedisUtil,
  ) {}

  async getOverview(uid: string) {
    const season = await this.getActiveSeason(this.dataSource);
    if (!season) {
      return {
        season: null,
        points: this.emptyPoints(),
        leaderboard: { list: [], me: null },
        shopItems: [],
        records: [],
      };
    }

    const [progress, leaderboard, shopItems, records] = await Promise.all([
      this.getProgress(this.dataSource, uid, season.season_key),
      this.getLeaderboard(uid, 20, season),
      this.listShopItems(uid, season),
      this.listPointRecords(uid, season.season_key, 8),
    ]);

    return {
      season: this.toSeasonView(season),
      points: this.toPointsView(progress),
      leaderboard: leaderboard.board,
      shopItems,
      records,
    };
  }

  async getLeaderboard(
    uid: string,
    limit = 50,
    activeSeason?: SeasonConfig | null,
  ) {
    const season =
      activeSeason || (await this.getActiveSeason(this.dataSource));
    if (!season || season.leaderboard_enabled !== true) {
      return {
        season: season ? this.toSeasonView(season) : null,
        board: { list: [], me: null },
      };
    }
    const normalizedLimit = this.normalizeLimit(limit);
    // 完整排名与 uid 无关，按 season_key 全局缓存；me 在读取时按 uid 现场查找。
    const rankedEntries = await this.getSeasonRankedEntries(season);
    return {
      season: this.toSeasonView(season),
      board: {
        list: rankedEntries.slice(0, normalizedLimit),
        me: rankedEntries.find((entry) => entry.uid === uid) || null,
      },
    };
  }

  private readonly SEASON_LEADERBOARD_CACHE_PREFIX = "leaderboard:season:";
  private readonly SEASON_LEADERBOARD_CACHE_TTL_SECONDS = 3600;

  /**
   * 计算某赛季的完整排名列表（uid 无关），优先读 Redis 缓存，TTL 1 小时。
   */
  private async getSeasonRankedEntries(season: SeasonConfig) {
    const cacheKey = `${this.SEASON_LEADERBOARD_CACHE_PREFIX}${season.season_key}`;
    if (this.redis) {
      const cached = await this.redis.get<SeasonLeaderboardEntry[]>(cacheKey);
      if (Array.isArray(cached)) {
        return cached;
      }
    }
    const progresses = await this.dataSource
      .getRepository(UserSeasonProgress)
      .find({ where: { season_key: season.season_key } });
    const uids = [
      ...new Set(progresses.map((progress) => progress.uid).filter(Boolean)),
    ];
    const userRepository = this.dataSource.getRepository(User);
    const users = uids.length
      ? await userRepository.find({ where: { uid: In(uids) } })
      : [];
    await ensureUsersPublicIds(userRepository, users);
    const userMap = new Map(users.map((user) => [user.uid, user]));
    const entries = progresses
      .map((progress) =>
        this.createLeaderboardEntry(
          progress.uid,
          Number(progress.earned_points || 0),
          userMap.get(progress.uid),
        ),
      )
      .filter((entry) => entry.value > 0)
      .sort(
        (left, right) =>
          right.value - left.value || left.uid.localeCompare(right.uid),
      );
    const rankedEntries = this.assignRanks(entries);
    if (this.redis) {
      await this.redis.set(
        cacheKey,
        rankedEntries,
        this.SEASON_LEADERBOARD_CACHE_TTL_SECONDS,
      );
    }
    return rankedEntries;
  }

  async grantTaskActivity(
    manager: EntityManager,
    uid: string,
    input: SeasonTaskActivityInput,
  ) {
    const amount = Number(input.activityPoints || 0);
    if (!Number.isInteger(amount) || amount <= 0) {
      return null;
    }
    const season = await this.getActiveSeason(manager);
    if (!season) {
      return null;
    }
    return this.applyPointChange(manager, uid, season, amount, {
      sourceType: "task_activity",
      sourceId: `${input.periodKey}:${input.taskId}`,
      title: `赛季积分：${input.taskName}`,
      metadata: {
        periodKey: input.periodKey,
        taskId: input.taskId,
        taskName: input.taskName,
      },
    });
  }

  async buyShopItem(uid: string, itemId: number, rawCount?: number) {
    const count = this.normalizeBuyCount(rawCount);
    return this.dataSource.transaction(async (manager) => {
      const season = await this.getActiveSeason(manager);
      if (!season) {
        throw new Error("当前暂无开放赛季");
      }
      if (season.shop_enabled !== true) {
        throw new Error("赛季商店暂未开启");
      }

      const shopRepository = manager.getRepository(SeasonShopItem);
      const item = await shopRepository.findOne({
        where: {
          id: Number(itemId),
          season_key: season.season_key,
          delete_flag: false,
        },
        lock: { mode: "pessimistic_write" },
      });
      if (!item) {
        throw new Error("赛季兑换项不存在");
      }
      const user = await manager.getRepository(User).findOne({
        where: { uid },
        lock: { mode: "pessimistic_write" },
      });
      if (!user) {
        throw new Error("用户不存在");
      }
      const rewards = this.rewardService.normalizeRewards(
        item.rewards,
        "赛季商店奖励不能为空",
      );
      await this.assertRewardAvailable(manager, rewards);
      const usedByUser = await this.getUserUsageCount(manager, item.id, uid);
      const unavailableReason = this.getShopUnavailableReason(
        season,
        item,
        usedByUser,
        count,
      );
      if (unavailableReason) {
        throw new Error(unavailableReason);
      }
      const totalCost = Number(item.cost_points || 0) * count;
      const progress = await this.ensureProgress(
        manager,
        uid,
        season.season_key,
      );
      if (Number(progress.point_balance || 0) < totalCost) {
        throw new Error(
          `赛季积分不足，需要${totalCost}，当前${progress.point_balance || 0}`,
        );
      }
      const scaledRewards = this.scaleRewards(rewards, count);
      await this.applyPointChange(manager, uid, season, -totalCost, {
        sourceType: "shop_spend",
        sourceId: item.id,
        title: `赛季商店兑换：${item.name}`,
        metadata: {
          shopItemId: item.id,
          shopItemName: item.name,
          count,
        },
      });
      await this.rewardService.grantRewards(manager, user, scaledRewards, {
        sourceType: "season_shop",
        sourceId: item.id,
        title: `赛季商店奖励：${item.name}`,
        metadata: {
          seasonKey: season.season_key,
          shopItemId: item.id,
          shopItemName: item.name,
          count,
        },
      });
      item.used_count = Number(item.used_count || 0) + count;
      await shopRepository.save(item);
      const rewardLookup = await this.buildRewardLookup(manager, [
        scaledRewards,
      ]);
      const decoratedRewards = this.decorateRewards(
        scaledRewards,
        rewardLookup,
      );
      await manager.getRepository(SeasonShopUsage).save(
        manager.getRepository(SeasonShopUsage).create({
          shop_item_id: item.id,
          shop_item_name: item.name,
          season_key: season.season_key,
          uid,
          count,
          cost_points: totalCost,
          reward_snapshot: decoratedRewards,
        }),
      );
      const nextProgress = await this.getProgress(
        manager,
        uid,
        season.season_key,
      );
      return {
        season: this.toSeasonView(season),
        itemId: item.id,
        count,
        costPoints: totalCost,
        rewards: decoratedRewards,
        points: this.toPointsView(nextProgress),
      };
    });
  }

  async listShopItems(uid: string, activeSeason?: SeasonConfig | null) {
    const season =
      activeSeason || (await this.getActiveSeason(this.dataSource));
    if (!season || season.shop_enabled !== true) {
      return [];
    }
    const itemRepository = this.dataSource.getRepository(SeasonShopItem);
    const usageRepository = this.dataSource.getRepository(SeasonShopUsage);
    const [items, progress] = await Promise.all([
      itemRepository.find({
        where: {
          season_key: season.season_key,
          enabled: true,
          delete_flag: false,
        },
        order: { sort_order: "ASC", id: "DESC" } as any,
      }),
      this.getProgress(this.dataSource, uid, season.season_key),
    ]);
    const visibleItems = items.filter((item) => this.isWithinTimeRange(item));
    const usages = visibleItems.length
      ? await usageRepository.find({
          where: {
            uid,
            season_key: season.season_key,
            shop_item_id: In(visibleItems.map((item) => item.id)),
          },
        })
      : [];
    const usageMap = this.sumUsageByItem(usages);
    const rewardLookup = await this.buildRewardLookup(
      this.dataSource,
      visibleItems.map((item) => item.rewards),
    );

    return visibleItems.map((item) => {
      const usedByUser = usageMap.get(item.id) || 0;
      const unavailableReason =
        this.getShopUnavailableReason(season, item, usedByUser, 1) ||
        (Number(progress.point_balance || 0) < Number(item.cost_points || 0)
          ? "赛季积分不足"
          : "");
      return {
        id: item.id,
        seasonKey: item.season_key,
        name: item.name,
        description: item.description || "",
        costPoints: Number(item.cost_points || 0),
        rewards: this.decorateRewards(item.rewards, rewardLookup),
        remaining:
          item.total_limit === null || item.total_limit === undefined
            ? null
            : Math.max(
                0,
                Number(item.total_limit || 0) - Number(item.used_count || 0),
              ),
        usedByUser,
        userLimit: item.user_limit ?? null,
        canBuy: unavailableReason === "",
        unavailableReason,
        startsAt: item.starts_at || null,
        endsAt: item.ends_at || null,
      };
    });
  }

  async getActiveSeason(manager: DataSource | EntityManager = this.dataSource) {
    const seasons = await manager.getRepository(SeasonConfig).find({
      where: { enabled: true, delete_flag: false },
      order: { id: "DESC" } as any,
    });
    return seasons.find((season) => this.isSeasonActive(season)) || null;
  }

  private async applyPointChange(
    manager: EntityManager,
    uid: string,
    season: SeasonConfig,
    amount: number,
    context: SeasonPointContext,
  ) {
    if (!Number.isInteger(amount) || amount === 0) {
      throw new Error("赛季积分变动数量必须为非零整数");
    }
    const progress = await this.ensureProgress(manager, uid, season.season_key);
    const before = Number(progress.point_balance || 0);
    const after = before + amount;
    if (after < 0) {
      throw new Error(`赛季积分不足，需要${Math.abs(amount)}，当前${before}`);
    }
    progress.point_balance = after;
    if (amount > 0) {
      progress.earned_points = Number(progress.earned_points || 0) + amount;
    }
    await manager.getRepository(UserSeasonProgress).save(progress);
    return manager.getRepository(SeasonPointRecord).save(
      manager.getRepository(SeasonPointRecord).create({
        uid,
        season_key: season.season_key,
        change_amount: amount,
        point_before: before,
        point_after: after,
        source_type: context.sourceType,
        source_id:
          context.sourceId === undefined || context.sourceId === null
            ? null
            : String(context.sourceId),
        title: context.title,
        metadata: context.metadata || null,
      }),
    );
  }

  private async ensureProgress(
    manager: EntityManager,
    uid: string,
    seasonKey: string,
  ) {
    const repository = manager.getRepository(UserSeasonProgress);
    let progress = await repository.findOne({
      where: { uid, season_key: seasonKey },
      lock: { mode: "pessimistic_write" },
    });
    if (!progress) {
      progress = repository.create({
        uid,
        season_key: seasonKey,
        earned_points: 0,
        point_balance: 0,
      });
      progress = await repository.save(progress);
    }
    return progress;
  }

  private async getProgress(
    manager: DataSource | EntityManager,
    uid: string,
    seasonKey: string,
  ) {
    return (
      (await manager.getRepository(UserSeasonProgress).findOne({
        where: { uid, season_key: seasonKey },
      })) ||
      manager.getRepository(UserSeasonProgress).create({
        uid,
        season_key: seasonKey,
        earned_points: 0,
        point_balance: 0,
      })
    );
  }

  private async listPointRecords(
    uid: string,
    seasonKey: string,
    limit: number,
  ) {
    const records = await this.dataSource
      .getRepository(SeasonPointRecord)
      .find({
        where: { uid, season_key: seasonKey },
        order: { createdAt: "DESC", id: "DESC" } as any,
        take: limit,
      });
    return records.map((record) => ({
      id: record.id,
      seasonKey: record.season_key,
      changeAmount: record.change_amount,
      pointBefore: record.point_before,
      pointAfter: record.point_after,
      sourceType: record.source_type,
      title: record.title,
      metadata: record.metadata || {},
      createdAt: record.createdAt,
    }));
  }

  private async assertRewardAvailable(
    manager: EntityManager,
    rewards: RedeemRewards,
  ) {
    await Promise.all([
      this.rewardService.assertRewardItemsAvailable(
        manager.getRepository(DropItem),
        rewards.items || [],
      ),
      this.rewardService.assertRewardCardsAvailable(
        manager.getRepository(CardItem),
        rewards.cards || [],
      ),
    ]);
  }

  private async buildRewardLookup(
    manager: DataSource | EntityManager,
    rewardsList: Array<RedeemRewards | null | undefined>,
  ) {
    const itemIds = [
      ...new Set(
        rewardsList.flatMap((rewards) =>
          (rewards?.items || []).map((item) => Number(item.itemId)),
        ),
      ),
    ].filter((itemId) => Number.isInteger(itemId) && itemId > 0);
    const cardIds = [
      ...new Set(
        rewardsList.flatMap((rewards) =>
          (rewards?.cards || []).map((card) => Number(card.cardId)),
        ),
      ),
    ].filter((cardId) => Number.isInteger(cardId) && cardId > 0);
    const [items, cards] = await Promise.all([
      itemIds.length
        ? manager.getRepository(DropItem).find({ where: { id: In(itemIds) } })
        : Promise.resolve([] as DropItem[]),
      cardIds.length
        ? manager.getRepository(CardItem).find({ where: { id: In(cardIds) } })
        : Promise.resolve([] as CardItem[]),
    ]);
    return {
      itemMap: new Map(items.map((item) => [item.id, item])),
      cardMap: new Map(cards.map((card) => [card.id, card])),
    };
  }

  private decorateRewards(
    rewards: RedeemRewards,
    lookup: {
      itemMap: Map<number, DropItem>;
      cardMap: Map<number, CardItem>;
    },
  ): RedeemRewards {
    return {
      points: Number(rewards.points || 0),
      items: (rewards.items || []).map((item) => ({
        ...item,
        itemName: lookup.itemMap.get(Number(item.itemId))?.drop_name || "",
      })),
      ...(rewards.cards?.length
        ? {
            cards: rewards.cards.map((card) => ({
              ...card,
              cardName:
                lookup.cardMap.get(Number(card.cardId))?.card_name || "",
            })),
          }
        : {}),
    };
  }

  private scaleRewards(rewards: RedeemRewards, count: number): RedeemRewards {
    return {
      points: Number(rewards.points || 0) * count,
      items: (rewards.items || []).map((item) => ({
        itemId: Number(item.itemId),
        num: Number(item.num || 0) * count,
      })),
      ...(rewards.cards?.length
        ? {
            cards: rewards.cards.map((card) => ({
              cardId: Number(card.cardId),
              rarity: card.rarity,
              num: Number(card.num || 0) * count,
            })),
          }
        : {}),
    };
  }

  private getShopUnavailableReason(
    season: SeasonConfig,
    item: SeasonShopItem,
    usedByUser: number,
    count: number,
  ) {
    if (season.shop_enabled !== true) {
      return "赛季商店暂未开启";
    }
    if (item.enabled !== true) {
      return "兑换项暂未开放";
    }
    if (!this.isWithinTimeRange(item)) {
      return "当前不在兑换时间";
    }
    if (
      item.total_limit !== null &&
      item.total_limit !== undefined &&
      Number(item.used_count || 0) + count > Number(item.total_limit)
    ) {
      return "库存不足";
    }
    if (
      item.user_limit !== null &&
      item.user_limit !== undefined &&
      usedByUser + count > Number(item.user_limit)
    ) {
      return "已达到个人限兑次数";
    }
    return "";
  }

  private async getUserUsageCount(
    manager: EntityManager,
    itemId: number,
    uid: string,
  ) {
    const usages = await manager.getRepository(SeasonShopUsage).find({
      where: { shop_item_id: itemId, uid },
    });
    return usages.reduce((sum, usage) => sum + Number(usage.count || 0), 0);
  }

  private sumUsageByItem(usages: SeasonShopUsage[]) {
    return usages.reduce((map, usage) => {
      map.set(
        usage.shop_item_id,
        (map.get(usage.shop_item_id) || 0) + Number(usage.count || 0),
      );
      return map;
    }, new Map<number, number>());
  }

  private isSeasonActive(season: SeasonConfig) {
    if (season.enabled !== true || season.delete_flag === true) {
      return false;
    }
    return this.isWithinTimeRange(season);
  }

  private isWithinTimeRange(value: {
    starts_at?: Date | null;
    ends_at?: Date | null;
  }) {
    const now = Date.now();
    const startsAt = value.starts_at ? new Date(value.starts_at).getTime() : 0;
    const endsAt = value.ends_at ? new Date(value.ends_at).getTime() : 0;
    if (startsAt && startsAt > now) {
      return false;
    }
    if (endsAt && endsAt < now) {
      return false;
    }
    return true;
  }

  private toSeasonView(season: SeasonConfig) {
    return {
      id: season.id,
      seasonKey: season.season_key,
      name: season.name,
      description: season.description || "",
      shopEnabled: season.shop_enabled === true,
      leaderboardEnabled: season.leaderboard_enabled === true,
      startsAt: season.starts_at || null,
      endsAt: season.ends_at || null,
    };
  }

  private toPointsView(progress: UserSeasonProgress) {
    return {
      earned: Number(progress.earned_points || 0),
      balance: Number(progress.point_balance || 0),
    };
  }

  private emptyPoints() {
    return { earned: 0, balance: 0 };
  }

  private createLeaderboardEntry(uid: string, value: number, user?: User) {
    return {
      rank: 0,
      uid,
      publicId: user ? getUserPublicId(user) : uid,
      nickname: user?.nickname || user?.name || "玩家",
      avatar: user?.avatar || "",
      value,
    };
  }

  private assignRanks<T extends { value: number; rank: number }>(
    entries: T[],
  ): T[] {
    let previousValue: number | undefined;
    let currentRank = 0;
    return entries.map((entry, index) => {
      if (previousValue === undefined || entry.value !== previousValue) {
        currentRank = index + 1;
        previousValue = entry.value;
      }
      return { ...entry, rank: currentRank };
    });
  }

  private normalizeBuyCount(value?: number): number {
    const count =
      value === undefined || value === null || value === 0 ? 1 : Number(value);
    if (!Number.isInteger(count) || count <= 0 || count > 99) {
      throw new Error("兑换数量必须为 1-99 的整数");
    }
    return count;
  }

  private normalizeLimit(value?: number) {
    const limit = Number(value || 50);
    if (!Number.isInteger(limit) || limit <= 0) {
      return 50;
    }
    return Math.min(limit, 100);
  }
}
