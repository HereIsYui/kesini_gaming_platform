import { Injectable, Optional } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  Between,
  FindOptionsWhere,
  In,
  Like,
  ObjectLiteral,
  Repository,
} from "typeorm";
import {
  EditableGachaConfig,
  GachaConfigView,
  GachaConfigService,
} from "src/card/gacha-config.service";
import { ConfigurationService } from "src/config/configuration.service";
import { CardItem } from "src/entity/card.entity";
import { DropItem } from "src/entity/drop.entity";
import {
  ExchangeCostItem,
  ExchangeShopItem,
} from "src/entity/exchangeShopItem.entity";
import { ExchangeShopUsage } from "src/entity/exchangeShopUsage.entity";
import { UserHistory } from "src/entity/history.entity";
import { UserInventory } from "src/entity/inventory.entity";
import { LaunchActivityClaim } from "src/entity/launchActivityClaim.entity";
import { LaunchActivityConfig } from "src/entity/launchActivityConfig.entity";
import { PoolInfo } from "src/entity/pool.entity";
import { RedeemCode, RedeemRewards } from "src/entity/redeemCode.entity";
import { RedeemCodeUsage } from "src/entity/redeemCodeUsage.entity";
import { RechargeConfig } from "src/entity/rechargeConfig.entity";
import {
  RechargeRecord,
  RechargeRecordStatus,
} from "src/entity/rechargeRecord.entity";
import { TradeConfig } from "src/entity/tradeConfig.entity";
import { TradeListing } from "src/entity/tradeListing.entity";
import { TradeRecord } from "src/entity/tradeRecord.entity";
import { User } from "src/entity/user.entity";
import { UserGachaPity } from "src/entity/userGachaPity.entity";

export interface PageQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
}

