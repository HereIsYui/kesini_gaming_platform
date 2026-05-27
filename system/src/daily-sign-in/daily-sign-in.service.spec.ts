import { DailySignInRecord } from "src/entity/dailySignInRecord.entity";
import { User } from "src/entity/user.entity";
import { DailySignInService } from "./daily-sign-in.service";

function createRepository(overrides: Record<string, any> = {}) {
  return {
    create: jest.fn((value) => value),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn((value) => Promise.resolve({ id: 1, ...value })),
    ...overrides,
  };
}

function createRecord(
  overrides: Partial<DailySignInRecord> = {},
): DailySignInRecord {
  return {
    id: 1,
    uid: "u1",
    sign_date: "2026-05-06",
    streak_count: 1,
    cycle_day: 1,
    reward_points: 10,
    createdAt: new Date("2026-05-06T00:00:00Z"),
    ...overrides,
  } as DailySignInRecord;
}

function createService(repositories: Map<any, any>, ledgerResult?: any) {
  const manager = {
    getRepository: jest.fn((entity) => repositories.get(entity)),
  };
  const dataSource = {
    getRepository: jest.fn((entity) => repositories.get(entity)),
    transaction: jest.fn((callback) => callback(manager)),
  };
  const pointLedgerService = {
    applyChange: jest.fn().mockResolvedValue(
      ledgerResult || {
        point_before: 0,
        point_after: 10,
      },
    ),
  };
  return {
    service: new DailySignInService(dataSource as any, pointLedgerService as any),
    dataSource,
    manager,
    pointLedgerService,
  };
}

describe("DailySignInService", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-05-07T04:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("首次签到发放 10 星穹币并写入记录", async () => {
    const user = { uid: "u1", point: 0 } as User;
    const recordRepository = createRepository();
    const userRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(user),
    });
    const { service, manager, pointLedgerService } = createService(
      new Map<any, any>([
        [DailySignInRecord, recordRepository],
        [User, userRepository],
      ]),
    );

    await expect(service.claim("u1")).resolves.toEqual(
      expect.objectContaining({
        signedToday: true,
        signDate: "2026-05-07",
        currentStreak: 1,
        cycleDay: 1,
        rewardPoints: 10,
        pointBefore: 0,
        pointAfter: 10,
      }),
    );
    expect(pointLedgerService.applyChange).toHaveBeenCalledWith(
      manager,
      user,
      10,
      expect.objectContaining({
        sourceType: "daily_sign_in",
        sourceId: "2026-05-07",
        title: "每日签到",
        metadata: expect.objectContaining({
          streakCount: 1,
          cycleDay: 1,
          rewardPoints: 10,
        }),
      }),
    );
    expect(recordRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "u1",
        sign_date: "2026-05-07",
        streak_count: 1,
        cycle_day: 1,
        reward_points: 10,
      }),
    );
  });

  it("同一天重复签到会被拒绝", async () => {
    const recordRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(
        createRecord({
          sign_date: "2026-05-07",
        }),
      ),
    });
    const { service, pointLedgerService } = createService(
      new Map<any, any>([
        [DailySignInRecord, recordRepository],
        [User, createRepository()],
      ]),
    );

    await expect(service.claim("u1")).rejects.toThrow("今日已签到");
    expect(pointLedgerService.applyChange).not.toHaveBeenCalled();
  });

  it("并发写入命中唯一索引时返回今日已签到", async () => {
    const recordRepository = createRepository({
      save: jest.fn().mockRejectedValue({ code: "ER_DUP_ENTRY" }),
    });
    const userRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({ uid: "u1", point: 0 }),
    });
    const { service } = createService(
      new Map<any, any>([
        [DailySignInRecord, recordRepository],
        [User, userRepository],
      ]),
    );

    await expect(service.claim("u1")).rejects.toThrow("今日已签到");
  });

  it("连续第 7 天签到发放 100 星穹币", async () => {
    const user = { uid: "u1", point: 30 } as User;
    const recordRepository = createRepository({
      find: jest.fn().mockResolvedValue([
        createRecord({
          sign_date: "2026-05-06",
          streak_count: 6,
          cycle_day: 6,
        }),
      ]),
    });
    const userRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(user),
    });
    const { service, pointLedgerService } = createService(
      new Map<any, any>([
        [DailySignInRecord, recordRepository],
        [User, userRepository],
      ]),
      { point_before: 30, point_after: 130 },
    );

    await expect(service.claim("u1")).resolves.toEqual(
      expect.objectContaining({
        currentStreak: 7,
        cycleDay: 7,
        rewardPoints: 100,
        pointAfter: 130,
      }),
    );
    expect(pointLedgerService.applyChange).toHaveBeenCalledWith(
      expect.anything(),
      user,
      100,
      expect.objectContaining({
        title: "七日签到",
      }),
    );
  });

  it("中断后重新从第 1 天计算", async () => {
    const recordRepository = createRepository({
      find: jest.fn().mockResolvedValue([
        createRecord({
          sign_date: "2026-05-05",
          streak_count: 5,
          cycle_day: 5,
        }),
      ]),
    });
    const userRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({ uid: "u1", point: 0 }),
    });
    const { service } = createService(
      new Map<any, any>([
        [DailySignInRecord, recordRepository],
        [User, userRepository],
      ]),
    );

    await expect(service.claim("u1")).resolves.toEqual(
      expect.objectContaining({
        currentStreak: 1,
        cycleDay: 1,
        rewardPoints: 10,
      }),
    );
  });

  it("连续第 8 天回到新一轮第 1 天", async () => {
    const recordRepository = createRepository({
      find: jest.fn().mockResolvedValue([
        createRecord({
          sign_date: "2026-05-06",
          streak_count: 7,
          cycle_day: 7,
          reward_points: 100,
        }),
      ]),
    });
    const userRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({ uid: "u1", point: 0 }),
    });
    const { service } = createService(
      new Map<any, any>([
        [DailySignInRecord, recordRepository],
        [User, userRepository],
      ]),
    );

    await expect(service.claim("u1")).resolves.toEqual(
      expect.objectContaining({
        currentStreak: 8,
        cycleDay: 1,
        rewardPoints: 10,
      }),
    );
  });
});
