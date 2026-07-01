import { Injectable, Optional } from "@nestjs/common";
import { randomUUID } from "crypto";
import { DataSource, EntityManager, FindOptionsWhere, In, Like } from "typeorm";
import { AchievementService } from "src/achievement/achievement.service";
import { CardItem } from "src/entity/card.entity";
import { DropItem } from "src/entity/drop.entity";
import { RedeemRewards } from "src/entity/redeemCode.entity";
import { ShopProduct, ShopCurrencyType } from "src/entity/shopProduct.entity";
import {
  ShopPurchaseRecord,
  ShopPurchaseStatus,
} from "src/entity/shopPurchaseRecord.entity";
import { User } from "src/entity/user.entity";
import { PointLedgerService } from "src/point-ledger/point-ledger.service";
import { RechargeService } from "src/recharge/recharge.service";
import { RewardService } from "src/reward/reward.service";

export interface BuyShopProductInput {
  count?: number;
  requestId?: string;
}

export interface ShopProductAdminInput {
  name?: string;
  description?: string;
  enabled?: boolean;
  currency_type?: ShopCurrencyType;
  price?: number;
  rewards?: RedeemRewards;
  total_limit?: number | null;
  user_limit?: number | null;
  starts_at?: Date | string | null;
  ends_at?: Date | string | null;
  sort_order?: number;
}

export interface ShopPageQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  uid?: string;
  productId?: number;
  status?: ShopPurchaseStatus;
}

const SHOP_CURRENCY_LABELS: Record<ShopCurrencyType, string> = {
  star_coin: "星穹币",
  fishpi_point: "鱼排积分",
};

