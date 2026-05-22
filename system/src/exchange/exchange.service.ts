import { Injectable, Optional } from "@nestjs/common";
import { DataSource, In, Repository } from "typeorm";
import { DropItem } from "src/entity/drop.entity";
import {
  ExchangeCostItem,
  ExchangeShopItem,
} from "src/entity/exchangeShopItem.entity";
import { ExchangeShopUsage } from "src/entity/exchangeShopUsage.entity";
import { UserInventory } from "src/entity/inventory.entity";
import { RedeemRewardItem, RedeemRewards } from "src/entity/redeemCode.entity";
import { User } from "src/entity/user.entity";
import { PointLedgerService } from "src/point-ledger/point-ledger.service";
import { AchievementService } from "src/achievement/achievement.service";

@Injectable()
export class ExchangeService {
  constructor(
    private readonly dataSource: DataSource,
    @Optional()
    private readonly pointLedgerService?: PointLedgerService,
    @Optional()
    private readonly achievementService?: AchievementService,
  ) {}

  async listAvailableItems(uid: string) {
    return this.dataSource.transaction(async (manager) => {
      const userRepository = manager.getRepository(User);
      const shopRepository = manager.getRepository(ExchangeShopItem);
      const usageRepository = manager.getRepository(ExchangeShopUsage);
      const inventoryRepository = manager.getRepository(UserInventory);
      const dropRepository = manager.getRepository(DropItem);

      const user = await userRepository.findOne({ where: { uid } });
      if (!user) {
        throw new Error("用户不存在");
      }

      const shopItems = await shopRepository.find({
        where: { enabled: true, delete_flag: false },
        order: { sort_order: "ASC", id: "DESC" },
      });
      const visibleItems = shopItems.filter((item) =>
        this.isWithinTimeRange(item),
      );
      if (visibleItems.length === 0) {
        return [];
      }

      const [inventories, usages] = await Promise.all([
        inventoryRepository.find({ where: { user_id: user.id } }),
        usageRepository.find({
          where: {
            uid,
            shop_item_id: In(visibleItems.map((item) => item.id)),
          },
        }),
      ]);
      const inventoryMap = new Map(
        inventories.map((inventory) => [inventory.item_id, inventory.num]),
      );
      const usageMap = this.sumUsageByItem(usages);
      const dropItemMap = await this.loadRelatedDropItems(
        dropRepository,
        visibleItems,
      );

      return visibleItems.map((item) => {
        const costs = this.normalizeCosts(item.costs, true);
        const rewards = this.normalizeRewards(item.rewards, true);
        const usedByUser = usageMap.get(item.id) || 0;
        const unavailableReason =
          this.getConfigUnavailableReason(costs, rewards, dropItemMap) ||
          this.getUnavailableReason(item, costs, inventoryMap, usedByUser, 1);
        return {
          ...item,
          costs: this.enrichCosts(costs, dropItemMap),
          rewards: this.enrichRewards(rewards, dropItemMap),
          remaining:
            item.total_limit === null || item.total_limit === undefined
              ? null
              : Math.max(0, item.total_limit - (item.used_count || 0)),
          usedByUser,
          canExchange: unavailableReason === "",
          unavailableReason,
        };
      });
    });
  }

