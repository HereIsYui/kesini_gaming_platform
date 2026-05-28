import { Injectable, Optional } from "@nestjs/common";
import { mkdir, writeFile } from "fs/promises";
import { extname, resolve } from "path";
import { randomUUID } from "crypto";
import { InjectRepository } from "@nestjs/typeorm";
import {
  Between,
  FindOptionsOrder,
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
import {
  DEFAULT_SITE_CONFIG,
  SiteConfigService,
  SiteConfigView,
} from "src/config/site-config.service";
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
import { PveChallengeRecord } from "src/entity/pveChallengeRecord.entity";
import { PveStage } from "src/entity/pveStage.entity";
import { PoolInfo } from "src/entity/pool.entity";
import { RedeemCode, RedeemRewards } from "src/entity/redeemCode.entity";
import { RedeemCodeUsage } from "src/entity/redeemCodeUsage.entity";
import { RechargeConfig } from "src/entity/rechargeConfig.entity";
import {
  RechargeRecord,
  RechargeRecordStatus,
} from "src/entity/rechargeRecord.entity";
import { SeasonConfig } from "src/entity/seasonConfig.entity";
import { SeasonPointRecord } from "src/entity/seasonPointRecord.entity";
import { SeasonShopItem } from "src/entity/seasonShopItem.entity";
import { SeasonShopUsage } from "src/entity/seasonShopUsage.entity";
import { SystemConfig } from "src/entity/systemConfig.entity";
import { TradeConfig } from "src/entity/tradeConfig.entity";
import { TradeListing } from "src/entity/tradeListing.entity";
import { TradeRecord } from "src/entity/tradeRecord.entity";
import { User } from "src/entity/user.entity";
import { UserGachaPity } from "src/entity/userGachaPity.entity";
import {
  DECOMPOSE_CONFIG_KEY,
  DECOMPOSE_CONFIG_RARITIES,
  DecomposeConfig,
  normalizeDecomposeConfig,
} from "src/card/decompose-config";

export interface PageQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
}

