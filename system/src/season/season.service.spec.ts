import { CardItem } from "src/entity/card.entity";
import { DropItem } from "src/entity/drop.entity";
import { SeasonConfig } from "src/entity/seasonConfig.entity";
import { SeasonPointRecord } from "src/entity/seasonPointRecord.entity";
import { SeasonShopItem } from "src/entity/seasonShopItem.entity";
import { SeasonShopUsage } from "src/entity/seasonShopUsage.entity";
import { User } from "src/entity/user.entity";
import { UserSeasonProgress } from "src/entity/userSeasonProgress.entity";
import { SeasonService } from "./season.service";

function isInOperator(value: unknown) {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    ((value as any)._type === "in" || (value as any).type === "in")
  );
}

function inValues(value: any) {
  return Array.isArray(value?._value)
    ? value._value
    : Array.isArray(value?.value)
      ? value.value
      : [];
}

function matchesWhere(item: any, where?: any) {
  if (!where) {
    return true;
  }
  if (Array.isArray(where)) {
    return where.some((entry) => matchesWhere(item, entry));
  }
  return Object.entries(where).every(([key, expected]) => {
    if (isInOperator(expected)) {
      return inValues(expected).includes(item[key]);
    }
    return item[key] === expected;
  });
}

function sortRows(rows: any[], order?: Record<string, "ASC" | "DESC">) {
  if (!order) {
    return rows;
  }
  const entries = Object.entries(order);
  return [...rows].sort((left, right) => {
    for (const [key, direction] of entries) {
      if (left[key] === right[key]) {
        continue;
      }
      const result = left[key] > right[key] ? 1 : -1;
      return direction === "DESC" ? -result : result;
    }
    return 0;
  });
}

function createRepository<T extends { id?: number }>(initial: T[] = []) {
  const rows = initial;
  let nextId =
    rows.reduce((max, item) => Math.max(max, Number(item.id || 0)), 0) + 1;
  const repository = {
    rows,
    create: jest.fn((value) => value),
    find: jest.fn(async (options?: any) => {
      const filtered = rows.filter((item) =>
        matchesWhere(item, options?.where),
      );
      return sortRows(filtered, options?.order);
    }),
    findOne: jest.fn(async (options?: any) => {
      return rows.find((item) => matchesWhere(item, options?.where)) || null;
    }),
    save: jest.fn(async (value: any) => {
      if (Array.isArray(value)) {
        return Promise.all(value.map((item) => repository.save(item)));
      }
      if (!value.id) {
        value.id = nextId++;
        value.createdAt = value.createdAt || new Date();
        rows.push(value);
        return value;
      }
      const index = rows.findIndex((item) => item.id === value.id);
      if (index >= 0) {
        rows[index] = value;
      } else {
        rows.push(value);
      }
      return value;
    }),
  };
  return repository;
}

