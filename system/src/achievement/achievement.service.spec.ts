import { AchievementService } from "src/achievement/achievement.service";
import { AchievementConfig } from "src/entity/achievementConfig.entity";
import { AchievementEvent } from "src/entity/achievementEvent.entity";
import { DropItem } from "src/entity/drop.entity";
import { UserHistory } from "src/entity/history.entity";
import { User } from "src/entity/user.entity";
import { UserAchievement } from "src/entity/userAchievement.entity";
import { RewardService } from "src/reward/reward.service";

type EntityKey = new (...args: any[]) => any;

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
  return [...rows].sort((a, b) => {
    for (const [key, direction] of entries) {
      if (a[key] === b[key]) {
        continue;
      }
      const result = a[key] > b[key] ? 1 : -1;
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
      const filtered = rows.filter((item) => matchesWhere(item, options?.where));
      return sortRows(filtered, options?.order);
    }),
    findOne: jest.fn(async (options?: any) => {
      return rows.find((item) => matchesWhere(item, options?.where)) || null;
    }),
    count: jest.fn(async (options?: any) => {
      return rows.filter((item) => matchesWhere(item, options?.where)).length;
    }),
    save: jest.fn(async (value: any) => {
      if (Array.isArray(value)) {
        return Promise.all(value.map((item) => repository.save(item)));
      }
      if (!value.id) {
        value.id = nextId++;
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
    createQueryBuilder: jest.fn(() => {
      const state: {
        where?: any;
        params: Record<string, any>;
        nullAck: boolean;
        sumColumn?: string;
        skip?: number;
        take?: number;
      } = { params: {}, nullAck: false };
      const builder: any = {
        select: jest.fn((expression: string | string[]) => {
          if (typeof expression === "string") {
            const match = /SUM\(entity\.(\w+)\)/.exec(expression);
            state.sumColumn = match?.[1];
          }
          return builder;
        }),
        innerJoin: jest.fn(() => builder),
        leftJoin: jest.fn(() => builder),
        where: jest.fn((condition: any, params?: Record<string, any>) => {
          if (typeof condition === "string") {
            Object.assign(state.params, params || {});
            if (condition.includes("notification_ack_at IS NULL")) {
              state.nullAck = true;
            }
          } else {
            state.where = condition;
          }
          return builder;
        }),
        andWhere: jest.fn((condition: string, params?: Record<string, any>) => {
          Object.assign(state.params, params || {});
          if (condition.includes("notification_ack_at IS NULL")) {
            state.nullAck = true;
          }
          return builder;
        }),
        orderBy: jest.fn(() => builder),
        addOrderBy: jest.fn(() => builder),
        skip: jest.fn((value: number) => {
          state.skip = value;
          return builder;
        }),
        take: jest.fn((value: number) => {
          state.take = value;
          return builder;
        }),
        getRawOne: jest.fn(async () => {
          const total = rows
            .filter((item) => matchesWhere(item, state.where))
            .reduce((sum, item: any) => sum + Number(item[state.sumColumn!] || 0), 0);
          return { total };
        }),
        getMany: jest.fn(async () => {
          let result = rows.filter((item: any) => {
            if (state.params.uid !== undefined && item.uid !== state.params.uid) {
              return false;
            }
            if (
              state.params.achieved !== undefined &&
              item.achieved !== state.params.achieved
            ) {
              return false;
            }
            if (
              state.params.achievementId !== undefined &&
              item.achievement_id !== state.params.achievementId
            ) {
              return false;
            }
            if (state.nullAck && item.notification_ack_at) {
              return false;
            }
            return matchesWhere(item, state.where);
          });
          result = result.sort((a: any, b: any) => Number(a.id || 0) - Number(b.id || 0));
          if (state.skip !== undefined) {
            result = result.slice(state.skip);
          }
          if (state.take !== undefined) {
            result = result.slice(0, state.take);
          }
          return result;
        }),
        getManyAndCount: jest.fn(async () => {
          const result = await builder.getMany();
          return [result, result.length];
        }),
      };
      return builder;
    }),
  };
  return repository;
}

function createHarness(options: {
  configs?: Partial<AchievementConfig>[];
  histories?: Partial<UserHistory>[];
  users?: Partial<User>[];
  dropItems?: Partial<DropItem>[];
}) {
  const repositories = new Map<any, any>();
  const configRepository = createRepository(
    (options.configs || []).map((config, index) => ({
      id: index + 1,
      code: `achievement_${index + 1}`,
      name: `成就 ${index + 1}`,
      description: "",
      category: "常规",
      target_type: "total_draws",
      target_value: 1,
      target_scope: null,
      rewards: { points: 1, items: [] },
      sort_order: 0,
      enabled: true,
      starts_at: null,
      ends_at: null,
      delete_flag: false,
      ...config,
    })) as AchievementConfig[],
  );
  const recordRepository = createRepository<UserAchievement>([]);
  const eventRepository = createRepository<AchievementEvent>([]);
  const userRepository = createRepository(
    (options.users || [{ id: 1, uid: "u1", point: 0 }]).map((user, index) => ({
      id: index + 1,
      uid: "u1",
      name: "",
      nickname: "",
      avatar: "",
      point: 0,
      ...user,
    })) as User[],
  );
  const historyRepository = createRepository(
    (options.histories || []).map((history, index) => ({
      id: index + 1,
      uid: "u1",
      count: 1,
      card_ids: "",
      card_levels: "",
      card_uuids: "",
      ...history,
    })) as UserHistory[],
  );
  const dropRepository = createRepository(
    (options.dropItems || []).map((item, index) => ({
      id: index + 1,
      drop_name: `物品 ${index + 1}`,
      drop_desc: "",
      drop_type: 0,
      drop_item_type: 0,
      drop_item_value: 0,
      disabled: false,
      default_fragment: false,
      ...item,
    })) as DropItem[],
  );

  repositories.set(AchievementConfig, configRepository);
  repositories.set(UserAchievement, recordRepository);
  repositories.set(AchievementEvent, eventRepository);
  repositories.set(User, userRepository);
  repositories.set(UserHistory, historyRepository);
  repositories.set(DropItem, dropRepository);

  const manager = {
    getRepository: jest.fn((entity: EntityKey) => repositories.get(entity)),
  };
  const dataSource = {
    manager,
    getRepository: jest.fn((entity: EntityKey) => repositories.get(entity)),
  };
  const service = new AchievementService(dataSource as any, new RewardService());
  return {
    service,
    manager,
    configRepository,
    recordRepository,
    eventRepository,
    userRepository,
    dropRepository,
  };
}

describe("AchievementService", () => {
  it("未达目标时只更新进度，不发放奖励和通知", async () => {
    const { service, manager, recordRepository, userRepository } = createHarness({
      configs: [{ code: "draw_3", target_value: 3, rewards: { points: 50, items: [] } }],
      histories: [{ count: 2 }],
      users: [{ uid: "u1", point: 0 }],
    });

    const result = await service.evaluateAndUnlock(manager as any, "u1");

    expect(result).toEqual([]);
    expect(recordRepository.rows[0]).toEqual(
      expect.objectContaining({ progress: 2, achieved: false }),
    );
    expect(userRepository.rows[0].point).toBe(0);
  });

  it("达成成就后只发一次奖励", async () => {
    const { service, manager, recordRepository, userRepository } = createHarness({
      configs: [{ code: "draw_2", target_value: 2, rewards: { points: 10, items: [] } }],
      histories: [{ count: 2 }],
      users: [{ uid: "u1", point: 0 }],
    });

    const first = await service.evaluateAndUnlock(manager as any, "u1");
    const second = await service.evaluateAndUnlock(manager as any, "u1");

    expect(first).toHaveLength(1);
    expect(second).toEqual([]);
    expect(userRepository.rows[0].point).toBe(10);
    expect(recordRepository.rows[0]).toEqual(
      expect.objectContaining({
        achieved: true,
        progress: 2,
        reward_snapshot: { points: 10, items: [] },
      }),
    );
  });

  it("同一事件可以同时达成多个成就", async () => {
    const { service, manager, eventRepository, userRepository } = createHarness({
      configs: [
        {
          code: "decompose_1",
          name: "首次分解",
          target_type: "decompose_count",
          target_value: 1,
          rewards: { points: 5, items: [] },
        },
        {
          code: "decompose_2",
          name: "连续分解",
          target_type: "decompose_count",
          target_value: 2,
          rewards: { points: 7, items: [] },
        },
      ],
      users: [{ uid: "u1", point: 0 }],
    });

    const result = await service.evaluateAndUnlock(manager as any, "u1", [
      { type: "decompose_count", amount: 2 },
    ]);

    expect(result.map((item) => item.code)).toEqual(["decompose_1", "decompose_2"]);
    expect(eventRepository.rows).toHaveLength(1);
    expect(userRepository.rows[0].point).toBe(12);
  });

  it("通知 ACK 后不会重复返回", async () => {
    const { service, manager } = createHarness({
      configs: [{ code: "draw_1", name: "首次抽取", rewards: { points: 1, items: [] } }],
      histories: [{ count: 1 }],
      users: [{ uid: "u1", point: 0 }],
    });
    await service.evaluateAndUnlock(manager as any, "u1");

    const unread = await service.listUnreadNotifications("u1");
    await service.ackNotifications("u1", [unread[0].achievementId]);
    const next = await service.listUnreadNotifications("u1");

    expect(unread).toHaveLength(1);
    expect(unread[0]).toEqual(expect.objectContaining({ code: "draw_1" }));
    expect(next).toEqual([]);
  });

  it("奖励物品不存在或禁用时阻止保存成就配置", async () => {
    const disabledHarness = createHarness({
      dropItems: [{ id: 9, drop_name: "禁用碎片", disabled: true }],
    });
    await expect(
      disabledHarness.service.createAchievement({
        code: "disabled_item",
        name: "禁用奖励",
        target_type: "total_draws",
        target_value: 1,
        rewards: { points: 0, items: [{ itemId: 9, num: 1 }] },
      }),
    ).rejects.toThrow("奖励物品已禁用");

    const missingHarness = createHarness({});
    await expect(
      missingHarness.service.createAchievement({
        code: "missing_item",
        name: "缺失奖励",
        target_type: "total_draws",
        target_value: 1,
        rewards: { points: 0, items: [{ itemId: 404, num: 1 }] },
      }),
    ).rejects.toThrow("奖励物品不存在");
  });

  it("玩家成就列表会返回当前进度", async () => {
    const { service } = createHarness({
      configs: [{ code: "draw_5", target_value: 5, rewards: { points: 1, items: [] } }],
      histories: [{ count: 3 }],
    });

    const result = await service.listPlayerAchievements("u1");

    expect(result.list[0]).toEqual(
      expect.objectContaining({
        code: "draw_5",
        progress: 3,
        achieved: false,
      }),
    );
  });
});
