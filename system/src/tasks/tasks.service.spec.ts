import { AchievementEvent } from "src/entity/achievementEvent.entity";
import { DailySignInRecord } from "src/entity/dailySignInRecord.entity";
import { ExchangeShopUsage } from "src/entity/exchangeShopUsage.entity";
import { UserHistory } from "src/entity/history.entity";
import { TradeRecord } from "src/entity/tradeRecord.entity";
import { User } from "src/entity/user.entity";
import { UserTaskClaim } from "src/entity/userTaskClaim.entity";
import { TasksService } from "./tasks.service";

function createQueryBuilder(result: { total?: number; count?: number } = {}) {
  return {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue({ total: result.total || 0 }),
    getCount: jest.fn().mockResolvedValue(result.count || 0),
  };
}

function createRepository(overrides: Record<string, any> = {}) {
  return {
    create: jest.fn((value) => value),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    count: jest.fn().mockResolvedValue(0),
    save: jest.fn((value) => Promise.resolve({ id: 1, ...value })),
    createQueryBuilder: jest.fn(() => createQueryBuilder()),
    ...overrides,
  };
}

function createService(repositories: Map<any, any>) {
  const manager = {
    getRepository: jest.fn((entity) => repositories.get(entity)),
  };
  const dataSource = {
    getRepository: jest.fn((entity) => repositories.get(entity)),
    transaction: jest.fn((callback) => callback(manager)),
  };
  const rewardService = {
    grantRewards: jest.fn().mockResolvedValue(undefined),
  };
  return {
    service: new TasksService(dataSource as any, rewardService as any),
    dataSource,
    manager,
    rewardService,
  };
}

function baseRepositories(overrides: Array<[any, any]> = []) {
  return new Map<any, any>([
    [UserTaskClaim, createRepository()],
    [User, createRepository({ findOne: jest.fn().mockResolvedValue({ uid: "u1", point: 0 }) })],
    [UserHistory, createRepository()],
    [DailySignInRecord, createRepository()],
    [ExchangeShopUsage, createRepository()],
    [TradeRecord, createRepository()],
    [AchievementEvent, createRepository()],
    ...overrides,
  ]);
}

describe("TasksService", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-05-07T04:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("完成日常任务后只可领取一次奖励", async () => {
    const claimRepository = createRepository();
    const user = { uid: "u1", point: 0 } as User;
    const userRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(user),
    });
    const historyRepository = createRepository({
      createQueryBuilder: jest.fn(() => createQueryBuilder({ total: 1 })),
    });
    const { service, manager, rewardService } = createService(
      baseRepositories([
        [UserTaskClaim, claimRepository],
        [User, userRepository],
        [UserHistory, historyRepository],
      ]),
    );

    await expect(
      service.claimTask("u1", {
        taskId: "daily_draw_1",
        periodKey: "2026-05-07",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        scope: "daily",
        periodKey: "2026-05-07",
        rewards: { points: 10, items: [] },
      }),
    );

    expect(claimRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "u1",
        scope: "daily",
        period_key: "2026-05-07",
        claim_type: "task",
        target_key: "daily_draw_1",
        activity_points: 20,
      }),
    );
    expect(rewardService.grantRewards).toHaveBeenCalledWith(
      manager,
      user,
      { points: 10, items: [] },
      expect.objectContaining({
        sourceType: "task",
        title: "任务奖励：星轨初响",
      }),
    );

    claimRepository.findOne.mockResolvedValueOnce({ id: 1 });
    await expect(
      service.claimTask("u1", {
        taskId: "daily_draw_1",
        periodKey: "2026-05-07",
      }),
    ).rejects.toThrow("任务奖励已领取");
  });

  it("未达到目标时不会发放任务奖励", async () => {
    const historyRepository = createRepository({
      createQueryBuilder: jest.fn(() => createQueryBuilder({ total: 0 })),
    });
    const { service, rewardService } = createService(
      baseRepositories([[UserHistory, historyRepository]]),
    );

    await expect(
      service.claimTask("u1", {
        taskId: "daily_draw_1",
        periodKey: "2026-05-07",
      }),
    ).rejects.toThrow("任务尚未完成");
    expect(rewardService.grantRewards).not.toHaveBeenCalled();
  });

  it("活跃度只统计已领取任务并可领取里程碑奖励", async () => {
    const claimRepository = createRepository({
      find: jest.fn().mockResolvedValue([
        {
          claim_type: "task",
          target_key: "daily_sign_in",
          activity_points: 20,
        },
        {
          claim_type: "task",
          target_key: "daily_draw_1",
          activity_points: 20,
        },
      ]),
    });
    const user = { uid: "u1", point: 0 } as User;
    const userRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(user),
    });
    const { service, rewardService } = createService(
      baseRepositories([
        [UserTaskClaim, claimRepository],
        [User, userRepository],
      ]),
    );

    await expect(
      service.claimActivity("u1", {
        scope: "daily",
        periodKey: "2026-05-07",
        milestone: 30,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        activity: 40,
        rewards: { points: 20, items: [] },
      }),
    );
    expect(claimRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        claim_type: "activity",
        target_key: "30",
        activity_points: 0,
      }),
    );
    expect(rewardService.grantRewards).toHaveBeenCalledWith(
      expect.anything(),
      user,
      { points: 20, items: [] },
      expect.objectContaining({
        sourceType: "task",
        title: "活跃度奖励：日常 30",
      }),
    );
  });

  it("概览中未领取任务不会计入活跃度", async () => {
    const claimRepository = createRepository({ find: jest.fn().mockResolvedValue([]) });
    const historyRepository = createRepository({
      createQueryBuilder: jest.fn(() => createQueryBuilder({ total: 10 })),
    });
    const { service } = createService(
      baseRepositories([
        [UserTaskClaim, claimRepository],
        [UserHistory, historyRepository],
      ]),
    );

    const overview = await service.getOverview("u1");
    expect(overview.daily.activity).toBe(0);
    expect(overview.daily.tasks.find((task) => task.id === "daily_draw_10"))
      .toEqual(expect.objectContaining({ completed: true, claimed: false }));
    expect(overview.daily.milestones[0]).toEqual(
      expect.objectContaining({ threshold: 30, available: false }),
    );
  });

  it("周常签到按自然周统计不同签到日", async () => {
    const signRepository = createRepository({
      find: jest.fn().mockResolvedValue([
        { sign_date: "2026-05-04" },
        { sign_date: "2026-05-05" },
        { sign_date: "2026-05-05" },
        { sign_date: "2026-05-06" },
      ]),
    });
    const { service } = createService(
      baseRepositories([[DailySignInRecord, signRepository]]),
    );

    const overview = await service.getOverview("u1");
    expect(
      overview.weekly.tasks.find((task) => task.id === "weekly_sign_in_3"),
    ).toEqual(expect.objectContaining({ progress: 3, completed: true }));
  });

  it("过期周期不能领取奖励", async () => {
    const { service, dataSource } = createService(baseRepositories());

    await expect(
      service.claimTask("u1", {
        taskId: "daily_draw_1",
        periodKey: "2026-05-06",
      }),
    ).rejects.toThrow("任务周期已刷新");
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