function createSeason(overrides: Partial<SeasonConfig> = {}): SeasonConfig {
  return {
    id: 1,
    season_key: "s1",
    name: "第一赛季",
    description: "赛季说明",
    enabled: true,
    shop_enabled: true,
    leaderboard_enabled: true,
    starts_at: new Date("2026-01-01T00:00:00Z"),
    ends_at: new Date("2026-12-31T23:59:59Z"),
    delete_flag: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as SeasonConfig;
}

function createHarness(
  options: {
    seasons?: Partial<SeasonConfig>[];
    progresses?: Partial<UserSeasonProgress>[];
    shopItems?: Partial<SeasonShopItem>[];
    usages?: Partial<SeasonShopUsage>[];
    users?: Partial<User>[];
  } = {},
) {
  const repositories = new Map<any, any>();
  repositories.set(
    SeasonConfig,
    createRepository(
      (options.seasons || [createSeason()]).map((season, index) =>
        createSeason({ id: index + 1, ...season }),
      ),
    ),
  );
  repositories.set(
    UserSeasonProgress,
    createRepository(
      (options.progresses || []).map((progress, index) => ({
        id: index + 1,
        uid: "u1",
        season_key: "s1",
        earned_points: 0,
        point_balance: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...progress,
      })) as UserSeasonProgress[],
    ),
  );
  repositories.set(SeasonPointRecord, createRepository<SeasonPointRecord>([]));
  repositories.set(
    SeasonShopItem,
    createRepository(
      (options.shopItems || []).map((item, index) => ({
        id: index + 1,
        season_key: "s1",
        name: `兑换项 ${index + 1}`,
        description: "",
        enabled: true,
        cost_points: 100,
        rewards: { points: 10, items: [] },
        total_limit: null,
        used_count: 0,
        user_limit: null,
        starts_at: null,
        ends_at: null,
        sort_order: 0,
        delete_flag: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...item,
      })) as SeasonShopItem[],
    ),
  );
  repositories.set(
    SeasonShopUsage,
    createRepository(
      (options.usages || []).map((usage, index) => ({
        id: index + 1,
        shop_item_id: 1,
        shop_item_name: "兑换项 1",
        season_key: "s1",
        uid: "u1",
        count: 1,
        cost_points: 100,
        reward_snapshot: { points: 10, items: [] },
        createdAt: new Date(),
        ...usage,
      })) as SeasonShopUsage[],
    ),
  );
  repositories.set(
    User,
    createRepository(
      (options.users || [{ id: 1, uid: "u1", point: 0 }]).map(
        (user, index) => ({
          id: index + 1,
          uid: "u1",
          name: "",
          nickname: "",
          avatar: "",
          point: 0,
          ...user,
        }),
      ) as User[],
    ),
  );
  repositories.set(DropItem, createRepository<DropItem>([]));
  repositories.set(CardItem, createRepository<CardItem>([]));
  const manager = {
    getRepository: jest.fn((entity) => repositories.get(entity)),
  };
  const dataSource = {
    getRepository: jest.fn((entity) => repositories.get(entity)),
    transaction: jest.fn((callback) => callback(manager)),
  };
  const rewardService = {
    normalizeRewards: jest.fn((rewards) => rewards),
    assertRewardItemsAvailable: jest.fn().mockResolvedValue(undefined),
    assertRewardCardsAvailable: jest.fn().mockResolvedValue(undefined),
    grantRewards: jest.fn().mockResolvedValue(undefined),
  };
  return {
    service: new SeasonService(dataSource as any, rewardService as any),
    repositories,
    manager,
    rewardService,
  };
}

describe("SeasonService", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-05-07T04:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("无开放赛季时返回空概览", async () => {
    const { service } = createHarness({
      seasons: [{ enabled: false }],
    });

    await expect(service.getOverview("u1")).resolves.toEqual(
      expect.objectContaining({
        season: null,
        points: { earned: 0, balance: 0 },
        leaderboard: { list: [], me: null },
        shopItems: [],
        records: [],
      }),
    );
  });

  it("领取任务奖励时发放赛季积分", async () => {
    const { service, manager, repositories } = createHarness();

    const record = await service.grantTaskActivity(manager as any, "u1", {
      periodKey: "2026-05-07",
      taskId: "daily_draw_1",
      taskName: "星轨初响",
      activityPoints: 20,
    });

    expect(record).toEqual(
      expect.objectContaining({
        uid: "u1",
        season_key: "s1",
        change_amount: 20,
        point_before: 0,
        point_after: 20,
        source_type: "task_activity",
      }),
    );
    expect(repositories.get(UserSeasonProgress).rows[0]).toEqual(
      expect.objectContaining({
        earned_points: 20,
        point_balance: 20,
      }),
    );
  });

  it("赛季商店兑换会扣余额、发奖励并写入记录", async () => {
    const { service, rewardService, repositories, manager } = createHarness({
      progresses: [{ earned_points: 200, point_balance: 200 }],
      shopItems: [{ id: 1, name: "星尘补给", cost_points: 80 }],
    });

    const result = await service.buyShopItem("u1", 1, 2);

    expect(result).toEqual(
      expect.objectContaining({
        itemId: 1,
        count: 2,
        costPoints: 160,
        points: { earned: 200, balance: 40 },
      }),
    );
    expect(rewardService.grantRewards).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({ uid: "u1" }),
      { points: 20, items: [] },
      expect.objectContaining({
        sourceType: "season_shop",
        title: "赛季商店奖励：星尘补给",
      }),
    );
    expect(repositories.get(SeasonShopUsage).rows[0]).toEqual(
      expect.objectContaining({
        shop_item_name: "星尘补给",
        count: 2,
        cost_points: 160,
      }),
    );
  });

  it("赛季积分不足时拒绝兑换", async () => {
    const { service, rewardService } = createHarness({
      progresses: [{ earned_points: 50, point_balance: 50 }],
      shopItems: [{ id: 1, cost_points: 80 }],
    });

    await expect(service.buyShopItem("u1", 1, 1)).rejects.toThrow(
      "赛季积分不足",
    );
    expect(rewardService.grantRewards).not.toHaveBeenCalled();
  });

  it("活动排行按累计获得积分排序", async () => {
    const { service } = createHarness({
      progresses: [
        { uid: "u2", earned_points: 40, point_balance: 40 },
        { uid: "u1", earned_points: 100, point_balance: 30 },
      ],
      users: [
        { id: 1, uid: "u1", nickname: "玩家一" },
        { id: 2, uid: "u2", nickname: "玩家二" },
      ],
    });

    const result = await service.getLeaderboard("u1", 10);

    expect(result.board.list.map((entry) => entry.uid)).toEqual(["u1", "u2"]);
    expect(result.board.me).toEqual(
      expect.objectContaining({ uid: "u1", rank: 1, value: 100 }),
    );
  });
});