type UploadedCardMediaFile = {
  originalname?: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
};

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
    @InjectRepository(SystemConfig)
    private readonly systemConfigRepository?: Repository<SystemConfig>,
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
    @Optional()
    @InjectRepository(PveStage)
    private readonly pveStageRepository?: Repository<PveStage>,
    @Optional()
    @InjectRepository(PveChallengeRecord)
    private readonly pveRecordRepository?: Repository<PveChallengeRecord>,
    @Optional()
    @InjectRepository(SeasonConfig)
    private readonly seasonRepository?: Repository<SeasonConfig>,
    @Optional()
    @InjectRepository(SeasonShopItem)
    private readonly seasonShopItemRepository?: Repository<SeasonShopItem>,
    @Optional()
    @InjectRepository(SeasonPointRecord)
    private readonly seasonPointRecordRepository?: Repository<SeasonPointRecord>,
    @Optional()
    @InjectRepository(SeasonShopUsage)
    private readonly seasonShopUsageRepository?: Repository<SeasonShopUsage>,
    @Optional()
    private readonly siteConfigService?: SiteConfigService,
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
    const historyUids = Array.from(
      new Set(recentHistories.map((history) => history.uid).filter(Boolean)),
    );
    const historyUsers = historyUids.length
      ? await this.userRepository.find({ where: { uid: In(historyUids) } })
      : [];
    const historyUserMap = new Map(
      historyUsers.map((user) => [user.uid, user]),
    );

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
      recentHistories: recentHistories.map((history) => {
        const user = historyUserMap.get(history.uid);
        return {
          ...history,
          userName: this.getUserDisplayName(user),
        };
      }),
    };
  }

  async getOptions() {
    const [pools, cards, dropItems, seasons] = await Promise.all([
      this.poolRepository.find({
        order: { sort_order: "ASC", id: "ASC" } as any,
      }),
      this.cardRepository.find({ order: { id: "DESC" } as any }),
      this.dropRepository.find({ order: { id: "DESC" } as any }),
      this.seasonRepository
        ? this.seasonRepository.find({
            where: { delete_flag: false },
            order: { id: "DESC" } as any,
          })
        : Promise.resolve([] as SeasonConfig[]),
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
      seasons: seasons.map((season) => ({
        label: `${season.name} · ${season.season_key}`,
        value: season.season_key,
        enabled: season.enabled === true,
      })),
    };
  }

  async saveCardImage(file: UploadedCardMediaFile | undefined) {
    if (!file?.buffer || !file.size) {
      throw new Error("请选择文件");
    }
    const mediaByMime: Record<
      string,
      { extension: string; directory: string; maxSize: number; label: string }
    > = {
      "image/jpeg": {
        extension: ".jpg",
        directory: "card-images",
        maxSize: 2 * 1024 * 1024,
        label: "图片",
      },
      "image/png": {
        extension: ".png",
        directory: "card-images",
        maxSize: 2 * 1024 * 1024,
        label: "图片",
      },
      "image/webp": {
        extension: ".webp",
        directory: "card-images",
        maxSize: 2 * 1024 * 1024,
        label: "图片",
      },
      "video/mp4": {
        extension: ".mp4",
        directory: "card-videos",
        maxSize: 10 * 1024 * 1024,
        label: "视频",
      },
      "video/webm": {
        extension: ".webm",
        directory: "card-videos",
        maxSize: 10 * 1024 * 1024,
        label: "视频",
      },
    };
    const media = mediaByMime[String(file.mimetype || "").toLowerCase()];
    if (!media) {
      throw new Error("仅支持 JPG、PNG、WEBP、MP4、WEBM 文件");
    }
    if (file.size > media.maxSize) {
      throw new Error(`${media.label}不能超过${media.maxSize / 1024 / 1024}MB`);
    }

    const publicRoot = process.env.FILE_ROOT
      ? resolve(process.env.FILE_ROOT)
      : resolve(__dirname, "..", "..", "public");
    const uploadDir = resolve(publicRoot, media.directory);
    await mkdir(uploadDir, { recursive: true });
    const fileName = `${Date.now()}-${randomUUID()}${media.extension}`;
    await writeFile(resolve(uploadDir, fileName), file.buffer);
    return {
      url: `/file/${media.directory}/${fileName}`,
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
      { sort_order: "ASC", id: "ASC" } as any,
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
      sort_order: this.normalizeOptionalIntegerInput(
        body.sort_order,
        "排序无效",
        0,
      ),
    });
    return this.poolRepository.save(pool);
  }

  async updatePool(id: number, body: Partial<PoolInfo>) {
    const pool = await this.mustFind(this.poolRepository, id, "卡池不存在");
    const updates: Partial<PoolInfo> = {};
    if (body.pool_name !== undefined) {
      updates.pool_name = this.normalizeRequiredString(
        body.pool_name,
        "卡池名称不能为空",
      );
    }
    if (body.card_desc !== undefined) {
      updates.card_desc = this.normalizeOptionalString(body.card_desc);
    }
    if (body.card_type !== undefined) {
      updates.card_type = this.normalizeIntegerInput(
        body.card_type,
        "卡池类型无效",
        0,
      );
    }
    if (body.enabled !== undefined && body.enabled !== null) {
      updates.enabled = body.enabled === true;
    }
    if (body.sort_order !== undefined) {
      updates.sort_order = this.normalizeOptionalIntegerInput(
        body.sort_order,
        "排序无效",
        0,
      );
    }
    Object.assign(pool, updates);
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
      card_image: this.normalizeOptionalString(body.card_image),
      card_type: Number(body.card_type || 0),
      pool: Number(body.pool || 1),
    });
    return this.cardRepository.save(card);
  }

  async updateCard(id: number, body: Partial<CardItem>) {
    const card = await this.mustFind(this.cardRepository, id, "卡片不存在");
    const updates: Partial<CardItem> = {};
    if (body.card_name !== undefined) {
      updates.card_name = this.normalizeRequiredString(
        body.card_name,
        "卡片名称不能为空",
      );
    }
    if (body.card_level !== undefined) {
      updates.card_level = this.normalizeCardLevels(body.card_level);
    }
    if (body.drop_item !== undefined) {
      updates.drop_item = this.normalizeOptionalString(body.drop_item);
    }
    if (body.card_desc !== undefined) {
      updates.card_desc = this.normalizeOptionalString(body.card_desc);
    }
    if (body.card_image !== undefined && body.card_image !== null) {
      updates.card_image = this.normalizeOptionalString(body.card_image);
    }
    if (body.card_type !== undefined) {
      updates.card_type = this.normalizeIntegerInput(
        body.card_type,
        "卡片类型无效",
        0,
      );
    }
    if (body.pool !== undefined) {
      updates.pool = this.normalizeIntegerInput(body.pool, "所属卡池无效", 1);
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
      body.disabled === undefined || body.disabled === null
        ? item.disabled === true
        : body.disabled === true;
    const defaultFragment =
      disabled || normalized.drop_type !== 0
        ? false
        : body.default_fragment === undefined || body.default_fragment === null
          ? item.default_fragment === true
          : body.default_fragment === true;
    await this.prepareDefaultFragment(
      { ...normalized, disabled },
      defaultFragment,
      id,
    );
    Object.assign(item, normalized, {
      disabled,
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
    const updates: Partial<User> = {};
    if (body.name !== undefined) {
      updates.name = this.normalizeOptionalString(body.name);
    }
    if (body.nickname !== undefined) {
      updates.nickname = this.normalizeOptionalString(body.nickname);
    }
    if (body.avatar !== undefined) {
      updates.avatar = this.normalizeOptionalString(body.avatar);
    }
    if (body.point !== undefined) {
      updates.point = this.normalizeIntegerInput(
        body.point,
        "星穹币必须为非负整数",
        0,
      );
    }
    if (body.is_admin !== undefined && body.is_admin !== null) {
      updates.is_admin = body.is_admin === true;
    }
    Object.assign(user, updates);
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
      return this.attachUserDisplayToUidRows(result);
    }

    const rarity = query.rarity.trim().toUpperCase();
    return this.attachUserDisplayToUidRows({
      ...result,
      list: result.list.filter((history) =>
        history.card_levels
          .split(",")
          .map((level) => level.trim().toUpperCase())
          .includes(rarity),
      ),
    });
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
    if (body.num !== undefined) {
      inventory.num = this.normalizeIntegerInput(
        body.num,
        "物品数量必须为非负整数",
        0,
      );
    }
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
    const result = await this.findAndPage(
      this.pityRepository,
      where,
      page,
      pageSize,
    );
    const pityRows = result.list as UserGachaPity[];
    const poolIds = [
      ...new Set(
        pityRows
          .map((pity) => Number(pity.pool_id))
          .filter((poolId) => Number.isInteger(poolId) && poolId > 0),
      ),
    ];
    const uids = [...new Set(pityRows.map((pity) => pity.uid).filter(Boolean))];
    const [pools, users, configs] = await Promise.all([
      poolIds.length
        ? this.poolRepository.find({ where: { id: In(poolIds) } })
        : Promise.resolve([] as PoolInfo[]),
      uids.length
        ? this.userRepository.find({ where: { uid: In(uids) } })
        : Promise.resolve([] as User[]),
      poolIds.length
        ? this.gachaConfigService.getPoolConfigsByPoolIds(poolIds)
        : Promise.resolve({} as Record<number, GachaConfigView>),
    ]);
    const poolMap = new Map(pools.map((pool) => [pool.id, pool]));
    const userMap = new Map(users.map((user) => [user.uid, user]));
    return {
      ...result,
      list: pityRows.map((pity) =>
        this.toPityView(
          pity,
          poolMap.get(pity.pool_id),
          userMap.get(pity.uid),
          configs[pity.pool_id],
        ),
      ),
    };
  }

  async updatePity(id: number, body: Partial<UserGachaPity>) {
    const pity = await this.mustFind(this.pityRepository, id, "保底记录不存在");
    if (body.draws_since_sr !== undefined) {
      pity.draws_since_sr = this.normalizeIntegerInput(
        body.draws_since_sr,
        "保底计数必须为非负整数",
        0,
      );
    }
    if (body.draws_since_ssr !== undefined) {
      pity.draws_since_ssr = this.normalizeIntegerInput(
        body.draws_since_ssr,
        "保底计数必须为非负整数",
        0,
      );
    }
    if (body.draws_since_ur !== undefined) {
      pity.draws_since_ur = this.normalizeIntegerInput(
        body.draws_since_ur,
        "保底计数必须为非负整数",
        0,
      );
    }
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

  async getSiteConfig() {
    if (!this.siteConfigService) {
      return DEFAULT_SITE_CONFIG;
    }
    return this.siteConfigService.getSiteConfig();
  }

  async updateSiteConfig(body: Partial<SiteConfigView>) {
    if (!this.siteConfigService) {
      throw new Error("站点配置服务未初始化");
    }
    return this.siteConfigService.updateSiteConfig(body);
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

    const next = code;
    if (body.name !== undefined) {
      next.name = this.normalizeRequiredString(body.name, "兑换码名称不能为空");
    }
    if (body.description !== undefined) {
      next.description = this.normalizeOptionalString(body.description);
    }
    if (body.enabled !== undefined && body.enabled !== null) {
      next.enabled = body.enabled === true;
    }
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
    return this.attachUserDisplayToUidRows(
      await this.findAndPage(this.redeemUsageRepository, where, page, pageSize),
    );
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
      enabled:
        body.enabled === undefined || body.enabled === null
          ? item.enabled
          : body.enabled,
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
    return this.attachUserDisplayToUidRows(
      await this.findAndPage(
        this.exchangeUsageRepository,
        where,
        page,
        pageSize,
      ),
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
        body.enabled === undefined || body.enabled === null
          ? config.enabled
          : body.enabled === true,
      fee_rate:
        body.fee_rate === undefined
          ? config.fee_rate
          : this.normalizeNumberInput(
              body.fee_rate,
              "交易手续费率必须在0-1之间",
            ),
      min_price:
        body.min_price === undefined
          ? config.min_price
          : this.normalizeIntegerInput(
              body.min_price,
              "最低交易价格必须为正整数",
              1,
            ),
      max_price:
        body.max_price === undefined
          ? config.max_price
          : this.normalizeIntegerInput(
              body.max_price,
              "最高交易价格必须大于等于最低价格且不超过999999",
              1,
            ),
    });
    this.assertTradeConfig(config);
    return repository.save(config);
  }

  async getDecomposeConfig() {
    return this.decorateDecomposeConfig(await this.readDecomposeConfig());
  }

  async updateDecomposeConfig(body: unknown) {
    const repository = this.mustSystemConfigRepository();
    const config = normalizeDecomposeConfig(body);
    await this.assertDecomposeConfig(config);
    let row = await repository.findOne({
      where: { key: DECOMPOSE_CONFIG_KEY },
    });
    if (!row) {
      row = repository.create({
        key: DECOMPOSE_CONFIG_KEY,
        description: "卡片分解默认产出配置",
      });
    }
    row.value = JSON.stringify(config);
    row.description = "卡片分解默认产出配置";
    await repository.save(row);
    return this.decorateDecomposeConfig(config);
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
        body.enabled === undefined || body.enabled === null
          ? config.enabled
          : body.enabled === true,
      min_amount:
        body.min_amount === undefined
          ? config.min_amount
          : this.normalizeIntegerInput(
              body.min_amount,
              "最低充值金额必须为正整数",
              1,
            ),
      max_amount:
        body.max_amount === undefined
          ? config.max_amount
          : this.normalizeIntegerInput(
              body.max_amount,
              "最高充值金额必须大于等于最低充值金额",
              1,
            ),
      recharge_ratio:
        body.recharge_ratio === undefined
          ? config.recharge_ratio
          : this.normalizeNumberInput(
              body.recharge_ratio,
              "充值比例必须大于0且不超过100",
            ),
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
    const decorated = await this.attachUserDisplayToUidRows({
      list: list.map((record) => this.decorateRechargeRecord(record)),
      total,
      page,
      pageSize,
    });
    return decorated;
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
        body.enabled === undefined || body.enabled === null
          ? config.enabled
          : body.enabled === true,
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
    return this.attachUserDisplayToUidRows(
      await this.findAndPage(
        this.mustLaunchActivityClaimRepository(),
        where,
        page,
        pageSize,
      ),
    );
  }

  async listPveStages(query: PageQuery) {
    const { page, pageSize } = this.normalizePage(query);
    const where = query.keyword
      ? [
          { name: Like(`%${query.keyword}%`), delete_flag: false },
          { description: Like(`%${query.keyword}%`), delete_flag: false },
        ]
      : { delete_flag: false };
    return this.findAndPage(
      this.mustPveStageRepository(),
      where,
      page,
      pageSize,
      { sort_order: "ASC", id: "ASC" } as any,
    );
  }

  async getPveStage(id: number) {
    const stage = await this.mustFind(
      this.mustPveStageRepository(),
      id,
      "PVE关卡不存在",
    );
    if (stage.delete_flag) {
      throw new Error("PVE关卡不存在");
    }
    return stage;
  }

  async createPveStage(body: Partial<PveStage>) {
    const normalized = await this.normalizePveStageInput(body, true);
    const entity = this.mustPveStageRepository().create({
      ...normalized,
      delete_flag: false,
    });
    this.assertPveStageTimeRange(entity.starts_at, entity.ends_at);
    return this.mustPveStageRepository().save(entity);
  }

  async updatePveStage(id: number, body: Partial<PveStage>) {
    const stage = await this.getPveStage(id);
    const normalized = await this.normalizePveStageInput(
      {
        ...stage,
        ...body,
        enabled:
          body.enabled === undefined || body.enabled === null
            ? stage.enabled
            : body.enabled,
      },
      false,
    );
    Object.assign(stage, normalized);
    this.assertPveStageTimeRange(stage.starts_at, stage.ends_at);
    return this.mustPveStageRepository().save(stage);
  }

  async deletePveStage(id: number) {
    const stage = await this.getPveStage(id);
    stage.enabled = false;
    stage.delete_flag = true;
    await this.mustPveStageRepository().save(stage);
    return { deleted: true };
  }

  async listPveRecords(query: PageQuery & { uid?: string; stageId?: number }) {
    const { page, pageSize } = this.normalizePage(query);
    const where: FindOptionsWhere<PveChallengeRecord> = {};
    if (query.uid) {
      where.uid = Like(`%${query.uid}%`);
    }
    if (query.stageId !== undefined) {
      where.stage_id = query.stageId;
    }
    return this.attachUserDisplayToUidRows(
      await this.findAndPage(
        this.mustPveRecordRepository(),
        where,
        page,
        pageSize,
      ),
    );
  }

  async listSeasons(query: PageQuery) {
    const { page, pageSize } = this.normalizePage(query);
    const where = query.keyword
      ? [
          { season_key: Like(`%${query.keyword}%`), delete_flag: false },
          { name: Like(`%${query.keyword}%`), delete_flag: false },
        ]
      : { delete_flag: false };
    return this.findAndPage(
      this.mustSeasonRepository(),
      where,
      page,
      pageSize,
      { id: "DESC" } as any,
    );
  }

  async getSeason(id: number) {
    const season = await this.mustFind(
      this.mustSeasonRepository(),
      id,
      "赛季不存在",
    );
    if (season.delete_flag) {
      throw new Error("赛季不存在");
    }
    return season;
  }

  async createSeason(body: Partial<SeasonConfig>) {
    const normalized = this.normalizeSeasonInput(body, true);
    const existing = await this.mustSeasonRepository().findOne({
      where: { season_key: normalized.season_key },
    });
    if (existing && existing.delete_flag !== true) {
      throw new Error("赛季编码已存在");
    }
    if (existing && existing.delete_flag === true) {
      Object.assign(existing, normalized, { delete_flag: false });
      this.assertSeasonTimeRange(existing.starts_at, existing.ends_at);
      return this.mustSeasonRepository().save(existing);
    }
    const season = this.mustSeasonRepository().create({
      ...normalized,
      delete_flag: false,
    });
    this.assertSeasonTimeRange(season.starts_at, season.ends_at);
    return this.mustSeasonRepository().save(season);
  }

  async updateSeason(id: number, body: Partial<SeasonConfig>) {
    const season = await this.getSeason(id);
    const normalized = this.normalizeSeasonInput(
      {
        ...season,
        ...body,
        enabled:
          body.enabled === undefined || body.enabled === null
            ? season.enabled
            : body.enabled,
        shop_enabled:
          body.shop_enabled === undefined || body.shop_enabled === null
            ? season.shop_enabled
            : body.shop_enabled,
        leaderboard_enabled:
          body.leaderboard_enabled === undefined ||
          body.leaderboard_enabled === null
            ? season.leaderboard_enabled
            : body.leaderboard_enabled,
      },
      false,
    );
    if (normalized.season_key !== season.season_key) {
      const existing = await this.mustSeasonRepository().findOne({
        where: { season_key: normalized.season_key },
      });
      if (existing && existing.id !== id && existing.delete_flag !== true) {
        throw new Error("赛季编码已存在");
      }
    }
    Object.assign(season, normalized);
    this.assertSeasonTimeRange(season.starts_at, season.ends_at);
    return this.mustSeasonRepository().save(season);
  }

  async deleteSeason(id: number) {
    const season = await this.getSeason(id);
    season.enabled = false;
    season.shop_enabled = false;
    season.leaderboard_enabled = false;
    season.delete_flag = true;
    await this.mustSeasonRepository().save(season);
    return { deleted: true };
  }

  async listSeasonShopItems(query: PageQuery & { seasonKey?: string }) {
    const { page, pageSize } = this.normalizePage(query);
    const where: FindOptionsWhere<SeasonShopItem> = { delete_flag: false };
    if (query.seasonKey) {
      where.season_key = query.seasonKey;
    }
    if (query.keyword) {
      const keyword = `%${query.keyword}%`;
      const base = { delete_flag: false };
      const filters = [
        { ...base, name: Like(keyword) },
        { ...base, season_key: Like(keyword) },
      ] as FindOptionsWhere<SeasonShopItem>[];
      return this.findAndPage(
        this.mustSeasonShopItemRepository(),
        filters,
        page,
        pageSize,
        { sort_order: "ASC", id: "DESC" } as any,
      );
    }
    return this.findAndPage(
      this.mustSeasonShopItemRepository(),
      where,
      page,
      pageSize,
      { sort_order: "ASC", id: "DESC" } as any,
    );
  }

  async getSeasonShopItem(id: number) {
    const item = await this.mustFind(
      this.mustSeasonShopItemRepository(),
      id,
      "赛季商店兑换项不存在",
    );
    if (item.delete_flag) {
      throw new Error("赛季商店兑换项不存在");
    }
    return item;
  }

  async createSeasonShopItem(body: Partial<SeasonShopItem>) {
    const normalized = await this.normalizeSeasonShopItemInput(body, true);
    const entity = this.mustSeasonShopItemRepository().create({
      ...normalized,
      used_count: 0,
      delete_flag: false,
    });
    this.assertSeasonShopTimeRange(entity.starts_at, entity.ends_at);
    return this.mustSeasonShopItemRepository().save(entity);
  }

  async updateSeasonShopItem(id: number, body: Partial<SeasonShopItem>) {
    const item = await this.getSeasonShopItem(id);
    const normalized = await this.normalizeSeasonShopItemInput(
      {
        ...item,
        ...body,
        enabled:
          body.enabled === undefined || body.enabled === null
            ? item.enabled
            : body.enabled,
      },
      false,
    );
    if (
      normalized.total_limit !== null &&
      normalized.total_limit !== undefined &&
      item.used_count > normalized.total_limit
    ) {
      throw new Error("总库存不能小于已兑换数量");
    }
    Object.assign(item, normalized);
    this.assertSeasonShopTimeRange(item.starts_at, item.ends_at);
    return this.mustSeasonShopItemRepository().save(item);
  }

  async deleteSeasonShopItem(id: number) {
    const item = await this.getSeasonShopItem(id);
    item.enabled = false;
    item.delete_flag = true;
    await this.mustSeasonShopItemRepository().save(item);
    return { deleted: true };
  }

  async listSeasonPointRecords(
    query: PageQuery & { uid?: string; seasonKey?: string },
  ) {
    const { page, pageSize } = this.normalizePage(query);
    const where: FindOptionsWhere<SeasonPointRecord> = {};
    if (query.uid) {
      where.uid = Like(`%${query.uid}%`);
    }
    if (query.seasonKey) {
      where.season_key = query.seasonKey;
    }
    return this.attachUserDisplayToUidRows(
      await this.findAndPage(
        this.mustSeasonPointRecordRepository(),
        where,
        page,
        pageSize,
      ),
    );
  }

  async listSeasonShopUsages(
    query: PageQuery & { uid?: string; itemId?: number },
  ) {
    const { page, pageSize } = this.normalizePage(query);
    const where: FindOptionsWhere<SeasonShopUsage> = {};
    if (query.uid) {
      where.uid = Like(`%${query.uid}%`);
    }
    if (query.itemId !== undefined) {
      where.shop_item_id = query.itemId;
    }
    return this.attachUserDisplayToUidRows(
      await this.findAndPage(
        this.mustSeasonShopUsageRepository(),
        where,
        page,
        pageSize,
      ),
    );
  }

  private getUserDisplayName(user?: User | null) {
    return String(user?.nickname || user?.name || user?.uid || "");
  }

  private async getUserDisplayMapByUids(
    values: Array<string | null | undefined>,
  ) {
    const uids = [
      ...new Set(values.map((uid) => String(uid || "").trim()).filter(Boolean)),
    ];
    if (uids.length === 0) {
      return new Map<string, string>();
    }
    const users = await this.userRepository.find({ where: { uid: In(uids) } });
    return new Map(
      users.map((user) => [user.uid, this.getUserDisplayName(user)]),
    );
  }

  private async attachUserDisplayToUidRows<
    T extends { uid?: string | null },
  >(result: { list: T[]; total: number; page: number; pageSize: number }) {
    const displayMap = await this.getUserDisplayMapByUids(
      result.list.map((item) => item.uid),
    );
    return {
      ...result,
      list: result.list.map((item) => ({
        ...item,
        userName: displayMap.get(String(item.uid || "")) || "",
      })),
    };
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

    const userMap = new Map(users.map((user) => [user.id, user]));
    return {
      ...result,
      list: result.list.map((inventory) => {
        const user = userMap.get(inventory.user_id) || null;
        return {
          ...inventory,
          user,
          userName: this.getUserDisplayName(user),
          item:
            this.decorateNullableDropItem(
              items.find((item) => item.id === inventory.item_id) || null,
            ) || null,
        };
      }),
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
    const userDisplayMap = await this.getUserDisplayMapByUids(
      list.flatMap((item) => [item.seller_uid, item.buyer_uid]),
    );
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
        sellerName: userDisplayMap.get(String(listing.seller_uid || "")) || "",
        buyerName: userDisplayMap.get(String(listing.buyer_uid || "")) || "",
        feeAmount,
        sellerIncome: Number(listing.price || 0) - feeAmount,
      };
    });
  }

  private async attachTradeRecordInfo(list: TradeRecord[]) {
    const userDisplayMap = await this.getUserDisplayMapByUids(
      list.flatMap((record) => [record.seller_uid, record.buyer_uid]),
    );
    return list.map((record) => ({
      ...record,
      cardName: record.card_snapshot?.cardName || `卡片#${record.card_id}`,
      cardDesc: record.card_snapshot?.cardDesc || "",
      cardType: record.card_snapshot?.cardType || 0,
      poolId: record.card_snapshot?.poolId || null,
      poolName: record.card_snapshot?.poolName || "",
      sellerName: userDisplayMap.get(String(record.seller_uid || "")) || "",
      buyerName: userDisplayMap.get(String(record.buyer_uid || "")) || "",
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

  private async readDecomposeConfig(): Promise<DecomposeConfig> {
    const row = await this.mustSystemConfigRepository().findOne({
      where: { key: DECOMPOSE_CONFIG_KEY },
    });
    if (!row?.value) {
      return normalizeDecomposeConfig(null);
    }
    try {
      return normalizeDecomposeConfig(JSON.parse(row.value));
    } catch {
      return normalizeDecomposeConfig(null);
    }
  }

  private async decorateDecomposeConfig(config: DecomposeConfig) {
    const itemIds = DECOMPOSE_CONFIG_RARITIES.flatMap((rarity) =>
      config.rules[rarity].drops.map((drop) => drop.itemId),
    ).filter((itemId) => itemId > 0);
    const items =
      itemIds.length > 0
        ? await this.dropRepository.find({ where: { id: In(itemIds) } })
        : [];
    const itemMap = new Map(items.map((item) => [item.id, item]));

    return {
      rules: DECOMPOSE_CONFIG_RARITIES.reduce(
        (result, rarity) => {
          const rule = config.rules[rarity];
          const drops = rule.drops.map((drop) => {
            const item = itemMap.get(drop.itemId);
            return {
              ...drop,
              itemName: item?.drop_name || "",
            };
          });
          const firstDrop = drops[0];
          result[rarity] = {
            ...rule,
            drops,
            itemId: firstDrop?.itemId || 0,
            min: firstDrop?.min || 1,
            max: firstDrop?.max || 1,
            itemName: firstDrop?.itemName || "",
          };
          return result;
        },
        {} as Record<string, unknown>,
      ),
    };
  }

  private async assertDecomposeConfig(config: DecomposeConfig) {
    const itemIds = [
      ...new Set(
        DECOMPOSE_CONFIG_RARITIES.flatMap((rarity) =>
          config.rules[rarity].drops.map((drop) => drop.itemId),
        ).filter((itemId) => itemId > 0),
      ),
    ];
    const items =
      itemIds.length > 0
        ? await this.dropRepository.find({ where: { id: In(itemIds) } })
        : [];
    const itemMap = new Map(items.map((item) => [item.id, item]));

    DECOMPOSE_CONFIG_RARITIES.forEach((rarity) => {
      const rule = config.rules[rarity];
      if (rule.drops.length === 0) {
        throw new Error(`${rarity} 分解产出不能为空`);
      }
      rule.drops.forEach((drop, index) => {
        const label = `${rarity} 分解第${index + 1}项`;
        if (!Number.isInteger(drop.min) || drop.min < 1) {
          throw new Error(`${label}最小数量必须为正整数`);
        }
        if (!Number.isInteger(drop.max) || drop.max < drop.min) {
          throw new Error(`${label}最大数量必须大于等于最小数量`);
        }
        if (drop.itemId > 0) {
          const item = itemMap.get(drop.itemId);
          if (!item) {
            throw new Error(`${label}碎片不存在`);
          }
          if (item.drop_type !== 0) {
            throw new Error(`${label}产出只能选择卡片碎片`);
          }
          if (item.disabled === true) {
            throw new Error(`${label}碎片已禁用`);
          }
        }
      });
    });
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

  private mustSystemConfigRepository() {
    if (!this.systemConfigRepository) {
      throw new Error("系统配置仓库未初始化");
    }
    return this.systemConfigRepository;
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

  private mustPveStageRepository() {
    if (!this.pveStageRepository) {
      throw new Error("PVE关卡仓库未初始化");
    }
    return this.pveStageRepository;
  }

  private mustPveRecordRepository() {
    if (!this.pveRecordRepository) {
      throw new Error("PVE挑战记录仓库未初始化");
    }
    return this.pveRecordRepository;
  }

  private mustSeasonRepository() {
    if (!this.seasonRepository) {
      throw new Error("赛季配置仓库未初始化");
    }
    return this.seasonRepository;
  }

  private mustSeasonShopItemRepository() {
    if (!this.seasonShopItemRepository) {
      throw new Error("赛季商店仓库未初始化");
    }
    return this.seasonShopItemRepository;
  }

  private mustSeasonPointRecordRepository() {
    if (!this.seasonPointRecordRepository) {
      throw new Error("赛季积分记录仓库未初始化");
    }
    return this.seasonPointRecordRepository;
  }

  private mustSeasonShopUsageRepository() {
    if (!this.seasonShopUsageRepository) {
      throw new Error("赛季商店兑换记录仓库未初始化");
    }
    return this.seasonShopUsageRepository;
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

  private toPityView(
    pity: UserGachaPity,
    pool: PoolInfo | undefined,
    user: User | undefined,
    config: GachaConfigView | undefined,
  ) {
    return {
      ...pity,
      userName: this.getUserDisplayName(user),
      poolName: pool?.pool_name || `卡池 #${pity.pool_id}`,
      gacha_config_mode: this.getGachaConfigMode(config),
      pitySystem: config?.pitySystem || null,
      pity_overview: this.getPityOverviewText(pity, config?.pitySystem),
    };
  }

  private getPityOverviewText(
    pity: UserGachaPity,
    pitySystem: GachaConfigView["pitySystem"] | undefined,
  ) {
    if (!pitySystem) {
      return "未读取到保底配置";
    }
    if (pitySystem.enabled === false) {
      return "当前卡池未开启保底";
    }
    const rules = [
      { label: "硬保底", rule: pitySystem.hardPity },
      { label: "软保底", rule: pitySystem.softPity },
    ].filter((item) => item.rule?.count && item.rule?.guaranteedRarity);
    if (rules.length === 0) {
      return "当前卡池未配置具体保底规则";
    }
    return rules
      .map(({ label, rule }) => {
        const current = this.getPityCounterByRarity(
          pity,
          rule!.guaranteedRarity,
        );
        const remaining = Math.max(0, Number(rule!.count) - current);
        const state =
          remaining <= 0
            ? "已满足"
            : remaining === 1
              ? "下抽触发"
              : `还差 ${remaining} 抽`;
        return `${label}${rule!.guaranteedRarity}: 已垫 ${current}/${rule!.count}，${state}`;
      })
      .join("；");
  }

  private getPityCounterByRarity(pity: UserGachaPity, rarity: string) {
    const rank = CARD_RARITIES.indexOf(rarity);
    if (rank >= CARD_RARITIES.indexOf("UR")) {
      return Number(pity.draws_since_ur || 0);
    }
    if (rank >= CARD_RARITIES.indexOf("SSR")) {
      return Number(pity.draws_since_ssr || 0);
    }
    return Number(pity.draws_since_sr || 0);
  }

  private async findAndPage<T extends ObjectLiteral>(
    repository: Repository<T>,
    where: any,
    page: number,
    pageSize: number,
    order: FindOptionsOrder<T> = { id: "DESC" } as any,
  ) {
    const [list, total] = await repository.findAndCount({
      where,
      order,
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

  private normalizeRequiredString(value: unknown, message: string) {
    const text = this.normalizeOptionalString(value);
    if (!text) {
      throw new Error(message);
    }
    return text;
  }

  private normalizeOptionalString(value: unknown) {
    return String(value ?? "").trim();
  }

  private normalizeOptionalIntegerInput(
    value: unknown,
    message: string,
    min = 0,
  ) {
    if (value === undefined || value === null || value === "") {
      return min;
    }
    return this.normalizeIntegerInput(value, message, min);
  }

  private normalizeIntegerInput(value: unknown, message: string, min = 0) {
    if (value === undefined || value === null || value === "") {
      throw new Error(message);
    }
    const number = Number(value);
    if (!Number.isInteger(number) || number < min) {
      throw new Error(message);
    }
    return number;
  }

  private normalizeNumberInput(value: unknown, message: string) {
    if (value === undefined || value === null || value === "") {
      throw new Error(message);
    }
    const number = Number(value);
    if (!Number.isFinite(number)) {
      throw new Error(message);
    }
    return number;
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
    const cards = Array.isArray(value.cards) ? value.cards : [];
    const normalizedCards = cards
      .map((card) => ({
        cardId: Number(card.cardId),
        rarity: String(card.rarity || "")
          .trim()
          .toUpperCase(),
        num: Number(card.num),
      }))
      .filter((card) => card.cardId > 0 || card.num > 0 || card.rarity);
    normalizedCards.forEach((card) => {
      if (!Number.isInteger(card.cardId) || card.cardId <= 0) {
        throw new Error("奖励卡片ID无效");
      }
      if (!CARD_RARITIES.includes(card.rarity)) {
        throw new Error("奖励卡片稀有度无效");
      }
      if (!Number.isInteger(card.num) || card.num <= 0) {
        throw new Error("奖励卡片数量无效");
      }
    });
    if (
      points === 0 &&
      normalizedItems.length === 0 &&
      normalizedCards.length === 0
    ) {
      throw new Error(emptyMessage);
    }
    await this.assertRewardItemsAvailable(
      normalizedItems.map((item) => item.itemId),
    );
    await this.assertRewardCardsAvailable(normalizedCards);
    return {
      points,
      items: normalizedItems,
      ...(normalizedCards.length > 0 ? { cards: normalizedCards } : {}),
    };
  }

  private async normalizePveStageInput(
    body: Partial<PveStage>,
    creating: boolean,
  ) {
    const name = this.normalizeOptionalString(body.name);
    if (!name) {
      throw new Error("关卡名称不能为空");
    }
    const enemyPower = this.normalizeIntegerInput(
      body.enemy_power ?? 100,
      "敌方战力必须为非负整数",
      0,
    );
    const recommendedPower = this.normalizeIntegerInput(
      body.recommended_power ?? enemyPower,
      "推荐战力必须为非负整数",
      0,
    );
    const dailyLimit = this.normalizeIntegerInput(
      body.daily_limit ?? 3,
      "每日挑战次数必须为非负整数",
      0,
    );
    const sortOrder = this.normalizeIntegerInput(
      body.sort_order ?? 0,
      "排序值必须为非负整数",
      0,
    );
    const rewards = await this.normalizeRewards(
      body.rewards,
      "关卡奖励不能为空",
    );
    return {
      name,
      description: this.normalizeOptionalString(body.description),
      enemy_power: enemyPower,
      recommended_power: recommendedPower,
      daily_limit: dailyLimit,
      rewards,
      enabled:
        body.enabled === undefined || body.enabled === null
          ? creating
          : body.enabled === true,
      sort_order: sortOrder,
      starts_at: this.parseOptionalDate(body.starts_at),
      ends_at: this.parseOptionalDate(body.ends_at),
    };
  }

  private normalizeSeasonInput(body: Partial<SeasonConfig>, creating: boolean) {
    const seasonKey = this.normalizeSeasonKey(body.season_key);
    const name = this.normalizeRequiredString(body.name, "赛季名称不能为空");
    return {
      season_key: seasonKey,
      name,
      description: this.normalizeOptionalString(body.description),
      enabled:
        body.enabled === undefined || body.enabled === null
          ? creating
          : body.enabled === true,
      shop_enabled:
        body.shop_enabled === undefined || body.shop_enabled === null
          ? true
          : body.shop_enabled === true,
      leaderboard_enabled:
        body.leaderboard_enabled === undefined ||
        body.leaderboard_enabled === null
          ? true
          : body.leaderboard_enabled === true,
      starts_at: this.parseOptionalDate(body.starts_at),
      ends_at: this.parseOptionalDate(body.ends_at),
    };
  }

  private async normalizeSeasonShopItemInput(
    body: Partial<SeasonShopItem>,
    creating: boolean,
  ) {
    const seasonKey = this.normalizeSeasonKey(body.season_key);
    const season = await this.mustSeasonRepository().findOne({
      where: { season_key: seasonKey, delete_flag: false },
    });
    if (!season) {
      throw new Error("所属赛季不存在");
    }
    const name = this.normalizeRequiredString(body.name, "兑换项名称不能为空");
    const costPoints = this.normalizeIntegerInput(
      body.cost_points ?? 1,
      "赛季积分价格必须为正整数",
      1,
    );
    const sortOrder = this.normalizeIntegerInput(
      body.sort_order ?? 0,
      "排序值必须为非负整数",
      0,
    );
    const rewards = await this.normalizeRewards(
      body.rewards,
      "赛季商店奖励不能为空",
    );
    return {
      season_key: seasonKey,
      name,
      description: this.normalizeOptionalString(body.description),
      enabled:
        body.enabled === undefined || body.enabled === null
          ? creating
          : body.enabled === true,
      cost_points: costPoints,
      rewards,
      total_limit: this.normalizeTotalLimit(body.total_limit),
      user_limit: this.normalizeNullablePositiveInt(
        body.user_limit,
        "单用户限兑必须为正整数",
      ),
      starts_at: this.parseOptionalDate(body.starts_at),
      ends_at: this.parseOptionalDate(body.ends_at),
      sort_order: sortOrder,
    };
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

  private async assertRewardCardsAvailable(
    cards: Array<{ cardId: number; rarity: string }>,
  ) {
    const uniqueCardIds = [
      ...new Set(cards.map((card) => Number(card.cardId))),
    ].filter((cardId) => Number.isInteger(cardId) && cardId > 0);
    if (uniqueCardIds.length === 0) {
      return;
    }
    const cardItems = await this.cardRepository.find({
      where: { id: In(uniqueCardIds) },
    });
    const cardMap = new Map(cardItems.map((card) => [card.id, card]));
    cards.forEach((rewardCard) => {
      const card = cardMap.get(Number(rewardCard.cardId));
      if (!card) {
        throw new Error(`奖励卡片不存在: ${rewardCard.cardId}`);
      }
      const rarities = String(card.card_level || "")
        .split(",")
        .map((rarity) => rarity.trim().toUpperCase())
        .filter(Boolean);
      if (!rarities.includes(rewardCard.rarity)) {
        throw new Error(`奖励卡片稀有度无效: ${card.card_name}`);
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

  private normalizeSeasonKey(value: unknown) {
    const key = String(value || "").trim();
    if (!key) {
      throw new Error("赛季编码不能为空");
    }
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(key)) {
      throw new Error(
        "赛季编码只能包含字母、数字、下划线和中划线，且不超过64位",
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
    const [
      inventoryCount,
      cards,
      redeemCodes,
      exchangeItems,
      launchConfigs,
      pveStages,
      seasonShopItems,
    ] = await Promise.all([
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
      this.pveStageRepository
        ? this.pveStageRepository.find({ where: { delete_flag: false } })
        : Promise.resolve([] as PveStage[]),
      this.seasonShopItemRepository
        ? this.seasonShopItemRepository.find({ where: { delete_flag: false } })
        : Promise.resolve([] as SeasonShopItem[]),
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
      ) ||
      pveStages.some((stage) =>
        (stage.rewards?.items || []).some(
          (item) => Number(item.itemId) === itemId,
        ),
      ) ||
      seasonShopItems.some((item) =>
        (item.rewards?.items || []).some(
          (entry) => Number(entry.itemId) === itemId,
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

  private assertPveStageTimeRange(start?: Date | null, end?: Date | null) {
    if (start && end && start.getTime() >= end.getTime()) {
      throw new Error("关卡结束时间必须晚于开始时间");
    }
  }

  private assertSeasonTimeRange(start?: Date | null, end?: Date | null) {
    if (start && end && start.getTime() >= end.getTime()) {
      throw new Error("赛季结束时间必须晚于开始时间");
    }
  }

  private assertSeasonShopTimeRange(start?: Date | null, end?: Date | null) {
    if (start && end && start.getTime() >= end.getTime()) {
      throw new Error("赛季商店兑换项结束时间必须晚于开始时间");
    }
  }
}
