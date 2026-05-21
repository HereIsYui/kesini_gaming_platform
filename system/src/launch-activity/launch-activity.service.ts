import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { DropItem } from "src/entity/drop.entity";
import { LaunchActivityClaim } from "src/entity/launchActivityClaim.entity";
import { LaunchActivityConfig } from "src/entity/launchActivityConfig.entity";
import { User } from "src/entity/user.entity";
import { RewardService } from "src/reward/reward.service";

const DEFAULT_ACTIVITY_KEY = "launch-2026";
const DEFAULT_ACTIVITY_NAME = "开服福利";

@Injectable()
export class LaunchActivityService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly rewardService: RewardService,
  ) {}

  async getCurrent(uid: string) {
    const config = await this.ensureConfig();
    const activity = this.toPublicActivity(config);
    const reason = this.getUnavailableReason(config);
    const claim = await this.dataSource
      .getRepository(LaunchActivityClaim)
      .findOne({
        where: { activity_key: config.activity_key, uid },
      });

    return {
      activity: reason ? null : activity,
      available: !reason && !claim,
      claimed: Boolean(claim),
      reason: claim ? "已领取" : reason || "",
    };
  }

  async claim(uid: string) {
    return this.dataSource.transaction(async (manager) => {
      const configRepository = manager.getRepository(LaunchActivityConfig);
      const claimRepository = manager.getRepository(LaunchActivityClaim);
      const userRepository = manager.getRepository(User);
      const dropRepository = manager.getRepository(DropItem);

      const config =
        (await configRepository.findOne({
          where: { id: 1 },
          lock: { mode: "pessimistic_write" },
        })) || (await this.createDefaultConfig(configRepository));

      const reason = this.getUnavailableReason(config);
      if (reason) {
        throw new Error(reason);
      }

      const existingClaim = await claimRepository.findOne({
        where: { activity_key: config.activity_key, uid },
      });
      if (existingClaim) {
        throw new Error("开服福利已领取");
      }

      const user = await userRepository.findOne({
        where: { uid },
        lock: { mode: "pessimistic_write" },
      });
      if (!user) {
        throw new Error("用户不存在");
      }

      const rewards = this.rewardService.normalizeRewards(
        config.rewards,
        "开服福利奖励不能为空",
      );
      await this.rewardService.assertRewardItemsAvailable(
        dropRepository,
        rewards.items,
      );
      await this.rewardService.grantRewards(manager, user, rewards);

      const claim = claimRepository.create({
        activity_key: config.activity_key,
        activity_name: config.name,
        uid,
        reward_snapshot: rewards,
      });
      await claimRepository.save(claim);

      return {
        activityKey: config.activity_key,
        name: config.name,
        rewards,
      };
    });
  }

  private async ensureConfig() {
    const repository = this.dataSource.getRepository(LaunchActivityConfig);
    const config = await repository.findOne({ where: { id: 1 } });
    return config || this.createDefaultConfig(repository);
  }

  private createDefaultConfig(
    repository: {
      create(value: Partial<LaunchActivityConfig>): LaunchActivityConfig;
      save(value: LaunchActivityConfig): Promise<LaunchActivityConfig>;
    },
  ) {
    return repository.save(
      repository.create({
        id: 1,
        enabled: false,
        activity_key: DEFAULT_ACTIVITY_KEY,
        name: DEFAULT_ACTIVITY_NAME,
        description: "登录后可领取一次的开服福利。",
        starts_at: null,
        ends_at: null,
        rewards: { points: 100, items: [] },
      }),
    );
  }

  private getUnavailableReason(config: LaunchActivityConfig) {
    if (!config.enabled) {
      return "开服福利暂未开启";
    }
    const now = Date.now();
    if (config.starts_at && config.starts_at.getTime() > now) {
      return "开服福利尚未开始";
    }
    if (config.ends_at && config.ends_at.getTime() < now) {
      return "开服福利已结束";
    }
    return "";
  }

  private toPublicActivity(config: LaunchActivityConfig) {
    return {
      activityKey: config.activity_key,
      name: config.name,
      description: config.description,
      startsAt: config.starts_at,
      endsAt: config.ends_at,
      rewards: this.rewardService.normalizeRewards(
        config.rewards,
        "开服福利奖励不能为空",
      ),
    };
  }
}