const DROP_TYPE_META: Record<number, { label: string; usage: string }> = {
  0: { label: "卡片碎片", usage: "用于卡片合成和分解产出" },
  1: { label: "虚拟星穹币", usage: "建议优先使用用户星穹币字段，不放入背包" },
  2: { label: "普通道具", usage: "可放入背包，也可作为兑换码奖励" },
  3: { label: "其他", usage: "预留类型，需结合业务说明使用" },
};
const CARD_RARITIES = ["N", "R", "SR", "SSR", "UR"];
const DEFAULT_RECHARGE_MEMO_TEMPLATE = "抽卡平台充值，兑换星穹币 {amount}";
const DEFAULT_LAUNCH_ACTIVITY_KEY = "launch-2026";
const DEFAULT_LAUNCH_ACTIVITY_NAME = "开服福利";
const DEFAULT_LAUNCH_ACTIVITY_DESCRIPTION = "登录后可领取一次的开服福利。";
const RECHARGE_STATUSES: RechargeRecordStatus[] = [
  "pending",
  "success",
  "failed",
  "local_failed",
];

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(CardItem)
    private readonly cardRepository: Repository<CardItem>,
    @InjectRepository(PoolInfo)
    private readonly poolRepository: Repository<PoolInfo>,
    @InjectRepository(DropItem)
    private readonly dropRepository: Repository<DropItem>,
    @InjectRepository(UserHistory)
    private readonly historyRepository: Repository<UserHistory>,
    @InjectRepository(UserInventory)
    private readonly inventoryRepository: Repository<UserInventory>,
    @InjectRepository(UserGachaPity)
    private readonly pityRepository: Repository<UserGachaPity>,
    @InjectRepository(RedeemCode)
    private readonly redeemCodeRepository: Repository<RedeemCode>,
    @InjectRepository(RedeemCodeUsage)
    private readonly redeemUsageRepository: Repository<RedeemCodeUsage>,
    @InjectRepository(ExchangeShopItem)
    private readonly exchangeItemRepository: Repository<ExchangeShopItem>,
    @InjectRepository(ExchangeShopUsage)
    private readonly exchangeUsageRepository: Repository<ExchangeShopUsage>,
    private readonly gachaConfigService: GachaConfigService,
    private readonly configService: ConfigurationService,
    @Optional()
    @InjectRepository(TradeListing)
    private readonly tradeListingRepository?: Repository<TradeListing>,
    @Optional()
    @InjectRepository(TradeRecord)
    private readonly tradeRecordRepository?: Repository<TradeRecord>,
    @Optional()
    @InjectRepository(TradeConfig)
    private readonly tradeConfigRepository?: Repository<TradeConfig>,
    @Optional()
    @InjectRepository(RechargeConfig)
    private readonly rechargeConfigRepository?: Repository<RechargeConfig>,
    @Optional()
    @InjectRepository(RechargeRecord)
    private readonly rechargeRecordRepository?: Repository<RechargeRecord>,
    @Optional()
    @InjectRepository(LaunchActivityConfig)
    private readonly launchActivityConfigRepository?: Repository<LaunchActivityConfig>,
    @Optional()
    @InjectRepository(LaunchActivityClaim)
    private readonly launchActivityClaimRepository?: Repository<LaunchActivityClaim>,
  ) {}

  async getMe(uid: string) {
    const user = await this.userRepository.findOne({ where: { uid } });
    return {
      user,
      isAdmin: user?.is_admin === true,
    };
  }

  async getDashboard() {
    const [userCount, cardCount, poolCount, dropItemCount, recentHistories] =
      await Promise.all([
        this.userRepository.count(),
        this.cardRepository.count(),
        this.poolRepository.count(),
        this.dropRepository.count(),
        this.historyRepository.find({
          order: { createdAt: "DESC" },
          take: 8,
        }),
      ]);

    const totalHistory = await this.historyRepository
      .createQueryBuilder("history")
      .select("SUM(history.count)", "total")
      .getRawOne();
    const rarityTotals = await this.userRepository
      .createQueryBuilder("user")
      .select("SUM(user.card_count_n)", "N")
      .addSelect("SUM(user.card_count_r)", "R")
      .addSelect("SUM(user.card_count_sr)", "SR")
      .addSelect("SUM(user.card_count_ssr)", "SSR")
      .addSelect("SUM(user.card_count_ur)", "UR")
      .getRawOne();

    return {
      counters: {
        userCount,
        cardCount,
        poolCount,
        dropItemCount,
        totalDraws: Number(totalHistory?.total || 0),
      },
      rarityTotals: {
        N: Number(rarityTotals?.N || 0),
        R: Number(rarityTotals?.R || 0),
        SR: Number(rarityTotals?.SR || 0),
        SSR: Number(rarityTotals?.SSR || 0),
        UR: Number(rarityTotals?.UR || 0),
      },
      recentHistories,
    };
  }

  async getOptions() {
    const [pools, cards, dropItems] = await Promise.all([
      this.poolRepository.find({ order: { id: "DESC" } as any }),
      this.cardRepository.find({ order: { id: "DESC" } as any }),
      this.dropRepository.find({ order: { id: "DESC" } as any }),
    ]);
    const defaultFragmentItem = dropItems.find(
      (item) =>
        item.drop_type === 0 &&
        item.default_fragment === true &&
        item.disabled !== true,
    );

    return {
      pools: pools.map((pool) => ({
        label: pool.pool_name,
        value: pool.id,
        type: pool.card_type,
      })),
      cards: cards.map((card) => ({
        label: card.card_name,
        value: card.id,
        rarity: card.card_level,
        pool: card.pool,
      })),
      dropItems: dropItems.map((item) => ({
        label: this.formatDropItemOptionLabel(item),
        value: item.id,
        type: item.drop_type,
        typeLabel: this.getDropTypeMeta(item.drop_type).label,
        usageLabel: this.getDropTypeMeta(item.drop_type).usage,
        disabled: item.disabled === true,
        defaultFragment: item.default_fragment === true,
      })),
      defaultFragmentItem: defaultFragmentItem
        ? {
            label: defaultFragmentItem.drop_name,
            value: defaultFragmentItem.id,
          }
        : null,
    };
  }

  async getPool(id: number) {
    const pool = await this.mustFind(this.poolRepository, id, "卡池不存在");
    const gachaConfig = await this.gachaConfigService.getPoolConfigDetail(id);
    return {
      ...pool,
      gacha_config_mode: this.getGachaConfigMode(gachaConfig.effective),
      gachaConfig,
    };
  }

  async listPools(query: PageQuery) {
    const { page, pageSize } = this.normalizePage(query);
    const where = query.keyword
      ? [
          { pool_name: Like(`%${query.keyword}%`) },
          { card_desc: Like(`%${query.keyword}%`) },
        ]
      : {};
    const result = await this.findAndPage(
      this.poolRepository,
      where,
      page,
      pageSize,
    );
    const poolIds = result.list
      .map((pool) => Number(pool.id))
      .filter((poolId) => Number.isInteger(poolId) && poolId > 0);
    if (poolIds.length === 0) {
      return result;
    }
    const configs =
      await this.gachaConfigService.getPoolConfigsByPoolIds(poolIds);
    return {
      ...result,
      list: result.list.map((pool) => {
        const config = configs[pool.id];
        return {
          ...pool,
          gacha_config_mode: this.getGachaConfigMode(config),
        };
      }),
    };
  }

  async createPool(body: Partial<PoolInfo>) {
    this.assertRequired(body.pool_name, "卡池名称不能为空");
    this.assertRequired(body.card_desc, "卡池描述不能为空");
    const pool = this.poolRepository.create({
      pool_name: body.pool_name,
      card_desc: body.card_desc,
      card_type: Number(body.card_type || 0),
      enabled: body.enabled ?? true,
    });
    return this.poolRepository.save(pool);
  }

  async updatePool(id: number, body: Partial<PoolInfo>) {
    const pool = await this.mustFind(this.poolRepository, id, "卡池不存在");
    Object.assign(
      pool,
      this.pickDefined(body, [
        "pool_name",
        "card_desc",
        "card_type",
        "enabled",
      ]),
    );
    return this.poolRepository.save(pool);
  }

  async deletePool(id: number) {
    await this.poolRepository.delete(id);
    return { deleted: true };
  }

  async listCards(query: PageQuery & { poolId?: number; rarity?: string }) {
    const { page, pageSize } = this.normalizePage(query);
    const where: FindOptionsWhere<CardItem> = {};
    if (query.poolId !== undefined) {
      where.pool = query.poolId;
    }
    if (query.keyword) {
      where.card_name = Like(`%${query.keyword}%`);
    }

    const result = await this.findAndPage(
      this.cardRepository,
      where,
      page,
      pageSize,
    );
    if (!query.rarity) {
      return result;
    }

    const normalizedRarity = query.rarity.trim().toUpperCase();
    return {
      ...result,
      list: result.list.filter((card) =>
        card.card_level
          .split(",")
          .map((level) => level.trim().toUpperCase())
          .includes(normalizedRarity),
      ),
    };
  }

  async getCard(id: number) {
    return this.mustFind(this.cardRepository, id, "卡片不存在");
  }

  async createCard(body: Partial<CardItem>) {
    this.assertRequired(body.card_name, "卡片名称不能为空");
    const card = this.cardRepository.create({
      card_name: body.card_name,
      card_level: this.normalizeCardLevels(body.card_level),
      drop_item: body.drop_item || "",
      card_desc: body.card_desc || "",
      card_type: Number(body.card_type || 0),
      pool: Number(body.pool || 1),
    });
    return this.cardRepository.save(card);
  }

  async updateCard(id: number, body: Partial<CardItem>) {
    const card = await this.mustFind(this.cardRepository, id, "卡片不存在");
    const updates = this.pickDefined(body, [
      "card_name",
      "card_level",
      "drop_item",
      "card_desc",
      "card_type",
      "pool",
    ]);
    if (updates.card_level !== undefined) {
      updates.card_level = this.normalizeCardLevels(updates.card_level);
    }
    Object.assign(card, updates);
    return this.cardRepository.save(card);
  }

  async deleteCard(id: number) {
    await this.cardRepository.delete(id);
    return { deleted: true };
  }

  async listDropItems(query: PageQuery) {
    const { page, pageSize } = this.normalizePage(query);
    const where = query.keyword
      ? [
          { drop_name: Like(`%${query.keyword}%`) },
          { drop_desc: Like(`%${query.keyword}%`) },
        ]
      : {};
    const result = await this.findAndPage(
      this.dropRepository,
      where,
      page,
      pageSize,
    );
    return {
      ...result,
      list: result.list.map((item) => this.decorateDropItem(item)),
    };
  }

  async getDropItem(id: number) {
    return this.decorateDropItem(
      await this.mustFind(this.dropRepository, id, "物品不存在"),
    );
  }

  async createDropItem(body: Partial<DropItem>) {
    const normalized = this.normalizeDropItemInput(body);
    const disabled = body.disabled === true;
    await this.prepareDefaultFragment(
      { ...normalized, disabled },
      body.default_fragment === true,
    );
    const item = this.dropRepository.create({
      ...normalized,
      disabled,
      default_fragment: body.default_fragment === true,
    });
    return this.dropRepository.save(item);
  }

  async updateDropItem(id: number, body: Partial<DropItem>) {
    const item = await this.mustFind(this.dropRepository, id, "物品不存在");
    const normalized = this.normalizeDropItemInput({ ...item, ...body });
    const disabled =
      body.disabled === undefined
        ? item.disabled === true
        : body.disabled === true;
    const defaultFragment =
      disabled || normalized.drop_type !== 0
        ? false
        : body.default_fragment === undefined
          ? item.default_fragment === true
          : body.default_fragment === true;
    await this.prepareDefaultFragment(
      { ...normalized, disabled },
      defaultFragment,
      id,
    );
    Object.assign(item, normalized, this.pickDefined(body, ["disabled"]), {
      default_fragment: defaultFragment,
    });
    return this.dropRepository.save(item);
  }

  async deleteDropItem(id: number) {
    const item = await this.mustFind(this.dropRepository, id, "物品不存在");
    if (await this.isDropItemReferenced(id)) {
      item.disabled = true;
      await this.dropRepository.save(item);
      return { deleted: false, disabled: true };
    }
    await this.dropRepository.delete(id);
    return { deleted: true };
  }

  async listUsers(query: PageQuery) {
    const { page, pageSize } = this.normalizePage(query);
    const where = query.keyword
      ? [
          { uid: Like(`%${query.keyword}%`) },
          { name: Like(`%${query.keyword}%`) },
          { nickname: Like(`%${query.keyword}%`) },
        ]
      : {};
    return this.findAndPage(this.userRepository, where, page, pageSize);
  }

  async getUser(id: number) {
    return this.mustFind(this.userRepository, id, "用户不存在");
  }

  async updateUser(id: number, body: Partial<User>) {
    const user = await this.mustFind(this.userRepository, id, "用户不存在");
    Object.assign(
      user,
      this.pickDefined(body, [
        "name",
        "nickname",
        "avatar",
        "point",
        "is_admin",
      ]),
    );
    return this.userRepository.save(user);
  }

  async listHistories(
    query: PageQuery & {
      uid?: string;
      rarity?: string;
      start?: string;
      end?: string;
    },
  ) {
    const { page, pageSize } = this.normalizePage(query);
    const where: FindOptionsWhere<UserHistory> = {};
    if (query.uid) {
      where.uid = query.uid;
    }
    if (query.start && query.end) {
      where.createdAt = Between(new Date(query.start), new Date(query.end));
    }

    const result = await this.findAndPage(
      this.historyRepository,
      where,
      page,
      pageSize,
    );
    if (!query.rarity) {
      return result;
    }

    const rarity = query.rarity.trim().toUpperCase();
    return {
      ...result,
      list: result.list.filter((history) =>
        history.card_levels
          .split(",")
          .map((level) => level.trim().toUpperCase())
          .includes(rarity),
      ),
    };
  }

  async listInventories(query: PageQuery & { uid?: string }) {
    const { page, pageSize } = this.normalizePage(query);
    const where: FindOptionsWhere<UserInventory> = {};
    if (query.uid) {
      const user = await this.userRepository.findOne({
        where: { uid: query.uid },
      });
      if (!user) {
        return { list: [], total: 0, page, pageSize };
      }
      where.user_id = user.id;
    }

    const result = await this.findAndPage(
      this.inventoryRepository,
      where,
      page,
      pageSize,
    );
    return this.attachInventoryInfo(result);
  }

  async updateInventory(id: number, body: Partial<UserInventory>) {
    const inventory = await this.mustFind(
      this.inventoryRepository,
      id,
      "背包记录不存在",
    );
    Object.assign(inventory, this.pickDefined(body, ["num"]));
    return this.inventoryRepository.save(inventory);
  }

  async listPity(query: PageQuery & { uid?: string; poolId?: number }) {
    const { page, pageSize } = this.normalizePage(query);
    const where: FindOptionsWhere<UserGachaPity> = {};
    if (query.uid) {
      where.uid = query.uid;
    }
    if (query.poolId !== undefined) {
      where.pool_id = query.poolId;
    }
    return this.findAndPage(this.pityRepository, where, page, pageSize);
  }

  async updatePity(id: number, body: Partial<UserGachaPity>) {
    const pity = await this.mustFind(this.pityRepository, id, "保底记录不存在");
    Object.assign(
      pity,
      this.pickDefined(body, [
        "draws_since_sr",
        "draws_since_ssr",
        "draws_since_ur",
      ]),
    );
    return this.pityRepository.save(pity);
  }

  async getGachaConfig() {
    const defaultConfig =
      await this.gachaConfigService.getGlobalDefaultConfigView();
    const fallbackConfig = this.gachaConfigService.getFallbackConfigView();
    return {
      defaultConfig,
      fallbackConfig,
      pools: { 0: defaultConfig },
      defaults: { 0: fallbackConfig },
      adminUids: this.configService.adminUids,
    };
  }

  async updateGachaConfig(poolId: number, body: EditableGachaConfig) {
    return this.gachaConfigService.savePoolConfig(poolId, body);
  }

  async copyGachaConfig(poolId: number, targetPoolIds: number[]) {
    const normalizedTargetIds = [
      ...new Set(
        (targetPoolIds || [])
          .map((targetPoolId) => Number(targetPoolId))
          .filter(
            (targetPoolId) =>
              Number.isInteger(targetPoolId) &&
              targetPoolId > 0 &&
              targetPoolId !== poolId,
          ),
      ),
    ];

    if (!Number.isInteger(poolId) || poolId <= 0) {
      throw new Error("源卡池ID无效");
    }
    if (normalizedTargetIds.length === 0) {
      throw new Error("请选择要复制到的目标卡池");
    }

    const expectedPoolIds = [poolId, ...normalizedTargetIds];
    const pools = await this.poolRepository.find({
      where: { id: In(expectedPoolIds) } as any,
    });
    const existingPoolIds = new Set(pools.map((pool) => pool.id));
    if (!existingPoolIds.has(poolId)) {
      throw new Error("源卡池不存在");
    }
    const missingPoolIds = expectedPoolIds.filter(
      (currentPoolId) => !existingPoolIds.has(currentPoolId),
    );
    if (missingPoolIds.length > 0) {
      throw new Error(`目标卡池不存在: ${missingPoolIds.join(",")}`);
    }

    const sourceConfig =
      await this.gachaConfigService.getConfigByPoolId(poolId);
    const nextConfig: EditableGachaConfig = {
      poolId,
      enabled: true,
      rarityProbabilities: sourceConfig.rarityProbabilities,
      upCards: sourceConfig.upCards || null,
      pitySystem: sourceConfig.pitySystem || null,
      drawCosts: sourceConfig.drawCosts,
    };
    const list: GachaConfigView[] = [];
    for (const targetPoolId of normalizedTargetIds) {
      list.push(
        await this.gachaConfigService.savePoolConfig(targetPoolId, {
          ...nextConfig,
          poolId: targetPoolId,
        }),
      );
    }

    return {
      sourcePoolId: poolId,
      targetPoolIds: normalizedTargetIds,
      list,
    };
  }

  async listRedeemCodes(query: PageQuery) {
    const { page, pageSize } = this.normalizePage(query);
    const where = query.keyword
      ? [
          {
            code: Like(`%${query.keyword.trim().toUpperCase()}%`),
            delete_flag: false,
          },
          { name: Like(`%${query.keyword}%`), delete_flag: false },
        ]
      : { delete_flag: false };
    return this.findAndPage(this.redeemCodeRepository, where, page, pageSize);
  }

  async getRedeemCode(id: number) {
    const code = await this.mustFind(
      this.redeemCodeRepository,
      id,
      "兑换码不存在",
    );
    if (code.delete_flag) {
      throw new Error("兑换码不存在");
    }
    return code;
  }

  async createRedeemCode(body: Partial<RedeemCode>) {
    const code = this.normalizeRedeemCode(body.code);
    this.assertRequired(code, "兑换码不能为空");
    this.assertRequired(body.name, "兑换码名称不能为空");
    const existing = await this.redeemCodeRepository.findOne({
      where: { code },
    });
    if (existing && !existing.delete_flag) {
      throw new Error("兑换码已存在");
    }
    const rewards = await this.normalizeRewards(body.rewards);
    const totalLimit = this.normalizeTotalLimit(body.total_limit);
    const entity = this.redeemCodeRepository.create({
      code,
      name: body.name!,
      description: body.description || "",
      enabled: body.enabled !== false,
      total_limit: totalLimit,
      used_count: 0,
      starts_at: this.parseOptionalDate(body.starts_at),
      ends_at: this.parseOptionalDate(body.ends_at),
      rewards,
      delete_flag: false,
    });
    this.assertRedeemTimeRange(entity.starts_at, entity.ends_at);
    return this.redeemCodeRepository.save(entity);
  }

  async updateRedeemCode(id: number, body: Partial<RedeemCode>) {
    const code = await this.getRedeemCode(id);
    const nextCode =
      body.code !== undefined ? this.normalizeRedeemCode(body.code) : code.code;
    if (!nextCode) {
      throw new Error("兑换码不能为空");
    }
    if (nextCode !== code.code) {
      const existing = await this.redeemCodeRepository.findOne({
        where: { code: nextCode },
      });
      if (existing && existing.id !== id && !existing.delete_flag) {
        throw new Error("兑换码已存在");
      }
    }

    const next = Object.assign(
      code,
      this.pickDefined(body, ["name", "description", "enabled"]),
    );
    next.code = nextCode;
    if (body.total_limit !== undefined) {
      next.total_limit = this.normalizeTotalLimit(body.total_limit);
      if (next.total_limit !== null && next.used_count > next.total_limit) {
        throw new Error("总库存不能小于已兑换数量");
      }
    }
    if (body.starts_at !== undefined) {
      next.starts_at = this.parseOptionalDate(body.starts_at);
    }
    if (body.ends_at !== undefined) {
      next.ends_at = this.parseOptionalDate(body.ends_at);
    }
    if (body.rewards !== undefined) {
      next.rewards = await this.normalizeRewards(body.rewards);
    }
    this.assertRequired(next.name, "兑换码名称不能为空");
    this.assertRedeemTimeRange(next.starts_at, next.ends_at);
    return this.redeemCodeRepository.save(next);
  }

  async deleteRedeemCode(id: number) {
    const code = await this.getRedeemCode(id);
    code.enabled = false;
    code.delete_flag = true;
    await this.redeemCodeRepository.save(code);
    return { deleted: true };
  }

  async listRedeemUsages(query: PageQuery & { uid?: string; codeId?: number }) {
    const { page, pageSize } = this.normalizePage(query);
    const where: FindOptionsWhere<RedeemCodeUsage> = {};
    if (query.uid) {
      where.uid = query.uid;
    }
    if (query.codeId !== undefined) {
      where.code_id = query.codeId;
    }
    return this.findAndPage(this.redeemUsageRepository, where, page, pageSize);
  }

  async listExchangeItems(query: PageQuery) {
    const { page, pageSize } = this.normalizePage(query);
    const where = query.keyword
      ? [
          { name: Like(`%${query.keyword}%`), delete_flag: false },
          { description: Like(`%${query.keyword}%`), delete_flag: false },
        ]
      : { delete_flag: false };
    return this.findAndPage(this.exchangeItemRepository, where, page, pageSize);
  }

  async getExchangeItem(id: number) {
    const item = await this.mustFind(
      this.exchangeItemRepository,
      id,
      "兑换项不存在",
    );
    if (item.delete_flag) {
      throw new Error("兑换项不存在");
    }
    return item;
  }

  async createExchangeItem(body: Partial<ExchangeShopItem>) {
    const normalized = await this.normalizeExchangeItemInput(body);
    const entity = this.exchangeItemRepository.create({
      ...normalized,
      used_count: 0,
      delete_flag: false,
    });
    this.assertExchangeTimeRange(entity.starts_at, entity.ends_at);
    return this.exchangeItemRepository.save(entity);
  }

  async updateExchangeItem(id: number, body: Partial<ExchangeShopItem>) {
    const item = await this.getExchangeItem(id);
    const normalized = await this.normalizeExchangeItemInput({
      ...item,
      ...body,
    });
    if (
      normalized.total_limit !== null &&
      normalized.total_limit !== undefined &&
      item.used_count > normalized.total_limit
    ) {
      throw new Error("总库存不能小于已兑换数量");
    }
    Object.assign(item, normalized);
    this.assertExchangeTimeRange(item.starts_at, item.ends_at);
    return this.exchangeItemRepository.save(item);
  }

  async deleteExchangeItem(id: number) {
    const item = await this.getExchangeItem(id);
    item.enabled = false;
    item.delete_flag = true;
    await this.exchangeItemRepository.save(item);
    return { deleted: true };
  }

  async listExchangeUsages(
    query: PageQuery & { uid?: string; itemId?: number },
  ) {
    const { page, pageSize } = this.normalizePage(query);
    const where: FindOptionsWhere<ExchangeShopUsage> = {};
    if (query.uid) {
      where.uid = query.uid;
    }
    if (query.itemId !== undefined) {
      where.shop_item_id = query.itemId;
    }
    return this.findAndPage(
      this.exchangeUsageRepository,
      where,
      page,
      pageSize,
    );
  }

  async listTradeListings(
    query: PageQuery & {
      status?: string;
      sellerUid?: string;
      buyerUid?: string;
      rarity?: string;
    },
  ) {
    const { page, pageSize } = this.normalizePage(query);
    const where: FindOptionsWhere<TradeListing> = {};
    if (query.status) {
      where.status = query.status as any;
    }
    if (query.sellerUid) {
      where.seller_uid = query.sellerUid;
    }
    if (query.buyerUid) {
      where.buyer_uid = query.buyerUid;
    }
    if (query.rarity) {
      where.card_level = query.rarity.trim().toUpperCase();
    }
    if (query.keyword) {
      where.card_uuid = Like(`%${query.keyword}%`);
    }
    const result = await this.findAndPage(
      this.mustTradeListingRepository(),
      where,
      page,
      pageSize,
    );
    return {
      ...result,
      list: await this.attachTradeListingInfo(result.list),
    };
  }

  async getTradeListing(id: number) {
    const listing = await this.mustFind(
      this.mustTradeListingRepository(),
      id,
      "交易挂单不存在",
    );
    return (await this.attachTradeListingInfo([listing]))[0];
  }

  async cancelTradeListing(id: number) {
    const listing = await this.getTradeListing(id);
    if (listing.status !== "active") {
      throw new Error("只能取消交易中的挂单");
    }
    const repository = this.mustTradeListingRepository();
    const entity = await this.mustFind(repository, id, "交易挂单不存在");
    entity.status = "cancelled";
    entity.cancelled_at = new Date();
    await repository.save(entity);
    return { cancelled: true };
  }

  async listTradeRecords(
    query: PageQuery & { uid?: string; listingId?: number },
  ) {
    const { page, pageSize } = this.normalizePage(query);
    const where: FindOptionsWhere<TradeRecord> = {};
    if (query.listingId !== undefined) {
      where.listing_id = query.listingId;
    }
    if (query.uid) {
      const keyword = query.uid;
      const result = await this.findAndPage(
        this.mustTradeRecordRepository(),
        [
          { ...where, seller_uid: keyword },
          { ...where, buyer_uid: keyword },
        ],
        page,
        pageSize,
      );
      return {
        ...result,
        list: await this.attachTradeRecordInfo(result.list),
      };
    }
    const result = await this.findAndPage(
      this.mustTradeRecordRepository(),
      where,
      page,
      pageSize,
    );
    return {
      ...result,
      list: await this.attachTradeRecordInfo(result.list),
    };
  }

  async getTradeRecord(id: number) {
    const record = await this.mustFind(
      this.mustTradeRecordRepository(),
      id,
      "交易记录不存在",
    );
    return (await this.attachTradeRecordInfo([record]))[0];
  }

  async getTradeConfig() {
    return this.ensureTradeConfig();
  }

  async updateTradeConfig(body: Partial<TradeConfig>) {
    const repository = this.mustTradeConfigRepository();
    const config = await this.ensureTradeConfig();
    Object.assign(config, {
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
    this.assertTradeConfig(config);
    return repository.save(config);
  }

  async getRechargeConfig() {
    const config = await this.ensureRechargeConfig();
    return this.toRechargeConfigView(config);
  }

  async updateRechargeConfig(body: Partial<RechargeConfig>) {
    const repository = this.mustRechargeConfigRepository();
    const config = await this.ensureRechargeConfig();
    const next = Object.assign(config, {
      enabled:
        body.enabled === undefined ? config.enabled : body.enabled === true,
      min_amount:
        body.min_amount === undefined
          ? config.min_amount
          : Number(body.min_amount),
      max_amount:
        body.max_amount === undefined
          ? config.max_amount
          : Number(body.max_amount),
      recharge_ratio:
        body.recharge_ratio === undefined
          ? config.recharge_ratio
          : Number(body.recharge_ratio),
      memo_template:
        body.memo_template === undefined
          ? config.memo_template
          : String(body.memo_template || "").trim() ||
            DEFAULT_RECHARGE_MEMO_TEMPLATE,
    });
    const nextKey = String(body.gold_finger_key || "").trim();
    if (nextKey) {
      next.gold_finger_key = nextKey;
    }
    const nextApiKey = String(body.fishpi_api_key || "").trim();
    if (nextApiKey) {
      next.fishpi_api_key = nextApiKey;
    }
    this.assertRechargeConfig(next);
    return this.toRechargeConfigView(await repository.save(next));
  }

  async listRechargeRecords(
    query: PageQuery & {
      uid?: string;
      userName?: string;
      status?: string;
      start?: string;
      end?: string;
    },
  ) {
    const { page, pageSize } = this.normalizePage(query);
    const repository = this.mustRechargeRecordRepository();
    const queryBuilder = repository
      .createQueryBuilder("record")
      .orderBy("record.id", "DESC")
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (query.uid) {
      queryBuilder.andWhere("record.uid LIKE :uid", {
        uid: `%${query.uid}%`,
      });
    }
    if (query.userName) {
      queryBuilder.andWhere("record.fishpi_user_name LIKE :userName", {
        userName: `%${query.userName}%`,
      });
    }
    if (query.status) {
      const status = query.status as RechargeRecordStatus;
      if (!RECHARGE_STATUSES.includes(status)) {
        throw new Error("充值状态无效");
      }
      queryBuilder.andWhere("record.status = :status", { status });
    }
    if (query.start) {
      const start = this.parseOptionalDate(query.start);
      if (start) {
        queryBuilder.andWhere("record.createdAt >= :start", { start });
      }
    }
    if (query.end) {
      const end = this.parseOptionalDate(query.end);
      if (end) {
        queryBuilder.andWhere("record.createdAt <= :end", { end });
      }
    }

    const [list, total] = await queryBuilder.getManyAndCount();
    return {
      list: list.map((record) => this.decorateRechargeRecord(record)),
      total,
      page,
      pageSize,
    };
  }

  async getLaunchActivityConfig() {
    const config = await this.ensureLaunchActivityConfig();
    return this.toLaunchActivityConfigView(config);
  }

  async updateLaunchActivityConfig(body: Partial<LaunchActivityConfig>) {
    const repository = this.mustLaunchActivityConfigRepository();
    const config = await this.ensureLaunchActivityConfig();
    const next = Object.assign(config, {
      enabled:
        body.enabled === undefined ? config.enabled : body.enabled === true,
      activity_key:
        body.activity_key === undefined
          ? config.activity_key
          : this.normalizeActivityKey(body.activity_key),
      name:
        body.name === undefined
          ? config.name
          : String(body.name || "").trim() || DEFAULT_LAUNCH_ACTIVITY_NAME,
      description:
        body.description === undefined
          ? config.description
          : String(body.description || "").trim(),
      starts_at:
        body.starts_at === undefined
          ? config.starts_at || null
          : this.parseOptionalDate(body.starts_at),
      ends_at:
        body.ends_at === undefined
          ? config.ends_at || null
          : this.parseOptionalDate(body.ends_at),
      rewards:
        body.rewards === undefined
          ? config.rewards
          : await this.normalizeRewards(body.rewards, "开服福利奖励不能为空"),
    });
    this.assertLaunchActivityConfig(next);
    return this.toLaunchActivityConfigView(await repository.save(next));
  }

  async listLaunchActivityClaims(
    query: PageQuery & { uid?: string; activityKey?: string },
  ) {
    const { page, pageSize } = this.normalizePage(query);
    const where: FindOptionsWhere<LaunchActivityClaim> = {};
    if (query.uid) {
      where.uid = Like(`%${query.uid}%`);
    }
    if (query.activityKey) {
      where.activity_key = Like(`%${query.activityKey}%`);
    }
    return this.findAndPage(
      this.mustLaunchActivityClaimRepository(),
      where,
      page,
      pageSize,
    );
  }

  private async attachInventoryInfo(result: {
    list: UserInventory[];
    total: number;
    page: number;
    pageSize: number;
  }) {
    const userIds = [...new Set(result.list.map((item) => item.user_id))];
    const itemIds = [...new Set(result.list.map((item) => item.item_id))];
    const [users, items]: [User[], DropItem[]] = await Promise.all([
      userIds.length
        ? this.userRepository.find({ where: { id: In(userIds) } })
        : Promise.resolve([] as User[]),
      itemIds.length
        ? this.dropRepository.find({ where: { id: In(itemIds) } })
        : Promise.resolve([] as DropItem[]),
    ]);

    return {
      ...result,
      list: result.list.map((inventory) => ({
        ...inventory,
        user: users.find((user) => user.id === inventory.user_id) || null,
        item:
          this.decorateNullableDropItem(
            items.find((item) => item.id === inventory.item_id) || null,
          ) || null,
      })),
    };
  }

  private async attachTradeListingInfo(list: TradeListing[]) {
    if (list.length === 0) {
      return [];
    }
    const cardIds = [...new Set(list.map((item) => item.card_id))];
    const cards = await this.cardRepository.find({
      where: { id: In(cardIds) },
    });
    const poolIds = [...new Set(cards.map((card) => card.pool))];
    const pools = poolIds.length
      ? await this.poolRepository.find({ where: { id: In(poolIds) } })
      : [];
    const cardMap = new Map(cards.map((card) => [card.id, card]));
    const poolMap = new Map(pools.map((pool) => [pool.id, pool]));
    return list.map((listing) => {
      const card = cardMap.get(listing.card_id);
      const pool = card ? poolMap.get(card.pool) : null;
      const feeAmount = Math.floor(
        Number(listing.price || 0) * Number(listing.fee_rate || 0),
      );
      return {
        ...listing,
        cardName: card?.card_name || `卡片#${listing.card_id}`,
        cardDesc: card?.card_desc || "",
        cardType: card?.card_type || 0,
        poolId: card?.pool || null,
        poolName: pool?.pool_name || "",
        feeAmount,
        sellerIncome: Number(listing.price || 0) - feeAmount,
      };
    });
  }

  private async attachTradeRecordInfo(list: TradeRecord[]) {
    return list.map((record) => ({
      ...record,
      cardName: record.card_snapshot?.cardName || `卡片#${record.card_id}`,
      cardDesc: record.card_snapshot?.cardDesc || "",
      cardType: record.card_snapshot?.cardType || 0,
      poolId: record.card_snapshot?.poolId || null,
      poolName: record.card_snapshot?.poolName || "",
    }));
  }

  private decorateRechargeRecord(record: RechargeRecord) {
    return {
      ...record,
      statusLabel: this.getRechargeStatusLabel(record.status),
      thirdPartyMsg: this.getRechargeThirdPartyMessage(
        record.third_party_response,
      ),
    };
  }

  private async ensureTradeConfig() {
    const repository = this.mustTradeConfigRepository();
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
    config.enabled = config.enabled !== false;
    config.fee_rate = Number(config.fee_rate || 0);
    config.min_price = Number(config.min_price || 1);
    config.max_price = Number(config.max_price || 999999);
    this.assertTradeConfig(config);
    return config;
  }

  private async ensureRechargeConfig() {
    const repository = this.mustRechargeConfigRepository();
    let config = await repository.findOne({ where: { id: 1 } });
    if (!config) {
      config = repository.create({
        id: 1,
        enabled: false,
        gold_finger_key: "",
        fishpi_api_key: "",
        min_amount: 1,
        max_amount: 9999,
        recharge_ratio: 1,
        memo_template: DEFAULT_RECHARGE_MEMO_TEMPLATE,
      });
      config = await repository.save(config);
    }
    config.enabled = config.enabled === true;
    config.min_amount = Number(config.min_amount || 1);
    config.max_amount = Number(config.max_amount || 9999);
    config.recharge_ratio = Number(config.recharge_ratio || 1);
    config.memo_template =
      config.memo_template || DEFAULT_RECHARGE_MEMO_TEMPLATE;
    config.fishpi_api_key = config.fishpi_api_key || "";
    this.assertRechargeConfig(config);
    return config;
  }

  private async ensureLaunchActivityConfig() {
    const repository = this.mustLaunchActivityConfigRepository();
    let config = await repository.findOne({ where: { id: 1 } });
    if (!config) {
      config = repository.create({
        id: 1,
        enabled: false,
        activity_key: DEFAULT_LAUNCH_ACTIVITY_KEY,
        name: DEFAULT_LAUNCH_ACTIVITY_NAME,
        description: DEFAULT_LAUNCH_ACTIVITY_DESCRIPTION,
        starts_at: null,
        ends_at: null,
        rewards: { points: 100, items: [] },
      });
      config = await repository.save(config);
    }
    config.enabled = config.enabled === true;
    config.activity_key = this.normalizeActivityKey(config.activity_key);
    config.name =
      String(config.name || "").trim() || DEFAULT_LAUNCH_ACTIVITY_NAME;
    config.description = String(config.description || "").trim();
    config.starts_at = config.starts_at || null;
    config.ends_at = config.ends_at || null;
    config.rewards = await this.normalizeRewards(
      config.rewards,
      "开服福利奖励不能为空",
    );
    this.assertLaunchActivityConfig(config);
    return config;
  }

  private assertTradeConfig(config: TradeConfig) {
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

  private assertRechargeConfig(config: RechargeConfig) {
    if (!Number.isInteger(config.min_amount) || config.min_amount < 1) {
      throw new Error("最低充值金额必须为正整数");
    }
    if (
      !Number.isInteger(config.max_amount) ||
      config.max_amount < config.min_amount
    ) {
      throw new Error("最高充值金额必须大于等于最低充值金额");
    }
    if (!String(config.memo_template || "").trim()) {
      throw new Error("充值备注模板不能为空");
    }
    if (
      !Number.isFinite(Number(config.recharge_ratio)) ||
      Number(config.recharge_ratio) <= 0 ||
      Number(config.recharge_ratio) > 100
    ) {
      throw new Error("充值比例必须大于0且不超过100");
    }
  }

  private assertLaunchActivityConfig(config: LaunchActivityConfig) {
    this.normalizeActivityKey(config.activity_key);
    if (!String(config.name || "").trim()) {
      throw new Error("活动名称不能为空");
    }
    if (config.starts_at && config.ends_at) {
      if (config.starts_at.getTime() > config.ends_at.getTime()) {
        throw new Error("活动开始时间不能晚于结束时间");
      }
    }
  }

  private toRechargeConfigView(config: RechargeConfig) {
    const key = String(config.gold_finger_key || "").trim();
    const apiKey = String(config.fishpi_api_key || "").trim();
    return {
      id: config.id,
      enabled: config.enabled === true,
      min_amount: config.min_amount,
      max_amount: config.max_amount,
      recharge_ratio: Number(config.recharge_ratio || 1),
      memo_template: config.memo_template || DEFAULT_RECHARGE_MEMO_TEMPLATE,
      hasGoldFingerKey: Boolean(key),
      maskedGoldFingerKey: this.maskSecret(key),
      hasFishpiApiKey: Boolean(apiKey),
      maskedFishpiApiKey: this.maskSecret(apiKey),
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  private toLaunchActivityConfigView(config: LaunchActivityConfig) {
    return {
      id: config.id,
      enabled: config.enabled === true,
      activity_key: config.activity_key,
      name: config.name,
      description: config.description,
      starts_at: config.starts_at,
      ends_at: config.ends_at,
      rewards: config.rewards,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  private maskSecret(value: string) {
    if (!value) {
      return "";
    }
    if (value.length <= 8) {
      return `${value.slice(0, 2)}******`;
    }
    return `${value.slice(0, 4)}******${value.slice(-4)}`;
  }

  private getRechargeStatusLabel(status: RechargeRecordStatus) {
    const labels: Record<RechargeRecordStatus, string> = {
      pending: "处理中",
      success: "成功",
      failed: "失败",
      local_failed: "本地入账失败",
    };
    return labels[status] || "未知";
  }

  private getRechargeThirdPartyMessage(response: unknown) {
    if (!response || typeof response !== "object") {
      return "-";
    }
    const value = response as Record<string, unknown>;
    return String(value.msg || value.message || value.code || "已记录");
  }

  private mustTradeListingRepository() {
    if (!this.tradeListingRepository) {
      throw new Error("交易挂单仓库未初始化");
    }
    return this.tradeListingRepository;
  }

  private mustTradeRecordRepository() {
    if (!this.tradeRecordRepository) {
      throw new Error("交易记录仓库未初始化");
    }
    return this.tradeRecordRepository;
  }

  private mustTradeConfigRepository() {
    if (!this.tradeConfigRepository) {
      throw new Error("交易配置仓库未初始化");
    }
    return this.tradeConfigRepository;
  }

  private mustRechargeConfigRepository() {
    if (!this.rechargeConfigRepository) {
      throw new Error("充值配置仓库未初始化");
    }
    return this.rechargeConfigRepository;
  }

  private mustRechargeRecordRepository() {
    if (!this.rechargeRecordRepository) {
      throw new Error("充值记录仓库未初始化");
    }
    return this.rechargeRecordRepository;
  }

  private mustLaunchActivityConfigRepository() {
    if (!this.launchActivityConfigRepository) {
      throw new Error("开服活动配置仓库未初始化");
    }
    return this.launchActivityConfigRepository;
  }

  private mustLaunchActivityClaimRepository() {
    if (!this.launchActivityClaimRepository) {
      throw new Error("开服活动领取记录仓库未初始化");
    }
    return this.launchActivityClaimRepository;
  }

  private normalizePage(query: PageQuery) {
    const page = Math.max(1, Number(query.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize || 20)));
    return { page, pageSize };
  }

  private getGachaConfigMode(config?: GachaConfigView | null) {
    return config?.scope === "pool" && config.enabled !== false
      ? "卡池配置"
      : "默认配置";
  }

  private async findAndPage<T extends ObjectLiteral>(
    repository: Repository<T>,
    where: any,
    page: number,
    pageSize: number,
  ) {
    const [list, total] = await repository.findAndCount({
      where,
      order: { id: "DESC" } as any,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { list, total, page, pageSize };
  }

  private async mustFind<T extends { id: number }>(
    repository: Repository<T>,
    id: number,
    message: string,
  ): Promise<T> {
    const entity = await repository.findOne({ where: { id } as any });
    if (!entity) {
      throw new Error(message);
    }
    return entity;
  }

  private assertRequired(value: unknown, message: string) {
    if (value === undefined || value === null || value === "") {
      throw new Error(message);
    }
  }

  private pickDefined<T extends Record<string, any>>(
    source: T,
    keys: string[],
  ) {
    return keys.reduce(
      (result, key) => {
        if (source[key] !== undefined) {
          result[key] = source[key];
        }
        return result;
      },
      {} as Record<string, any>,
    );
  }

  private normalizeRedeemCode(code: unknown): string {
    return String(code || "")
      .trim()
      .toUpperCase();
  }

  private async normalizeRewards(
    rewards: unknown,
    emptyMessage = "兑换码奖励不能为空",
  ): Promise<RedeemRewards> {
    const value = (rewards || {}) as Partial<RedeemRewards>;
    const points = Number(value.points || 0);
    if (!Number.isFinite(points) || points < 0) {
      throw new Error("奖励星穹币无效");
    }
    const items = Array.isArray(value.items) ? value.items : [];
    const normalizedItems = items
      .map((item) => ({
        itemId: Number(item.itemId),
        num: Number(item.num),
      }))
      .filter((item) => item.itemId > 0 || item.num > 0);
    normalizedItems.forEach((item) => {
      if (!Number.isInteger(item.itemId) || item.itemId <= 0) {
        throw new Error("奖励物品ID无效");
      }
      if (!Number.isInteger(item.num) || item.num <= 0) {
        throw new Error("奖励物品数量无效");
      }
    });
    if (points === 0 && normalizedItems.length === 0) {
      throw new Error(emptyMessage);
    }
    await this.assertRewardItemsAvailable(
      normalizedItems.map((item) => item.itemId),
    );
    return { points, items: normalizedItems };
  }

  private async normalizeExchangeItemInput(body: Partial<ExchangeShopItem>) {
    const name = String(body.name || "").trim();
    this.assertRequired(name, "兑换项名称不能为空");
    const costs = this.normalizeCosts(body.costs);
    const rewards = this.normalizeExchangeRewards(body.rewards);
    await Promise.all([
      this.assertExchangeItemsAvailable(
        costs.map((item) => item.itemId),
        "消耗物品",
      ),
      this.assertExchangeItemsAvailable(
        rewards.items.map((item) => item.itemId),
        "奖励物品",
      ),
    ]);

    const userLimit = this.normalizeNullablePositiveInt(
      body.user_limit,
      "单用户限兑必须为正整数",
    );
    const sortOrder = Number(body.sort_order || 0);
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      throw new Error("排序值必须为非负整数");
    }

    return {
      name,
      description: body.description || "",
      enabled: body.enabled !== false,
      costs,
      rewards,
      total_limit: this.normalizeTotalLimit(body.total_limit),
      user_limit: userLimit,
      starts_at: this.parseOptionalDate(body.starts_at),
      ends_at: this.parseOptionalDate(body.ends_at),
      sort_order: sortOrder,
    };
  }

  private normalizeCosts(costs: unknown): ExchangeCostItem[] {
    const items = Array.isArray(costs) ? costs : [];
    const normalizedItems = items
      .map((item) => ({
        itemId: Number(item.itemId),
        num: Number(item.num),
      }))
      .filter((item) => item.itemId > 0 || item.num > 0);
    normalizedItems.forEach((item) => {
      if (!Number.isInteger(item.itemId) || item.itemId <= 0) {
        throw new Error("消耗物品ID无效");
      }
      if (!Number.isInteger(item.num) || item.num <= 0) {
        throw new Error("消耗物品数量无效");
      }
    });
    if (normalizedItems.length === 0) {
      throw new Error("兑换消耗不能为空");
    }
    return normalizedItems;
  }

  private normalizeExchangeRewards(rewards: unknown): RedeemRewards {
    const value = (rewards || {}) as Partial<RedeemRewards>;
    const points = Number(value.points || 0);
    if (!Number.isFinite(points) || points < 0) {
      throw new Error("奖励星穹币无效");
    }
    const items = Array.isArray(value.items) ? value.items : [];
    const normalizedItems = items
      .map((item) => ({
        itemId: Number(item.itemId),
        num: Number(item.num),
      }))
      .filter((item) => item.itemId > 0 || item.num > 0);
    normalizedItems.forEach((item) => {
      if (!Number.isInteger(item.itemId) || item.itemId <= 0) {
        throw new Error("奖励物品ID无效");
      }
      if (!Number.isInteger(item.num) || item.num <= 0) {
        throw new Error("奖励物品数量无效");
      }
    });
    if (points === 0 && normalizedItems.length === 0) {
      throw new Error("兑换奖励不能为空");
    }
    return { points, items: normalizedItems };
  }

  private normalizeDropItemInput(body: Partial<DropItem>) {
    const dropName = String(body.drop_name || "").trim();
    this.assertRequired(dropName, "物品名称不能为空");
    const dropType = Number(body.drop_type ?? 0);
    if (!Number.isInteger(dropType) || !DROP_TYPE_META[dropType]) {
      throw new Error("物品类型无效");
    }

    const itemType =
      body.drop_item_type === undefined || body.drop_item_type === null
        ? 0
        : Number(body.drop_item_type);
    const itemValue =
      body.drop_item_value === undefined || body.drop_item_value === null
        ? 0
        : Number(body.drop_item_value);
    if (!Number.isInteger(itemType) || itemType < 0) {
      throw new Error("用途参数类型必须为非负整数");
    }
    if (!Number.isFinite(itemValue) || itemValue < 0) {
      throw new Error("用途参数值必须为非负数字");
    }

    return {
      drop_name: dropName,
      drop_desc: body.drop_desc || "",
      drop_type: dropType,
      drop_item_type: dropType === 2 || dropType === 3 ? itemType : 0,
      drop_item_value: dropType === 2 || dropType === 3 ? itemValue : 0,
    };
  }

  private async prepareDefaultFragment(
    item: { drop_type: number; disabled?: boolean },
    defaultFragment: boolean,
    exceptId?: number,
  ) {
    if (!defaultFragment) {
      return;
    }
    if (item.drop_type !== 0) {
      throw new Error("只有卡片碎片可以设为默认分解碎片");
    }
    if (item.disabled === true) {
      throw new Error("默认分解碎片不能禁用");
    }

    const existingDefaults = await this.dropRepository.find({
      where: { default_fragment: true } as any,
    });
    const needClear = existingDefaults.filter(
      (existing) => existing.id !== exceptId,
    );
    if (needClear.length > 0) {
      await this.dropRepository.save(
        needClear.map((existing) => ({
          ...existing,
          default_fragment: false,
        })),
      );
    }
  }

  private normalizeCardLevels(value: unknown): string {
    const selected = String(value || "")
      .split(",")
      .map((level) => level.trim().toUpperCase())
      .filter(Boolean);

    if (selected.length === 0) {
      throw new Error("卡片稀有度不能为空");
    }

    const invalid = selected.find((level) => !CARD_RARITIES.includes(level));
    if (invalid) {
      throw new Error(`卡片稀有度不支持: ${invalid}`);
    }

    const selectedSet = new Set(selected);
    return CARD_RARITIES.filter((level) => selectedSet.has(level)).join(",");
  }

  private decorateNullableDropItem(item: DropItem | null) {
    return item ? this.decorateDropItem(item) : null;
  }

  private decorateDropItem<T extends DropItem>(item: T) {
    const meta = this.getDropTypeMeta(item.drop_type);
    return {
      ...item,
      typeLabel: meta.label,
      usageLabel: meta.usage,
      disabled: item.disabled === true,
      default_fragment: item.default_fragment === true,
    };
  }

  private getDropTypeMeta(type: number) {
    return DROP_TYPE_META[type] || DROP_TYPE_META[3];
  }

  private formatDropItemOptionLabel(item: DropItem) {
    const meta = this.getDropTypeMeta(item.drop_type);
    return `${item.drop_name} · ${meta.label}${item.disabled ? "（已禁用）" : ""}`;
  }

  private async assertRewardItemsAvailable(itemIds: number[]) {
    const uniqueItemIds = [...new Set(itemIds)];
    if (uniqueItemIds.length === 0) {
      return;
    }
    const items = await this.dropRepository.find({
      where: { id: In(uniqueItemIds) },
    });
    const itemMap = new Map(items.map((item) => [item.id, item]));
    uniqueItemIds.forEach((itemId) => {
      const item = itemMap.get(itemId);
      if (!item) {
        throw new Error(`奖励物品不存在: ${itemId}`);
      }
      if (item.disabled) {
        throw new Error(`奖励物品已禁用: ${item.drop_name}`);
      }
    });
  }

  private normalizeActivityKey(value: unknown) {
    const key = String(value || "").trim();
    if (!key) {
      throw new Error("活动批次不能为空");
    }
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(key)) {
      throw new Error(
        "活动批次只能包含字母、数字、下划线和中划线，且不超过64位",
      );
    }
    return key;
  }

  private async assertExchangeItemsAvailable(itemIds: number[], label: string) {
    const uniqueItemIds = [...new Set(itemIds)];
    if (uniqueItemIds.length === 0) {
      return;
    }
    const items = await this.dropRepository.find({
      where: { id: In(uniqueItemIds) },
    });
    const itemMap = new Map(items.map((item) => [item.id, item]));
    uniqueItemIds.forEach((itemId) => {
      const item = itemMap.get(itemId);
      if (!item) {
        throw new Error(`${label}不存在: ${itemId}`);
      }
      if (item.disabled) {
        throw new Error(`${label}已禁用: ${item.drop_name}`);
      }
      if (item.drop_type === 1) {
        throw new Error(`${label}不能选择虚拟星穹币: ${item.drop_name}`);
      }
    });
  }

  private async isDropItemReferenced(itemId: number): Promise<boolean> {
    const [inventoryCount, cards, redeemCodes, exchangeItems, launchConfigs] =
      await Promise.all([
        this.inventoryRepository.count({ where: { item_id: itemId } }),
        this.cardRepository.find({
          where: { drop_item: Like(`%${itemId}%`) },
        }),
        this.redeemCodeRepository.find({
          where: { delete_flag: false },
        }),
        this.exchangeItemRepository.find({
          where: { delete_flag: false },
        }),
        this.launchActivityConfigRepository
          ? this.launchActivityConfigRepository.find()
          : Promise.resolve([] as LaunchActivityConfig[]),
      ]);

    if (inventoryCount > 0) {
      return true;
    }
    if (
      cards.some((card) =>
        this.parseDropItemIds(card.drop_item).includes(itemId),
      )
    ) {
      return true;
    }
    return (
      redeemCodes.some((code) =>
        (code.rewards?.items || []).some(
          (item) => Number(item.itemId) === itemId,
        ),
      ) ||
      exchangeItems.some((item) =>
        [...(item.costs || []), ...(item.rewards?.items || [])].some(
          (entry) => Number(entry.itemId) === itemId,
        ),
      ) ||
      launchConfigs.some((config) =>
        (config.rewards?.items || []).some(
          (item) => Number(item.itemId) === itemId,
        ),
      )
    );
  }

  private parseDropItemIds(dropItem: string): number[] {
    if (!dropItem) {
      return [];
    }
    return dropItem
      .split(";")
      .map((item) => Number(item.split(",")[0]?.trim()))
      .filter((id) => Number.isInteger(id) && id > 0);
  }

  private normalizeTotalLimit(value: unknown): number | null {
    if (value === undefined || value === null || value === "") {
      return null;
    }
    const totalLimit = Number(value);
    if (!Number.isInteger(totalLimit) || totalLimit <= 0) {
      throw new Error("总库存必须为正整数");
    }
    return totalLimit;
  }

  private normalizeNullablePositiveInt(
    value: unknown,
    message: string,
  ): number | null {
    if (value === undefined || value === null || value === "") {
      return null;
    }
    const number = Number(value);
    if (!Number.isInteger(number) || number <= 0) {
      throw new Error(message);
    }
    return number;
  }

  private parseOptionalDate(value: unknown): Date | null {
    if (value === undefined || value === null || value === "") {
      return null;
    }
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) {
      throw new Error("时间格式无效");
    }
    return date;
  }

  private assertRedeemTimeRange(start?: Date | null, end?: Date | null) {
    if (start && end && start.getTime() >= end.getTime()) {
      throw new Error("兑换结束时间必须晚于开始时间");
    }
  }

  private assertExchangeTimeRange(start?: Date | null, end?: Date | null) {
    if (start && end && start.getTime() >= end.getTime()) {
      throw new Error("兑换项结束时间必须晚于开始时间");
    }
  }
}
