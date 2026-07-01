import { randomInt } from "crypto";
import { Injectable, Optional } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  DataSource,
  EntityManager,
  In,
  IsNull,
  MoreThanOrEqual,
  Repository,
} from "typeorm";
import { v4 as uuidv4 } from "uuid";
import { CardItem } from "src/entity/card.entity";
import { PoolInfo } from "src/entity/pool.entity";
import { User } from "src/entity/user.entity";
import { UserCard } from "src/entity/userCard.entity";
import { UserHistory } from "src/entity/history.entity";
import { DropItem } from "src/entity/drop.entity";
import { UserInventory } from "src/entity/inventory.entity";
import { UserGachaPity } from "src/entity/userGachaPity.entity";
import { TradeListing } from "src/entity/tradeListing.entity";
import { SystemConfig } from "src/entity/systemConfig.entity";
import { RechargeRecord } from "src/entity/rechargeRecord.entity";
import { PveChallengeRecord } from "src/entity/pveChallengeRecord.entity";
import { UserFormationSlot } from "src/entity/userFormationSlot.entity";
import { UserShowcaseCard } from "src/entity/userShowcaseCard.entity";
import {
  CardRarity,
  DrawCosts,
  GachaConfig,
  GachaResult,
  LeaderboardBoard,
  LeaderboardEntry,
  LeaderboardResponse,
  PitySystemConfig,
} from "src/types/api";
import { PointLedgerService } from "src/point-ledger/point-ledger.service";
import { AchievementService } from "src/achievement/achievement.service";
import { SocialActivityService } from "src/social/social-activity.service";
import {
  assignUserPublicId,
  ensureUserPublicId,
  ensureUsersPublicIds,
  getUserPublicId,
} from "src/utils/user-public-id";
import { GachaConfigService } from "./gacha-config.service";
import { RedisUtil } from "src/utils/redis";
import {
  DECOMPOSE_CONFIG_KEY,
  isDecomposeConfigRarity,
  normalizeDecomposeConfig,
} from "./decompose-config";
import {
  calculateCardPower,
  calculateCardPowerWithPotential,
  getCardStarLevel,
  getCardStarMaxLevel,
  getCultivationExp,
  getCultivationLevel,
  getCultivationMaxLevel,
  getCultivationUpgradeCost,
  getPotentialGrade,
  getPotentialRange,
  normalizeBattleRole,
  resolveUserCardPotential,
} from "./cultivation";

const RARITY_ORDER: CardRarity[] = ["N", "R", "SR", "SSR", "UR"];
const ALLOWED_DRAW_COUNTS = [1, 10];
const DEFAULT_DRAW_POOL_ID = 1;
const NEW_CARD_WINDOW_MS = 48 * 60 * 60 * 1000;

type RarityCounts = Record<CardRarity, number>;
type CardPoolByRarity = Record<CardRarity, CardItem[]>;
type DecomposeFragmentSummary = {
  itemId: number;
  itemName: string;
  count: number;
};
type DecomposeFragmentDrop = {
  rarity: CardRarity;
  fragmentItem: DropItem;
  fragmentCount: number;
};
type DecomposeCandidate = {
  userCard: UserCard;
  card: CardItem;
  rarity: CardRarity;
};
type DecomposeCandidateGroup = {
  candidates: DecomposeCandidate[];
  totalOwned: number;
};
type UserCardGroup = {
  cardId: number;
  cardName: string;
  cardDesc: string;
  cardImage: string;
  cardLevel: CardRarity;
  cardType: number;
  poolId: number;
  count: number;
  listedCount: number;
  lockedCount: number;
  sellableCount: number;
  canSell: boolean;
  canLottery: boolean;
  canUpgrade: boolean;
  canStar: boolean;
  lockableUuid: string | null;
  unlockableUuid: string | null;
  upgradeableUuid: string | null;
  starableUuid: string | null;
  cultivationLevel: number;
  cultivationExp: number;
  cultivationMaxLevel: number;
  starLevel: number;
  starMaxLevel: number;
  battleRole: string;
  basePower: number;
  potentialPower: number;
  potentialGrade: string;
  potentialPercent: number;
  power: number;
  latestObtainedAt: Date | null;
};
type StarProtectedSets = {
  listed: Set<string>;
  formation: Set<string>;
  showcase: Set<string>;
};
type StarSourceContext = {
  userCards: UserCard[];
  cards: CardItem[];
  protectedSets: StarProtectedSets;
};
type UserCatalogEntry = {
  key: string;
  card: CardItem;
  rarity: CardRarity;
  collected: boolean;
  ownedCount: number;
  requiredFragments: number;
  fragmentCount: number;
  canSynthesize: boolean;
};
type LeaderboardMetricKey =
  | "totalCards"
  | "ssrCards"
  | "urCards"
  | "completedPools"
  | "rechargeAmount"
  | "pveCleared";
type LeaderboardMetrics = Record<LeaderboardMetricKey, number>;

// 与 uid 无关的完整排行榜计算结果，可全局缓存；me 在读取时按 uid 现场查找。
interface LeaderboardComputed {
  generatedAt: string;
  rankings: Record<LeaderboardMetricKey, LeaderboardEntry[]>;
}

@Injectable()
export class CardService {
  constructor(
    @InjectRepository(CardItem)
    private readonly cardRepository: Repository<CardItem>,
    @InjectRepository(PoolInfo)
    private readonly poolRepository: Repository<PoolInfo>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(UserCard)
    private readonly userCardRepository: Repository<UserCard>,
    @InjectRepository(UserHistory)
    private readonly userCardHistoryRepository: Repository<UserHistory>,
    @InjectRepository(DropItem)
    private readonly dropRepository: Repository<DropItem>,
    @InjectRepository(UserInventory)
    private readonly inventoryRepository: Repository<UserInventory>,
    @InjectRepository(UserGachaPity)
    private readonly pityRepository: Repository<UserGachaPity>,
    private readonly gachaConfigService: GachaConfigService,
    private readonly dataSource: DataSource,
    @Optional()
    private readonly pointLedgerService?: PointLedgerService,
    @Optional()
    private readonly achievementService?: AchievementService,
    @Optional()
    private readonly socialActivityService?: SocialActivityService,
    @Optional()
    @InjectRepository(RechargeRecord)
    private readonly rechargeRecordRepository?: Repository<RechargeRecord>,
    @Optional()
    @InjectRepository(PveChallengeRecord)
    private readonly pveRecordRepository?: Repository<PveChallengeRecord>,
    @Optional()
    private readonly redis?: RedisUtil,
  ) {}

  /**
   * 单抽
   * @param uid 用户ID
   * @param poolId 卡池ID
   */
  async drawOnce(uid: string, poolId?: number): Promise<GachaResult> {
    const results = await this.drawMultiple(uid, 1, poolId);
    return results[0];
  }

  /**
   * 十连抽
   * @param uid 用户ID
   * @param poolId 卡池ID
   */
  async drawTen(uid: string, poolId?: number): Promise<GachaResult[]> {
    return this.drawMultiple(uid, 10, poolId);
  }

  /**
   * 多次抽卡
   * @param uid 用户ID
   * @param count 抽卡次数
   * @param poolId 卡池ID
   */
  async drawMultiple(
    uid: string,
    count: number,
    poolId?: number,
  ): Promise<GachaResult[]> {
    if (!Number.isInteger(count) || count <= 0) {
      throw new Error("抽卡次数必须为正整数");
    }
    if (!ALLOWED_DRAW_COUNTS.includes(count)) {
      throw new Error("抽卡次数仅支持1抽或10抽");
    }

    const serverConfig = await this.resolveServerConfig(poolId);
    const effectivePoolId = serverConfig.poolId!;
    const drawCost = this.getDrawCost(serverConfig.drawCosts, count);

    return this.dataSource.transaction(async (manager) => {
      const poolRepository = manager.getRepository(PoolInfo);
      const cardRepository = manager.getRepository(CardItem);
      const userCardRepository = manager.getRepository(UserCard);
      const userHistoryRepository = manager.getRepository(UserHistory);
      const pityRepository = manager.getRepository(UserGachaPity);

      const pool = await poolRepository.findOne({
        where: { id: effectivePoolId },
      });
      if (!pool) {
        throw new Error(`卡池ID ${effectivePoolId} 不存在`);
      }
      if (pool.enabled === false) {
        throw new Error(`卡池 ${pool.pool_name} 已下线`);
      }

      const probabilities = this.getProbabilities(serverConfig);
      const cards = await cardRepository.find({
        where: { pool: effectivePoolId, enabled: true },
      });
      const cardsByRarity = this.groupCardsByRarity(cards);
      this.assertPoolCanDraw(cardsByRarity, probabilities, effectivePoolId);

      const user = await this.findOrCreateUser(manager, uid);
      await this.deductUserPoint(manager, user, drawCost, {
        count,
        poolId: effectivePoolId,
        poolName: pool.pool_name,
      });
      const pity = await this.findOrCreatePity(
        pityRepository,
        uid,
        effectivePoolId,
      );
      const rarityCounts = this.createEmptyRarityCounts();
      const userCards: UserCard[] = [];
      const results: GachaResult[] = [];

      for (let i = 0; i < count; i++) {
        const pityMinimumRarity = this.getPityMinimumRarity(
          pity,
          serverConfig.pitySystem,
        );
        const rarity = this.rollRarity(probabilities, pityMinimumRarity);
        const isPity = Boolean(pityMinimumRarity);
        const { card, isUp } = this.pickCardForRarity(
          cardsByRarity[rarity],
          serverConfig.upCards,
        );
        const potential = this.rollPotential(rarity);

        const userCard = userCardRepository.create({
          uid,
          card_id: card.id.toString(),
          card_level: rarity,
          can_sell: true,
          can_lottery: true,
          card_uuid: uuidv4(),
          delete_flag: false,
          potential_bp: potential.potentialBp,
          potential_grade: potential.potentialGrade,
        });
        userCards.push(userCard);
        rarityCounts[rarity] += 1;
        this.updatePityCounters(pity, rarity);

        results.push({
          cardId: card.id,
          cardName: card.card_name,
          cardDesc: card.card_desc,
          cardImage: card.card_image || "",
          rarity,
          cardType: card.card_type,
          poolId: card.pool,
          isUp,
          isPity,
          userCardUuid: userCard.card_uuid,
          battleRole: normalizeBattleRole(card.battle_role),
          potentialGrade: potential.potentialGrade,
          potentialPercent: potential.potentialBp / 100,
        });
      }

      await userCardRepository.save(userCards);
      this.applyUserRarityCounts(user, rarityCounts);
      await manager.getRepository(User).save(user);
      await pityRepository.save(pity);
      await this.saveUserHistoryToDB(userHistoryRepository, uid, results);
      await this.achievementService?.evaluateAndUnlock(manager, uid);

      return results;
    });
  }