@Injectable()
export class ShopMallService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly rewardService: RewardService,
    private readonly pointLedgerService: PointLedgerService,
    private readonly rechargeService: RechargeService,
    @Optional()
    private readonly achievementService?: AchievementService,
  ) {}

  async listProducts(uid: string) {
    return this.dataSource.transaction(async (manager) => {
      const user = await manager.getRepository(User).findOne({ where: { uid } });
      if (!user) {
        throw new Error("用户不存在");
      }

      const products = await manager.getRepository(ShopProduct).find({
        where: { enabled: true, delete_flag: false },
        order: { sort_order: "ASC", id: "DESC" },
      });
      const visibleProducts = products.filter((product) =>
        this.isWithinTimeRange(product),
      );
      if (visibleProducts.length === 0) {
        return [];
      }

      const usageMap = await this.loadUsageMap(
        manager,
        uid,
        visibleProducts.map((product) => product.id),
      );
      const rewardLookup = await this.loadRewardLookup(manager, visibleProducts);
      const fishpiAvailable = await this.isFishpiPaymentAvailable();

      return visibleProducts.map((product) => {
        const usedByUser = usageMap.get(product.id) || 0;
        const reason = this.getUnavailableReason(
          product,
          usedByUser,
          1,
          user,
          fishpiAvailable,
        );
        return {
          id: product.id,
          name: product.name,
          description: product.description || "",
          currencyType: product.currency_type,
          currencyLabel: SHOP_CURRENCY_LABELS[product.currency_type],
          price: product.price,
          rewards: this.decorateRewards(product.rewards, rewardLookup),
          remaining: this.remaining(product),
          usedByUser,
          userLimit: product.user_limit ?? null,
          startsAt: product.starts_at ?? null,
          endsAt: product.ends_at ?? null,
          canBuy: reason === "",
          unavailableReason: reason,
        };
      });
    });
  }

  async buy(uid: string, productId: number, input: BuyShopProductInput) {
    const count = this.normalizeCount(input.count);
    const requestId = this.normalizeRequestId(input.requestId);
    const existing = await this.findExistingPurchase(uid, requestId);
    if (existing) {
      return this.handleExistingPurchase(existing);
    }

    const product = await this.dataSource
      .getRepository(ShopProduct)
      .findOne({ where: { id: productId, delete_flag: false } });
    if (!product) {
      throw new Error("商品不存在");
    }

    if (product.currency_type === "fishpi_point") {
      return this.buyWithFishpiPoint(uid, product, count, requestId);
    }
    return this.buyWithStarCoin(uid, product, count, requestId);
  }

  async listAdminProducts(query: ShopPageQuery) {
    const { page, pageSize } = this.normalizePage(query);
    const where = query.keyword
      ? [
          { name: Like(`%${query.keyword}%`), delete_flag: false },
          { description: Like(`%${query.keyword}%`), delete_flag: false },
        ]
      : { delete_flag: false };
    const [list, total] = await this.dataSource
      .getRepository(ShopProduct)
      .findAndCount({
        where,
        order: { sort_order: "ASC", id: "DESC" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      });
    return { list, total, page, pageSize };
  }

  async getAdminProduct(id: number) {
    const product = await this.dataSource.getRepository(ShopProduct).findOne({
      where: { id },
    });
    if (!product || product.delete_flag) {
      throw new Error("商品不存在");
    }
    return product;
  }

  async createAdminProduct(body: ShopProductAdminInput) {
    const normalized = await this.normalizeProductInput(body);
    const entity = this.dataSource.getRepository(ShopProduct).create({
      ...normalized,
      used_count: 0,
      delete_flag: false,
    });
    return this.dataSource.getRepository(ShopProduct).save(entity);
  }

  async updateAdminProduct(id: number, body: ShopProductAdminInput) {
    const product = await this.getAdminProduct(id);
    const normalized = await this.normalizeProductInput({
      ...product,
      ...body,
      enabled:
        body.enabled === undefined || body.enabled === null
          ? product.enabled
          : body.enabled,
    });
    if (
      normalized.total_limit !== null &&
      normalized.total_limit !== undefined &&
      product.used_count > normalized.total_limit
    ) {
      throw new Error("总库存不能小于已售");
    }
    Object.assign(product, normalized);
    return this.dataSource.getRepository(ShopProduct).save(product);
  }

  async deleteAdminProduct(id: number) {
    const product = await this.getAdminProduct(id);
    product.enabled = false;
    product.delete_flag = true;
    await this.dataSource.getRepository(ShopProduct).save(product);
    return { deleted: true };
  }

  async listAdminPurchases(query: ShopPageQuery) {
    const { page, pageSize } = this.normalizePage(query);
    const where: FindOptionsWhere<ShopPurchaseRecord> = {};
    if (query.uid) {
      where.uid = query.uid;
    }
    if (query.productId !== undefined) {
      where.product_id = query.productId;
    }
    if (query.status) {
      where.status = query.status;
    }
    const [list, total] = await this.dataSource
      .getRepository(ShopPurchaseRecord)
      .findAndCount({
        where,
        order: { createdAt: "DESC", id: "DESC" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      });
    return {
      list: await this.attachUserNames(list),
      total,
      page,
      pageSize,
    };
  }

  async getAdminPurchase(id: number) {
    const record = await this.dataSource
      .getRepository(ShopPurchaseRecord)
      .findOne({ where: { id } });
    if (!record) {
      throw new Error("购买记录不存在");
    }
    const [view] = await this.attachUserNames([record]);
    return view;
  }

  private async buyWithStarCoin(
    uid: string,
    product: ShopProduct,
    count: number,
    requestId: string,
  ) {
    const result = await this.dataSource.transaction(async (manager) => {
      const productRepository = manager.getRepository(ShopProduct);
      const purchaseRepository = manager.getRepository(ShopPurchaseRecord);
      const userRepository = manager.getRepository(User);

      const lockedProduct = await productRepository.findOne({
        where: { id: product.id, delete_flag: false },
        lock: { mode: "pessimistic_write" },
      });
      if (!lockedProduct) {
        throw new Error("商品不存在");
      }
      const user = await userRepository.findOne({
        where: { uid },
        lock: { mode: "pessimistic_write" },
      });
      if (!user) {
        throw new Error("用户不存在");
      }
      const usedByUser = await this.getUserUsageCount(
        manager,
        uid,
        lockedProduct.id,
      );
      const reason = this.getUnavailableReason(
        lockedProduct,
        usedByUser,
        count,
        user,
        true,
      );
      if (reason) {
        throw new Error(reason);
      }

      const costAmount = lockedProduct.price * count;
      const rewardSnapshot = this.scaleRewards(lockedProduct.rewards, count);
      const pointBefore = Number(user.point || 0);
      const record = await purchaseRepository.save(
        purchaseRepository.create({
          request_id: requestId,
          product_id: lockedProduct.id,
          product_name: lockedProduct.name,
          uid,
          fishpi_user_name: user.name || null,
          count,
          currency_type: "star_coin",
          unit_price: lockedProduct.price,
          cost_amount: costAmount,
          reward_snapshot: rewardSnapshot,
          status: "pending",
          balance_before: pointBefore,
          balance_after: pointBefore,
          third_party_response: null,
          failure_reason: null,
        }),
      );

      await this.pointLedgerService.applyChange(manager, user, -costAmount, {
        sourceType: "shop_buy",
        sourceId: record.id,
        title: `商城购买：${lockedProduct.name}`,
        metadata: {
          productId: lockedProduct.id,
          productName: lockedProduct.name,
          count,
          currencyType: lockedProduct.currency_type,
          costAmount,
        },
      });

      await this.rewardService.grantRewards(manager, user, rewardSnapshot, {
        sourceType: "shop_reward",
        sourceId: record.id,
        title: `商城奖励：${lockedProduct.name}`,
        metadata: {
          productId: lockedProduct.id,
          productName: lockedProduct.name,
          count,
        },
      });

      lockedProduct.used_count = Number(lockedProduct.used_count || 0) + count;
      await productRepository.save(lockedProduct);
      record.status = "success";
      record.balance_after = Number(user.point || 0);
      await purchaseRepository.save(record);
      await this.achievementService?.evaluateAndUnlock(manager, uid);
      return record;
    });

    return this.toPurchaseResult(
      result,
      await this.loadRewardLookupForRewards(result.reward_snapshot),
    );
  }

  private async buyWithFishpiPoint(
    uid: string,
    product: ShopProduct,
    count: number,
    requestId: string,
  ) {
    const purchaseRepository = this.dataSource.getRepository(ShopPurchaseRecord);
    const pending = await purchaseRepository.save(
      purchaseRepository.create({
        request_id: requestId,
        product_id: product.id,
        product_name: product.name,
        uid,
        fishpi_user_name: null,
        count,
        currency_type: "fishpi_point",
        unit_price: product.price,
        cost_amount: product.price * count,
        reward_snapshot: this.scaleRewards(product.rewards, count),
        status: "pending",
        balance_before: 0,
        balance_after: 0,
        third_party_response: null,
        failure_reason: null,
      }),
    );

    let thirdPartyResponse: any = null;
    let fishpiBefore = 0;
    let fishpiAfter = 0;
    try {
      const record = await this.dataSource.transaction(async (manager) => {
        const productRepository = manager.getRepository(ShopProduct);
        const purchaseTxRepository = manager.getRepository(ShopPurchaseRecord);
        const userRepository = manager.getRepository(User);

        const lockedRecord = await purchaseTxRepository.findOne({
          where: { id: pending.id },
          lock: { mode: "pessimistic_write" },
        });
        if (!lockedRecord) {
          throw new Error("购买记录不存在");
        }
        const lockedProduct = await productRepository.findOne({
          where: { id: product.id, delete_flag: false },
          lock: { mode: "pessimistic_write" },
        });
        if (!lockedProduct) {
          throw new Error("商品不存在");
        }
        const user = await userRepository.findOne({
          where: { uid },
          lock: { mode: "pessimistic_write" },
        });
        if (!user) {
          throw new Error("用户不存在");
        }
        const usedByUser = await this.getUserUsageCount(
          manager,
          uid,
          lockedProduct.id,
        );
        const reason = this.getUnavailableReason(
          lockedProduct,
          usedByUser,
          count,
          user,
          true,
        );
        if (reason) {
          throw new Error(reason);
        }

        const costAmount = lockedProduct.price * count;
        thirdPartyResponse = await this.rechargeService.deductFishpiPoints(
          uid,
          costAmount,
          {
            localAmount: costAmount,
            memo: `商城购买 ${lockedProduct.name} x${count}`,
            unavailableMessage: "购买暂不可用",
          },
        );
        fishpiBefore = Number(thirdPartyResponse?.balance?.userPoint || 0);
        fishpiAfter = fishpiBefore - costAmount;

        const rewardSnapshot = this.scaleRewards(lockedProduct.rewards, count);
        await this.rewardService.grantRewards(manager, user, rewardSnapshot, {
          sourceType: "shop_reward",
          sourceId: lockedRecord.id,
          title: `商城奖励：${lockedProduct.name}`,
          metadata: {
            productId: lockedProduct.id,
            productName: lockedProduct.name,
            count,
          },
        });

        lockedProduct.used_count = Number(lockedProduct.used_count || 0) + count;
        await productRepository.save(lockedProduct);
        lockedRecord.product_name = lockedProduct.name;
        lockedRecord.fishpi_user_name = user.name || null;
        lockedRecord.count = count;
        lockedRecord.currency_type = "fishpi_point";
        lockedRecord.unit_price = lockedProduct.price;
        lockedRecord.cost_amount = costAmount;
        lockedRecord.reward_snapshot = rewardSnapshot;
        lockedRecord.status = "success";
        lockedRecord.balance_before = fishpiBefore;
        lockedRecord.balance_after = fishpiAfter;
        lockedRecord.third_party_response =
          this.sanitizeThirdPartyResponse(thirdPartyResponse);
        lockedRecord.failure_reason = null;
        await purchaseTxRepository.save(lockedRecord);
        await this.achievementService?.evaluateAndUnlock(manager, uid);
        return lockedRecord;
      });

      const userAfter = await this.dataSource
        .getRepository(User)
        .findOne({ where: { uid } });
      return {
        ...(await this.toPurchaseResult(
          record,
          await this.loadRewardLookupForRewards(record.reward_snapshot),
        )),
        pointAfter: userAfter?.point,
        fishpiPointAfter: fishpiAfter,
      };
    } catch (error) {
      await this.markPurchase(
        pending.id,
        thirdPartyResponse ? "local_failed" : "failed",
        {
          third_party_response: thirdPartyResponse
            ? this.sanitizeThirdPartyResponse(thirdPartyResponse)
            : this.getThirdPartyErrorResponse(error),
          failure_reason: this.getErrorMessage(error),
          balance_before: fishpiBefore,
          balance_after: fishpiAfter,
        },
      );
      if (thirdPartyResponse) {
        throw new Error("购买异常");
      }
      throw error;
    }
  }

  private async normalizeProductInput(body: ShopProductAdminInput) {
    const name = String(body.name || "").trim();
    if (!name) {
      throw new Error("商品名称不能为空");
    }
    const currencyType = this.normalizeCurrencyType(body.currency_type);
    const price = this.normalizePositiveInteger(body.price, "价格无效");
    const rewards = this.rewardService.normalizeRewards(
      body.rewards,
      "奖励不能为空",
    );
    await Promise.all([
      this.rewardService.assertRewardItemsAvailable(
        this.dataSource.getRepository(DropItem),
        rewards.items,
      ),
      this.rewardService.assertRewardCardsAvailable(
        this.dataSource.getRepository(CardItem),
        rewards.cards || [],
      ),
    ]);
    if (currencyType === "star_coin" && Number(rewards.points || 0) >= price) {
      throw new Error("星穹币奖励不能高于价格");
    }

    const startsAt = this.parseOptionalDate(body.starts_at);
    const endsAt = this.parseOptionalDate(body.ends_at);
    if (startsAt && endsAt && startsAt.getTime() >= endsAt.getTime()) {
      throw new Error("结束时间必须晚于开始时间");
    }

    return {
      name,
      description: String(body.description || "").trim(),
      enabled: body.enabled !== false,
      currency_type: currencyType,
      price,
      rewards,
      total_limit: this.normalizeNullablePositiveInt(
        body.total_limit,
        "总库存无效",
      ),
      user_limit: this.normalizeNullablePositiveInt(
        body.user_limit,
        "单人限购无效",
      ),
      starts_at: startsAt,
      ends_at: endsAt,
      sort_order: this.normalizeNonNegativeInteger(
        body.sort_order,
        "排序无效",
      ),
    };
  }

  private getUnavailableReason(
    product: ShopProduct,
    usedByUser: number,
    count: number,
    user: User,
    fishpiAvailable: boolean,
  ) {
    if (!product.enabled) {
      return "已下架";
    }
    if (product.starts_at && product.starts_at.getTime() > Date.now()) {
      return "未开始";
    }
    if (product.ends_at && product.ends_at.getTime() < Date.now()) {
      return "已结束";
    }
    if (
      product.total_limit !== null &&
      product.total_limit !== undefined &&
      Number(product.used_count || 0) + count > product.total_limit
    ) {
      return "库存不足";
    }
    if (
      product.user_limit !== null &&
      product.user_limit !== undefined &&
      usedByUser + count > product.user_limit
    ) {
      return "已达上限";
    }
    const costAmount = Number(product.price || 0) * count;
    if (product.currency_type === "star_coin" && Number(user.point || 0) < costAmount) {
      return "余额不足";
    }
    if (product.currency_type === "fishpi_point" && !fishpiAvailable) {
      return "暂不可用";
    }
    return "";
  }

  private async loadUsageMap(
    manager: EntityManager,
    uid: string,
    productIds: number[],
  ) {
    if (productIds.length === 0) {
      return new Map<number, number>();
    }
    const records = await manager.getRepository(ShopPurchaseRecord).find({
      where: {
        uid,
        product_id: In(productIds),
        status: "success",
      },
    });
    return records.reduce((result, record) => {
      result.set(
        record.product_id,
        (result.get(record.product_id) || 0) + Number(record.count || 0),
      );
      return result;
    }, new Map<number, number>());
  }

  private async getUserUsageCount(
    manager: EntityManager,
    uid: string,
    productId: number,
  ) {
    const records = await manager.getRepository(ShopPurchaseRecord).find({
      where: { uid, product_id: productId, status: "success" },
    });
    return records.reduce((sum, record) => sum + Number(record.count || 0), 0);
  }

  private async findExistingPurchase(uid: string, requestId: string) {
    return this.dataSource.getRepository(ShopPurchaseRecord).findOne({
      where: { uid, request_id: requestId },
    });
  }

  private async handleExistingPurchase(record: ShopPurchaseRecord) {
    if (record.status === "success") {
      return this.toPurchaseResult(
        record,
        await this.loadRewardLookupForRewards(record.reward_snapshot),
      );
    }
    if (record.status === "pending") {
      throw new Error("处理中");
    }
    if (record.status === "local_failed") {
      throw new Error("购买异常");
    }
    throw new Error(record.failure_reason || "购买失败");
  }

  private async markPurchase(
    id: number,
    status: ShopPurchaseStatus,
    updates: Partial<ShopPurchaseRecord>,
  ) {
    const repository = this.dataSource.getRepository(ShopPurchaseRecord);
    const record = await repository.findOne({ where: { id } });
    if (!record) {
      return;
    }
    Object.assign(record, updates, { status });
    await repository.save(record);
  }

  private toPurchaseResult(
    record: ShopPurchaseRecord,
    lookup: RewardLookup,
  ) {
    return {
      purchaseId: record.id,
      productId: record.product_id,
      count: record.count,
      currencyType: record.currency_type,
      costAmount: record.cost_amount,
      rewards: this.decorateRewards(record.reward_snapshot, lookup),
      pointAfter:
        record.currency_type === "star_coin"
          ? record.balance_after
          : undefined,
      fishpiPointAfter:
        record.currency_type === "fishpi_point"
          ? record.balance_after
          : undefined,
    };
  }

  private async attachUserNames(records: ShopPurchaseRecord[]) {
    const uids = [...new Set(records.map((record) => record.uid).filter(Boolean))];
    if (uids.length === 0) {
      return records;
    }
    const users = await this.dataSource
      .getRepository(User)
      .find({ where: { uid: In(uids) } });
    const userMap = new Map(users.map((user) => [user.uid, user]));
    return records.map((record) => ({
      ...record,
      userName:
        userMap.get(record.uid)?.nickname ||
        userMap.get(record.uid)?.name ||
        record.fishpi_user_name ||
        "",
    }));
  }

  private scaleRewards(rewards: RedeemRewards, count: number): RedeemRewards {
    return {
      points: Number(rewards.points || 0) * count,
      items: (rewards.items || []).map((item) => ({
        itemId: Number(item.itemId),
        num: Number(item.num) * count,
      })),
      ...((rewards.cards || []).length > 0
        ? {
            cards: (rewards.cards || []).map((card) => ({
              cardId: Number(card.cardId),
              rarity: String(card.rarity || "").trim().toUpperCase(),
              num: Number(card.num) * count,
            })),
          }
        : {}),
    };
  }

  private async loadRewardLookup(
    manager: EntityManager,
    products: ShopProduct[],
  ): Promise<RewardLookup> {
    const rewards = products.map((product) => product.rewards);
    return this.loadRewardLookupFromRewards(manager, rewards);
  }

  private async loadRewardLookupForRewards(
    rewards: RedeemRewards,
  ): Promise<RewardLookup> {
    return this.loadRewardLookupFromRewards(this.dataSource.manager, [rewards]);
  }

  private async loadRewardLookupFromRewards(
    manager: EntityManager,
    rewardsList: RedeemRewards[],
  ): Promise<RewardLookup> {
    const itemIds = [
      ...new Set(
        rewardsList.flatMap((rewards) =>
          (rewards.items || []).map((item) => Number(item.itemId)),
        ),
      ),
    ].filter((id) => Number.isInteger(id) && id > 0);
    const cardIds = [
      ...new Set(
        rewardsList.flatMap((rewards) =>
          (rewards.cards || []).map((card) => Number(card.cardId)),
        ),
      ),
    ].filter((id) => Number.isInteger(id) && id > 0);
    const [items, cards] = await Promise.all([
      itemIds.length
        ? manager.getRepository(DropItem).find({ where: { id: In(itemIds) } })
        : Promise.resolve([]),
      cardIds.length
        ? manager.getRepository(CardItem).find({ where: { id: In(cardIds) } })
        : Promise.resolve([]),
    ]);
    return {
      items: new Map(items.map((item) => [item.id, item.drop_name])),
      cards: new Map(cards.map((card) => [card.id, card.card_name])),
    };
  }

  private decorateRewards(
    rewards: RedeemRewards,
    lookup: RewardLookup,
  ): RedeemRewards {
    return {
      points: Number(rewards.points || 0),
      items: (rewards.items || []).map((item) => ({
        ...item,
        itemName: lookup.items.get(Number(item.itemId)) || "",
      })),
      ...((rewards.cards || []).length > 0
        ? {
            cards: (rewards.cards || []).map((card) => ({
              ...card,
              cardName: lookup.cards.get(Number(card.cardId)) || "",
            })),
          }
        : {}),
    };
  }

  private remaining(product: ShopProduct) {
    if (product.total_limit === null || product.total_limit === undefined) {
      return null;
    }
    return Math.max(0, product.total_limit - Number(product.used_count || 0));
  }

  private isWithinTimeRange(product: ShopProduct) {
    const now = Date.now();
    if (product.starts_at && product.starts_at.getTime() > now) {
      return false;
    }
    if (product.ends_at && product.ends_at.getTime() < now) {
      return false;
    }
    return true;
  }

  private async isFishpiPaymentAvailable() {
    try {
      const config = await this.rechargeService.ensureConfig();
      return Boolean(String(config.gold_finger_key || "").trim());
    } catch {
      return false;
    }
  }

  private normalizeCurrencyType(value: unknown): ShopCurrencyType {
    const text = String(value || "star_coin").trim();
    if (text === "star_coin" || text === "fishpi_point") {
      return text;
    }
    throw new Error("支付方式无效");
  }

  private normalizeCount(value: unknown) {
    const count =
      value === undefined || value === null || value === "" ? 1 : Number(value);
    if (!Number.isInteger(count) || count <= 0 || count > 99) {
      throw new Error("数量无效");
    }
    return count;
  }

  private normalizeRequestId(value?: string) {
    const requestId = String(value || randomUUID()).trim();
    if (!requestId) {
      throw new Error("流水号不能为空");
    }
    if (requestId.length > 80) {
      throw new Error("流水号过长");
    }
    return requestId;
  }

  private normalizePositiveInteger(value: unknown, message: string) {
    const next = Number(value);
    if (!Number.isInteger(next) || next <= 0) {
      throw new Error(message);
    }
    return next;
  }

  private normalizeNonNegativeInteger(value: unknown, message: string) {
    const next = Number(value || 0);
    if (!Number.isInteger(next) || next < 0) {
      throw new Error(message);
    }
    return next;
  }

  private normalizeNullablePositiveInt(value: unknown, message: string) {
    if (value === undefined || value === null || value === "") {
      return null;
    }
    const next = Number(value);
    if (!Number.isInteger(next) || next <= 0) {
      throw new Error(message);
    }
    return next;
  }

  private parseOptionalDate(value: unknown): Date | null {
    if (value === undefined || value === null || value === "") {
      return null;
    }
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) {
      throw new Error("时间无效");
    }
    return date;
  }

  private normalizePage(query: ShopPageQuery) {
    const page = Number(query.page || 1);
    const pageSize = Number(query.pageSize || 20);
    return {
      page: Number.isInteger(page) && page > 0 ? page : 1,
      pageSize:
        Number.isInteger(pageSize) && pageSize > 0
          ? Math.min(pageSize, 100)
          : 20,
    };
  }

  private sanitizeThirdPartyResponse(value: unknown) {
    if (!value) {
      return null;
    }
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return { message: String(value) };
    }
  }

  private getThirdPartyErrorResponse(error: unknown) {
    return {
      message: this.getErrorMessage(error),
    };
  }

  private getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "购买失败";
  }
}

interface RewardLookup {
  items: Map<number, string>;
  cards: Map<number, string>;
}
