import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  Between,
  FindOptionsWhere,
  In,
  Like,
  ObjectLiteral,
  Repository,
} from "typeorm";
import { GachaConfigService } from "src/card/gacha-config.service";
import { ConfigurationService } from "src/config/configuration.service";
import { CardItem } from "src/entity/card.entity";
import { DropItem } from "src/entity/drop.entity";
import { UserHistory } from "src/entity/history.entity";
import { UserInventory } from "src/entity/inventory.entity";
import { PoolInfo } from "src/entity/pool.entity";
import { User } from "src/entity/user.entity";
import { UserGachaPity } from "src/entity/userGachaPity.entity";

export interface PageQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
}

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
    private readonly gachaConfigService: GachaConfigService,
    private readonly configService: ConfigurationService,
  ) {}

  async getMe(uid: string) {
    const user = await this.userRepository.findOne({ where: { uid } });
    return {
      user,
      adminByEnv: this.configService.adminUids.includes(uid),
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

  async listPools(query: PageQuery) {
    const { page, pageSize } = this.normalizePage(query);
    const where = query.keyword
      ? [
          { pool_name: Like(`%${query.keyword}%`) },
          { card_desc: Like(`%${query.keyword}%`) },
        ]
      : {};
    return this.findAndPage(this.poolRepository, where, page, pageSize);
  }

  async createPool(body: Partial<PoolInfo>) {
    this.assertRequired(body.pool_name, "卡池名称不能为空");
    this.assertRequired(body.card_desc, "卡池描述不能为空");
    const pool = this.poolRepository.create({
      pool_name: body.pool_name,
      card_desc: body.card_desc,
      card_type: Number(body.card_type || 0),
    });
    return this.poolRepository.save(pool);
  }

  async updatePool(id: number, body: Partial<PoolInfo>) {
    const pool = await this.mustFind(this.poolRepository, id, "卡池不存在");
    Object.assign(
      pool,
      this.pickDefined(body, ["pool_name", "card_desc", "card_type"]),
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

  async createCard(body: Partial<CardItem>) {
    this.assertRequired(body.card_name, "卡片名称不能为空");
    this.assertRequired(body.card_level, "卡片稀有度不能为空");
    const card = this.cardRepository.create({
      card_name: body.card_name,
      card_level: body.card_level,
      drop_item: body.drop_item || "",
      card_desc: body.card_desc || "",
      card_type: Number(body.card_type || 0),
      pool: Number(body.pool || 1),
    });
    return this.cardRepository.save(card);
  }

  async updateCard(id: number, body: Partial<CardItem>) {
    const card = await this.mustFind(this.cardRepository, id, "卡片不存在");
    Object.assign(
      card,
      this.pickDefined(body, [
        "card_name",
        "card_level",
        "drop_item",
        "card_desc",
        "card_type",
        "pool",
      ]),
    );
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
    return this.findAndPage(this.dropRepository, where, page, pageSize);
  }

  async createDropItem(body: Partial<DropItem>) {
    this.assertRequired(body.drop_name, "道具名称不能为空");
    const item = this.dropRepository.create({
      drop_name: body.drop_name,
      drop_desc: body.drop_desc || "",
      drop_type: Number(body.drop_type || 0),
      drop_item_type: Number(body.drop_item_type || 0),
      drop_item_value: Number(body.drop_item_value || 0),
    });
    return this.dropRepository.save(item);
  }

  async updateDropItem(id: number, body: Partial<DropItem>) {
    const item = await this.mustFind(this.dropRepository, id, "掉落物不存在");
    Object.assign(
      item,
      this.pickDefined(body, [
        "drop_name",
        "drop_desc",
        "drop_type",
        "drop_item_type",
        "drop_item_value",
      ]),
    );
    return this.dropRepository.save(item);
  }

  async deleteDropItem(id: number) {
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

  getGachaConfig() {
    return {
      pools: this.gachaConfigService.getAllPoolConfigs(),
      adminUids: this.configService.adminUids,
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

    return {
      ...result,
      list: result.list.map((inventory) => ({
        ...inventory,
        user: users.find((user) => user.id === inventory.user_id) || null,
        item: items.find((item) => item.id === inventory.item_id) || null,
      })),
    };
  }

  private normalizePage(query: PageQuery) {
    const page = Math.max(1, Number(query.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize || 20)));
    return { page, pageSize };
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
}