  /**
   * 重置用户抽卡历史 (用于测试或特殊情况)
   */
  async resetUserHistory(uid: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(UserHistory).delete({ uid });
      await manager.getRepository(UserGachaPity).delete({ uid });

      const user = await manager
        .getRepository(User)
        .findOne({ where: { uid } });
      if (user) {
        user.card_count_n = 0;
        user.card_count_r = 0;
        user.card_count_sr = 0;
        user.card_count_ssr = 0;
        user.card_count_ur = 0;
        await manager.getRepository(User).save(user);
      }
    });
  }

  /**
   * 获取用户抽卡统计
   */
  async getUserGachaStats(uid: string): Promise<any> {
    const user = await this.userRepository.findOne({ where: { uid } });
    const totalHistory = await this.userCardHistoryRepository
      .createQueryBuilder("history")
      .select("SUM(history.count)", "total")
      .where("history.uid = :uid", { uid })
      .getRawOne();
    const totalDraws = parseInt(totalHistory?.total || "0");
    const recentHistory = await this.userCardHistoryRepository.find({
      where: { uid },
      order: { createdAt: "DESC" },
      take: 5,
    });
    const pityStates = await this.pityRepository.find({ where: { uid } });
    const availablePools = await this.poolRepository.find({
      where: { enabled: true },
      order: { sort_order: "ASC", id: "ASC" },
    });
    const pityStateMap = new Map(
      pityStates.map((pity) => [pity.pool_id, pity]),
    );
    const pity = await Promise.all(
      availablePools.map(async (pool) => {
        const config = await this.gachaConfigService.getConfigByPoolId(pool.id);
        const state =
          pityStateMap.get(pool.id) ||
          this.pityRepository.create({
            uid,
            pool_id: pool.id,
            draws_since_sr: 0,
            draws_since_ssr: 0,
            draws_since_ur: 0,
          });
        return this.createPityView(pool, state, config.pitySystem);
      }),
    );

    return {
      uid,
      point: user?.point || 0,
      totalDraws,
      cardCounts: {
        N: user?.card_count_n || 0,
        R: user?.card_count_r || 0,
        SR: user?.card_count_sr || 0,
        SSR: user?.card_count_ssr || 0,
        UR: user?.card_count_ur || 0,
      },
      pity,
      recentDraws: recentHistory.map((h) => ({
        count: h.count,
        cardIds: h.card_ids ? h.card_ids.split(",") : [],
        cardLevels: h.card_levels ? h.card_levels.split(",") : [],
        cardUuids: h.card_uuids ? h.card_uuids.split(",") : [],
        details: h.card_details || [],
        createdAt: h.createdAt,
      })),
    };
  }

  /**
   * 获取玩家排行榜
   */
  async getLeaderboard(
    uid: string,
    limit: number = 50,
  ): Promise<LeaderboardResponse> {
    const normalizedLimit = this.normalizeLeaderboardLimit(limit);
    // 完整排序结果与 uid 无关，可全局缓存；me(当前用户名次)在读取时按 uid 现场查找。
    const computed = await this.getLeaderboardComputed();
    return {
      generatedAt: computed.generatedAt,
      rankings: {
        totalCards: this.sliceLeaderboardBoard(
          computed.rankings.totalCards,
          uid,
          normalizedLimit,
        ),
        ssrCards: this.sliceLeaderboardBoard(
          computed.rankings.ssrCards,
          uid,
          normalizedLimit,
        ),
        urCards: this.sliceLeaderboardBoard(
          computed.rankings.urCards,
          uid,
          normalizedLimit,
        ),
        completedPools: this.sliceLeaderboardBoard(
          computed.rankings.completedPools,
          uid,
          normalizedLimit,
        ),
        rechargeAmount: this.sliceLeaderboardBoard(
          computed.rankings.rechargeAmount,
          uid,
          normalizedLimit,
        ),
        pveCleared: this.sliceLeaderboardBoard(
          computed.rankings.pveCleared,
          uid,
          normalizedLimit,
        ),
      },
    };
  }

  private readonly LEADERBOARD_CACHE_KEY = "leaderboard:card";
  private readonly LEADERBOARD_CACHE_TTL_SECONDS = 3600;

  /**
   * 计算与 uid 无关的完整排行榜（每个维度的完整排名列表），优先读 Redis 缓存。
   * TTL 1 小时，排行榜容忍分钟级延迟，无需精确失效。
   */
  private async getLeaderboardComputed(): Promise<LeaderboardComputed> {
    if (this.redis) {
      const cached = await this.redis.get<LeaderboardComputed>(
        this.LEADERBOARD_CACHE_KEY,
      );
      if (cached?.rankings) {
        return cached;
      }
    }
    const computed = await this.computeLeaderboardRankings();
    if (this.redis) {
      await this.redis.set(
        this.LEADERBOARD_CACHE_KEY,
        computed,
        this.LEADERBOARD_CACHE_TTL_SECONDS,
      );
    }
    return computed;
  }

  private async computeLeaderboardRankings(): Promise<LeaderboardComputed> {
    const [users, cards, userCards, rechargeTotals, pveTotals] =
      await Promise.all([
        this.userRepository.find(),
        this.cardRepository.find(),
        this.userCardRepository.find({ where: { delete_flag: false } }),
        this.getRechargeLeaderboardTotals(),
        this.getPveLeaderboardTotals(),
      ]);
    await ensureUsersPublicIds(this.userRepository, users);
    const cardMap = new Map(cards.map((card) => [card.id, card]));
    const userMap = new Map(users.map((user) => [user.uid, user]));
    const metricsByUid = new Map<string, LeaderboardMetrics>();
    const ownedVersionsByUid = new Map<string, Map<number, Set<string>>>();

    users.forEach((user) => {
      metricsByUid.set(user.uid, this.createEmptyLeaderboardMetrics());
    });

    userCards.forEach((userCard) => {
      const card = cardMap.get(Number(userCard.card_id));
      if (!card || !userCard.uid) {
        return;
      }
      const rarity = this.getEffectiveUserCardRarity(userCard, card);
      if (!rarity) {
        return;
      }

      const metrics = this.ensureLeaderboardMetrics(metricsByUid, userCard.uid);
      metrics.totalCards += 1;
      if (rarity === "SSR") {
        metrics.ssrCards += 1;
      }
      if (rarity === "UR") {
        metrics.urCards += 1;
      }

      const poolVersions = this.ensurePoolVersionSet(
        ownedVersionsByUid,
        userCard.uid,
        card.pool,
      );
      poolVersions.add(this.createPoolVersionKey(card.id, rarity));
    });

    rechargeTotals.forEach((total) => {
      if (!total.uid || total.amount <= 0) {
        return;
      }
      const metrics = this.ensureLeaderboardMetrics(metricsByUid, total.uid);
      metrics.rechargeAmount += total.amount;
    });

    pveTotals.forEach((total) => {
      if (!total.uid || total.cleared <= 0) {
        return;
      }
      const metrics = this.ensureLeaderboardMetrics(metricsByUid, total.uid);
      metrics.pveCleared += total.cleared;
    });

    const requiredVersionsByPool = this.buildRequiredPoolVersionMap(cards);
    metricsByUid.forEach((metrics, ownerUid) => {
      const ownerPools = ownedVersionsByUid.get(ownerUid);
      metrics.completedPools = this.countCompletedPools(
        requiredVersionsByPool,
        ownerPools,
      );
    });

    return {
      generatedAt: new Date().toISOString(),
      rankings: {
        totalCards: this.buildRankedEntries(
          metricsByUid,
          userMap,
          "totalCards",
        ),
        ssrCards: this.buildRankedEntries(metricsByUid, userMap, "ssrCards"),
        urCards: this.buildRankedEntries(metricsByUid, userMap, "urCards"),
        completedPools: this.buildRankedEntries(
          metricsByUid,
          userMap,
          "completedPools",
        ),
        rechargeAmount: this.buildRankedEntries(
          metricsByUid,
          userMap,
          "rechargeAmount",
        ),
        pveCleared: this.buildRankedEntries(
          metricsByUid,
          userMap,
          "pveCleared",
        ),
      },
    };
  }

  /**
   * 获取所有卡池列表
   */
  async getAllPools(): Promise<PoolInfo[]> {
    const pools = await this.poolRepository.find({
      where: { enabled: true },
      order: { sort_order: "ASC", id: "ASC" },
    });
    return Promise.all(
      pools.map((pool) => this.decoratePoolWithDrawCosts(pool)),
    );
  }

  /**
   * 根据卡池ID获取卡池信息
   */
  async getPoolById(poolId: number): Promise<any | null> {
    const pool = await this.poolRepository.findOne({
      where: { id: this.resolvePoolId(poolId), enabled: true },
    });
    return pool ? this.decoratePoolWithDrawCosts(pool) : null;
  }

  /**
   * 根据卡池ID获取该卡池的所有卡片（仅上架卡片）
   */
  async getCardsByPool(poolId: number): Promise<CardItem[]> {
    const effectivePoolId = this.resolvePoolId(poolId);
    const pool = await this.poolRepository.findOne({
      where: { id: effectivePoolId, enabled: true },
    });
    if (!pool) {
      throw new Error("卡池不存在或已下线");
    }
    return this.cardRepository.find({
      where: { pool: effectivePoolId, enabled: true },
    });
  }

  /**
   * 根据卡池ID获取该卡池的所有卡片（含已下架，用于图鉴）
   */
  async getCardsByPoolForCatalog(poolId: number): Promise<CardItem[]> {
    const effectivePoolId = this.resolvePoolId(poolId);
    const pool = await this.poolRepository.findOne({
      where: { id: effectivePoolId, enabled: true },
    });
    if (!pool) {
      throw new Error("卡池不存在或已下线");
    }
    // 不过滤 enabled，返回所有卡片（含已下架）
    return this.cardRepository.find({
      where: { pool: effectivePoolId },
      order: { id: "ASC" },
    });
  }

  async getUserCatalog(
    uid: string,
    poolId: number,
  ): Promise<{ poolId: number; list: UserCatalogEntry[]; total: number }> {
    const effectivePoolId = this.resolvePoolId(poolId);
    const pool = await this.poolRepository.findOne({
      where: { id: effectivePoolId, enabled: true },
    });
    if (!pool) {
      throw new Error("卡池不存在或已下线");
    }

    const user = await this.userRepository.findOne({ where: { uid } });
    if (!user) {
      throw new Error("用户不存在");
    }

    // 图鉴显示所有卡片（含已下架），前端可读 card.enabled 判断状态
    const cards = await this.getCardsByPoolForCatalog(effectivePoolId);
    if (cards.length === 0) {
      return { poolId: effectivePoolId, list: [], total: 0 };
    }

    const cardMap = new Map(cards.map((card) => [card.id, card]));
    const userCards = await this.userCardRepository.find({
      where: {
        uid,
        delete_flag: false,
        card_id: In(cards.map((card) => String(card.id))),
      },
    });
    const ownedMap = new Map<string, number>();
    userCards.forEach((userCard) => {
      const card = cardMap.get(Number(userCard.card_id));
      if (!card) {
        return;
      }
      const rarity = this.getEffectiveUserCardRarity(userCard, card);
      if (!rarity) {
        return;
      }
      const key = this.createPoolVersionKey(card.id, rarity);
      ownedMap.set(key, (ownedMap.get(key) || 0) + 1);
    });

    const synthesisRarities = [
      ...new Set(
        cards
          .flatMap((card) => this.parseCardLevels(card.card_level))
          .filter((rarity) => rarity !== "UR"),
      ),
    ];
    const fragmentCountMap = new Map<CardRarity, number>();
    for (const rarity of synthesisRarities) {
      const fragmentItem = await this.findRarityFragmentItem(
        this.dataSource.manager,
        rarity,
      );
      const inventory = await this.inventoryRepository.findOne({
        where: { user_id: user.id, item_id: fragmentItem.id },
      });
      fragmentCountMap.set(rarity, inventory?.num || 0);
    }

    const list = cards.flatMap((card) => {
      return this.parseCardLevels(card.card_level).map((rarity) => {
        const key = this.createPoolVersionKey(card.id, rarity);
        const ownedCount = ownedMap.get(key) || 0;
        const collected = ownedCount > 0;
        const requiredFragments =
          rarity === "UR" ? 0 : this.getRequiredFragments(rarity);
        const fragmentCount =
          rarity === "UR" ? 0 : fragmentCountMap.get(rarity) || 0;
        return {
          key,
          card,
          rarity,
          collected,
          ownedCount,
          requiredFragments,
          fragmentCount,
          canSynthesize:
            !collected && rarity !== "UR" && fragmentCount >= requiredFragments,
        };
      });
    });

    return {
      poolId: effectivePoolId,
      list,
      total: list.length,
    };
  }

  /**
   * 根据卡池类型获取卡池列表
   * @param cardType 0 常驻卡池 1 活动卡池 2 限定卡池 3 轮转卡池
   */
  async getPoolsByType(cardType: number): Promise<PoolInfo[]> {
    const pools = await this.poolRepository.find({
      where: { card_type: cardType, enabled: true },
      order: { sort_order: "ASC", id: "ASC" },
    });
    return Promise.all(
      pools.map((pool) => this.decoratePoolWithDrawCosts(pool)),
    );
  }

  /**
   * 获取用户卡片列表（支持分页）
   */
  async getUserCards(
    uid: string,
    rarity?: string,
    poolId?: number,
    page: number = 1,
    pageSize: number = 10,
    grouped: boolean = false,
    newOnly: boolean = false,
  ): Promise<{
    list: any[];
    dropItems: any[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    page = Math.max(1, page);
    pageSize = Math.min(100, Math.max(1, pageSize));

    const user = await this.userRepository.findOne({ where: { uid } });
    if (!user) {
      throw new Error("用户不存在");
    }
    const dropItems = await this.getUserDropItems(user.id);

    const normalizedRarity = rarity ? this.normalizeRarity(rarity) : undefined;
    if (grouped && (poolId === undefined || poolId === null)) {
      throw new Error("请选择卡池");
    }
    const poolCardIds =
      poolId === undefined ? undefined : await this.getCardIdsByPool(poolId);
    if (poolCardIds !== undefined && poolCardIds.length === 0) {
      return this.emptyUserCardsResult(page, pageSize, dropItems);
    }

    const baseWhere: any = {
      uid,
      delete_flag: false,
    };
    if (newOnly) {
      baseWhere.createdAt = MoreThanOrEqual(
        new Date(Date.now() - NEW_CARD_WINDOW_MS),
      );
    }

    const whereConditions = await this.buildUserCardWhereConditions(
      baseWhere,
      normalizedRarity,
      poolCardIds,
    );
    if (whereConditions.length === 0) {
      return this.emptyUserCardsResult(page, pageSize, dropItems);
    }

    if (grouped) {
      return this.getGroupedUserCardsResult(
        whereConditions,
        page,
        pageSize,
        dropItems,
      );
    }

    const total = await this.userCardRepository.count({
      where: whereConditions,
    });
    if (total === 0) {
      return this.emptyUserCardsResult(page, pageSize, dropItems);
    }

    const userCards = await this.userCardRepository.find({
      where: whereConditions,
      order: { id: "DESC" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    const cardIds = [...new Set(userCards.map((uc) => parseInt(uc.card_id)))];
    const cards = await this.cardRepository.find({
      where: { id: In(cardIds) },
    });
    const activeListings = await this.findActiveListingsByCardUuids(
      userCards.map((userCard) => userCard.card_uuid),
    );
    const activeListingMap = new Map(
      activeListings.map((listing) => [listing.card_uuid, listing]),
    );
    const starSourceContext = await this.createStarSourceContext(
      uid,
      userCards,
      cards,
      activeListings,
    );
    const starSourceMap = this.buildStarSourceMap(
      starSourceContext.userCards,
      starSourceContext.cards,
      starSourceContext.protectedSets,
    );

    const list = userCards
      .map((userCard) => {
        const card = cards.find((c) => c.id === parseInt(userCard.card_id));
        if (!card) {
          return null;
        }
        const activeListing = activeListingMap.get(userCard.card_uuid);
        const rarity = this.getEffectiveUserCardRarity(userCard, card);
        if (!rarity) {
          return null;
        }
        const cultivationLevel = getCultivationLevel(userCard);
        const cultivationExp = getCultivationExp(userCard);
        const starLevel = getCardStarLevel(userCard);
        const cultivationMaxLevel = getCultivationMaxLevel(rarity);
        const powerView = this.createPowerView(
          userCard,
          rarity,
          cultivationLevel,
          starLevel,
        );
        const canUpgrade =
          !activeListing &&
          userCard.locked !== true &&
          cultivationLevel < cultivationMaxLevel;
        const canStar =
          this.isStarTargetAvailable(userCard, Boolean(activeListing)) &&
          this.hasAvailableStarSource(userCard, card, rarity, starSourceMap);

        return {
          id: userCard.id,
          uuid: userCard.card_uuid,
          cardId: card.id,
          cardName: card.card_name,
          cardDesc: card.card_desc,
          cardImage: card.card_image || "",
          cardLevel: rarity,
          cardType: card.card_type,
          battleRole: normalizeBattleRole(card.battle_role),
          poolId: card.pool,
          canSell: userCard.can_sell,
          canLottery: userCard.can_lottery,
          locked: userCard.locked === true,
          isListed: Boolean(activeListing),
          tradeListingId: activeListing?.id || null,
          tradePrice: activeListing?.price || null,
          cultivationLevel,
          cultivationExp,
          cultivationMaxLevel,
          starLevel,
          starMaxLevel: getCardStarMaxLevel(),
          ...powerView,
          canUpgrade,
          canStar,
          upgradeableUuid: canUpgrade ? userCard.card_uuid : null,
          starableUuid: canStar ? userCard.card_uuid : null,
          obtainedAt: userCard.createdAt,
        };
      })
      .filter((item) => item !== null);

    return {
      list,
      dropItems,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async updateUserCardLock(uid: string, cardUuid: string, locked: boolean) {
    if (!cardUuid || typeof locked !== "boolean") {
      throw new Error("锁定参数无效");
    }

    return this.dataSource.transaction(async (manager) => {
      const userCardRepository = manager.getRepository(UserCard);
      const userCard = await userCardRepository.findOne({
        where: { uid, card_uuid: cardUuid, delete_flag: false },
        lock: { mode: "pessimistic_write" },
      });
      if (!userCard) {
        throw new Error("用户没有这张卡片");
      }

      const activeListing = await manager.getRepository(TradeListing).findOne({
        where: { card_uuid: cardUuid, status: "active" },
        lock: { mode: "pessimistic_write" },
      });
      if (activeListing) {
        throw new Error("挂售中的卡片不能切换锁定状态");
      }

      userCard.locked = locked;
      await userCardRepository.save(userCard);

      const card = await manager.getRepository(CardItem).findOne({
        where: { id: Number(userCard.card_id) },
      });

      return {
        uuid: userCard.card_uuid,
        locked: userCard.locked,
        cardId: Number(userCard.card_id),
        cardName: card?.card_name || "",
        cardLevel:
          userCard.card_level ||
          (card ? this.getHighestRarity(card.card_level) : undefined),
      };
    });
  }

  async getUserCardUpgradePreview(uid: string, cardUuid: string) {
    const userCard = await this.userCardRepository.findOne({
      where: { uid, card_uuid: cardUuid, delete_flag: false },
    });
    if (!userCard) {
      throw new Error("用户没有这张卡片");
    }
    const card = await this.cardRepository.findOne({
      where: { id: Number(userCard.card_id) },
    });
    if (!card) {
      throw new Error("卡片不存在");
    }
    const [activeListing] = await this.findActiveListingsByCardUuids([
      cardUuid,
    ]);
    const user = await this.userRepository.findOne({ where: { uid } });
    if (!user) {
      throw new Error("用户不存在");
    }
    const rarity = this.getEffectiveUserCardRarity(userCard, card);
    if (!rarity) {
      throw new Error("未知的卡片等级");
    }
    const fragmentItem = await this.findCultivationFragmentItem(
      this.dataSource.manager,
      rarity,
    );
    const inventory = await this.inventoryRepository.findOne({
      where: { user_id: user.id, item_id: fragmentItem.id },
    });

    return this.createUpgradePreview(
      userCard,
      card,
      fragmentItem,
      inventory?.num || 0,
      Boolean(activeListing),
    );
  }

  async upgradeUserCard(uid: string, cardUuid: string) {
    return this.dataSource.transaction(async (manager) => {
      const userCardRepository = manager.getRepository(UserCard);
      const inventoryRepository = manager.getRepository(UserInventory);
      const userCard = await userCardRepository.findOne({
        where: { uid, card_uuid: cardUuid, delete_flag: false },
        lock: { mode: "pessimistic_write" },
      });
      if (!userCard) {
        throw new Error("用户没有这张卡片");
      }
      if (userCard.locked === true) {
        throw new Error("已锁定的卡片不能养成");
      }

      const activeListing = await manager.getRepository(TradeListing).findOne({
        where: { card_uuid: cardUuid, status: "active" },
        lock: { mode: "pessimistic_write" },
      });
      if (activeListing) {
        throw new Error("挂售中的卡片不能养成");
      }

      const card = await manager.getRepository(CardItem).findOne({
        where: { id: Number(userCard.card_id) },
      });
      if (!card) {
        throw new Error("卡片不存在");
      }
      const rarity = this.getEffectiveUserCardRarity(userCard, card);
      if (!rarity) {
        throw new Error("未知的卡片等级");
      }

      const currentLevel = getCultivationLevel(userCard);
      const maxLevel = getCultivationMaxLevel(rarity);
      if (currentLevel >= maxLevel) {
        throw new Error("卡片已达到当前稀有度等级上限");
      }

      const user = await this.getExistingUser(manager, uid);
      const fragmentItem = await this.findCultivationFragmentItem(
        manager,
        rarity,
      );
      const inventory = await inventoryRepository.findOne({
        where: { user_id: user.id, item_id: fragmentItem.id },
        lock: { mode: "pessimistic_write" },
      });
      const cost = getCultivationUpgradeCost(rarity, currentLevel);
      if (!inventory || inventory.num < cost) {
        throw new Error(
          `碎片不足，需要${cost}个${fragmentItem.drop_name}，当前拥有${inventory?.num || 0}个`,
        );
      }

      const before = this.createCultivationSnapshot(userCard, card, rarity);
      inventory.num -= cost;
      userCard.cultivation_level = currentLevel + 1;
      userCard.cultivation_exp = getCultivationExp(userCard) + cost;
      await inventoryRepository.save(inventory);
      await userCardRepository.save(userCard);
      const after = this.createCultivationSnapshot(userCard, card, rarity);
      await this.socialActivityService?.recordActivity(
        {
          actorUid: uid,
          type: "card_upgraded",
          title: "养成卡片",
          summary: `${card.card_name} Lv.${after.level}`,
          metadata: {
            cardId: Number(userCard.card_id),
            cardName: card.card_name,
            rarity,
            level: after.level,
            power: after.power,
          },
        },
        manager,
      );

      return {
        uuid: userCard.card_uuid,
        cardId: Number(userCard.card_id),
        cardName: card.card_name,
        rarity,
        before,
        after,
        cost: {
          itemId: fragmentItem.id,
          itemName: fragmentItem.drop_name,
          num: cost,
          remaining: inventory.num,
        },
      };
    });
  }

  async rerollUserCardPotential(uid: string, cardUuid: string) {
    if (!cardUuid) {
      throw new Error("卡片参数无效");
    }
    return this.dataSource.transaction(async (manager) => {
      const userCardRepository = manager.getRepository(UserCard);
      const inventoryRepository = manager.getRepository(UserInventory);
      const userCard = await userCardRepository.findOne({
        where: { uid, card_uuid: cardUuid, delete_flag: false },
        lock: { mode: "pessimistic_write" },
      });
      if (!userCard) {
        throw new Error("用户没有这张卡片");
      }
      if (userCard.locked === true) {
        throw new Error("已锁定的卡片不能洗练");
      }
      const activeListing = await manager.getRepository(TradeListing).findOne({
        where: { card_uuid: cardUuid, status: "active" },
        lock: { mode: "pessimistic_write" },
      });
      if (activeListing) {
        throw new Error("挂售中的卡片不能洗练");
      }

      const card = await manager.getRepository(CardItem).findOne({
        where: { id: Number(userCard.card_id) },
      });
      if (!card) {
        throw new Error("卡片不存在");
      }
      const rarity = this.getEffectiveUserCardRarity(userCard, card);
      if (!rarity) {
        throw new Error("未知的卡片等级");
      }
      const user = await this.getExistingUser(manager, uid);
      const fragmentItem = await this.findCultivationFragmentItem(
        manager,
        rarity,
      );
      const cost = this.getPotentialRerollCost(rarity);
      const inventory = await inventoryRepository.findOne({
        where: { user_id: user.id, item_id: fragmentItem.id },
        lock: { mode: "pessimistic_write" },
      });
      if (!inventory || inventory.num < cost) {
        throw new Error(
          `碎片不足，需要${cost}个${fragmentItem.drop_name}，当前拥有${inventory?.num || 0}个`,
        );
      }
      const before = this.createPotentialSnapshot(userCard, card, rarity);
      const potential = this.rollPotential(rarity);
      inventory.num -= cost;
      userCard.potential_bp = potential.potentialBp;
      userCard.potential_grade = potential.potentialGrade;
      await inventoryRepository.save(inventory);
      await userCardRepository.save(userCard);
      const after = this.createPotentialSnapshot(userCard, card, rarity);
      return {
        uuid: userCard.card_uuid,
        cardId: Number(userCard.card_id),
        cardName: card.card_name,
        rarity,
        battleRole: normalizeBattleRole(card.battle_role),
        before,
        after,
        cost: {
          itemId: fragmentItem.id,
          itemName: fragmentItem.drop_name,
          num: cost,
          remaining: inventory.num,
        },
      };
    });
  }

  async getUserCardStarPreview(uid: string, cardUuid: string) {
    const userCard = await this.userCardRepository.findOne({
      where: { uid, card_uuid: cardUuid, delete_flag: false },
    });
    if (!userCard) {
      throw new Error("用户没有这张卡片");
    }
    const card = await this.cardRepository.findOne({
      where: { id: Number(userCard.card_id) },
    });
    if (!card) {
      throw new Error("卡片不存在");
    }
    const rarity = this.getEffectiveUserCardRarity(userCard, card);
    if (!rarity) {
      throw new Error("未知的卡片等级");
    }

    const allUserCards = await this.userCardRepository.find({
      where: { uid, delete_flag: false },
    });
    const cardIds = [
      ...new Set(allUserCards.map((item) => Number(item.card_id))),
    ].filter((cardId) => Number.isInteger(cardId) && cardId > 0);
    const allCards =
      cardIds.length > 0
        ? await this.cardRepository.find({ where: { id: In(cardIds) } })
        : [];
    const cardUuids = allUserCards.map((item) => item.card_uuid);
    const activeListings = await this.findActiveListingsByCardUuids(cardUuids);
    const protectedSets = await this.createStarProtectedSets(
      this.dataSource,
      cardUuids,
      activeListings,
      uid,
    );
    return this.createStarPreview(
      userCard,
      card,
      rarity,
      allUserCards,
      allCards,
      protectedSets,
    );
  }

  async starUserCard(uid: string, cardUuid: string, sourceUuid: string) {
    if (!sourceUuid || typeof sourceUuid !== "string") {
      throw new Error("请选择消耗卡片");
    }
    if (cardUuid === sourceUuid) {
      throw new Error("不能消耗同一张卡片");
    }

    return this.dataSource.transaction(async (manager) => {
      const userCardRepository = manager.getRepository(UserCard);
      const cardRepository = manager.getRepository(CardItem);
      const cardUuids = [cardUuid, sourceUuid].sort();
      const userCards = await userCardRepository.find({
        where: { uid, card_uuid: In(cardUuids), delete_flag: false },
        lock: { mode: "pessimistic_write" },
      });
      const userCardMap = new Map(
        userCards.map((item) => [item.card_uuid, item]),
      );
      const targetUserCard = userCardMap.get(cardUuid);
      const sourceUserCard = userCardMap.get(sourceUuid);
      if (!targetUserCard) {
        throw new Error("用户没有这张卡片");
      }
      if (!sourceUserCard) {
        throw new Error("消耗卡片不存在");
      }

      const cardIds = [
        ...new Set(
          [targetUserCard, sourceUserCard].map((item) => Number(item.card_id)),
        ),
      ].filter((cardId) => Number.isInteger(cardId) && cardId > 0);
      const cards =
        cardIds.length > 0
          ? await cardRepository.find({ where: { id: In(cardIds) } })
          : [];
      const cardMap = new Map(cards.map((item) => [item.id, item]));
      const targetCard = cardMap.get(Number(targetUserCard.card_id));
      const sourceCard = cardMap.get(Number(sourceUserCard.card_id));
      if (!targetCard || !sourceCard) {
        throw new Error("卡片不存在");
      }

      const targetRarity = this.getEffectiveUserCardRarity(
        targetUserCard,
        targetCard,
      );
      const sourceRarity = this.getEffectiveUserCardRarity(
        sourceUserCard,
        sourceCard,
      );
      if (!targetRarity || !sourceRarity) {
        throw new Error("未知的卡片等级");
      }
      if (
        this.normalizeStarCardName(targetCard.card_name) !==
          this.normalizeStarCardName(sourceCard.card_name) ||
        targetRarity !== sourceRarity
      ) {
        throw new Error("只能消耗同名同稀有度卡片");
      }

      const activeListings = await manager.getRepository(TradeListing).find({
        where: { card_uuid: In(cardUuids), status: "active" },
        lock: { mode: "pessimistic_write" },
      });
      const protectedSets = await this.createStarProtectedSets(
        manager,
        cardUuids,
        activeListings,
        uid,
        true,
      );
      const targetListed = protectedSets.listed.has(cardUuid);
      const targetUnavailableReason = this.getStarTargetUnavailableReason(
        targetUserCard,
        targetListed,
      );
      if (targetUnavailableReason) {
        throw new Error(targetUnavailableReason);
      }
      const sourceUnavailableReason = this.getStarSourceUnavailableReason(
        sourceUserCard,
        protectedSets,
      );
      if (sourceUnavailableReason) {
        throw new Error(`消耗卡片${sourceUnavailableReason}`);
      }

      const before = this.createStarSnapshot(
        targetUserCard,
        targetCard,
        targetRarity,
      );
      targetUserCard.star_level = before.starLevel + 1;
      sourceUserCard.delete_flag = true;
      await userCardRepository.save([targetUserCard, sourceUserCard]);
      const after = this.createStarSnapshot(
        targetUserCard,
        targetCard,
        targetRarity,
      );
      const source = this.createStarSourceSnapshot(
        sourceUserCard,
        sourceCard,
        sourceRarity,
      );

      await this.socialActivityService?.recordActivity(
        {
          actorUid: uid,
          type: "card_starred",
          title: "卡片升星",
          summary: `${targetCard.card_name} ${after.starLevel}星`,
          metadata: {
            cardId: Number(targetUserCard.card_id),
            cardName: targetCard.card_name,
            rarity: targetRarity,
            starLevel: after.starLevel,
            power: after.power,
            sourceUuid,
          },
        },
        manager,
      );

      return {
        uuid: targetUserCard.card_uuid,
        cardId: Number(targetUserCard.card_id),
        cardName: targetCard.card_name,
        rarity: targetRarity,
        before,
        after,
        source,
        powerGain: Math.max(0, after.power - before.power),
      };
    });
  }

  async getUserDrawHistory(uid: string, page = 1, pageSize = 10) {
    page = Math.max(1, page);
    pageSize = Math.min(50, Math.max(1, pageSize));

    const [histories, total] =
      await this.userCardHistoryRepository.findAndCount({
        where: { uid },
        order: { createdAt: "DESC" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      });
    const cardIds = [
      ...new Set(
        histories
          .flatMap((history) => this.extractHistoryCardIds(history))
          .filter((id) => Number.isInteger(id) && id > 0),
      ),
    ];
    const cards =
      cardIds.length > 0
        ? await this.cardRepository.find({ where: { id: In(cardIds) } })
        : [];
    const cardMap = new Map(cards.map((card) => [card.id, card]));

    return {
      list: histories.map((history) =>
        this.toDrawHistoryRecord(history, cardMap),
      ),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  private async getGroupedUserCardsResult(
    whereConditions: any[],
    page: number,
    pageSize: number,
    dropItems: any[],
  ) {
    const userCards = await this.userCardRepository.find({
      where: whereConditions,
      order: { id: "DESC" },
    });
    if (userCards.length === 0) {
      return this.emptyUserCardsResult(page, pageSize, dropItems);
    }

    const cardIds = [
      ...new Set(userCards.map((userCard) => Number(userCard.card_id))),
    ].filter((cardId) => Number.isInteger(cardId) && cardId > 0);
    const cards =
      cardIds.length > 0
        ? await this.cardRepository.find({ where: { id: In(cardIds) } })
        : [];
    const activeListings = await this.findActiveListingsByCardUuids(
      userCards.map((userCard) => userCard.card_uuid),
    );
    const ownerUid = this.extractUidFromWhereConditions(whereConditions);
    const starSourceContext = await this.createStarSourceContext(
      ownerUid,
      userCards,
      cards,
      activeListings,
    );
    const groups = this.groupOwnedCards(
      userCards,
      cards,
      activeListings,
      starSourceContext.protectedSets,
      starSourceContext.userCards,
      starSourceContext.cards,
    );
    const total = groups.length;
    const start = (page - 1) * pageSize;

    return {
      list: groups.slice(start, start + pageSize),
      dropItems,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  private groupOwnedCards(
    userCards: UserCard[],
    cards: CardItem[],
    activeListings: TradeListing[],
    starProtectedSets?: StarProtectedSets,
    starSourceUserCards?: UserCard[],
    starSourceCards?: CardItem[],
  ): UserCardGroup[] {
    const cardMap = new Map(cards.map((card) => [card.id, card]));
    const activeListingSet = new Set(
      activeListings.map((listing) => listing.card_uuid),
    );
    const protectedSets =
      starProtectedSets ||
      this.createStarProtectedSetsFromActiveListings(activeListings);
    const starSourceMap = this.buildStarSourceMap(
      starSourceUserCards || userCards,
      starSourceCards || cards,
      protectedSets,
    );
    const groupMap = new Map<string, UserCardGroup>();

    userCards.forEach((userCard) => {
      const card = cardMap.get(Number(userCard.card_id));
      if (!card) {
        return;
      }
      const rarity = this.getEffectiveUserCardRarity(userCard, card);
      if (!rarity) {
        return;
      }

      const key = this.createPoolVersionKey(card.id, rarity);
      let group = groupMap.get(key);
      if (!group) {
        group = {
          cardId: card.id,
          cardName: card.card_name,
          cardDesc: card.card_desc,
          cardImage: card.card_image || "",
          cardLevel: rarity,
          cardType: card.card_type,
          battleRole: normalizeBattleRole(card.battle_role),
          poolId: card.pool,
          count: 0,
          listedCount: 0,
          lockedCount: 0,
          sellableCount: 0,
          canSell: false,
          canLottery: false,
          canUpgrade: false,
          canStar: false,
          lockableUuid: null,
          unlockableUuid: null,
          upgradeableUuid: null,
          starableUuid: null,
          cultivationLevel: 1,
          cultivationExp: 0,
          cultivationMaxLevel: getCultivationMaxLevel(rarity),
          starLevel: 0,
          starMaxLevel: getCardStarMaxLevel(),
          basePower: calculateCardPower(rarity, 1, 0),
          potentialPower: 0,
          potentialGrade: "C",
          potentialPercent: 0,
          power: calculateCardPower(rarity, 1, 0),
          latestObtainedAt: null,
        };
        groupMap.set(key, group);
      }

      const isListed = activeListingSet.has(userCard.card_uuid);
      const isLocked = userCard.locked === true;
      const cultivationLevel = getCultivationLevel(userCard);
      const cultivationExp = getCultivationExp(userCard);
      const starLevel = getCardStarLevel(userCard);
      const powerView = this.createPowerView(
        userCard,
        rarity,
        cultivationLevel,
        starLevel,
      );
      const power = powerView.power;
      group.count += 1;
      group.listedCount += isListed ? 1 : 0;
      group.lockedCount += isLocked ? 1 : 0;
      group.sellableCount +=
        userCard.can_sell === true && !isListed && !isLocked ? 1 : 0;
      group.canSell = group.sellableCount > 0;
      group.canLottery = group.canLottery || userCard.can_lottery === true;
      if (!isListed && !isLocked && !group.lockableUuid) {
        group.lockableUuid = userCard.card_uuid;
      }
      if (!isListed && isLocked && !group.unlockableUuid) {
        group.unlockableUuid = userCard.card_uuid;
      }
      if (
        power > group.power ||
        (power === group.power &&
          (starLevel > group.starLevel ||
            (starLevel === group.starLevel &&
              (cultivationLevel > group.cultivationLevel ||
                (cultivationLevel === group.cultivationLevel &&
                  cultivationExp > group.cultivationExp)))))
      ) {
        group.cultivationLevel = cultivationLevel;
        group.cultivationExp = cultivationExp;
        group.starLevel = starLevel;
        group.basePower = powerView.basePower;
        group.potentialPower = powerView.potentialPower;
        group.potentialGrade = powerView.potentialGrade;
        group.potentialPercent = powerView.potentialPercent;
        group.power = powerView.power;
      }
      if (
        !isListed &&
        !isLocked &&
        cultivationLevel < group.cultivationMaxLevel &&
        !group.upgradeableUuid
      ) {
        group.upgradeableUuid = userCard.card_uuid;
      }
      if (
        this.isStarTargetAvailable(userCard, isListed) &&
        this.hasAvailableStarSource(userCard, card, rarity, starSourceMap) &&
        !group.starableUuid
      ) {
        group.starableUuid = userCard.card_uuid;
      }
      group.latestObtainedAt = this.pickLatestDate(
        group.latestObtainedAt,
        userCard.createdAt,
      );
    });

    return Array.from(groupMap.values())
      .map((group) => {
        const sellableCount =
          group.cardLevel === "UR"
            ? 0
            : Math.min(group.sellableCount, Math.max(0, group.count - 1));
        return {
          ...group,
          sellableCount,
          canSell: sellableCount > 0,
          canUpgrade: Boolean(group.upgradeableUuid),
          canStar: Boolean(group.starableUuid),
        };
      })
      .sort((left, right) => {
        const rightTime = right.latestObtainedAt?.getTime() || 0;
        const leftTime = left.latestObtainedAt?.getTime() || 0;
        return (
          rightTime - leftTime ||
          right.cardId - left.cardId ||
          this.getRarityRank(right.cardLevel) -
            this.getRarityRank(left.cardLevel)
        );
      });
  }

  private pickLatestDate(current: Date | null, next?: Date | string | null) {
    const nextDate = next instanceof Date ? next : next ? new Date(next) : null;
    if (!nextDate || Number.isNaN(nextDate.getTime())) {
      return current;
    }
    if (!current || nextDate.getTime() > current.getTime()) {
      return nextDate;
    }
    return current;
  }

  /**
   * 合成卡片
   */
  async synthesizeCard(uid: string, cardId: number, targetRarity?: string) {
    return this.dataSource.transaction(async (manager) => {
      const cardRepository = manager.getRepository(CardItem);
      const inventoryRepository = manager.getRepository(UserInventory);
      const userCardRepository = manager.getRepository(UserCard);

      const card = await cardRepository.findOne({ where: { id: cardId } });
      if (!card) {
        throw new Error("卡片不存在");
      }

      const rarity = this.resolveSynthesisRarity(card, targetRarity);
      if (rarity === "UR") {
        throw new Error("不能合成UR卡片");
      }

      const requiredFragments = this.getRequiredFragments(rarity);
      const fragmentItem = await this.findRarityFragmentItem(manager, rarity);
      const user = await this.getExistingUser(manager, uid);
      const userInventory = await inventoryRepository.findOne({
        where: { user_id: user.id, item_id: fragmentItem.id },
        lock: { mode: "pessimistic_write" },
      });
      const currentFragments = userInventory?.num || 0;

      if (!userInventory || currentFragments < requiredFragments) {
        throw new Error(
          `碎片不足，需要${requiredFragments}个碎片，当前拥有${currentFragments}个`,
        );
      }

      userInventory.num -= requiredFragments;
      await inventoryRepository.save(userInventory);

      const userCard = userCardRepository.create({
        uid,
        card_id: cardId.toString(),
        card_level: rarity,
        card_uuid: uuidv4(),
        can_sell: true,
        can_lottery: true,
        delete_flag: false,
      });
      await userCardRepository.save(userCard);
      await this.achievementService?.evaluateAndUnlock(manager, uid, [
        {
          type: "synthesize_count",
          amount: 1,
          metadata: { cardId, rarity, cardUuid: userCard.card_uuid },
        },
      ]);

      return {
        data: {
          card_name: card.card_name,
          card_level: rarity,
          fragments_used: requiredFragments,
          card_uuid: userCard.card_uuid,
        },
        msg: "合成成功",
      };
    });
  }

  /**
   * 分解卡片
   */
  async decomposeCard(uid: string, cardUuid: string) {
    return this.dataSource.transaction(async (manager) => {
      const userCardRepository = manager.getRepository(UserCard);
      const userCard = await userCardRepository.findOne({
        where: { uid, card_uuid: cardUuid, delete_flag: false },
        lock: { mode: "pessimistic_write" },
      });

      if (!userCard) {
        throw new Error("用户没有这张卡片");
      }
      if (userCard.locked === true) {
        throw new Error("已锁定的卡片不能分解");
      }
      const activeListing = await manager.getRepository(TradeListing).findOne({
        where: { card_uuid: cardUuid, status: "active" },
        lock: { mode: "pessimistic_write" },
      });
      if (activeListing) {
        throw new Error("交易中的卡片不能分解");
      }

      const card = await manager.getRepository(CardItem).findOne({
        where: { id: parseInt(userCard.card_id) },
      });
      if (!card) {
        throw new Error("卡片不存在");
      }
      const rarity = this.getEffectiveUserCardRarity(userCard, card);
      if (!rarity) {
        throw new Error("未知的卡片等级");
      }
      await this.assertCanRemoveOwnedCard(
        manager,
        uid,
        userCard,
        card,
        rarity,
        "分解",
      );

      const user = await this.getExistingUser(manager, uid);
      const fragmentDrops = await this.createDecomposeFragmentDrops(
        manager,
        userCard,
        card,
      );

      userCard.delete_flag = true;
      await userCardRepository.save(userCard);
      for (const fragmentDrop of fragmentDrops) {
        await this.applyFragmentGain(
          manager,
          user.id,
          fragmentDrop.fragmentItem,
          fragmentDrop.fragmentCount,
        );
      }
      await this.achievementService?.evaluateAndUnlock(manager, uid, [
        {
          type: "decompose_count",
          amount: 1,
          metadata: {
            cardId: Number(userCard.card_id),
            rarity,
            cardUuid,
          },
        },
      ]);
      const fragmentMap = this.createFragmentSummaryMap(fragmentDrops);

      return {
        data: {
          card_id: parseInt(userCard.card_id),
          card_name: card.card_name,
          card_level: rarity,
          card_uuid: cardUuid,
          fragments_gained: fragmentDrops.reduce(
            (sum, item) => sum + item.fragmentCount,
            0,
          ),
          fragments: this.toFragmentSummary(fragmentMap),
        },
        msg: "分解成功",
      };
    });
  }

  async previewBulkDecompose(uid: string, rarities: string[]) {
    const selectedRarities = this.normalizeDecomposeRarities(rarities);
    const userCards = await this.userCardRepository.find({
      where: { uid, delete_flag: false },
    });
    const cardIds = [
      ...new Set(userCards.map((item) => Number(item.card_id)).filter(Boolean)),
    ];
    const cards =
      cardIds.length > 0
        ? await this.cardRepository.find({ where: { id: In(cardIds) } })
        : [];
    const activeListings = await this.findActiveListingsByCardUuids(
      userCards.map((item) => item.card_uuid),
    );
    return this.createBulkDecomposePreview(
      userCards,
      cards,
      activeListings,
      selectedRarities,
    );
  }

  async bulkDecomposeCards(uid: string, rarities: string[]) {
    const selectedRarities = this.normalizeDecomposeRarities(rarities);
    return this.dataSource.transaction(async (manager) => {
      const userCardRepository = manager.getRepository(UserCard);
      const user = await this.getExistingUser(manager, uid);
      const userCards = await userCardRepository.find({
        where: { uid, delete_flag: false },
        lock: { mode: "pessimistic_write" },
      });
      const cardIds = [
        ...new Set(
          userCards.map((item) => Number(item.card_id)).filter(Boolean),
        ),
      ];
      const cards =
        cardIds.length > 0
          ? await manager.getRepository(CardItem).find({
              where: { id: In(cardIds) },
            })
          : [];
      const activeListings =
        userCards.length > 0
          ? await manager.getRepository(TradeListing).find({
              where: {
                card_uuid: In(userCards.map((item) => item.card_uuid)),
                status: "active",
              },
              lock: { mode: "pessimistic_write" },
            })
          : [];
      const preview = this.createBulkDecomposePreview(
        userCards,
        cards,
        activeListings,
        selectedRarities,
      );
      const candidates = this.collectDecomposeCandidates(
        this.collectDecomposeCandidateGroups(
          userCards,
          cards,
          activeListings,
          selectedRarities,
        ),
      );
      if (candidates.length === 0) {
        return {
          ...preview,
          decomposed: 0,
          fragments: [],
        };
      }

      const fragmentMap = new Map<number, { item: DropItem; count: number }>();
      for (const candidate of candidates) {
        const fragmentDrops = await this.createDecomposeFragmentDrops(
          manager,
          candidate.userCard,
          candidate.card,
        );
        for (const fragmentDrop of fragmentDrops) {
          const existing = fragmentMap.get(fragmentDrop.fragmentItem.id);
          if (existing) {
            existing.count += fragmentDrop.fragmentCount;
          } else {
            fragmentMap.set(fragmentDrop.fragmentItem.id, {
              item: fragmentDrop.fragmentItem,
              count: fragmentDrop.fragmentCount,
            });
          }
        }
        candidate.userCard.delete_flag = true;
      }

      await userCardRepository.save(
        candidates.map((candidate) => candidate.userCard),
      );
      for (const { item, count } of fragmentMap.values()) {
        await this.applyFragmentGain(manager, user.id, item, count);
      }
      await this.achievementService?.evaluateAndUnlock(manager, uid, [
        {
          type: "decompose_count",
          amount: candidates.length,
          metadata: {
            rarities: selectedRarities,
          },
        },
      ]);

      return {
        ...preview,
        decomposed: candidates.length,
        fragments: this.toFragmentSummary(fragmentMap),
      };
    });
  }

  private createBulkDecomposePreview(
    userCards: UserCard[],
    cards: CardItem[],
    activeListings: TradeListing[],
    selectedRarities: CardRarity[],
  ) {
    const candidateGroups = this.collectDecomposeCandidateGroups(
      userCards,
      cards,
      activeListings,
      selectedRarities,
    );
    const candidates = this.collectDecomposeCandidates(candidateGroups);
    const selectedSet = new Set(selectedRarities);
    const activeListingSet = new Set(
      activeListings.map((listing) => listing.card_uuid),
    );
    const cardMap = new Map(cards.map((card) => [card.id, card]));
    const countsByRarity = this.createEmptyRarityCounts();
    let skippedListed = 0;
    let skippedLocked = 0;

    userCards.forEach((userCard) => {
      const card = cardMap.get(Number(userCard.card_id));
      if (!card) {
        return;
      }
      const rarity = this.getEffectiveUserCardRarity(userCard, card);
      if (!rarity || !selectedSet.has(rarity)) {
        return;
      }
      if (activeListingSet.has(userCard.card_uuid)) {
        skippedListed += 1;
      }
      if (userCard.locked === true) {
        skippedLocked += 1;
      }
    });
    candidates.forEach((candidate) => {
      countsByRarity[candidate.rarity] += 1;
    });

    return {
      selectedRarities,
      total: candidates.length,
      countsByRarity,
      skippedListed,
      skippedLocked,
      reservedCount: this.countBulkReservedCandidates(candidateGroups),
    };
  }

  private collectDecomposeCandidates(
    candidateGroups: Map<string, DecomposeCandidateGroup>,
  ): DecomposeCandidate[] {
    return Array.from(candidateGroups.values()).flatMap((group) =>
      [...group.candidates]
        .sort((left, right) => this.compareUserCardsForKeep(left, right))
        .slice(this.getBulkKeepCount(group)),
    );
  }

  private collectDecomposeCandidateGroups(
    userCards: UserCard[],
    cards: CardItem[],
    activeListings: TradeListing[],
    selectedRarities: CardRarity[],
  ): Map<string, DecomposeCandidateGroup> {
    const selectedSet = new Set(selectedRarities);
    const activeListingSet = new Set(
      activeListings.map((listing) => listing.card_uuid),
    );
    const cardMap = new Map(cards.map((card) => [card.id, card]));
    const groups = new Map<string, DecomposeCandidateGroup>();

    userCards.forEach((userCard) => {
      const card = cardMap.get(Number(userCard.card_id));
      if (!card) {
        return;
      }
      const rarity = this.getEffectiveUserCardRarity(userCard, card);
      if (!rarity || !selectedSet.has(rarity)) {
        return;
      }
      const key = this.createPoolVersionKey(card.id, rarity);
      const group = groups.get(key) || { candidates: [], totalOwned: 0 };
      group.totalOwned += 1;
      if (
        !activeListingSet.has(userCard.card_uuid) &&
        userCard.locked !== true
      ) {
        group.candidates.push({ userCard, card, rarity });
      }
      groups.set(key, group);
    });

    return groups;
  }

  private getBulkKeepCount(group: DecomposeCandidateGroup) {
    const protectedCount = Math.max(
      0,
      group.totalOwned - group.candidates.length,
    );
    return protectedCount > 0 ? 0 : Math.min(1, group.candidates.length);
  }

  private countBulkReservedCandidates(
    candidateGroups: Map<string, DecomposeCandidateGroup>,
  ) {
    return Array.from(candidateGroups.values()).reduce(
      (sum, group) => sum + this.getBulkKeepCount(group),
      0,
    );
  }

  private compareUserCardsForKeep(
    left: DecomposeCandidate,
    right: DecomposeCandidate,
  ) {
    const rightTime = right.userCard.createdAt
      ? new Date(right.userCard.createdAt).getTime()
      : 0;
    const leftTime = left.userCard.createdAt
      ? new Date(left.userCard.createdAt).getTime()
      : 0;
    return (
      rightTime - leftTime ||
      Number(right.userCard.id || 0) - Number(left.userCard.id || 0)
    );
  }

  private normalizeDecomposeRarities(rarities: string[]): CardRarity[] {
    const normalized = [
      ...new Set(
        (rarities || [])
          .map((item) => item.trim())
          .filter(Boolean)
          .map((item) => this.normalizeRarity(item)),
      ),
    ];
    if (normalized.length === 0) {
      throw new Error("请选择要分解的卡片等级");
    }
    if (normalized.includes("UR")) {
      throw new Error("UR卡片不可以一键分解");
    }
    return normalized;
  }

  private async createDecomposeFragmentDrops(
    manager: EntityManager,
    userCard: UserCard,
    card: CardItem,
  ): Promise<DecomposeFragmentDrop[]> {
    const rarity =
      this.getEffectiveUserCardRarity(userCard, card) ||
      this.getHighestRarity(card.card_level);
    if (rarity === "UR") {
      throw new Error("UR卡片不可以分解");
    }
    const decomposeRule = await this.getDecomposeRule(manager, rarity);
    return Promise.all(
      decomposeRule.drops.map(async (dropRule) => {
        const fragmentCount = randomInt(dropRule.min, dropRule.max + 1);
        const fragmentItem =
          dropRule.itemId > 0
            ? await this.findDecomposeConfigFragmentItem(
                manager,
                dropRule.itemId,
              )
            : await this.findCardDecomposeFragmentItem(manager, card);
        return {
          rarity,
          fragmentCount,
          fragmentItem,
        };
      }),
    );
  }

  private async assertCanRemoveOwnedCard(
    manager: EntityManager,
    uid: string,
    userCard: UserCard,
    card: CardItem,
    rarity: CardRarity,
    actionLabel: string,
  ) {
    const userCards = await manager.getRepository(UserCard).find({
      where: {
        uid,
        card_id: userCard.card_id,
        delete_flag: false,
      },
      lock: { mode: "pessimistic_write" },
    });
    const sameRarityCount = userCards.filter(
      (item) => this.getEffectiveUserCardRarity(item, card) === rarity,
    ).length;
    if (sameRarityCount <= 1) {
      throw new Error(`至少保留一张${rarity}卡片，不能${actionLabel}`);
    }
  }

  private async applyFragmentGain(
    manager: EntityManager,
    userId: number,
    fragmentItem: DropItem,
    fragmentCount: number,
  ) {
    const inventoryRepository = manager.getRepository(UserInventory);
    let userInventory = await inventoryRepository.findOne({
      where: { user_id: userId, item_id: fragmentItem.id },
      lock: { mode: "pessimistic_write" },
    });

    if (!userInventory) {
      userInventory = inventoryRepository.create({
        user_id: userId,
        item_id: fragmentItem.id,
        num: fragmentCount,
      });
    } else {
      userInventory.num += fragmentCount;
    }
    await inventoryRepository.save(userInventory);
  }

  private toFragmentSummary(
    fragmentMap: Map<number, { item: DropItem; count: number }>,
  ): DecomposeFragmentSummary[] {
    return Array.from(fragmentMap.values()).map(({ item, count }) => ({
      itemId: item.id,
      itemName: item.drop_name,
      count,
    }));
  }

  private createFragmentSummaryMap(fragmentDrops: DecomposeFragmentDrop[]) {
    const fragmentMap = new Map<number, { item: DropItem; count: number }>();
    fragmentDrops.forEach((fragmentDrop) => {
      const existing = fragmentMap.get(fragmentDrop.fragmentItem.id);
      if (existing) {
        existing.count += fragmentDrop.fragmentCount;
      } else {
        fragmentMap.set(fragmentDrop.fragmentItem.id, {
          item: fragmentDrop.fragmentItem,
          count: fragmentDrop.fragmentCount,
        });
      }
    });
    return fragmentMap;
  }

  private async resolveServerConfig(poolId?: number): Promise<GachaConfig> {
    const effectivePoolId =
      poolId === undefined || poolId === null || poolId === 0
        ? DEFAULT_DRAW_POOL_ID
        : poolId;
    const config =
      await this.gachaConfigService.getConfigByPoolId(effectivePoolId);
    return {
      ...config,
      poolId: effectivePoolId,
    };
  }

  private resolvePoolId(poolId: number): number {
    return poolId === 0 ? DEFAULT_DRAW_POOL_ID : poolId;
  }

  private getProbabilities(config: GachaConfig): Record<string, number> {
    const probabilities =
      config.rarityProbabilities ||
      this.gachaConfigService.getDefaultConfig().rarityProbabilities!;
    if (!this.gachaConfigService.validateProbabilities(probabilities)) {
      throw new Error("卡池配置异常，请联系运营");
    }
    return probabilities;
  }

  private getDrawCost(costs: DrawCosts | undefined, count: number): number {
    const drawCosts = costs || { once: 100, ten: 998 };
    return count === 10 ? drawCosts.ten : drawCosts.once;
  }

  private async deductUserPoint(
    manager: EntityManager,
    user: User,
    cost: number,
    context: { count: number; poolId: number; poolName: string },
  ): Promise<void> {
    this.normalizeUserStats(user);
    if (user.point < cost) {
      throw new Error(`星穹币不足，需要${cost}，当前${user.point}`);
    }
    if (this.pointLedgerService) {
      await this.pointLedgerService.applyChange(manager, user, -cost, {
        sourceType: context.count === 10 ? "draw_ten" : "draw_once",
        sourceId: context.poolId,
        title:
          context.count === 10
            ? `十连抽：${context.poolName}`
            : `单抽：${context.poolName}`,
        metadata: {
          poolId: context.poolId,
          poolName: context.poolName,
          count: context.count,
          cost,
        },
      });
      return;
    }
    user.point -= cost;
  }

  private async decoratePoolWithDrawCosts(pool: PoolInfo) {
    const config = await this.gachaConfigService.getConfigByPoolId(pool.id);
    return {
      ...pool,
      sortOrder: Number(pool.sort_order || 0),
      rarityProbabilities: config.rarityProbabilities || {},
      drawCosts: config.drawCosts || { once: 10, ten: 100 },
    };
  }

  private rollRarity(
    probabilities: Record<string, number>,
    minimumRarity?: CardRarity,
  ): CardRarity {
    const minimumRank = minimumRarity ? this.getRarityRank(minimumRarity) : 0;
    const candidates = RARITY_ORDER.filter(
      (rarity) => this.getRarityRank(rarity) >= minimumRank,
    )
      .map((rarity) => ({ rarity, probability: probabilities[rarity] || 0 }))
      .filter((item) => item.probability > 0);

    if (candidates.length === 0) {
      return minimumRarity || RARITY_ORDER[0];
    }

    const total = candidates.reduce((sum, item) => sum + item.probability, 0);
    const random = this.randomFloat() * total;
    let cumulative = 0;

    for (const item of candidates) {
      cumulative += item.probability;
      if (random <= cumulative) {
        return item.rarity;
      }
    }

    return candidates[candidates.length - 1].rarity;
  }

  private randomFloat(): number {
    return randomInt(0, 1_000_000_000) / 1_000_000_000;
  }

  private pickCardForRarity(
    cards: CardItem[],
    upConfig?: { enabled: boolean; cardIds: number[]; upRate: number },
  ): { card: CardItem; isUp: boolean } {
    if (!cards || cards.length === 0) {
      throw new Error("当前稀有度没有可抽取卡片");
    }

    if (upConfig?.enabled && upConfig.cardIds.length > 0) {
      const upCards = cards.filter((card) =>
        upConfig.cardIds.includes(card.id),
      );
      if (upCards.length > 0 && this.randomFloat() < upConfig.upRate) {
        const card = upCards[randomInt(0, upCards.length)];
        return { card, isUp: true };
      }
    }

    const card = cards[randomInt(0, cards.length)];
    return {
      card,
      isUp: Boolean(upConfig?.enabled && upConfig.cardIds.includes(card.id)),
    };
  }

  private groupCardsByRarity(cards: CardItem[]): CardPoolByRarity {
    const grouped = this.createEmptyCardPool();
    cards.forEach((card) => {
      this.parseCardLevels(card.card_level).forEach((rarity) => {
        grouped[rarity].push(card);
      });
    });
    return grouped;
  }

  private assertPoolCanDraw(
    cardsByRarity: CardPoolByRarity,
    probabilities: Record<string, number>,
    poolId: number,
  ): void {
    RARITY_ORDER.forEach((rarity) => {
      if (
        (probabilities[rarity] || 0) > 0 &&
        cardsByRarity[rarity].length === 0
      ) {
        throw new Error(`卡池${poolId}中没有稀有度为${rarity}的卡片`);
      }
    });
  }

  private parseCardLevels(cardLevel: string): CardRarity[] {
    return cardLevel
      .split(",")
      .map((level) => level.trim().toUpperCase())
      .filter((level): level is CardRarity =>
        RARITY_ORDER.includes(level as CardRarity),
      );
  }

  private cardSupportsRarity(card: CardItem, rarity: CardRarity): boolean {
    return this.parseCardLevels(card.card_level).includes(rarity);
  }

  private resolveSynthesisRarity(
    card: CardItem,
    targetRarity?: string,
  ): CardRarity {
    if (!targetRarity) {
      return this.getHighestRarity(card.card_level);
    }

    const rarity = this.normalizeRarity(targetRarity);
    if (!this.cardSupportsRarity(card, rarity)) {
      throw new Error("卡片不支持该稀有度");
    }
    return rarity;
  }

  private getHighestRarity(cardLevel: string): CardRarity {
    const levels = this.parseCardLevels(cardLevel);
    if (levels.length === 0) {
      throw new Error("未知的卡片等级");
    }
    return levels.sort(
      (a, b) => this.getRarityRank(b) - this.getRarityRank(a),
    )[0];
  }

  private getRarityRank(rarity: CardRarity): number {
    return RARITY_ORDER.indexOf(rarity);
  }

  private getPityMinimumRarity(
    pity: UserGachaPity,
    config?: PitySystemConfig,
  ): CardRarity | undefined {
    if (!config?.enabled) {
      return undefined;
    }

    if (
      config.hardPity &&
      this.getPityCounter(pity, config.hardPity.guaranteedRarity) + 1 >=
        config.hardPity.count
    ) {
      return config.hardPity.guaranteedRarity;
    }

    if (
      config.softPity &&
      this.getPityCounter(pity, config.softPity.guaranteedRarity) + 1 >=
        config.softPity.count
    ) {
      return config.softPity.guaranteedRarity;
    }

    return undefined;
  }

  private getPityCounter(pity: UserGachaPity, rarity: CardRarity): number {
    if (this.getRarityRank(rarity) >= this.getRarityRank("UR")) {
      return pity.draws_since_ur || 0;
    }
    if (this.getRarityRank(rarity) >= this.getRarityRank("SSR")) {
      return pity.draws_since_ssr || 0;
    }
    return pity.draws_since_sr || 0;
  }

  private createPityView(
    pool: PoolInfo,
    pity: UserGachaPity,
    config?: PitySystemConfig,
  ) {
    const soft =
      config?.enabled && config.softPity
        ? this.createPityRuleView(pity, config.softPity)
        : null;
    const hard =
      config?.enabled && config.hardPity
        ? this.createPityRuleView(pity, config.hardPity)
        : null;
    const next = [soft, hard]
      .filter(Boolean)
      .sort((left, right) => left!.remaining - right!.remaining)[0];

    return {
      poolId: pool.id,
      poolName: pool.pool_name,
      enabled: pool.enabled !== false,
      drawsSinceSR: pity.draws_since_sr || 0,
      drawsSinceSSR: pity.draws_since_ssr || 0,
      drawsSinceUR: pity.draws_since_ur || 0,
      soft,
      hard,
      next: next
        ? {
            label: `${next.guaranteedRarity} 保底`,
            guaranteedRarity: next.guaranteedRarity,
            remaining: next.remaining,
          }
        : null,
    };
  }

  private createPityRuleView(
    pity: UserGachaPity,
    rule: NonNullable<PitySystemConfig["softPity"]>,
  ) {
    const current = this.getPityCounter(pity, rule.guaranteedRarity);
    return {
      count: rule.count,
      guaranteedRarity: rule.guaranteedRarity,
      current,
      remaining: Math.max(0, rule.count - current),
    };
  }

  private updatePityCounters(pity: UserGachaPity, rarity: CardRarity): void {
    const rank = this.getRarityRank(rarity);
    pity.draws_since_sr =
      rank >= this.getRarityRank("SR") ? 0 : (pity.draws_since_sr || 0) + 1;
    pity.draws_since_ssr =
      rank >= this.getRarityRank("SSR") ? 0 : (pity.draws_since_ssr || 0) + 1;
    pity.draws_since_ur =
      rank >= this.getRarityRank("UR") ? 0 : (pity.draws_since_ur || 0) + 1;
  }

  private async findOrCreateUser(
    manager: EntityManager,
    uid: string,
  ): Promise<User> {
    const userRepository = manager.getRepository(User);
    let user = await userRepository.findOne({
      where: { uid },
      lock: { mode: "pessimistic_write" },
    });

    if (!user) {
      user = userRepository.create({
        uid,
        name: uid,
        nickname: uid,
        avatar: "",
        point: 0,
        card_count_n: 0,
        card_count_r: 0,
        card_count_sr: 0,
        card_count_ssr: 0,
        card_count_ur: 0,
        is_admin: false,
      });
      await assignUserPublicId(userRepository, user);
      return userRepository.save(user);
    }

    await ensureUserPublicId(userRepository, user);
    this.normalizeUserStats(user);
    return user;
  }

  private async getExistingUser(
    manager: EntityManager,
    uid: string,
  ): Promise<User> {
    const user = await manager.getRepository(User).findOne({
      where: { uid },
      lock: { mode: "pessimistic_write" },
    });
    if (!user) {
      throw new Error("用户不存在");
    }
    this.normalizeUserStats(user);
    return user;
  }

  private async findOrCreatePity(
    repository: Repository<UserGachaPity>,
    uid: string,
    poolId: number,
  ): Promise<UserGachaPity> {
    const pity = await repository.findOne({
      where: { uid, pool_id: poolId },
      lock: { mode: "pessimistic_write" },
    });

    return (
      pity ||
      repository.create({
        uid,
        pool_id: poolId,
        draws_since_sr: 0,
        draws_since_ssr: 0,
        draws_since_ur: 0,
      })
    );
  }

  private async saveUserHistoryToDB(
    repository: Repository<UserHistory>,
    uid: string,
    results: GachaResult[],
  ): Promise<void> {
    const userCardHistory = repository.create({
      uid,
      count: results.length,
      card_ids: results.map((result) => result.cardId).join(","),
      card_levels: results.map((result) => result.rarity).join(","),
      card_uuids: results.map((result) => result.userCardUuid).join(","),
      card_details: results.map((result) => ({
        cardId: result.cardId,
        rarity: result.rarity,
        cardUuid: result.userCardUuid,
        isUp: result.isUp,
        isPity: result.isPity,
      })),
    });

    await repository.save(userCardHistory);
  }

  private extractHistoryCardIds(history: UserHistory): number[] {
    const detailIds = Array.isArray(history.card_details)
      ? history.card_details.map((detail) => Number(detail.cardId))
      : [];
    const legacyIds = String(history.card_ids || "")
      .split(",")
      .map((id) => Number(id.trim()));
    return [...detailIds, ...legacyIds].filter(
      (id) => Number.isInteger(id) && id > 0,
    );
  }

  private toDrawHistoryRecord(
    history: UserHistory,
    cardMap: Map<number, CardItem>,
  ) {
    const cardIds = String(history.card_ids || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const cardLevels = String(history.card_levels || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const cardUuids = String(history.card_uuids || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const rawDetails =
      Array.isArray(history.card_details) && history.card_details.length > 0
        ? history.card_details
        : cardIds.map((cardId, index) => ({
            cardId: Number(cardId),
            rarity: cardLevels[index] || "",
            cardUuid: cardUuids[index] || "",
            isUp: false,
            isPity: false,
          }));

    return {
      id: history.id,
      count: history.count,
      createdAt: history.createdAt,
      cardIds,
      cardLevels,
      cardUuids,
      details: rawDetails.map((detail, index) => {
        const cardId = Number(detail.cardId);
        const card = cardMap.get(cardId);
        const rarity =
          detail.rarity ||
          cardLevels[index] ||
          (card ? this.getHighestRarity(card.card_level) : "");
        return {
          cardId,
          cardName: card?.card_name || `卡片 ${cardId}`,
          cardDesc: card?.card_desc || "",
          cardImage: card?.card_image || "",
          cardType: card?.card_type ?? 0,
          poolId: card?.pool ?? null,
          rarity,
          cardUuid: detail.cardUuid || cardUuids[index] || "",
          isUp: detail.isUp === true,
          isPity: detail.isPity === true,
        };
      }),
    };
  }

  private async buildUserCardWhereConditions(
    baseWhere: any,
    rarity?: CardRarity,
    poolCardIds?: number[],
  ): Promise<any[]> {
    const applyPoolFilter = (condition: any, cardIds?: number[]) => {
      if (cardIds !== undefined) {
        condition.card_id = In(cardIds.map((id) => id.toString()));
      }
      return condition;
    };

    if (!rarity) {
      return [applyPoolFilter({ ...baseWhere }, poolCardIds)];
    }

    const conditions = [
      applyPoolFilter({ ...baseWhere, card_level: rarity }, poolCardIds),
    ];
    const fallbackCardIds = await this.getFallbackCardIdsByRarity(
      rarity,
      poolCardIds,
    );

    if (fallbackCardIds.length > 0) {
      conditions.push(
        applyPoolFilter(
          { ...baseWhere, card_level: IsNull() },
          fallbackCardIds,
        ),
        applyPoolFilter({ ...baseWhere, card_level: "" }, fallbackCardIds),
      );
    }

    return conditions;
  }

  private async getCardIdsByPool(poolId: number): Promise<number[]> {
    const cards = await this.cardRepository.find({
      where: { pool: this.resolvePoolId(poolId) },
    });
    return cards.map((card) => card.id);
  }

  private async getFallbackCardIdsByRarity(
    rarity: CardRarity,
    poolCardIds?: number[],
  ): Promise<number[]> {
    const cards = await this.cardRepository.find(
      poolCardIds === undefined ? {} : { where: { id: In(poolCardIds) } },
    );

    return cards
      .filter((card) => this.getHighestRarity(card.card_level) === rarity)
      .map((card) => card.id);
  }

  private async getUserDropItems(userId: number): Promise<any[]> {
    const userInventories = await this.inventoryRepository.find({
      where: { user_id: userId },
    });
    const dropItems =
      userInventories.length > 0
        ? await this.dropRepository.find({
            where: { id: In(userInventories.map((inv) => inv.item_id)) },
          })
        : [];
    const itemInfoMap = new Map();

    dropItems.forEach((item) => {
      const inventory = userInventories.find((inv) => inv.item_id === item.id);
      if (inventory) {
        itemInfoMap.set(item.id, {
          id: item.id,
          name: item.drop_name,
          desc: item.drop_desc,
          type: item.drop_type,
          itemType: item.drop_item_type,
          itemValue: item.drop_item_value,
          num: inventory.num,
        });
      }
    });

    return Array.from(itemInfoMap.values());
  }

  private async findActiveListingsByCardUuids(
    cardUuids: string[],
  ): Promise<TradeListing[]> {
    const uniqueCardUuids = [...new Set(cardUuids.filter(Boolean))];
    if (uniqueCardUuids.length === 0) {
      return [];
    }
    try {
      const repository = this.dataSource?.getRepository?.(TradeListing);
      if (!repository) {
        return [];
      }
      return repository.find({
        where: { card_uuid: In(uniqueCardUuids), status: "active" },
      });
    } catch {
      return [];
    }
  }

  private normalizeLeaderboardLimit(limit: number): number {
    if (!Number.isInteger(limit) || limit <= 0) {
      return 50;
    }
    return Math.min(100, limit);
  }

  private createEmptyLeaderboardMetrics(): LeaderboardMetrics {
    return {
      totalCards: 0,
      ssrCards: 0,
      urCards: 0,
      completedPools: 0,
      rechargeAmount: 0,
      pveCleared: 0,
    };
  }

  private async getRechargeLeaderboardTotals(): Promise<
    Array<{ uid: string; amount: number }>
  > {
    if (!this.rechargeRecordRepository) {
      return [];
    }
    const rows = await this.rechargeRecordRepository
      .createQueryBuilder("record")
      .select("record.uid", "uid")
      .addSelect("COALESCE(SUM(record.amount), 0)", "amount")
      .where("record.status = :status", { status: "success" })
      .groupBy("record.uid")
      .getRawMany<{ uid: string; amount: string | number }>();

    return rows.map((row) => ({
      uid: String(row.uid || ""),
      amount: Number(row.amount || 0),
    }));
  }

  private async getPveLeaderboardTotals(): Promise<
    Array<{ uid: string; cleared: number }>
  > {
    if (!this.pveRecordRepository) {
      return [];
    }
    const rows = await this.pveRecordRepository
      .createQueryBuilder("record")
      .select("record.uid", "uid")
      .addSelect("COUNT(record.id)", "cleared")
      .where("record.success = :success", { success: true })
      .groupBy("record.uid")
      .getRawMany<{ uid: string; cleared: string | number }>();

    return rows.map((row) => ({
      uid: String(row.uid || ""),
      cleared: Number(row.cleared || 0),
    }));
  }

  private ensureLeaderboardMetrics(
    metricsByUid: Map<string, LeaderboardMetrics>,
    uid: string,
  ): LeaderboardMetrics {
    let metrics = metricsByUid.get(uid);
    if (!metrics) {
      metrics = this.createEmptyLeaderboardMetrics();
      metricsByUid.set(uid, metrics);
    }
    return metrics;
  }

  private ensurePoolVersionSet(
    ownedVersionsByUid: Map<string, Map<number, Set<string>>>,
    uid: string,
    poolId: number,
  ): Set<string> {
    let poolMap = ownedVersionsByUid.get(uid);
    if (!poolMap) {
      poolMap = new Map<number, Set<string>>();
      ownedVersionsByUid.set(uid, poolMap);
    }

    let versions = poolMap.get(poolId);
    if (!versions) {
      versions = new Set<string>();
      poolMap.set(poolId, versions);
    }
    return versions;
  }

  private getEffectiveUserCardRarity(
    userCard: UserCard,
    card: CardItem,
  ): CardRarity | null {
    try {
      return userCard.card_level
        ? this.normalizeRarity(userCard.card_level)
        : this.getHighestRarity(card.card_level);
    } catch {
      return null;
    }
  }

  private normalizeStarCardName(name: string) {
    return String(name || "").trim();
  }

  private extractUidFromWhereConditions(whereConditions: any[]) {
    for (const condition of whereConditions || []) {
      const uid = condition?.uid;
      if (typeof uid === "string" && uid) {
        return uid;
      }
    }
    return "";
  }

  private async createStarSourceContext(
    uid: string,
    fallbackUserCards: UserCard[],
    fallbackCards: CardItem[],
    fallbackActiveListings: TradeListing[],
  ): Promise<StarSourceContext> {
    if (!uid) {
      return {
        userCards: fallbackUserCards,
        cards: fallbackCards,
        protectedSets: await this.createStarProtectedSets(
          this.dataSource,
          fallbackUserCards.map((userCard) => userCard.card_uuid),
          fallbackActiveListings,
        ),
      };
    }
    try {
      const userCards = await this.userCardRepository.find({
        where: { uid, delete_flag: false },
      });
      const cardIds = [
        ...new Set(userCards.map((userCard) => Number(userCard.card_id))),
      ].filter((cardId) => Number.isInteger(cardId) && cardId > 0);
      const cards =
        cardIds.length > 0
          ? await this.cardRepository.find({ where: { id: In(cardIds) } })
          : [];
      const cardUuids = userCards.map((userCard) => userCard.card_uuid);
      const activeListings =
        await this.findActiveListingsByCardUuids(cardUuids);
      const protectedSets = await this.createStarProtectedSets(
        this.dataSource,
        cardUuids,
        activeListings,
        uid,
      );
      return { userCards, cards, protectedSets };
    } catch {
      return {
        userCards: fallbackUserCards,
        cards: fallbackCards,
        protectedSets: await this.createStarProtectedSets(
          this.dataSource,
          fallbackUserCards.map((userCard) => userCard.card_uuid),
          fallbackActiveListings,
          uid,
        ),
      };
    }
  }

  private createStarKey(card: CardItem, rarity: CardRarity) {
    return `${this.normalizeStarCardName(card.card_name)}::${rarity}`;
  }

  private createStarProtectedSetsFromActiveListings(
    activeListings: TradeListing[] = [],
  ): StarProtectedSets {
    return {
      listed: new Set(activeListings.map((listing) => listing.card_uuid)),
      formation: new Set(),
      showcase: new Set(),
    };
  }

  private async createStarProtectedSets(
    manager: DataSource | EntityManager,
    cardUuids: string[],
    activeListings: TradeListing[] = [],
    uid?: string,
    lock = false,
  ): Promise<StarProtectedSets> {
    const uniqueCardUuids = [...new Set(cardUuids.filter(Boolean))];
    return {
      listed: new Set(activeListings.map((listing) => listing.card_uuid)),
      formation: await this.findProtectedCardUuidSet(
        manager,
        UserFormationSlot,
        uniqueCardUuids,
        uid,
        lock,
      ),
      showcase: await this.findProtectedCardUuidSet(
        manager,
        UserShowcaseCard,
        uniqueCardUuids,
        uid,
        lock,
      ),
    };
  }

  private async findProtectedCardUuidSet(
    manager: DataSource | EntityManager,
    entity: typeof UserFormationSlot | typeof UserShowcaseCard,
    cardUuids: string[],
    uid?: string,
    lock = false,
  ): Promise<Set<string>> {
    const uniqueCardUuids = [...new Set(cardUuids.filter(Boolean))];
    if (uniqueCardUuids.length === 0) {
      return new Set();
    }
    try {
      const repository = manager.getRepository?.(entity);
      if (!repository?.find) {
        if (lock) {
          throw new Error("卡片状态校验失败");
        }
        return new Set();
      }
      const where: Record<string, unknown> = {
        card_uuid: In(uniqueCardUuids),
      };
      if (uid) {
        where.uid = uid;
      }
      const rows = await repository.find({
        where,
        ...(lock ? { lock: { mode: "pessimistic_write" as const } } : {}),
      });
      return new Set(rows.map((row) => row.card_uuid));
    } catch {
      if (lock) {
        throw new Error("卡片状态校验失败");
      }
      return new Set();
    }
  }

  private buildStarSourceMap(
    userCards: UserCard[],
    cards: CardItem[],
    protectedSets: StarProtectedSets,
  ): Map<string, string[]> {
    const cardMap = new Map(cards.map((card) => [card.id, card]));
    const sourceMap = new Map<string, string[]>();
    userCards.forEach((userCard) => {
      const card = cardMap.get(Number(userCard.card_id));
      if (
        !card ||
        this.getStarSourceUnavailableReason(userCard, protectedSets)
      ) {
        return;
      }
      const rarity = this.getEffectiveUserCardRarity(userCard, card);
      if (!rarity) {
        return;
      }
      const key = this.createStarKey(card, rarity);
      const sourceUuids = sourceMap.get(key) || [];
      sourceUuids.push(userCard.card_uuid);
      sourceMap.set(key, sourceUuids);
    });
    return sourceMap;
  }

  private hasAvailableStarSource(
    targetUserCard: UserCard,
    card: CardItem,
    rarity: CardRarity,
    starSourceMap: Map<string, string[]>,
  ) {
    const sourceUuids =
      starSourceMap.get(this.createStarKey(card, rarity)) || [];
    return sourceUuids.some((uuid) => uuid !== targetUserCard.card_uuid);
  }

  private isStarTargetAvailable(userCard: UserCard, isListed: boolean) {
    return !this.getStarTargetUnavailableReason(userCard, isListed);
  }

  private getStarTargetUnavailableReason(
    userCard: UserCard,
    isListed: boolean,
  ) {
    if (userCard.locked === true) {
      return "已锁定";
    }
    if (isListed) {
      return "挂售中";
    }
    if (getCardStarLevel(userCard) >= getCardStarMaxLevel()) {
      return "满星";
    }
    return "";
  }

  private getStarSourceUnavailableReason(
    userCard: UserCard,
    protectedSets: StarProtectedSets,
  ) {
    if (userCard.locked === true) {
      return "已锁定";
    }
    if (protectedSets.listed.has(userCard.card_uuid)) {
      return "挂售中";
    }
    if (protectedSets.formation.has(userCard.card_uuid)) {
      return "上阵中";
    }
    if (protectedSets.showcase.has(userCard.card_uuid)) {
      return "展示中";
    }
    return "";
  }

  private compareStarSourceCandidates(
    left: { userCard: UserCard; available: boolean },
    right: { userCard: UserCard; available: boolean },
  ) {
    if (left.available !== right.available) {
      return left.available ? -1 : 1;
    }
    const leftCreated = left.userCard.createdAt
      ? new Date(left.userCard.createdAt).getTime()
      : 0;
    const rightCreated = right.userCard.createdAt
      ? new Date(right.userCard.createdAt).getTime()
      : 0;
    return (
      getCardStarLevel(left.userCard) - getCardStarLevel(right.userCard) ||
      getCultivationLevel(left.userCard) -
        getCultivationLevel(right.userCard) ||
      getCultivationExp(left.userCard) - getCultivationExp(right.userCard) ||
      leftCreated - rightCreated ||
      Number(left.userCard.id || 0) - Number(right.userCard.id || 0)
    );
  }

  private createStarPreview(
    userCard: UserCard,
    card: CardItem,
    rarity: CardRarity,
    allUserCards: UserCard[],
    allCards: CardItem[],
    protectedSets: StarProtectedSets,
  ) {
    const cardMap = new Map(allCards.map((item) => [item.id, item]));
    const targetListed = protectedSets.listed.has(userCard.card_uuid);
    const targetUnavailableReason = this.getStarTargetUnavailableReason(
      userCard,
      targetListed,
    );
    const targetName = this.normalizeStarCardName(card.card_name);
    const candidates = allUserCards
      .map((sourceUserCard) => {
        if (sourceUserCard.card_uuid === userCard.card_uuid) {
          return null;
        }
        const sourceCard = cardMap.get(Number(sourceUserCard.card_id));
        if (!sourceCard) {
          return null;
        }
        const sourceRarity = this.getEffectiveUserCardRarity(
          sourceUserCard,
          sourceCard,
        );
        if (
          !sourceRarity ||
          sourceRarity !== rarity ||
          this.normalizeStarCardName(sourceCard.card_name) !== targetName
        ) {
          return null;
        }
        const unavailableReason = this.getStarSourceUnavailableReason(
          sourceUserCard,
          protectedSets,
        );
        return {
          userCard: sourceUserCard,
          card: sourceCard,
          rarity: sourceRarity,
          available: !unavailableReason,
          unavailableReason,
        };
      })
      .filter(
        (
          item,
        ): item is {
          userCard: UserCard;
          card: CardItem;
          rarity: CardRarity;
          available: boolean;
          unavailableReason: string;
        } => item !== null,
      )
      .sort((left, right) => this.compareStarSourceCandidates(left, right))
      .map((item) =>
        this.createStarCandidateView(
          item.userCard,
          item.card,
          item.rarity,
          item.available,
          item.unavailableReason,
        ),
      );
    const current = this.createStarSnapshot(userCard, card, rarity);
    const next =
      current.starLevel < current.starMaxLevel
        ? this.createStarSnapshot(userCard, card, rarity, current.starLevel + 1)
        : null;
    const hasAvailableSource = candidates.some(
      (candidate) => candidate.available,
    );
    const unavailableReason =
      targetUnavailableReason || (!hasAvailableSource ? "没有可消耗卡片" : "");

    return {
      uuid: userCard.card_uuid,
      cardId: Number(userCard.card_id),
      cardName: card.card_name,
      rarity,
      current,
      next,
      candidates,
      canStar: !unavailableReason,
      unavailableReason,
    };
  }

  private createStarSnapshot(
    userCard: UserCard,
    card: CardItem,
    rarity: CardRarity,
    overrideStarLevel?: number,
  ) {
    const cultivationLevel = getCultivationLevel(userCard);
    const starLevel =
      overrideStarLevel === undefined
        ? getCardStarLevel(userCard)
        : Math.min(getCardStarMaxLevel(), Math.max(0, overrideStarLevel));
    const powerView = this.createPowerView(
      userCard,
      rarity,
      cultivationLevel,
      starLevel,
    );
    return {
      starLevel,
      starMaxLevel: getCardStarMaxLevel(),
      cultivationLevel,
      ...powerView,
      cardName: card.card_name,
      rarity,
    };
  }

  private createStarSourceSnapshot(
    userCard: UserCard,
    card: CardItem,
    rarity: CardRarity,
  ) {
    return {
      uuid: userCard.card_uuid,
      cardId: Number(userCard.card_id),
      cardName: card.card_name,
      rarity,
      cultivationLevel: getCultivationLevel(userCard),
      starLevel: getCardStarLevel(userCard),
      ...this.createPowerView(
        userCard,
        rarity,
        getCultivationLevel(userCard),
        getCardStarLevel(userCard),
      ),
    };
  }

  private createStarCandidateView(
    userCard: UserCard,
    card: CardItem,
    rarity: CardRarity,
    available: boolean,
    unavailableReason: string,
  ) {
    return {
      ...this.createStarSourceSnapshot(userCard, card, rarity),
      cardImage: card.card_image || "",
      cardLevel: rarity,
      cardType: card.card_type,
      battleRole: normalizeBattleRole(card.battle_role),
      poolId: card.pool,
      starMaxLevel: getCardStarMaxLevel(),
      obtainedAt: userCard.createdAt,
      available,
      unavailableReason,
    };
  }

  private createCultivationSnapshot(
    userCard: UserCard,
    card: CardItem,
    rarity: CardRarity,
  ) {
    const level = getCultivationLevel(userCard);
    const starLevel = getCardStarLevel(userCard);
    const powerView = this.createPowerView(userCard, rarity, level, starLevel);
    return {
      level,
      exp: getCultivationExp(userCard),
      maxLevel: getCultivationMaxLevel(rarity),
      starLevel,
      starMaxLevel: getCardStarMaxLevel(),
      ...powerView,
      cardName: card.card_name,
      rarity,
    };
  }

  private createUpgradePreview(
    userCard: UserCard,
    card: CardItem,
    fragmentItem: DropItem,
    ownedFragments: number,
    isListed: boolean,
  ) {
    const rarity = this.getEffectiveUserCardRarity(userCard, card);
    if (!rarity) {
      throw new Error("未知的卡片等级");
    }
    const current = this.createCultivationSnapshot(userCard, card, rarity);
    const nextLevel = Math.min(current.maxLevel, current.level + 1);
    const cost =
      current.level < current.maxLevel
        ? getCultivationUpgradeCost(rarity, current.level)
        : 0;
    const next = {
      level: nextLevel,
      exp: current.exp + cost,
      maxLevel: current.maxLevel,
      starLevel: current.starLevel,
      starMaxLevel: current.starMaxLevel,
      ...this.createPowerView(userCard, rarity, nextLevel, current.starLevel),
      cardName: card.card_name,
      rarity,
    };
    const unavailableReason =
      userCard.locked === true
        ? "已锁定的卡片不能养成"
        : isListed
          ? "挂售中的卡片不能养成"
          : current.level >= current.maxLevel
            ? "卡片已达到当前稀有度等级上限"
            : ownedFragments < cost
              ? `碎片不足，需要${cost}个${fragmentItem.drop_name}，当前拥有${ownedFragments}个`
              : "";

    return {
      uuid: userCard.card_uuid,
      cardId: Number(userCard.card_id),
      cardName: card.card_name,
      rarity,
      current,
      next: current.level < current.maxLevel ? next : null,
      cost: {
        itemId: fragmentItem.id,
        itemName: fragmentItem.drop_name,
        num: cost,
        owned: ownedFragments,
      },
      canUpgrade: !unavailableReason,
      unavailableReason,
    };
  }

  private buildRequiredPoolVersionMap(
    cards: CardItem[],
  ): Map<number, Set<string>> {
    const requiredVersionsByPool = new Map<number, Set<string>>();
    cards.forEach((card) => {
      if (card.enabled === false) {
        return;
      }
      const levels = this.parseCardLevels(card.card_level);
      if (levels.length === 0) {
        return;
      }
      let versions = requiredVersionsByPool.get(card.pool);
      if (!versions) {
        versions = new Set<string>();
        requiredVersionsByPool.set(card.pool, versions);
      }
      levels.forEach((rarity) => {
        versions.add(this.createPoolVersionKey(card.id, rarity));
      });
    });
    return requiredVersionsByPool;
  }

  private countCompletedPools(
    requiredVersionsByPool: Map<number, Set<string>>,
    ownerPools?: Map<number, Set<string>>,
  ): number {
    if (!ownerPools) {
      return 0;
    }

    let completed = 0;
    requiredVersionsByPool.forEach((requiredVersions, poolId) => {
      const ownedVersions = ownerPools.get(poolId);
      if (
        ownedVersions &&
        Array.from(requiredVersions).every((version) =>
          ownedVersions.has(version),
        )
      ) {
        completed += 1;
      }
    });
    return completed;
  }

  private createPoolVersionKey(cardId: number, rarity: CardRarity): string {
    return `${cardId}:${rarity}`;
  }

  private buildRankedEntries(
    metricsByUid: Map<string, LeaderboardMetrics>,
    userMap: Map<string, User>,
    metric: LeaderboardMetricKey,
  ): LeaderboardEntry[] {
    const entries = Array.from(metricsByUid.entries())
      .map(([uid, metrics]) =>
        this.createLeaderboardEntry(uid, metrics[metric], userMap.get(uid)),
      )
      .filter((entry) => entry.value > 0)
      .sort((a, b) => b.value - a.value || a.uid.localeCompare(b.uid));
    return this.assignLeaderboardRanks(entries);
  }

  private sliceLeaderboardBoard(
    rankedEntries: LeaderboardEntry[],
    currentUid: string,
    limit: number,
  ): LeaderboardBoard {
    return {
      list: rankedEntries.slice(0, limit),
      me: rankedEntries.find((entry) => entry.uid === currentUid) || null,
    };
  }

  private createLeaderboardEntry(
    uid: string,
    value: number,
    user?: User,
  ): LeaderboardEntry {
    return {
      rank: 0,
      uid,
      publicId: user ? getUserPublicId(user) : uid,
      nickname: user?.nickname || user?.name || "玩家",
      avatar: user?.avatar || "",
      value,
    };
  }

  private assignLeaderboardRanks(
    entries: LeaderboardEntry[],
  ): LeaderboardEntry[] {
    let previousValue: number | undefined;
    let currentRank = 0;

    return entries.map((entry, index) => {
      if (previousValue === undefined || entry.value !== previousValue) {
        currentRank = index + 1;
        previousValue = entry.value;
      }
      return {
        ...entry,
        rank: currentRank,
      };
    });
  }

  private rollPotential(rarity: CardRarity) {
    const range = getPotentialRange(rarity);
    const potentialBp = randomInt(range.min, range.max + 1);
    return {
      potentialBp,
      potentialGrade: getPotentialGrade(potentialBp),
    };
  }

  private createPowerView(
    userCard: UserCard,
    rarity: CardRarity,
    level: number,
    starLevel: number,
  ) {
    const potential = resolveUserCardPotential(userCard, rarity);
    const power = calculateCardPowerWithPotential(
      rarity,
      level,
      starLevel,
      potential.potentialBp,
    );
    return {
      ...power,
      potentialGrade: potential.potentialGrade,
      potentialPercent: potential.potentialPercent,
    };
  }

  private createPotentialSnapshot(
    userCard: UserCard,
    card: CardItem,
    rarity: CardRarity,
  ) {
    const level = getCultivationLevel(userCard);
    const starLevel = getCardStarLevel(userCard);
    return {
      rarity,
      battleRole: normalizeBattleRole(card.battle_role),
      level,
      starLevel,
      ...this.createPowerView(userCard, rarity, level, starLevel),
    };
  }

  private getPotentialRerollCost(rarity: CardRarity) {
    return {
      N: 5,
      R: 8,
      SR: 12,
      SSR: 20,
      UR: 30,
    }[rarity];
  }

  private normalizeRarity(rarity: string): CardRarity {
    const normalized = rarity.trim().toUpperCase();
    if (!RARITY_ORDER.includes(normalized as CardRarity)) {
      throw new Error("稀有度参数无效");
    }
    return normalized as CardRarity;
  }

  private createEmptyRarityCounts(): RarityCounts {
    return {
      N: 0,
      R: 0,
      SR: 0,
      SSR: 0,
      UR: 0,
    };
  }

  private createEmptyCardPool(): CardPoolByRarity {
    return {
      N: [],
      R: [],
      SR: [],
      SSR: [],
      UR: [],
    };
  }

  private applyUserRarityCounts(user: User, counts: RarityCounts): void {
    this.normalizeUserStats(user);
    user.card_count_n += counts.N;
    user.card_count_r += counts.R;
    user.card_count_sr += counts.SR;
    user.card_count_ssr += counts.SSR;
    user.card_count_ur += counts.UR;
  }

  private normalizeUserStats(user: User): void {
    user.point = user.point || 0;
    user.card_count_n = user.card_count_n || 0;
    user.card_count_r = user.card_count_r || 0;
    user.card_count_sr = user.card_count_sr || 0;
    user.card_count_ssr = user.card_count_ssr || 0;
    user.card_count_ur = user.card_count_ur || 0;
  }

  private emptyUserCardsResult(
    page: number,
    pageSize: number,
    dropItems: any[] = [],
  ) {
    return {
      list: [],
      dropItems,
      total: 0,
      page,
      pageSize,
      totalPages: 0,
    };
  }

  private async getDecomposeRule(manager: EntityManager, rarity: CardRarity) {
    const fallback = this.getDecomposeFragmentRange(rarity);
    const fallbackRule = { drops: [{ itemId: 0, ...fallback }] };
    if (!isDecomposeConfigRarity(rarity)) {
      return fallbackRule;
    }

    try {
      const row = await manager.getRepository(SystemConfig).findOne({
        where: { key: DECOMPOSE_CONFIG_KEY },
      });
      if (!row?.value) {
        return fallbackRule;
      }
      const config = normalizeDecomposeConfig(JSON.parse(row.value));
      return config.rules[rarity] || fallbackRule;
    } catch {
      return fallbackRule;
    }
  }

  private async findDecomposeConfigFragmentItem(
    manager: EntityManager,
    itemId: number,
  ): Promise<DropItem> {
    const fragmentItem = await manager.getRepository(DropItem).findOne({
      where: { id: itemId, drop_type: 0, disabled: false },
    });
    if (!fragmentItem) {
      throw new Error("分解配置的碎片物品不存在或已禁用");
    }
    return fragmentItem;
  }

  private async findCardDecomposeFragmentItem(
    manager: EntityManager,
    card: CardItem,
  ): Promise<DropItem> {
    const dropRepository = manager.getRepository(DropItem);
    const configuredIds = this.parseDropItemIds(card.drop_item);
    if (configuredIds.length > 0) {
      const configuredItems = await dropRepository.find({
        where: { id: In(configuredIds), drop_type: 0, disabled: false },
      });
      if (configuredItems.length > 0) {
        return configuredItems[0];
      }
    }

    return this.findDefaultFragmentItem(manager);
  }

  private async findCultivationFragmentItem(
    manager: EntityManager,
    rarity: CardRarity,
  ): Promise<DropItem> {
    if (rarity === "UR") {
      return this.findDefaultFragmentItem(manager);
    }
    return this.findRarityFragmentItem(manager, rarity);
  }

  private async findRarityFragmentItem(
    manager: EntityManager,
    rarity: CardRarity,
  ): Promise<DropItem> {
    if (rarity === "UR") {
      throw new Error("UR卡片没有合成碎片");
    }
    const targetName = `${rarity}碎片`;
    const fragmentItems = await manager.getRepository(DropItem).find({
      where: { drop_type: 0, disabled: false },
    });
    const candidates = fragmentItems
      .filter(
        (item) =>
          this.normalizeFragmentName(item.drop_name) ===
          this.normalizeFragmentName(targetName),
      )
      .sort((a, b) => {
        const aExact = String(a.drop_name || "").trim() === targetName;
        const bExact = String(b.drop_name || "").trim() === targetName;
        if (aExact !== bExact) {
          return aExact ? -1 : 1;
        }
        return Number(a.id || 0) - Number(b.id || 0);
      });
    const fragmentItem = candidates[0];
    if (!fragmentItem) {
      throw new Error(`${targetName}不存在或已禁用`);
    }
    return fragmentItem;
  }

  private async findDefaultFragmentItem(
    manager: EntityManager,
  ): Promise<DropItem> {
    const dropRepository = manager.getRepository(DropItem);
    const defaultFragmentItem = await dropRepository.findOne({
      where: { drop_type: 0, disabled: false, default_fragment: true },
    });
    if (defaultFragmentItem) {
      return defaultFragmentItem;
    }

    const fragmentItem = await dropRepository.findOne({
      where: { drop_type: 0, disabled: false },
    });
    if (!fragmentItem) {
      throw new Error("卡片碎片物品不存在");
    }
    return fragmentItem;
  }

  private normalizeFragmentName(name: string): string {
    return String(name || "").replace(/\s+/g, "");
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

  private getRequiredFragments(rarity: CardRarity): number {
    switch (rarity) {
      case "N":
        return 80;
      case "R":
        return 160;
      case "SR":
        return 320;
      case "SSR":
        return 1000;
      case "UR":
        throw new Error("不能合成UR卡片");
    }
  }

  private getDecomposeFragmentRange(rarity: CardRarity): {
    min: number;
    max: number;
  } {
    switch (rarity) {
      case "N":
        return { min: 1, max: 10 };
      case "R":
        return { min: 10, max: 20 };
      case "SR":
        return { min: 20, max: 40 };
      case "SSR":
        return { min: 40, max: 80 };
      case "UR":
        throw new Error("UR卡片不可以分解");
    }
  }
}
