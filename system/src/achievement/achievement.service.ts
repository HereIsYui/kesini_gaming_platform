import { Injectable } from "@nestjs/common";
import {
  DataSource,
  EntityManager,
  In,
  ObjectLiteral,
  Repository,
} from "typeorm";
import {
  AchievementConfig,
  AchievementTargetScope,
  AchievementTargetType,
} from "src/entity/achievementConfig.entity";
import { AchievementEvent } from "src/entity/achievementEvent.entity";
import { CardItem } from "src/entity/card.entity";
import { DropItem } from "src/entity/drop.entity";
import { ExchangeShopUsage } from "src/entity/exchangeShopUsage.entity";
import { UserHistory } from "src/entity/history.entity";
import { PoolInfo } from "src/entity/pool.entity";
import { RechargeRecord } from "src/entity/rechargeRecord.entity";
import { RedeemCodeUsage } from "src/entity/redeemCodeUsage.entity";
import { RedeemRewards } from "src/entity/redeemCode.entity";
import { TradeRecord } from "src/entity/tradeRecord.entity";
import { User } from "src/entity/user.entity";
import { UserAchievement } from "src/entity/userAchievement.entity";
import { UserCard } from "src/entity/userCard.entity";
import { RewardService } from "src/reward/reward.service";

export const ACHIEVEMENT_TARGET_TYPES: AchievementTargetType[] = [
  "total_draws",
  "rarity_draws",
  "owned_cards",
  "rarity_owned_cards",
  "completed_pools",
  "recharge_points",
  "redeem_count",
  "exchange_count",
  "trade_buy_count",
  "trade_sell_count",
  "synthesize_count",
  "decompose_count",
];

export const ACHIEVEMENT_TARGET_LABELS: Record<AchievementTargetType, string> =
  {
    total_draws: "总抽数",
    rarity_draws: "指定稀有度抽取数",
    owned_cards: "当前持有卡片数",
    rarity_owned_cards: "指定稀有度持有数",
    completed_pools: "集齐卡池数",
    recharge_points: "累计充值星穹币",
    redeem_count: "兑换码次数",
    exchange_count: "兑换商店次数",
    trade_buy_count: "买入次数",
    trade_sell_count: "卖出次数",
    synthesize_count: "合成次数",
    decompose_count: "分解次数",
  };

export interface AchievementEventInput {
  type: AchievementTargetType;
  amount?: number;
  metadata?: Record<string, unknown> | null;
}

export interface AchievementConfigInput {
  code?: string;
  name?: string;
  description?: string;
  category?: string;
  target_type?: AchievementTargetType;
  target_value?: number;
  target_scope?: AchievementTargetScope | null;
  rewards?: RedeemRewards;
  sort_order?: number;
  enabled?: boolean;
  starts_at?: string | Date | null;
  ends_at?: string | Date | null;
}