  async claim(uid: string, shopItemId: number, rawCount?: number) {
    const count = this.normalizeClaimCount(rawCount);

    return this.dataSource.transaction(async (manager) => {
      const shopRepository = manager.getRepository(ExchangeShopItem);
      const usageRepository = manager.getRepository(ExchangeShopUsage);
      const userRepository = manager.getRepository(User);
      const inventoryRepository = manager.getRepository(UserInventory);
      const dropRepository = manager.getRepository(DropItem);

      const shopItem = await shopRepository.findOne({
        where: { id: shopItemId, delete_flag: false },
        lock: { mode: "pessimistic_write" },
      });
      if (!shopItem) {
        throw new Error("兑换项不存在");
      }

      const user = await userRepository.findOne({
        where: { uid },
        lock: { mode: "pessimistic_write" },
      });
      if (!user) {
        throw new Error("用户不存在");
      }

      const costs = this.normalizeCosts(shopItem.costs);
      const rewards = this.normalizeRewards(shopItem.rewards);
      const [costItems, rewardItems] = await Promise.all([
        this.assertExchangeItemsAvailable(dropRepository, costs, "消耗物品"),
        this.assertExchangeItemsAvailable(
          dropRepository,
          rewards.items,
          "奖励物品",
        ),
      ]);
      const usageCount = await this.getUserUsageCount(
        usageRepository,
        shopItem.id,
        uid,
      );

      const inventoryMap = await this.loadAndLockInventories(
        inventoryRepository,
        user.id,
        costs.map((item) => item.itemId),
      );
      const unavailableReason = this.getUnavailableReason(
        shopItem,
        costs,
        new Map(
          [...inventoryMap.entries()].map(([itemId, inventory]) => [
            itemId,
            inventory.num,
          ]),
        ),
        usageCount,
        count,
      );
      if (unavailableReason) {
        throw new Error(unavailableReason);
      }

      const scaledCosts = this.scaleCosts(costs, count);
      const scaledRewards = this.scaleRewards(rewards, count);
      for (const cost of scaledCosts) {
        const inventory = inventoryMap.get(cost.itemId);
        if (!inventory || inventory.num < cost.num) {
          const itemName = costItems.get(cost.itemId)?.drop_name || cost.itemId;
          throw new Error(
            `物品不足: ${itemName}，需要${cost.num}，当前${inventory?.num || 0}`,
          );
        }
        inventory.num -= cost.num;
        await inventoryRepository.save(inventory);
      }

      if (scaledRewards.points > 0) {
        if (this.pointLedgerService) {
          await this.pointLedgerService.applyChange(
            manager,
            user,
            scaledRewards.points,
            {
              sourceType: "exchange_shop",
              sourceId: shopItem.id,
              title: `兑换商店奖励：${shopItem.name}`,
              metadata: {
                exchangeItemId: shopItem.id,
                exchangeItemName: shopItem.name,
                count,
              },
            },
          );
        } else {
          user.point = (user.point || 0) + scaledRewards.points;
          await userRepository.save(user);
        }
      }
      for (const rewardItem of scaledRewards.items) {
        await this.grantInventoryItem(inventoryRepository, user.id, rewardItem);
      }

      shopItem.used_count = (shopItem.used_count || 0) + count;
      await shopRepository.save(shopItem);
      await usageRepository.save(
        usageRepository.create({
          shop_item_id: shopItem.id,
          shop_item_name: shopItem.name,
          uid,
          count,
          cost_snapshot: this.enrichCosts(scaledCosts, costItems),
          reward_snapshot: this.enrichRewards(scaledRewards, rewardItems),
        }),
      );
      await this.achievementService?.evaluateAndUnlock(manager, uid);

      return {
        exchangeItemId: shopItem.id,
        count,
        costs: scaledCosts,
        rewards: scaledRewards,
      };
    });
  }

  private normalizeClaimCount(value?: number): number {
    const count =
      value === undefined || value === null || value === 0 ? 1 : Number(value);
    if (!Number.isInteger(count) || count <= 0 || count > 99) {
      throw new Error("兑换数量必须为 1-99 的整数");
    }
    return count;
  }

  private normalizeCosts(
    costs: unknown,
    allowEmpty = false,
  ): ExchangeCostItem[] {
    const items = Array.isArray(costs) ? costs : [];
    const normalized = items
      .map((item) => ({
        itemId: Number(item.itemId),
        num: Number(item.num),
      }))
      .filter((item) => item.itemId > 0 || item.num > 0);
    normalized.forEach((item) => {
      if (!Number.isInteger(item.itemId) || item.itemId <= 0) {
        throw new Error("消耗物品ID无效");
      }
      if (!Number.isInteger(item.num) || item.num <= 0) {
        throw new Error("消耗物品数量无效");
      }
    });
    if (!allowEmpty && normalized.length === 0) {
      throw new Error("兑换消耗不能为空");
    }
    return normalized;
  }

  private normalizeRewards(
    rewards: unknown,
    allowEmpty = false,
  ): RedeemRewards {
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
    if (!allowEmpty && points === 0 && normalizedItems.length === 0) {
      throw new Error("兑换奖励不能为空");
    }
    return { points, items: normalizedItems };
  }

  private isWithinTimeRange(item: ExchangeShopItem): boolean {
    const now = Date.now();
    if (item.starts_at && item.starts_at.getTime() > now) {
      return false;
    }
    if (item.ends_at && item.ends_at.getTime() < now) {
      return false;
    }
    return true;
  }

  private getUnavailableReason(
    item: ExchangeShopItem,
    costs: ExchangeCostItem[],
    inventoryMap: Map<number, number>,
    usedByUser: number,
    count: number,
  ): string {
    if (!item.enabled) {
      return "兑换项已停用";
    }
    if (item.starts_at && item.starts_at.getTime() > Date.now()) {
      return "兑换项尚未开始";
    }
    if (item.ends_at && item.ends_at.getTime() < Date.now()) {
      return "兑换项已过期";
    }
    if (
      item.total_limit !== null &&
      item.total_limit !== undefined &&
      (item.used_count || 0) + count > item.total_limit
    ) {
      return "兑换项库存不足";
    }
    if (
      item.user_limit !== null &&
      item.user_limit !== undefined &&
      usedByUser + count > item.user_limit
    ) {
      return "超过单用户限兑次数";
    }
    const missingCost = costs.find(
      (cost) => (inventoryMap.get(cost.itemId) || 0) < cost.num * count,
    );
    if (missingCost) {
      return "物品不足";
    }
    return "";
  }

