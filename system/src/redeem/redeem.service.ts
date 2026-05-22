import { Injectable, Optional } from "@nestjs/common";
import { DataSource } from "typeorm";
import { DropItem } from "src/entity/drop.entity";
import { RedeemCode } from "src/entity/redeemCode.entity";
import { RedeemCodeUsage } from "src/entity/redeemCodeUsage.entity";
import { User } from "src/entity/user.entity";
import { AchievementService } from "src/achievement/achievement.service";
import { RewardService } from "src/reward/reward.service";

@Injectable()
export class RedeemService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly rewardService: RewardService,
    @Optional()
    private readonly achievementService?: AchievementService,
  ) {}

  async claim(uid: string, rawCode: string) {
    const normalizedCode = this.normalizeCode(rawCode);
    if (!normalizedCode) {
      throw new Error("兑换码不能为空");
    }

    return this.dataSource.transaction(async (manager) => {
      const redeemCodeRepository = manager.getRepository(RedeemCode);
      const usageRepository = manager.getRepository(RedeemCodeUsage);
      const userRepository = manager.getRepository(User);
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

      const rewards = this.rewardService.normalizeRewards(
        redeemCode!.rewards,
        "兑换码奖励不能为空",
      );
      await this.rewardService.assertRewardItemsAvailable(
        dropRepository,
        rewards.items,
      );
      await this.rewardService.grantRewards(manager, user, rewards, {
        sourceType: "redeem_code",
        sourceId: redeemCode!.id,
        title: `兑换码奖励：${redeemCode!.code}`,
        metadata: {
          code: redeemCode!.code,
          name: redeemCode!.name,
        },
      });

      redeemCode!.used_count = (redeemCode!.used_count || 0) + 1;
      await redeemCodeRepository.save(redeemCode!);

      const usage = usageRepository.create({
        code_id: redeemCode!.id,
        code: redeemCode!.code,
        uid,
        reward_snapshot: rewards,
      });
      await usageRepository.save(usage);
      await this.achievementService?.evaluateAndUnlock(manager, uid);

      return {
        code: redeemCode!.code,
        rewards,
      };
    });
  }

  private assertRedeemCodeAvailable(
    code: RedeemCode | null,
  ): asserts code is RedeemCode {
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

  private normalizeCode(code: string): string {
    return String(code || "")
      .trim()
      .toUpperCase();
  }
}