@Injectable()
export class AchievementService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly rewardService: RewardService,
  ) {}

  async listPlayerAchievements(uid: string) {
    const manager = this.dataSource.manager;
    const configs = await manager.getRepository(AchievementConfig).find({
      where: { enabled: true, delete_flag: false },
      order: { sort_order: "ASC", id: "ASC" },
    });
    const visibleConfigs = configs.filter((config) => this.isVisible(config));
    const records = visibleConfigs.length
      ? await manager.getRepository(UserAchievement).find({
          where: {
            uid,
            achievement_id: In(visibleConfigs.map((config) => config.id)),
          },
        })
      : [];
    const recordMap = new Map(
      records.map((record) => [record.achievement_id, record]),
    );

    const list: ReturnType<AchievementService["toPlayerView"]>[] = [];
    for (const config of visibleConfigs) {
      const record = recordMap.get(config.id);
      const progress = record?.achieved
        ? Math.max(Number(record.progress || 0), config.target_value)
        : await this.calculateProgress(manager, uid, config);
      list.push(this.toPlayerView(config, record, progress));
    }
    return {
      list,
      total: list.length,
    };
  }

  async listUnreadNotifications(uid: string) {
    const records = await this.dataSource
      .getRepository(UserAchievement)
      .createQueryBuilder("record")
      .innerJoin(AchievementConfig, "config", "config.id = record.achievement_id")
      .where("record.uid = :uid", { uid })
      .andWhere("record.achieved = :achieved", { achieved: true })
      .andWhere("record.notification_ack_at IS NULL")
      .andWhere("config.delete_flag = :deleteFlag", { deleteFlag: false })
      .orderBy("record.achieved_at", "ASC")
      .addOrderBy("record.id", "ASC")
      .select([
        "record.id",
        "record.uid",
        "record.achievement_id",
        "record.achievement_code",
        "record.progress",
        "record.achieved",
        "record.achieved_at",
        "record.reward_snapshot",
      ])
      .getMany();
    if (records.length === 0) {
      return [];
    }
    const configs = await this.dataSource.getRepository(AchievementConfig).find({
      where: { id: In(records.map((record) => record.achievement_id)) },
    });
    const configMap = new Map(
      configs
        .filter((config) => this.isVisible(config))
        .map((config) => [config.id, config]),
    );
    return records
      .map((record) => {
        const config = configMap.get(record.achievement_id);
        return config ? this.toNotificationView(config, record) : null;
      })
      .filter(Boolean);
  }

  async ackNotifications(uid: string, achievementIds: number[]) {
    const normalizedIds = [
      ...new Set(
        (achievementIds || [])
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0),
      ),
    ];
    if (normalizedIds.length === 0) {
      return { acknowledged: 0 };
    }
    const repository = this.dataSource.getRepository(UserAchievement);
    const records = await repository.find({
      where: {
        uid,
        achievement_id: In(normalizedIds),
        achieved: true,
      },
    });
    const now = new Date();
    const targets = records.filter((record) => !record.notification_ack_at);
    targets.forEach((record) => {
      record.notification_ack_at = now;
    });
    if (targets.length > 0) {
      await repository.save(targets);
    }
    return { acknowledged: targets.length };
  }

  async evaluateAndUnlock(
    manager: EntityManager,
    uid: string,
    events: AchievementEventInput[] = [],
  ) {
    const normalizedEvents = this.normalizeEvents(events);
    if (normalizedEvents.length > 0) {
      const eventRepository = manager.getRepository(AchievementEvent);
      await eventRepository.save(
        normalizedEvents.map((event) =>
          eventRepository.create({
            uid,
            event_type: event.type,
            amount: event.amount || 1,
            metadata: event.metadata || null,
          }),
        ),
      );
    }

    const configs = await manager.getRepository(AchievementConfig).find({
      where: { enabled: true, delete_flag: false },
      order: { sort_order: "ASC", id: "ASC" },
    });
    const activeConfigs = configs.filter((config) => this.isVisible(config));
    const unlocked: ReturnType<AchievementService["toNotificationView"]>[] = [];
    for (const config of activeConfigs) {
      const record = await this.findOrCreateUserAchievement(
        manager,
        uid,
        config,
      );
      if (record.achieved) {
        continue;
      }
      const progress = await this.calculateProgress(manager, uid, config);
      record.progress = progress;
      if (progress < config.target_value) {
        await manager.getRepository(UserAchievement).save(record);
        continue;
      }

      const rewards = this.rewardService.normalizeRewards(
        config.rewards,
        "成就奖励不能为空",
      );
      await this.rewardService.assertRewardItemsAvailable(
        manager.getRepository(DropItem),
        rewards.items,
      );
      const user = await manager.getRepository(User).findOne({
        where: { uid },
        lock: { mode: "pessimistic_write" },
      });
      if (!user) {
        throw new Error("用户不存在");
      }
      await this.rewardService.grantRewards(manager, user, rewards, {
        sourceType: "achievement",
        sourceId: config.code,
        title: `成就奖励：${config.name}`,
        metadata: {
          achievementId: config.id,
          achievementCode: config.code,
          achievementName: config.name,
        },
      });
      record.progress = progress;
      record.achieved = true;
      record.achieved_at = new Date();
      record.reward_snapshot = rewards;
      record.notification_ack_at = null;
      await manager.getRepository(UserAchievement).save(record);
      unlocked.push(this.toNotificationView(config, record));
    }
    return unlocked;
  }

  async listAdminAchievements(query: {
    page?: number;
    pageSize?: number;
    keyword?: string;
    targetType?: string;
  }) {
    const { page, pageSize } = this.normalizePage(query);
    const repository = this.dataSource.getRepository(AchievementConfig);
    const builder = repository
      .createQueryBuilder("achievement")
      .where("achievement.delete_flag = :deleteFlag", { deleteFlag: false });
    const keyword = String(query.keyword || "").trim();
    if (keyword) {
      builder.andWhere(
        "(achievement.name LIKE :keyword OR achievement.code LIKE :keyword OR achievement.description LIKE :keyword)",
        { keyword: `%${keyword}%` },
      );
    }
    if (query.targetType) {
      builder.andWhere("achievement.target_type = :targetType", {
        targetType: query.targetType,
      });
    }
    const [list, total] = await builder
      .orderBy("achievement.sort_order", "ASC")
      .addOrderBy("achievement.id", "DESC")
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return {
      list: list.map((config) => this.toAdminConfigView(config)),
      total,
      page,
      pageSize,
    };
  }

  async createAchievement(input: AchievementConfigInput) {
    const normalized = await this.normalizeConfigInput(input, true);
    const repository = this.dataSource.getRepository(AchievementConfig);
    const duplicate = await repository.findOne({
      where: { code: normalized.code },
    });
    if (duplicate && !duplicate.delete_flag) {
      throw new Error("成就编码已存在");
    }
    const saved = await repository.save(repository.create(normalized));
    return this.toAdminConfigView(saved);
  }

  async updateAchievement(id: number, input: AchievementConfigInput) {
    const repository = this.dataSource.getRepository(AchievementConfig);
    const config = await repository.findOne({ where: { id } });
    if (!config || config.delete_flag) {
      throw new Error("成就不存在");
    }
    const normalized = await this.normalizeConfigInput(input, false, config);
    if (normalized.code && normalized.code !== config.code) {
      const duplicate = await repository.findOne({
        where: { code: normalized.code },
      });
      if (duplicate && duplicate.id !== config.id && !duplicate.delete_flag) {
        throw new Error("成就编码已存在");
      }
    }
    Object.assign(config, normalized);
    const saved = await repository.save(config);
    return this.toAdminConfigView(saved);
  }

  async deleteAchievement(id: number) {
    const repository = this.dataSource.getRepository(AchievementConfig);
    const config = await repository.findOne({ where: { id } });
    if (!config) {
      throw new Error("成就不存在");
    }
    config.delete_flag = true;
    config.enabled = false;
    await repository.save(config);
    return { deleted: true };
  }

  async listUserAchievements(query: {
    page?: number;
    pageSize?: number;
    uid?: string;
    achieved?: string | boolean;
    achievementId?: number;
  }) {
    const { page, pageSize } = this.normalizePage(query);
    const builder = this.dataSource
      .getRepository(UserAchievement)
      .createQueryBuilder("record")
      .leftJoin(AchievementConfig, "config", "config.id = record.achievement_id")
      .orderBy("record.id", "DESC");
    const uid = String(query.uid || "").trim();
    if (uid) {
      builder.andWhere("record.uid = :uid", { uid });
    }
    if (query.achievementId) {
      builder.andWhere("record.achievement_id = :achievementId", {
        achievementId: query.achievementId,
      });
    }
    const achieved = this.parseOptionalBoolean(query.achieved);
    if (achieved !== undefined) {
      builder.andWhere("record.achieved = :achieved", { achieved });
    }
    const [records, total] = await builder
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    const configIds = [
      ...new Set(records.map((record) => record.achievement_id)),
    ];
    const configs = configIds.length
      ? await this.dataSource.getRepository(AchievementConfig).find({
          where: { id: In(configIds) },
        })
      : [];
    const configMap = new Map(configs.map((config) => [config.id, config]));
    const uids = [...new Set(records.map((record) => record.uid).filter(Boolean))];
    const users = uids.length
      ? await this.dataSource.getRepository(User).find({ where: { uid: In(uids) } })
      : [];
    const userMap = new Map(users.map((user) => [user.uid, user]));
    return {
      list: records.map((record) => {
        const config = configMap.get(record.achievement_id);
        const user = userMap.get(record.uid);
        return {
          id: record.id,
          uid: record.uid,
          userName: user?.nickname || user?.name || user?.uid || "",
          achievementId: record.achievement_id,
          achievementCode: record.achievement_code,
          achievementName: config?.name || record.achievement_code,
          category: config?.category || "",
          progress: record.progress,
          targetValue: config?.target_value || 0,
          achieved: record.achieved,
          achievedAt: record.achieved_at || null,
          notificationAckAt: record.notification_ack_at || null,
          rewards: record.reward_snapshot || config?.rewards || null,
          updatedAt: record.updatedAt,
        };
      }),
      total,
      page,
      pageSize,
    };
  }

  private async findOrCreateUserAchievement(
    manager: EntityManager,
    uid: string,
    config: AchievementConfig,
  ) {
    const repository = manager.getRepository(UserAchievement);
    let record = await repository.findOne({
      where: { uid, achievement_id: config.id },
      lock: { mode: "pessimistic_write" },
    });
    if (!record) {
      record = repository.create({
        uid,
        achievement_id: config.id,
        achievement_code: config.code,
        progress: 0,
        achieved: false,
        achieved_at: null,
        reward_snapshot: null,
        notification_ack_at: null,
      });
      record = await repository.save(record);
    }
    if (record.achievement_code !== config.code) {
      record.achievement_code = config.code;
    }
    return record;
  }

  private async calculateProgress(
    manager: EntityManager,
    uid: string,
    config: AchievementConfig,
  ) {
    switch (config.target_type) {
      case "total_draws":
        return this.sumColumn(manager.getRepository(UserHistory), {
          uid,
        }, "count");
      case "rarity_draws":
        return this.countRarityDraws(manager, uid, config.target_scope);
      case "owned_cards":
        return this.countOwnedCards(manager, uid, config.target_scope);
      case "rarity_owned_cards":
        return this.countOwnedCards(manager, uid, config.target_scope, true);
      case "completed_pools":
        return this.countCompletedPools(manager, uid);
      case "recharge_points":
        return this.sumColumn(
          manager.getRepository(RechargeRecord),
          { uid, status: "success" },
          "amount",
        );
      case "redeem_count":
        return manager.getRepository(RedeemCodeUsage).count({ where: { uid } });
      case "exchange_count":
        return this.sumColumn(manager.getRepository(ExchangeShopUsage), {
          uid,
        }, "count");
      case "trade_buy_count":
        return manager.getRepository(TradeRecord).count({
          where: { buyer_uid: uid },
        });
      case "trade_sell_count":
        return manager.getRepository(TradeRecord).count({
          where: { seller_uid: uid },
        });
      case "synthesize_count":
      case "decompose_count":
        return this.sumAchievementEvents(manager, uid, config.target_type);
      default:
        return 0;
    }
  }

  private async sumColumn<T extends ObjectLiteral>(
    repository: Repository<T>,
    where: Record<string, unknown>,
    column: string,
  ) {
    const result = await repository
      .createQueryBuilder("entity")
      .select(`SUM(entity.${column})`, "total")
      .where(where)
      .getRawOne();
    return Number(result?.total || 0);
  }

  private async countRarityDraws(
    manager: EntityManager,
    uid: string,
    scope?: AchievementTargetScope | null,
  ) {
    const rarity = this.normalizeRarity(scope?.rarity);
    if (!rarity) {
      return 0;
    }
    const histories = await manager.getRepository(UserHistory).find({
      where: { uid },
    });
    return histories.reduce((sum, history) => {
      const levels = String(history.card_levels || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      return sum + levels.filter((level) => level === rarity).length;
    }, 0);
  }

  private async countOwnedCards(
    manager: EntityManager,
    uid: string,
    scope?: AchievementTargetScope | null,
    requireRarity = false,
  ) {
    const where: Record<string, unknown> = { uid, delete_flag: false };
    const rarity = this.normalizeRarity(scope?.rarity);
    if (requireRarity && !rarity) {
      return 0;
    }
    if (rarity) {
      where.card_level = rarity;
    }
    const poolId = Number(scope?.poolId || 0);
    if (Number.isInteger(poolId) && poolId > 0) {
      const cards = await manager.getRepository(CardItem).find({
        where: { pool: poolId },
      });
      const cardIds = cards.map((card) => String(card.id));
      if (cardIds.length === 0) {
        return 0;
      }
      where.card_id = In(cardIds);
    }
    return manager.getRepository(UserCard).count({ where });
  }

  private async countCompletedPools(manager: EntityManager, uid: string) {
    const [cards, userCards] = await Promise.all([
      manager.getRepository(CardItem).find(),
      manager.getRepository(UserCard).find({ where: { uid, delete_flag: false } }),
    ]);
    const required = new Map<number, Set<string>>();
    cards.forEach((card) => {
      const levels = String(card.card_level || "")
        .split(",")
        .map((level) => this.normalizeRarity(level))
        .filter(Boolean) as string[];
      if (levels.length === 0) {
        return;
      }
      if (!required.has(card.pool)) {
        required.set(card.pool, new Set());
      }
      levels.forEach((level) => required.get(card.pool)!.add(`${card.id}:${level}`));
    });

    const cardMap = new Map(cards.map((card) => [String(card.id), card]));
    const owned = new Map<number, Set<string>>();
    userCards.forEach((userCard) => {
      const card = cardMap.get(String(userCard.card_id));
      const rarity = this.normalizeRarity(userCard.card_level || "");
      if (!card || !rarity) {
        return;
      }
      if (!owned.has(card.pool)) {
        owned.set(card.pool, new Set());
      }
      owned.get(card.pool)!.add(`${card.id}:${rarity}`);
    });

    let total = 0;
    required.forEach((versions, poolId) => {
      const ownedVersions = owned.get(poolId);
      if (
        ownedVersions &&
        Array.from(versions).every((version) => ownedVersions.has(version))
      ) {
        total += 1;
      }
    });
    return total;
  }

  private async sumAchievementEvents(
    manager: EntityManager,
    uid: string,
    type: AchievementTargetType,
  ) {
    return this.sumColumn(
      manager.getRepository(AchievementEvent),
      { uid, event_type: type },
      "amount",
    );
  }

  private normalizeEvents(events: AchievementEventInput[]) {
    return (events || [])
      .map((event) => ({
        type: event.type,
        amount: Number(event.amount || 1),
        metadata: event.metadata || null,
      }))
      .filter(
        (event) =>
          ACHIEVEMENT_TARGET_TYPES.includes(event.type) &&
          Number.isInteger(event.amount) &&
          event.amount > 0,
      );
  }

  private async normalizeConfigInput(
    input: AchievementConfigInput,
    creating: boolean,
    existing?: AchievementConfig,
  ) {
    const result: Partial<AchievementConfig> = {};
    if (creating || input.code !== undefined) {
      const code = String(input.code || "").trim();
      if (!/^[a-zA-Z0-9_-]{2,64}$/.test(code)) {
        throw new Error("成就编码需为 2-64 位字母、数字、下划线或横线");
      }
      result.code = code;
    }
    if (creating || input.name !== undefined) {
      const name = String(input.name || "").trim();
      if (!name) {
        throw new Error("成就名称不能为空");
      }
      result.name = name;
    }
    if (input.description !== undefined || creating) {
      result.description = String(input.description || "").trim();
    }
    if (input.category !== undefined || creating) {
      result.category = String(input.category || "常规").trim() || "常规";
    }
    if (creating || input.target_type !== undefined) {
      const type = input.target_type || existing?.target_type;
      if (!type || !ACHIEVEMENT_TARGET_TYPES.includes(type)) {
        throw new Error("成就目标类型无效");
      }
      result.target_type = type;
    }
    if (creating || input.target_value !== undefined) {
      const targetValue = Number(input.target_value);
      if (!Number.isInteger(targetValue) || targetValue <= 0) {
        throw new Error("成就目标值必须为正整数");
      }
      result.target_value = targetValue;
    }
    if (input.target_scope !== undefined || creating) {
      result.target_scope = this.normalizeTargetScope(
        input.target_scope,
        result.target_type || existing?.target_type,
      );
    }
    if (creating || input.rewards !== undefined) {
      const rewards = this.rewardService.normalizeRewards(
        input.rewards,
        "成就奖励不能为空",
      );
      await this.rewardService.assertRewardItemsAvailable(
        this.dataSource.getRepository(DropItem),
        rewards.items,
      );
      result.rewards = rewards;
    }
    if (input.sort_order !== undefined || creating) {
      const sortOrder = Number(input.sort_order || 0);
      if (!Number.isInteger(sortOrder) || sortOrder < 0) {
        throw new Error("排序值必须为非负整数");
      }
      result.sort_order = sortOrder;
    }
    if (input.enabled !== undefined || creating) {
      result.enabled = input.enabled !== false;
    }
    if (input.starts_at !== undefined) {
      result.starts_at = this.parseOptionalDate(input.starts_at);
    }
    if (input.ends_at !== undefined) {
      result.ends_at = this.parseOptionalDate(input.ends_at);
    }
    return result;
  }

  private normalizeTargetScope(
    scope: AchievementTargetScope | null | undefined,
    targetType?: AchievementTargetType,
  ): AchievementTargetScope | null {
    const raw = scope || {};
    const result: AchievementTargetScope = {};
    if (
      targetType === "rarity_draws" ||
      targetType === "rarity_owned_cards"
    ) {
      const rarity = this.normalizeRarity(raw.rarity);
      if (!rarity) {
        throw new Error("该目标类型必须选择稀有度");
      }
      result.rarity = rarity;
    } else if (raw.rarity) {
      const rarity = this.normalizeRarity(raw.rarity);
      if (!rarity) {
        throw new Error("稀有度范围无效");
      }
      result.rarity = rarity;
    }
    if (raw.poolId !== undefined && raw.poolId !== null && raw.poolId !== 0) {
      const poolId = Number(raw.poolId);
      if (!Number.isInteger(poolId) || poolId <= 0) {
        throw new Error("卡池范围无效");
      }
      result.poolId = poolId;
    }
    return Object.keys(result).length > 0 ? result : null;
  }

  private normalizeRarity(value?: unknown) {
    const rarity = String(value || "").trim().toUpperCase();
    return ["N", "R", "SR", "SSR", "UR"].includes(rarity) ? rarity : "";
  }

  private parseOptionalDate(value: string | Date | null | undefined) {
    if (value === undefined || value === null || value === "") {
      return null;
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new Error("时间格式无效");
    }
    return date;
  }

  private isVisible(config: AchievementConfig) {
    const now = Date.now();
    if (config.starts_at && config.starts_at.getTime() > now) {
      return false;
    }
    if (config.ends_at && config.ends_at.getTime() < now) {
      return false;
    }
    return config.enabled === true && config.delete_flag !== true;
  }

  private toPlayerView(
    config: AchievementConfig,
    record?: UserAchievement | null,
    progress = 0,
  ) {
    return {
      id: config.id,
      code: config.code,
      name: config.name,
      description: config.description,
      category: config.category,
      targetType: config.target_type,
      targetLabel: ACHIEVEMENT_TARGET_LABELS[config.target_type],
      targetValue: config.target_value,
      targetScope: config.target_scope || null,
      progress: Math.min(Math.max(0, progress), config.target_value),
      achieved: record?.achieved === true,
      achievedAt: record?.achieved_at || null,
      rewards: record?.reward_snapshot || config.rewards,
      sortOrder: config.sort_order,
    };
  }

  private toNotificationView(
    config: AchievementConfig,
    record: UserAchievement,
  ) {
    return {
      achievementId: config.id,
      code: config.code,
      name: config.name,
      description: config.description,
      category: config.category,
      achievedAt: record.achieved_at || new Date(),
      rewards: record.reward_snapshot || config.rewards,
    };
  }

  private toAdminConfigView(config: AchievementConfig) {
    return {
      id: config.id,
      code: config.code,
      name: config.name,
      description: config.description,
      category: config.category,
      target_type: config.target_type,
      targetTypeLabel: ACHIEVEMENT_TARGET_LABELS[config.target_type],
      target_value: config.target_value,
      target_scope: config.target_scope || null,
      rewards: config.rewards,
      sort_order: config.sort_order,
      enabled: config.enabled,
      starts_at: config.starts_at || null,
      ends_at: config.ends_at || null,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  private normalizePage(query: { page?: number; pageSize?: number }) {
    const page = Math.max(1, Number(query.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize || 20)));
    return { page, pageSize };
  }

  private parseOptionalBoolean(value: string | boolean | undefined) {
    if (value === undefined || value === "" || value === "all") {
      return undefined;
    }
    if (value === true || value === "true") {
      return true;
    }
    if (value === false || value === "false") {
      return false;
    }
    return undefined;
  }
}