  private getConfigUnavailableReason(
    costs: ExchangeCostItem[],
    rewards: RedeemRewards,
    itemMap: Map<number, DropItem>,
  ): string {
    const invalidCost = costs.find((cost) => {
      const item = itemMap.get(cost.itemId);
      return !item || item.disabled || item.drop_type === 1;
    });
    if (invalidCost) {
      return "消耗物品不可用";
    }
    const invalidReward = rewards.items.find((reward) => {
      const item = itemMap.get(reward.itemId);
      return !item || item.disabled || item.drop_type === 1;
    });
    return invalidReward ? "奖励物品不可用" : "";
  }

  private async assertExchangeItemsAvailable<T extends ExchangeCostItem>(
    dropRepository: Repository<DropItem>,
    items: T[],
    label: string,
  ): Promise<Map<number, DropItem>> {
    const uniqueItemIds = [...new Set(items.map((item) => item.itemId))];
    if (uniqueItemIds.length === 0) {
      return new Map();
    }
    const dropItems = await dropRepository.find({
      where: { id: In(uniqueItemIds) },
    });
    const itemMap = new Map(dropItems.map((item) => [item.id, item]));
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
    return itemMap;
  }

  private async loadAndLockInventories(
    inventoryRepository: Repository<UserInventory>,
    userId: number,
    itemIds: number[],
  ): Promise<Map<number, UserInventory>> {
    if (itemIds.length === 0) {
      return new Map();
    }
    const inventories = await inventoryRepository.find({
      where: { user_id: userId, item_id: In([...new Set(itemIds)]) },
      lock: { mode: "pessimistic_write" },
    });
    return new Map(
      inventories.map((inventory) => [inventory.item_id, inventory]),
    );
  }

  private async getUserUsageCount(
    usageRepository: Repository<ExchangeShopUsage>,
    shopItemId: number,
    uid: string,
  ): Promise<number> {
    const usages = await usageRepository.find({
      where: { shop_item_id: shopItemId, uid },
    });
    return usages.reduce((sum, usage) => sum + Number(usage.count || 0), 0);
  }

  private sumUsageByItem(usages: ExchangeShopUsage[]) {
    return usages.reduce((result, usage) => {
      result.set(
        usage.shop_item_id,
        (result.get(usage.shop_item_id) || 0) + Number(usage.count || 0),
      );
      return result;
    }, new Map<number, number>());
  }

  private async loadRelatedDropItems(
    dropRepository: Repository<DropItem>,
    shopItems: ExchangeShopItem[],
  ) {
    const itemIds = [
      ...new Set(
        shopItems.flatMap((item) => [
          ...this.normalizeCosts(item.costs, true).map((cost) => cost.itemId),
          ...this.normalizeRewards(item.rewards, true).items.map(
            (reward) => reward.itemId,
          ),
        ]),
      ),
    ];
    if (itemIds.length === 0) {
      return new Map<number, DropItem>();
    }
    const items = await dropRepository.find({ where: { id: In(itemIds) } });
    return new Map(items.map((item) => [item.id, item]));
  }

  private scaleCosts(costs: ExchangeCostItem[], count: number) {
    return costs.map((item) => ({
      itemId: item.itemId,
      num: item.num * count,
    }));
  }

  private scaleRewards(rewards: RedeemRewards, count: number): RedeemRewards {
    return {
      points: rewards.points * count,
      items: rewards.items.map((item) => ({
        itemId: item.itemId,
        num: item.num * count,
      })),
    };
  }

  private enrichCosts<T extends ExchangeCostItem>(
    costs: T[],
    itemMap: Map<number, DropItem>,
  ) {
    return costs.map((item) => ({
      ...item,
      itemName: itemMap.get(item.itemId)?.drop_name || "",
    }));
  }

  private enrichRewards(
    rewards: RedeemRewards,
    itemMap: Map<number, DropItem>,
  ) {
    return {
      ...rewards,
      items: rewards.items.map((item) => ({
        ...item,
        itemName: itemMap.get(item.itemId)?.drop_name || "",
      })),
    };
  }

  private async grantInventoryItem(
    inventoryRepository: Repository<UserInventory>,
    userId: number,
    item: RedeemRewardItem,
  ) {
    let inventory = await inventoryRepository.findOne({
      where: { user_id: userId, item_id: item.itemId },
      lock: { mode: "pessimistic_write" },
    });
    if (!inventory) {
      inventory = inventoryRepository.create({
        user_id: userId,
        item_id: item.itemId,
        num: item.num,
      });
    } else {
      inventory.num += item.num;
    }
    await inventoryRepository.save(inventory);
  }
}
