import { randomInt } from "crypto";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, In, Repository } from "typeorm";
import { v4 as uuidv4 } from "uuid";
import { CardItem } from "src/entity/card.entity";
import { PoolInfo } from "src/entity/pool.entity";
import { User } from "src/entity/user.entity";
import { UserCard } from "src/entity/userCard.entity";
import { UserHistory } from "src/entity/history.entity";
import { DropItem } from "src/entity/drop.entity";
import { UserInventory } from "src/entity/inventory.entity";
import { UserGachaPity } from "src/entity/userGachaPity.entity";
import {
  CardRarity,
  GachaConfig,
  GachaResult,
  PitySystemConfig,
} from "src/types/api";
import { GachaConfigService } from "./gacha-config.service";

const RARITY_ORDER: CardRarity[] = ["N", "R", "SR", "SSR", "UR"];
const MAX_DRAW_COUNT = 100;

type RarityCounts = Record<CardRarity, number>;
type CardPoolByRarity = Record<CardRarity, CardItem[]>;

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
    if (count > MAX_DRAW_COUNT) {
      throw new Error(`单次最多只能抽取${MAX_DRAW_COUNT}次`);
    }

    const serverConfig = this.resolveServerConfig(poolId);
    const effectivePoolId = serverConfig.poolId!;

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

      const probabilities = this.getProbabilities(serverConfig);
      const cards = await cardRepository.find({
        where: { pool: effectivePoolId },
      });
      const cardsByRarity = this.groupCardsByRarity(cards);
      this.assertPoolCanDraw(cardsByRarity, probabilities, effectivePoolId);

      const user = await this.findOrCreateUser(manager, uid);
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

        const userCard = userCardRepository.create({
          uid,
          card_id: card.id.toString(),
          card_level: rarity,
          can_sell: true,
          can_lottery: true,
          card_uuid: uuidv4(),
          delete_flag: false,
        });
        userCards.push(userCard);
        rarityCounts[rarity] += 1;
        this.updatePityCounters(pity, rarity);

        results.push({
          cardId: card.id,
          cardName: card.card_name,
          cardDesc: card.card_desc,
          rarity,
          cardType: card.card_type,
          poolId: card.pool,
          isUp,
          isPity,
          userCardUuid: userCard.card_uuid,
        });
      }

      await userCardRepository.save(userCards);
      this.applyUserRarityCounts(user, rarityCounts);
      await manager.getRepository(User).save(user);
      await pityRepository.save(pity);
      await this.saveUserHistoryToDB(userHistoryRepository, uid, results);

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

    return {
      uid,
      totalDraws,
      cardCounts: {
        N: user?.card_count_n || 0,
        R: user?.card_count_r || 0,
        SR: user?.card_count_sr || 0,
        SSR: user?.card_count_ssr || 0,
        UR: user?.card_count_ur || 0,
      },
      pity: pityStates.map((pity) => ({
        poolId: pity.pool_id,
        drawsSinceSR: pity.draws_since_sr,
        drawsSinceSSR: pity.draws_since_ssr,
        drawsSinceUR: pity.draws_since_ur,
      })),
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
   * 获取所有卡池列表
   */
  async getAllPools(): Promise<PoolInfo[]> {
    return this.poolRepository.find();
  }

  /**
   * 根据卡池ID获取卡池信息
   */
  async getPoolById(poolId: number): Promise<PoolInfo | null> {
    return this.poolRepository.findOne({
      where: { id: this.resolvePoolId(poolId) },
    });
  }

  /**
   * 根据卡池ID获取该卡池的所有卡片
   */
  async getCardsByPool(poolId: number): Promise<CardItem[]> {
    return this.cardRepository.find({
      where: { pool: this.resolvePoolId(poolId) },
    });
  }

  /**
   * 根据卡池类型获取卡池列表
   * @param cardType 0 常驻卡池 1 活动卡池 2 限定卡池
   */
  async getPoolsByType(cardType: number): Promise<PoolInfo[]> {
    return this.poolRepository.find({ where: { card_type: cardType } });
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

    const whereConditions: any = {
      uid,
      delete_flag: false,
    };

    const filteredCardIds = await this.getFilteredCardIds(rarity, poolId);
    if ((rarity || poolId !== undefined) && filteredCardIds.length === 0) {
      return this.emptyUserCardsResult(page, pageSize);
    }

    if (filteredCardIds.length > 0) {
      whereConditions.card_id = In(filteredCardIds.map((id) => id.toString()));
    }

    const total = await this.userCardRepository.count({
      where: whereConditions,
    });
    if (total === 0) {
      return this.emptyUserCardsResult(page, pageSize);
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
    const user = await this.userRepository.findOne({ where: { uid } });
    if (!user) {
      throw new Error("用户不存在");
    }

    const userInventories = await this.inventoryRepository.find({
      where: { user_id: user.id },
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

    const list = userCards
      .map((userCard) => {
        const card = cards.find((c) => c.id === parseInt(userCard.card_id));
        if (!card) {
          return null;
        }

        return {
          id: userCard.id,
          uuid: userCard.card_uuid,
          cardName: card.card_name,
          cardDesc: card.card_desc,
          cardLevel:
            userCard.card_level || this.getHighestRarity(card.card_level),
          cardType: card.card_type,
          poolId: card.pool,
          canSell: userCard.can_sell,
          canLottery: userCard.can_lottery,
          obtainedAt: userCard.createdAt,
        };
      })
      .filter((item) => item !== null);

    return {
      list,
      dropItems: Array.from(itemInfoMap.values()),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 合成卡片
   */
  async synthesizeCard(uid: string, cardId: number) {
    return this.dataSource.transaction(async (manager) => {
      const cardRepository = manager.getRepository(CardItem);
      const inventoryRepository = manager.getRepository(UserInventory);
      const userCardRepository = manager.getRepository(UserCard);

      const card = await cardRepository.findOne({ where: { id: cardId } });
      if (!card) {
        throw new Error("卡片不存在");
      }

      const rarity = this.getHighestRarity(card.card_level);
      if (rarity === "UR") {
        throw new Error("不能合成UR卡片");
      }

      const requiredFragments = this.getRequiredFragments(rarity);
      const fragmentItem = await this.findFragmentItem(manager, card);
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

      return {
        data: {
          card_name: card.card_name,
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
      const inventoryRepository = manager.getRepository(UserInventory);
      const userCard = await userCardRepository.findOne({
        where: { uid, card_uuid: cardUuid, delete_flag: false },
        lock: { mode: "pessimistic_write" },
      });

      if (!userCard) {
        throw new Error("用户没有这张卡片");
      }

      const card = await manager.getRepository(CardItem).findOne({
        where: { id: parseInt(userCard.card_id) },
      });
      if (!card) {
        throw new Error("卡片不存在");
      }

      const rarity =
        (userCard.card_level as CardRarity | undefined) ||
        this.getHighestRarity(card.card_level);
      if (rarity === "UR") {
        throw new Error("UR卡片不可以分解");
      }

      const fragmentRange = this.getDecomposeFragmentRange(rarity);
      const fragmentCount = randomInt(fragmentRange.min, fragmentRange.max + 1);
      const fragmentItem = await this.findFragmentItem(manager, card);
      const user = await this.getExistingUser(manager, uid);

      userCard.delete_flag = true;
      await userCardRepository.save(userCard);

      let userInventory = await inventoryRepository.findOne({
        where: { user_id: user.id, item_id: fragmentItem.id },
        lock: { mode: "pessimistic_write" },
      });

      if (!userInventory) {
        userInventory = inventoryRepository.create({
          user_id: user.id,
          item_id: fragmentItem.id,
          num: fragmentCount,
        });
      } else {
        userInventory.num += fragmentCount;
      }
      await inventoryRepository.save(userInventory);

      return {
        data: {
          card_id: parseInt(userCard.card_id),
          card_name: card.card_name,
          card_uuid: cardUuid,
          fragments_gained: fragmentCount,
        },
        msg: "分解成功",
      };
    });
  }

  private resolveServerConfig(poolId?: number): GachaConfig {
    if (poolId === undefined || poolId === null || poolId === 0) {
      return this.gachaConfigService.getDefaultConfig();
    }

    const config = this.gachaConfigService.getConfigByPoolId(poolId);
    return {
      ...config,
      poolId,
    };
  }

  private resolvePoolId(poolId: number): number {
    return poolId === 0
      ? this.gachaConfigService.getDefaultConfig().poolId!
      : poolId;
  }

  private getProbabilities(config: GachaConfig): Record<string, number> {
    const probabilities =
      config.rarityProbabilities ||
      this.gachaConfigService.getDefaultConfig().rarityProbabilities!;
    if (!this.gachaConfigService.validateProbabilities(probabilities)) {
      throw new Error("服务端抽卡概率配置无效");
    }
    return probabilities;
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
      });
      return userRepository.save(user);
    }

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

  private async getFilteredCardIds(
    rarity?: string,
    poolId?: number,
  ): Promise<number[]> {
    if (!rarity && poolId === undefined) {
      return [];
    }

    const normalizedRarity = rarity ? this.normalizeRarity(rarity) : undefined;
    const cards = await this.cardRepository.find(
      poolId === undefined
        ? {}
        : { where: { pool: this.resolvePoolId(poolId) } },
    );

    return cards
      .filter(
        (card) =>
          !normalizedRarity || this.cardSupportsRarity(card, normalizedRarity),
      )
      .map((card) => card.id);
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

  private emptyUserCardsResult(page: number, pageSize: number) {
    return {
      list: [],
      dropItems: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
    };
  }

  private async findFragmentItem(
    manager: EntityManager,
    card: CardItem,
  ): Promise<DropItem> {
    const dropRepository = manager.getRepository(DropItem);
    const configuredIds = this.parseDropItemIds(card.drop_item);
    if (configuredIds.length > 0) {
      const configuredItems = await dropRepository.find({
        where: { id: In(configuredIds), drop_type: 0 },
      });
      if (configuredItems.length > 0) {
        return configuredItems[0];
      }
    }

    const fragmentItem = await dropRepository.findOne({
      where: { drop_type: 0 },
    });
    if (!fragmentItem) {
      throw new Error("卡片碎片物品不存在");
    }
    return fragmentItem;
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
