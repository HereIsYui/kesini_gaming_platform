import { Injectable, Optional } from "@nestjs/common";
import { EntityManager, Repository } from "typeorm";
import { DropItem } from "src/entity/drop.entity";
import { UserInventory } from "src/entity/inventory.entity";
import { RedeemRewards, RedeemRewardItem } from "src/entity/redeemCode.entity";
import { User } from "src/entity/user.entity";
import {
  PointLedgerContext,
  PointLedgerService,
} from "src/point-ledger/point-ledger.service";

@Injectable()
export class RewardService {
  constructor(
    @Optional()
    private readonly pointLedgerService?: PointLedgerService,
  ) {}

  normalizeRewards(
    rewards: unknown,
    emptyMessage = "奖励不能为空",
  ): RedeemRewards {
    const value = (rewards || {}) as Partial<RedeemRewards>;
    const points = Number(value.points || 0);
    if (!Number.isInteger(points) || points < 0) {
      throw new Error("奖励积分必须为非负整数");
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

    return { points, items: normalizedItems };
  }

  async assertRewardItemsAvailable(
    dropRepository: Repository<DropItem>,
    items: RedeemRewardItem[],
  ) {
    for (const item of items) {
      const dropItem = await dropRepository.findOne({
        where: { id: item.itemId },
      });
      if (!dropItem) {
        throw new Error(`奖励物品不存在: ${item.itemId}`);
      }
      if (dropItem.disabled) {
        throw new Error(`奖励物品已禁用: ${dropItem.drop_name}`);
      }
    }
  }

  async grantRewards(
    manager: EntityManager,
    user: User,
    rewards: RedeemRewards,
    pointContext?: PointLedgerContext,
  ) {
    const userRepository = manager.getRepository(User);
    const inventoryRepository = manager.getRepository(UserInventory);

    if (rewards.points > 0) {
      if (this.pointLedgerService && pointContext) {
        await this.pointLedgerService.applyChange(
          manager,
          user,
          rewards.points,
          pointContext,
        );
      } else {
        user.point = (user.point || 0) + rewards.points;
        await userRepository.save(user);
      }
    }

    for (const item of rewards.items) {
      await this.grantInventoryItem(inventoryRepository, user, item);
    }
  }

  private async grantInventoryItem(
    inventoryRepository: Repository<UserInventory>,
    user: User,
    item: RedeemRewardItem,
  ) {
    if (!user.id) {
      throw new Error("用户记录缺少ID，无法发放物品");
    }

    let inventory = await inventoryRepository.findOne({
      where: { user_id: user.id, item_id: item.itemId },
      lock: { mode: "pessimistic_write" },
    });
    if (!inventory) {
      inventory = inventoryRepository.create({
        user_id: user.id,
        item_id: item.itemId,
        num: item.num,
      });
    } else {
      inventory.num += item.num;
    }
    await inventoryRepository.save(inventory);
  }
}
