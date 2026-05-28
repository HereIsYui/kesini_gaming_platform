import { Injectable } from "@nestjs/common";
import {
  Between,
  DataSource,
  EntityManager,
  ObjectLiteral,
  Repository,
} from "typeorm";
import { AchievementEvent } from "src/entity/achievementEvent.entity";
import { DailySignInRecord } from "src/entity/dailySignInRecord.entity";
import { ExchangeShopUsage } from "src/entity/exchangeShopUsage.entity";
import { UserHistory } from "src/entity/history.entity";
import type { RedeemRewards } from "src/entity/redeemCode.entity";
import { TradeRecord } from "src/entity/tradeRecord.entity";
import { User } from "src/entity/user.entity";
import {
  TaskScope,
  UserTaskClaim,
} from "src/entity/userTaskClaim.entity";
import { RewardService } from "src/reward/reward.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const TASK_OFFSET_MS = 8 * 60 * 60 * 1000;

type TaskMetric =
  | "sign_in"
  | "draws"
  | "exchange"
  | "trade"
  | "synthesize"
  | "decompose";

interface TaskDefinition {
  key: string;
  scope: TaskScope;
  name: string;
  description: string;
  metric: TaskMetric;
  targetValue: number;
  activityPoints: number;
  rewards: RedeemRewards;
}

interface ActivityMilestoneDefinition {
  threshold: number;
  rewards: RedeemRewards;
}

interface TaskView {
  id: string;
  name: string;
  description: string;
  targetValue: number;
  progress: number;
  rawProgress: number;
  completed: boolean;
  claimed: boolean;
  activityPoints: number;
  rewards: RedeemRewards;
}

interface TaskPeriod {
  scope: TaskScope;
  label: string;
  periodKey: string;
  startAt: Date;
  endExclusive: Date;
  startDateKey: string;
  endDateKey: string;
}

export interface TaskClaimInput {
  taskId: string;
  periodKey: string;
}

export interface ActivityClaimInput {
  scope: TaskScope;
  periodKey: string;
  milestone: number;
}

const TASK_DEFINITIONS: Record<TaskScope, TaskDefinition[]> = {
  daily: [
    {
      key: "daily_sign_in",
      scope: "daily",
      name: "每日签到",
      description: "完成一次今日签到。",
      metric: "sign_in",
      targetValue: 1,
      activityPoints: 20,
      rewards: { points: 10, items: [] },
    },
    {
      key: "daily_draw_1",
      scope: "daily",
      name: "星轨初响",
      description: "任意卡池抽取 1 次。",
      metric: "draws",
      targetValue: 1,
      activityPoints: 20,
      rewards: { points: 10, items: [] },
    },
    {
      key: "daily_draw_10",
      scope: "daily",
      name: "十连回声",
      description: "累计抽取 10 次。",
      metric: "draws",
      targetValue: 10,
      activityPoints: 30,
      rewards: { points: 20, items: [] },
    },
    {
      key: "daily_exchange_1",
      scope: "daily",
      name: "物资兑换",
      description: "在兑换商店完成 1 次兑换。",
      metric: "exchange",
      targetValue: 1,
      activityPoints: 15,
      rewards: { points: 10, items: [] },
    },
    {
      key: "daily_trade_1",
      scope: "daily",
      name: "市场往来",
      description: "完成 1 次买入或卖出。",
      metric: "trade",
      targetValue: 1,
      activityPoints: 15,
      rewards: { points: 10, items: [] },
    },
  ],
  weekly: [
    {
      key: "weekly_sign_in_3",
      scope: "weekly",
      name: "三日足迹",
      description: "本周累计签到 3 天。",
      metric: "sign_in",
      targetValue: 3,
      activityPoints: 60,
      rewards: { points: 60, items: [] },
    },
    {
      key: "weekly_draw_30",
      scope: "weekly",
      name: "星轨巡礼",
      description: "本周累计抽取 30 次。",
      metric: "draws",
      targetValue: 30,
      activityPoints: 80,
      rewards: { points: 80, items: [] },
    },
    {
      key: "weekly_synthesize_1",
      scope: "weekly",
      name: "图鉴补完",
      description: "本周合成 1 张卡片。",
      metric: "synthesize",
      targetValue: 1,
      activityPoints: 60,
      rewards: { points: 60, items: [] },
    },
    {
      key: "weekly_decompose_10",
      scope: "weekly",
      name: "碎片整理",
      description: "本周分解 10 张卡片。",
      metric: "decompose",
      targetValue: 10,
      activityPoints: 60,
      rewards: { points: 60, items: [] },
    },
    {
      key: "weekly_trade_3",
      scope: "weekly",
      name: "市场熟客",
      description: "本周完成 3 次买入或卖出。",
      metric: "trade",
      targetValue: 3,
      activityPoints: 80,
      rewards: { points: 80, items: [] },
    },
  ],
};

