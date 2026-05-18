import { Injectable } from "@nestjs/common";
import { DataSource, Repository } from "typeorm";
import { DropItem } from "src/entity/drop.entity";
import { UserInventory } from "src/entity/inventory.entity";
import {
  RedeemCode,
  RedeemRewards,
  RedeemRewardItem,
} from "src/entity/redeemCode.entity";
import { RedeemCodeUsage } from "src/entity/redeemCodeUsage.entity";
import { User } from "src/entity/user.entity";

@Injectable()
export class RedeemService {
  constructor(private readonly dataSource: DataSource) {}

  async claim(uid: string, rawCode: string) {
    const normalizedCode = this.normalizeCode(rawCode);
    if (!normalizedCode) {
      throw new Error("兑换码不能为空");
    }

    return this.dataSource.transaction(async (manager) => {
      const redeemCodeRepository = manager.getRepository(RedeemCode);
      const usageRepository = manager.getRepository(RedeemCodeUsage);
      const userRepository = manager.getRepository(User);
      const inventoryRepository = manager.getRepository(UserInventory);
      const dropRepository = manager.getRepository(DropItem);

      const redeemCode = await redeemCodeRepository.findOne({
        where: { code: normalizedCode, delete_flag: false },
        lock: { mode: "pessimistic_write" },
      });
      this.assertRedeemCodeAvailable(redeemCode);

      const existingUsage = await usageRepository.findOne({
        where: { code_id: redeemCode!.id, uid },
      });
      if (existingUsage) {
        throw new Error("该兑换码已领取");
      }

      const user = await userRepository.findOne({
        where: { uid },
        lock: { mode: "pessimistic_write" },
      });
      if (!user) {
        throw new Error("用户不存在");
      }

      const rewards = this.normalizeRewards(redeemCode!.rewards);
      await this.assertRewardItemsAvailable(dropRepository, rewards.items);
      if (rewards.points > 0) {
        user.point = (user.point || 0) + rewards.points;
        await userRepository.save(user);
      }

      for (const item of rewards.items) {
        await this.grantInventoryItem(inventoryRepository, user.id, item);
      }

      redeemCode!.used_count = (redeemCode!.used_count || 0) + 1;
      await redeemCodeRepository.save(redeemCode!);

      const usage = usageRepository.create({
        code_id: redeemCode!.id,
        code: redeemCode!.code,
        uid,
        reward_snapshot: rewards,
      });
      await usageRepository.save(usage);

      return {
        code: redeemCode!.code,
        rewards,
      };
    });
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

  private assertRedeemCodeAvailable(code: RedeemCode | null): asserts code is RedeemCode {
    if (!code) {
      throw new Error("兑换码不存在");
    }
    if (!code.enabled) {
      throw new Error("兑换码已停用");
    }
    const now = Date.now();
    if (code.starts_at && code.starts_at.getTime() > now) {
      throw new Error("兑换码尚未开始");
    }
    if (code.ends_at && code.ends_at.getTime() < now) {
      throw new Error("兑换码已过期");
    }
    if (code.total_limit !== null && code.total_limit !== undefined) {
      if ((code.used_count || 0) >= code.total_limit) {
        throw new Error("兑换码库存已用完");
      }
    }
  }

  private normalizeRewards(rewards: RedeemRewards): RedeemRewards {
    return {
      points: Number(rewards?.points || 0),
      items: Array.isArray(rewards?.items)
        ? rewards.items.map((item) => ({
            itemId: Number(item.itemId),
            num: Number(item.num),
          }))
        : [],
    };
  }

  private async assertRewardItemsAvailable(
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

  private normalizeCode(code: string): string {
    return String(code || "")
      .trim()
      .toUpperCase();
  }
}