const ACTIVITY_MILESTONES: Record<TaskScope, ActivityMilestoneDefinition[]> = {
  daily: [
    { threshold: 30, rewards: { points: 20, items: [] } },
    { threshold: 60, rewards: { points: 40, items: [] } },
    { threshold: 100, rewards: { points: 80, items: [] } },
  ],
  weekly: [
    { threshold: 100, rewards: { points: 80, items: [] } },
    { threshold: 200, rewards: { points: 120, items: [] } },
    { threshold: 300, rewards: { points: 200, items: [] } },
  ],
};

@Injectable()
export class TasksService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly rewardService: RewardService,
  ) {}

  async getOverview(uid: string) {
    const periods = this.getCurrentPeriods();
    const [daily, weekly] = await Promise.all([
      this.buildScopeOverview(this.dataSource, uid, periods.daily),
      this.buildScopeOverview(this.dataSource, uid, periods.weekly),
    ]);
    return {
      generatedAt: new Date().toISOString(),
      daily,
      weekly,
    };
  }

  async claimTask(uid: string, input: TaskClaimInput) {
    const task = this.findTask(input.taskId);
    const period = this.getCurrentPeriods()[task.scope];
    this.assertCurrentPeriod(input.periodKey, period);

    try {
      return await this.dataSource.transaction(async (manager) => {
        const claimRepository = manager.getRepository(UserTaskClaim);
        const existing = await this.findClaim(
          claimRepository,
          uid,
          period,
          "task",
          task.key,
        );
        if (existing) {
          throw new Error("任务奖励已领取");
        }

        const progress = await this.calculateTaskProgress(manager, uid, task, period);
        if (progress < task.targetValue) {
          throw new Error("任务尚未完成");
        }

        const user = await this.findLockedUser(manager, uid);
        const rewards = this.cloneRewards(task.rewards);
        const claim = claimRepository.create({
          uid,
          scope: period.scope,
          period_key: period.periodKey,
          claim_type: "task",
          target_key: task.key,
          activity_points: task.activityPoints,
          reward_snapshot: rewards,
        });
        await claimRepository.save(claim);

        await this.rewardService.grantRewards(manager, user, rewards, {
          sourceType: "task",
          sourceId: `${period.scope}:${period.periodKey}:${task.key}`,
          title: `任务奖励：${task.name}`,
          metadata: {
            scope: period.scope,
            periodKey: period.periodKey,
            taskId: task.key,
            taskName: task.name,
            activityPoints: task.activityPoints,
          },
        });

        return {
          scope: period.scope,
          periodKey: period.periodKey,
          task: this.toTaskView(task, progress, true),
          rewards,
        };
      });
    } catch (error) {
      if (this.isDuplicateClaimError(error)) {
        throw new Error("任务奖励已领取");
      }
      throw error;
    }
  }

  async claimActivity(uid: string, input: ActivityClaimInput) {
    const scope = this.normalizeScope(input.scope);
    const period = this.getCurrentPeriods()[scope];
    this.assertCurrentPeriod(input.periodKey, period);
    const milestone = ACTIVITY_MILESTONES[scope].find(
      (item) => item.threshold === Number(input.milestone),
    );
    if (!milestone) {
      throw new Error("活跃度奖励不存在");
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        const claimRepository = manager.getRepository(UserTaskClaim);
        const targetKey = String(milestone.threshold);
        const existing = await this.findClaim(
          claimRepository,
          uid,
          period,
          "activity",
          targetKey,
        );
        if (existing) {
          throw new Error("活跃度奖励已领取");
        }

        const activity = await this.calculateClaimedActivity(manager, uid, period);
        if (activity < milestone.threshold) {
          throw new Error("活跃度不足");
        }

        const user = await this.findLockedUser(manager, uid);
        const rewards = this.cloneRewards(milestone.rewards);
        const claim = claimRepository.create({
          uid,
          scope,
          period_key: period.periodKey,
          claim_type: "activity",
          target_key: targetKey,
          activity_points: 0,
          reward_snapshot: rewards,
        });
        await claimRepository.save(claim);

        await this.rewardService.grantRewards(manager, user, rewards, {
          sourceType: "task",
          sourceId: `${scope}:${period.periodKey}:activity:${targetKey}`,
          title: `活跃度奖励：${period.label} ${targetKey}`,
          metadata: {
            scope,
            periodKey: period.periodKey,
            milestone: milestone.threshold,
            activity,
          },
        });

        return {
          scope,
          periodKey: period.periodKey,
          activity,
          milestone: this.toMilestoneView(milestone, true, activity),
          rewards,
        };
      });
    } catch (error) {
      if (this.isDuplicateClaimError(error)) {
        throw new Error("活跃度奖励已领取");
      }
      throw error;
    }
  }

  private async buildScopeOverview(
    manager: DataSource | EntityManager,
    uid: string,
    period: TaskPeriod,
  ) {
    const claims = await manager.getRepository(UserTaskClaim).find({
      where: {
        uid,
        scope: period.scope,
        period_key: period.periodKey,
      },
    });
    const claimMap = new Map(
      claims.map((claim) => [`${claim.claim_type}:${claim.target_key}`, claim]),
    );
    const tasks: TaskView[] = [];
    for (const task of TASK_DEFINITIONS[period.scope]) {
      const progress = await this.calculateTaskProgress(manager, uid, task, period);
      tasks.push(
        this.toTaskView(task, progress, claimMap.has(`task:${task.key}`)),
      );
    }
    const activity = claims
      .filter((claim) => claim.claim_type === "task")
      .reduce((sum, claim) => sum + Number(claim.activity_points || 0), 0);

    return {
      scope: period.scope,
      label: period.label,
      periodKey: period.periodKey,
      startsAt: period.startAt.toISOString(),
      endsAt: new Date(period.endExclusive.getTime() - 1).toISOString(),
      activity,
      maxActivity: TASK_DEFINITIONS[period.scope].reduce(
        (sum, task) => sum + task.activityPoints,
        0,
      ),
      tasks,
      milestones: ACTIVITY_MILESTONES[period.scope].map((milestone) =>
        this.toMilestoneView(
          milestone,
          claimMap.has(`activity:${milestone.threshold}`),
          activity,
        ),
      ),
    };
  }

  private toTaskView(
    task: TaskDefinition,
    progress: number,
    claimed: boolean,
  ): TaskView {
    const normalizedProgress = Math.max(0, Math.floor(progress));
    return {
      id: task.key,
      name: task.name,
      description: task.description,
      targetValue: task.targetValue,
      progress: Math.min(normalizedProgress, task.targetValue),
      rawProgress: normalizedProgress,
      completed: normalizedProgress >= task.targetValue,
      claimed,
      activityPoints: task.activityPoints,
      rewards: this.cloneRewards(task.rewards),
    };
  }

  private toMilestoneView(
    milestone: ActivityMilestoneDefinition,
    claimed: boolean,
    activity: number,
  ) {
    return {
      threshold: milestone.threshold,
      rewards: this.cloneRewards(milestone.rewards),
      claimed,
      available: activity >= milestone.threshold && !claimed,
    };
  }

  private async calculateTaskProgress(
    manager: DataSource | EntityManager,
    uid: string,
    task: TaskDefinition,
    period: TaskPeriod,
  ) {
    switch (task.metric) {
      case "sign_in":
        return this.countSignIn(manager, uid, period);
      case "draws":
        return this.sumCreatedAt(
          manager.getRepository(UserHistory),
          "uid",
          "count",
          uid,
          period,
        );
      case "exchange":
        return this.sumCreatedAt(
          manager.getRepository(ExchangeShopUsage),
          "uid",
          "count",
          uid,
          period,
        );
      case "trade":
        return this.countTrade(manager, uid, period);
      case "synthesize":
        return this.sumAchievementEvents(manager, uid, "synthesize_count", period);
      case "decompose":
        return this.sumAchievementEvents(manager, uid, "decompose_count", period);
      default:
        return 0;
    }
  }

  private async countSignIn(
    manager: DataSource | EntityManager,
    uid: string,
    period: TaskPeriod,
  ) {
    if (period.scope === "daily") {
      return manager.getRepository(DailySignInRecord).count({
        where: { uid, sign_date: period.startDateKey },
      });
    }
    const records = await manager.getRepository(DailySignInRecord).find({
      where: {
        uid,
        sign_date: Between(period.startDateKey, period.endDateKey),
      },
    });
    return new Set(records.map((record) => record.sign_date)).size;
  }

  private async countTrade(
    manager: DataSource | EntityManager,
    uid: string,
    period: TaskPeriod,
  ) {
    const repository = manager.getRepository(TradeRecord);
    const [buyCount, sellCount] = await Promise.all([
      this.countCreatedAt(repository, "buyer_uid", uid, period),
      this.countCreatedAt(repository, "seller_uid", uid, period),
    ]);
    return buyCount + sellCount;
  }

  private async sumAchievementEvents(
    manager: DataSource | EntityManager,
    uid: string,
    eventType: string,
    period: TaskPeriod,
  ) {
    return this.sumCreatedAt(
      manager.getRepository(AchievementEvent),
      "uid",
      "amount",
      uid,
      period,
      "entity.event_type = :eventType",
      { eventType },
    );
  }

  private async sumCreatedAt<T extends ObjectLiteral>(
    repository: Repository<T>,
    uidColumn: string,
    column: string,
    uid: string,
    period: TaskPeriod,
    extraWhere?: string,
    extraParams: Record<string, unknown> = {},
  ) {
    const builder = repository
      .createQueryBuilder("entity")
      .select(`COALESCE(SUM(entity.${column}), 0)`, "total")
      .where(`entity.${uidColumn} = :uid`, { uid })
      .andWhere("entity.createdAt >= :startAt AND entity.createdAt < :endAt", {
        startAt: period.startAt,
        endAt: period.endExclusive,
      });
    if (extraWhere) {
      builder.andWhere(extraWhere, extraParams);
    }
    const result = await builder.getRawOne();
    return Number(result?.total || 0);
  }

  private async countCreatedAt<T extends ObjectLiteral>(
    repository: Repository<T>,
    uidColumn: string,
    uid: string,
    period: TaskPeriod,
  ) {
    return repository
      .createQueryBuilder("entity")
      .where(`entity.${uidColumn} = :uid`, { uid })
      .andWhere("entity.createdAt >= :startAt AND entity.createdAt < :endAt", {
        startAt: period.startAt,
        endAt: period.endExclusive,
      })
      .getCount();
  }

  private async calculateClaimedActivity(
    manager: EntityManager,
    uid: string,
    period: TaskPeriod,
  ) {
    const claims = await manager.getRepository(UserTaskClaim).find({
      where: {
        uid,
        scope: period.scope,
        period_key: period.periodKey,
        claim_type: "task",
      },
    });
    return claims.reduce(
      (sum, claim) => sum + Number(claim.activity_points || 0),
      0,
    );
  }

  private async findLockedUser(manager: EntityManager, uid: string) {
    const user = await manager.getRepository(User).findOne({
      where: { uid },
      lock: { mode: "pessimistic_write" },
    });
    if (!user) {
      throw new Error("用户不存在");
    }
    return user;
  }

  private async findClaim(
    repository: Repository<UserTaskClaim>,
    uid: string,
    period: TaskPeriod,
    claimType: "task" | "activity",
    targetKey: string,
  ) {
    return repository.findOne({
      where: {
        uid,
        scope: period.scope,
        period_key: period.periodKey,
        claim_type: claimType,
        target_key: targetKey,
      },
      lock: { mode: "pessimistic_write" },
    });
  }

  private findTask(taskId: string) {
    const taskKey = String(taskId || "").trim();
    const task = [...TASK_DEFINITIONS.daily, ...TASK_DEFINITIONS.weekly].find(
      (item) => item.key === taskKey,
    );
    if (!task) {
      throw new Error("任务不存在");
    }
    return task;
  }

  private normalizeScope(scope: string): TaskScope {
    if (scope === "daily" || scope === "weekly") {
      return scope;
    }
    throw new Error("任务周期无效");
  }

  private assertCurrentPeriod(periodKey: string, period: TaskPeriod) {
    if (String(periodKey || "") !== period.periodKey) {
      throw new Error("任务周期已刷新，请重新打开任务中心");
    }
  }

  private getCurrentPeriods(now = new Date()): Record<TaskScope, TaskPeriod> {
    const dateKey = this.getDateKey(now);
    const dailyStartAt = this.dateKeyToUtcStart(dateKey);
    const weekStartDateKey = this.getWeekStartDateKey(dateKey);
    const weekEndDateKey = this.shiftDateKey(weekStartDateKey, 6);
    const weekStartAt = this.dateKeyToUtcStart(weekStartDateKey);
    return {
      daily: {
        scope: "daily",
        label: "日常",
        periodKey: dateKey,
        startAt: dailyStartAt,
        endExclusive: new Date(dailyStartAt.getTime() + DAY_MS),
        startDateKey: dateKey,
        endDateKey: dateKey,
      },
      weekly: {
        scope: "weekly",
        label: "周常",
        periodKey: this.getIsoWeekKey(dateKey),
        startAt: weekStartAt,
        endExclusive: new Date(weekStartAt.getTime() + DAY_MS * 7),
        startDateKey: weekStartDateKey,
        endDateKey: weekEndDateKey,
      },
    };
  }

  private getDateKey(date = new Date()) {
    return new Date(date.getTime() + TASK_OFFSET_MS).toISOString().slice(0, 10);
  }

  private getWeekStartDateKey(dateKey: string) {
    const date = new Date(`${dateKey}T00:00:00.000Z`);
    const day = date.getUTCDay() || 7;
    return this.shiftDateKey(dateKey, 1 - day);
  }

  private getIsoWeekKey(dateKey: string) {
    const date = new Date(`${dateKey}T00:00:00.000Z`);
    const day = date.getUTCDay() || 7;
    const thursday = new Date(date);
    thursday.setUTCDate(date.getUTCDate() + 4 - day);
    const year = thursday.getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const week = Math.ceil(
      ((thursday.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7,
    );
    return `${year}-W${String(week).padStart(2, "0")}`;
  }

  private shiftDateKey(dateKey: string, deltaDays: number) {
    return new Date(
      new Date(`${dateKey}T00:00:00.000Z`).getTime() + deltaDays * DAY_MS,
    )
      .toISOString()
      .slice(0, 10);
  }

  private dateKeyToUtcStart(dateKey: string) {
    return new Date(
      new Date(`${dateKey}T00:00:00.000Z`).getTime() - TASK_OFFSET_MS,
    );
  }

  private cloneRewards(rewards: RedeemRewards): RedeemRewards {
    return JSON.parse(JSON.stringify(rewards)) as RedeemRewards;
  }

  private isDuplicateClaimError(error: unknown) {
    const value = error as { code?: string; errno?: number };
    return value?.code === "ER_DUP_ENTRY" || value?.errno === 1062;
  }
}
