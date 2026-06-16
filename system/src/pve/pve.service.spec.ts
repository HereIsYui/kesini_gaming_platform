import { Between, FindOperator } from "typeorm";
import { CardItem } from "src/entity/card.entity";
import { DropItem } from "src/entity/drop.entity";
import { UserInventory } from "src/entity/inventory.entity";
import { PveChallengeRecord } from "src/entity/pveChallengeRecord.entity";
import { PveStage } from "src/entity/pveStage.entity";
import { TradeListing } from "src/entity/tradeListing.entity";
import { User } from "src/entity/user.entity";
import { UserCard } from "src/entity/userCard.entity";
import { UserFormationSlot } from "src/entity/userFormationSlot.entity";
import { FormationService } from "src/formation/formation.service";
import { RewardService } from "src/reward/reward.service";
import { PveService } from "./pve.service";

type EntityClass<T> = new () => T;

class PveTestStore {
  stages: PveStage[] = [];
  records: PveChallengeRecord[] = [];
  users: User[] = [];
  slots: UserFormationSlot[] = [];
  userCards: UserCard[] = [];
  cards: CardItem[] = [];
  listings: TradeListing[] = [];
  drops: DropItem[] = [];
  inventories: UserInventory[] = [];
  nextRecordId = 1;

  getRepository<T>(entity: EntityClass<T>) {
    if (entity === PveStage) {
      return this.createArrayRepository(this.stages);
    }
    if (entity === PveChallengeRecord) {
      return this.createRecordRepository();
    }
    if (entity === User) {
      return this.createArrayRepository(this.users, "uid");
    }
    if (entity === UserFormationSlot) {
      return this.createArrayRepository(this.slots);
    }
    if (entity === UserCard) {
      return this.createArrayRepository(this.userCards);
    }
    if (entity === CardItem) {
      return this.createArrayRepository(this.cards);
    }
    if (entity === TradeListing) {
      return this.createArrayRepository(this.listings);
    }
    if (entity === DropItem) {
      return this.createArrayRepository(this.drops);
    }
    if (entity === UserInventory) {
      return this.createInventoryRepository();
    }
    throw new Error("测试仓库未配置");
  }

  async transaction<T>(callback: (manager: PveTestStore) => Promise<T>) {
    return callback(this);
  }

  private createRecordRepository() {
    return {
      find: async (options?: any) =>
        this.records.filter((item) =>
          this.matchesWhere(item, options?.where || {}),
        ),
      count: async (options?: any) =>
        this.records.filter((item) =>
          this.matchesWhere(item, options?.where || {}),
        ).length,
      findAndCount: async (options?: any) => {
        const list = this.records
          .filter((item) => this.matchesWhere(item, options?.where || {}))
          .sort((left, right) => right.id - left.id);
        return [list.slice(options?.skip || 0, (options?.skip || 0) + options?.take), list.length];
      },
      create: (value: Partial<PveChallengeRecord>) => ({
        ...value,
        id: this.nextRecordId++,
        createdAt: new Date(),
      }),
      save: async (record: PveChallengeRecord) => {
        this.records.push(record);
        return record;
      },
    };
  }

  private createInventoryRepository() {
    return {
      findOne: async (options?: any) =>
        this.inventories.find((item) =>
          this.matchesWhere(item, options?.where || {}),
        ) || null,
      create: (value: Partial<UserInventory>) => ({
        ...value,
        id: this.inventories.length + 1,
      }),
      save: async (inventory: UserInventory) => {
        const index = this.inventories.findIndex(
          (item) => item.id === inventory.id,
        );
        if (index >= 0) {
          this.inventories[index] = inventory;
        } else {
          this.inventories.push(inventory);
        }
        return inventory;
      },
    };
  }

  private createArrayRepository<T extends Record<string, any>>(
    items: T[],
    idKey = "id",
  ) {
    return {
      find: async (options?: any) => {
        const result = items.filter((item) =>
          this.matchesWhere(item, options?.where || {}),
        );
        if (options?.order?.sort_order === "ASC") {
          return [...result].sort(
            (left, right) =>
              Number(left.sort_order || 0) - Number(right.sort_order || 0) ||
              Number(left.id || 0) - Number(right.id || 0),
          );
        }
        if (options?.order?.position === "ASC") {
          return [...result].sort(
            (left, right) => Number(left.position || 0) - Number(right.position || 0),
          );
        }
        return result;
      },
      findOne: async (options?: any) =>
        items.find((item) => this.matchesWhere(item, options?.where || {})) ||
        null,
      create: (value: Partial<T>) => ({
        ...value,
        [idKey]: value[idKey] ?? items.length + 1,
      }),
      save: async (value: T | T[]) => {
        const values = Array.isArray(value) ? value : [value];
        values.forEach((entry) => {
          const key = entry[idKey];
          const index = items.findIndex((item) => item[idKey] === key);
          if (index >= 0) {
            items[index] = entry;
          } else {
            items.push(entry);
          }
        });
        return value;
      },
    };
  }

  private matchesWhere(item: Record<string, any>, where: Record<string, any>) {
    return Object.entries(where || {}).every(([key, expected]) => {
      const actual = item[key];
      if (expected instanceof FindOperator) {
        const operator = expected as any;
        const value = operator._value;
        if (operator._type === "between") {
          const [start, end] = value as Date[];
          return actual >= start && actual <= end;
        }
        if (operator._type === "in") {
          return (value as unknown[]).includes(actual);
        }
      }
      return actual === expected;
    });
  }
}

function createStage(id: number, patch: Partial<PveStage> = {}): PveStage {
  return {
    id,
    name: `测试关卡${id}`,
    description: "测试关卡说明",
    enemy_power: 500,
    recommended_power: 500,
    daily_limit: 3,
    rewards: { points: 20, items: [{ itemId: 1, num: 2 }] },
    enabled: true,
    sort_order: id,
    starts_at: null,
    ends_at: null,
    delete_flag: false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...patch,
  } as PveStage;
}

function createUser(): User {
  return {
    id: 1,
    uid: "u1",
    point: 100,
    card_count_n: 0,
    card_count_r: 0,
    card_count_sr: 0,
    card_count_ssr: 1,
    card_count_ur: 0,
  } as User;
}

function seedFormation(store: PveTestStore) {
  store.cards = [
    {
      id: 1,
      card_name: "测试卡",
      card_desc: "测试卡说明",
      card_image: "",
      card_level: "SSR",
      card_type: 0,
      pool: 1,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    } as CardItem,
  ];
  store.userCards = [
    {
      id: 1,
      uid: "u1",
      card_id: "1",
      card_level: "SSR",
      can_sell: true,
      can_lottery: true,
      card_uuid: "card-a",
      delete_flag: false,
      locked: false,
      cultivation_level: 2,
      cultivation_exp: 0,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    } as UserCard,
  ];
  store.slots = [
    {
      id: 1,
      uid: "u1",
      position: 1,
      card_uuid: "card-a",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    } as UserFormationSlot,
  ];
}

function createService(
  store: PveTestStore,
  vip: {
    checked: boolean;
    active: boolean;
    levelCode: string;
    expiresAt: string | null;
  } | null = null,
  redis: any = undefined,
  riskConfig: Partial<{
    enabled: boolean;
    windowSeconds: number;
    limit: number;
    banSeconds: number;
  }> | null = null,
) {
  const pointLedgerService = {
    applyChange: jest.fn(async (_manager, user: User, amount: number) => {
      user.point = Number(user.point || 0) + amount;
      return {};
    }),
  };
  const rechargeService = vip
    ? {
        getGameVipStatus: jest.fn().mockResolvedValue(toGameVip(vip)),
      }
    : undefined;
  const systemConfigRepository = riskConfig
    ? {
        findOne: jest.fn().mockResolvedValue({
          key: "pve_risk_control",
          value: JSON.stringify(riskConfig),
        }),
      }
    : undefined;
  return new PveService(
    store as any,
    new FormationService(store as any),
    new RewardService(pointLedgerService as any),
    undefined,
    rechargeService as any,
    redis,
    systemConfigRepository as any,
  );
}

function toGameVip(vip: {
  checked: boolean;
  active: boolean;
  levelCode: string;
  expiresAt: string | null;
}) {
  const match = String(vip.levelCode || "")
    .trim()
    .toUpperCase()
    .match(/^VIP([1-4])/);
  const tier = vip.active && match ? Number(match[1]) : 0;
  const sweepLimits = [0, 5, 10, 20, 50];
  return {
    checked: vip.checked,
    active: vip.active && tier > 0,
    tier,
    label: tier > 0 ? `VIP${tier}` : "非VIP",
    sources: tier > 0 ? ["fishpi"] : [],
    sourceLabels: tier > 0 ? ["鱼排"] : [],
    sweepLimit: sweepLimits[tier] || 0,
    tradeFeeDiscount: 0,
    dailyRewards: { points: 0, items: [] },
    dailyClaimed: false,
    dailyClaimDate: "2026-01-01",
  };
}

describe("PveService 轻量关卡", () => {
  let store: PveTestStore;
  let service: PveService;

  beforeEach(() => {
    store = new PveTestStore();
    store.users = [createUser()];
    store.drops = [
      { id: 1, drop_name: "测试碎片", disabled: false } as DropItem,
    ];
    seedFormation(store);
    service = createService(store);
  });

  it("关卡列表返回阵容战力和今日次数", async () => {
    store.stages = [
      createStage(1),
      createStage(2, { enabled: false }),
      createStage(3, { starts_at: new Date(Date.now() + 86400000) }),
    ];
    store.records = [
      {
        id: 1,
        uid: "u1",
        stage_id: 1,
        stage_name: "测试关卡1",
        formation_power: 1000,
        enemy_power: 500,
        success: true,
        reward_snapshot: { points: 20, items: [] },
        createdAt: new Date(),
      } as PveChallengeRecord,
    ];

    const result = await service.listStages("u1");

    expect(result.formation.totalPower).toBeGreaterThan(0);
    expect(result.list).toHaveLength(1);
    expect(result.list[0]).toMatchObject({
      id: 1,
      cleared: true,
      todayCount: 1,
      remainingAttempts: 2,
      canChallenge: true,
      firstClearRewards: { points: 20, items: [{ itemId: 1, num: 2 }] },
      repeatRewards: { points: 0, items: [{ itemId: 1, num: 2 }] },
      rewards: { points: 0, items: [{ itemId: 1, num: 2 }] },
    });
  });

  it("关卡列表按分页返回", async () => {
    store.stages = Array.from({ length: 15 }, (_, index) =>
      createStage(index + 1),
    );

    const result = await service.listStages("u1", { page: 2, pageSize: 5 });

    expect(result.total).toBe(15);
    expect(result.page).toBe(2);
    expect(result.totalPages).toBe(3);
    expect(result.list.map((stage) => stage.id)).toEqual([6, 7, 8, 9, 10]);
  });

  it("关卡列表可定位到下一关", async () => {
    store.stages = Array.from({ length: 12 }, (_, index) =>
      createStage(index + 1),
    );
    store.records = Array.from({ length: 5 }, (_, index) => ({
      id: index + 1,
      uid: "u1",
      stage_id: index + 1,
      stage_name: `测试关卡${index + 1}`,
      formation_power: 1000,
      enemy_power: 500,
      success: true,
      reward_snapshot: { points: 20, items: [] },
      mode: "challenge",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    })) as PveChallengeRecord[];

    const result = await service.listStages("u1", {
      page: 1,
      pageSize: 5,
      focus: "nextUncleared",
    });

    expect(result.page).toBe(2);
    expect(result.nextUnclearedStageId).toBe(6);
    expect(result.nextUnclearedPage).toBe(2);
    expect(result.list.map((stage) => stage.id)).toEqual([6, 7, 8, 9, 10]);
  });

  it("战力足够时挑战胜利并发放奖励", async () => {
    store.stages = [createStage(1, { enemy_power: 100 })];

    const result = await service.challenge("u1", 1);

    expect(result.success).toBe(true);
    expect(store.records[0]).toMatchObject({
      stage_id: 1,
      success: true,
      reward_snapshot: { points: 20, items: [{ itemId: 1, num: 2 }] },
    });
    expect(store.users[0].point).toBe(120);
    expect(store.inventories[0]).toMatchObject({
      user_id: 1,
      item_id: 1,
      num: 2,
    });
  });

  it("重复通关只发碎片", async () => {
    store.stages = [createStage(1, { enemy_power: 100 })];
    store.records = [
      {
        id: 1,
        uid: "u1",
        stage_id: 1,
        stage_name: "测试关卡1",
        formation_power: 1000,
        enemy_power: 100,
        success: true,
        reward_snapshot: { points: 20, items: [{ itemId: 1, num: 2 }] },
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      } as PveChallengeRecord,
    ];

    const result = await service.challenge("u1", 1);

    expect(result.success).toBe(true);
    expect(store.records[1]).toMatchObject({
      stage_id: 1,
      success: true,
      reward_snapshot: { points: 0, items: [{ itemId: 1, num: 2 }] },
    });
    expect(store.users[0].point).toBe(100);
    expect(store.inventories[0]).toMatchObject({
      user_id: 1,
      item_id: 1,
      num: 2,
    });
    expect(result.stage).toMatchObject({
      cleared: true,
      rewards: { points: 0, items: [{ itemId: 1, num: 2 }] },
      firstClearRewards: { points: 20, items: [{ itemId: 1, num: 2 }] },
    });
  });

  it("重复通关不发奖励卡片", async () => {
    store.stages = [
      createStage(1, {
        enemy_power: 100,
        rewards: {
          points: 20,
          items: [{ itemId: 1, num: 2 }],
          cards: [{ cardId: 1, rarity: "SSR", num: 1 }],
        },
      }),
    ];
    store.records = [
      {
        id: 1,
        uid: "u1",
        stage_id: 1,
        stage_name: "测试关卡1",
        formation_power: 1000,
        enemy_power: 100,
        success: true,
        reward_snapshot: {
          points: 20,
          items: [{ itemId: 1, num: 2 }],
          cards: [{ cardId: 1, rarity: "SSR", num: 1 }],
        },
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      } as PveChallengeRecord,
    ];
    const initialCardCount = store.userCards.length;

    const result = await service.challenge("u1", 1);

    expect(result.rewards).toMatchObject({
      points: 0,
      items: [{ itemId: 1, num: 2 }],
    });
    expect(result.rewards?.cards).toBeUndefined();
    expect(store.records[1].reward_snapshot?.cards).toBeUndefined();
    expect(store.userCards).toHaveLength(initialCardCount);
    expect(store.users[0].card_count_ssr).toBe(1);
  });

  it("战力不足时记录失败且不发奖励", async () => {
    store.stages = [createStage(1, { enemy_power: 99999 })];

    const result = await service.challenge("u1", 1);

    expect(result.success).toBe(false);
    expect(store.records[0]).toMatchObject({
      stage_id: 1,
      success: false,
      reward_snapshot: null,
    });
    expect(store.users[0].point).toBe(100);
    expect(store.inventories).toHaveLength(0);
  });

  it("达到每日次数上限后拒绝挑战", async () => {
    store.stages = [createStage(1, { daily_limit: 1 })];
    store.records = [
      {
        id: 1,
        uid: "u1",
        stage_id: 1,
        stage_name: "测试关卡1",
        formation_power: 1000,
        enemy_power: 500,
        success: true,
        reward_snapshot: { points: 20, items: [] },
        createdAt: new Date(),
      } as PveChallengeRecord,
    ];

    await expect(service.challenge("u1", 1)).rejects.toThrow(
      "今日挑战次数已用完",
    );
  });

  it("未配置阵容时不能挑战", async () => {
    store.stages = [createStage(1)];
    store.slots = [];

    await expect(service.challenge("u1", 1)).rejects.toThrow("请先配置阵容");
  });

  it("VIP扫荡不再受每日次数限制并只发重复奖励", async () => {
    service = createService(store, {
      checked: true,
      active: true,
      levelCode: "VIP1_MONTH",
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
    store.stages = Array.from({ length: 6 }, (_, index) =>
      createStage(index + 1, {
        rewards: {
          points: 20,
          items: [{ itemId: 1, num: 2 }],
          cards: [{ cardId: 1, rarity: "SSR", num: 1 }],
        },
      }),
    );
    const initialCardCount = store.userCards.length;
    store.records = store.stages.map((stage, index) => ({
      id: index + 1,
      uid: "u1",
      stage_id: stage.id,
      stage_name: stage.name,
      formation_power: 1000,
      enemy_power: 500,
      success: true,
      reward_snapshot: { points: 20, items: [] },
      mode: "challenge",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    })) as PveChallengeRecord[];
    store.nextRecordId = 20;

    const result = await service.sweep("u1", {
      stageIds: [1, 2, 3, 4, 5, 6],
    });

    expect(result).toMatchObject({
      vipLevel: 1,
      unlimited: true,
      swept: 6,
    });
    expect(result.skipped).toEqual([]);
    const sweepRecords = store.records.filter((record) => record.mode === "sweep");
    expect(sweepRecords).toHaveLength(6);
    expect(sweepRecords[0].reward_snapshot).toEqual({
      points: 0,
      items: [{ itemId: 1, num: 2 }],
    });
    expect(store.users[0].point).toBe(100);
    expect(store.inventories[0]).toMatchObject({
      user_id: 1,
      item_id: 1,
      num: 12,
    });
    expect(store.userCards).toHaveLength(initialCardCount);
  });

  it("不指定关卡时自动扫荡全部已通关卡", async () => {
    service = createService(store, {
      checked: true,
      active: true,
      levelCode: "VIP1_MONTH",
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
    store.stages = [createStage(1), createStage(2), createStage(3)];
    // 仅 1、3 通关，2 未通关
    store.records = [1, 3].map((stageId, index) => ({
      id: index + 1,
      uid: "u1",
      stage_id: stageId,
      stage_name: `测试关卡${stageId}`,
      formation_power: 1000,
      enemy_power: 500,
      success: true,
      reward_snapshot: { points: 20, items: [] },
      mode: "challenge",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    })) as PveChallengeRecord[];
    store.nextRecordId = 20;

    const result = await service.sweep("u1", {});

    expect(result.swept).toBe(2);
    const sweptStageIds = store.records
      .filter((record) => record.mode === "sweep")
      .map((record) => record.stage_id)
      .sort();
    expect(sweptStageIds).toEqual([1, 3]);
  });

  it("非VIP不能扫荡", async () => {
    service = createService(store, {
      checked: true,
      active: false,
      levelCode: "VIP1_MONTH",
      expiresAt: "2026-01-01T00:00:00.000Z",
    });
    store.stages = [createStage(1)];

    await expect(service.sweep("u1", { stageIds: [1] })).rejects.toThrow(
      "非VIP",
    );
  });

  it("扫荡会跳过未通关关卡但不再受次数限制", async () => {
    service = createService(store, {
      checked: true,
      active: true,
      levelCode: "VIP4_YEAR",
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
    store.stages = [
      createStage(1, { daily_limit: 1 }),
      createStage(2, { daily_limit: 3 }),
    ];
    // 关卡1已通关（即使 daily_limit=1 也能继续扫荡），关卡2未通关
    store.records = [
      {
        id: 1,
        uid: "u1",
        stage_id: 1,
        stage_name: "测试关卡1",
        formation_power: 1000,
        enemy_power: 500,
        success: true,
        reward_snapshot: { points: 20, items: [] },
        mode: "challenge",
        createdAt: new Date(),
      } as PveChallengeRecord,
    ];

    const result = await service.sweep("u1", { stageIds: [1, 2] });

    expect(result.swept).toBe(1);
    expect(result.skipped).toEqual([
      { stageId: 2, stageName: "测试关卡2", reason: "未通关" },
    ]);
    expect(
      store.records.filter((record) => record.mode === "sweep"),
    ).toHaveLength(1);
  });

  it("挑战记录按分页返回", async () => {
    store.records = [
      {
        id: 1,
        uid: "u1",
        stage_id: 1,
        stage_name: "测试关卡1",
        formation_power: 1000,
        enemy_power: 500,
        success: true,
        reward_snapshot: { points: 20, items: [] },
        createdAt: new Date(),
      } as PveChallengeRecord,
    ];

    const result = await service.listRecords("u1", { page: 1, pageSize: 10 });

    expect(result.total).toBe(1);
    expect(result.list[0]).toMatchObject({
      stageId: 1,
      stageName: "测试关卡1",
      success: true,
    });
  });

  it("自动战斗顺序挑战未通关卡，遇到打不过即停止", async () => {
    store.stages = [
      createStage(1, { enemy_power: 100 }),
      createStage(2, { enemy_power: 200 }),
      createStage(3, { enemy_power: 999999 }), // 战力不足，停在这里
      createStage(4, { enemy_power: 100 }),
    ];
    // 阵容战力来自 SSR 卡，足以打过关卡1、2，打不过关卡3
    const result = await service.autoBattle("u1");

    expect(result.attempted).toBe(3);
    expect(result.cleared).toBe(2);
    expect(result.stopReason).toContain("战力不足");
    expect(result.list.map((item) => item.stageId)).toEqual([1, 2, 3]);
    expect(result.list[2].success).toBe(false);
    // 关卡4没被挑战
    expect(
      store.records.some(
        (record) => record.stage_id === 4 && record.mode === "auto",
      ),
    ).toBe(false);
  });

  it("自动战斗跳过已通关卡", async () => {
    store.stages = [
      createStage(1, { enemy_power: 100 }),
      createStage(2, { enemy_power: 100 }),
    ];
    store.records = [
      {
        id: 1,
        uid: "u1",
        stage_id: 1,
        stage_name: "测试关卡1",
        formation_power: 1000,
        enemy_power: 100,
        success: true,
        reward_snapshot: { points: 20, items: [] },
        mode: "challenge",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      } as PveChallengeRecord,
    ];
    store.nextRecordId = 10;

    const result = await service.autoBattle("u1");

    expect(result.list.map((item) => item.stageId)).toEqual([2]);
    expect(result.cleared).toBe(1);
  });

  it("挑战超过每分钟阈值后触发临时封禁", async () => {
    let counter = 0;
    let banned = false;
    const redis = {
      exists: jest.fn(async () => banned),
      incrWithExpire: jest.fn(async () => {
        counter += 1;
        return counter;
      }),
      set: jest.fn(async () => {
        banned = true;
        return true;
      }),
    };
    service = createService(store, null, redis);
    store.stages = [createStage(1, { enemy_power: 100, daily_limit: 1000 })];

    // 第 51 次调用触发封禁（incr 返回 51 > 50）
    counter = 50;
    await expect(service.challenge("u1", 1)).rejects.toThrow(
      "操作过于频繁",
    );
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringContaining("pve:ban:u1"),
      expect.objectContaining({ uid: "u1", count: 51 }),
      300,
    );

    // 已封禁后再次调用直接拒绝
    await expect(service.challenge("u1", 1)).rejects.toThrow(
      "操作过于频繁",
    );
  });

  it("Redis 不可用时风控放行不影响正常挑战", async () => {
    const redis = {
      exists: jest.fn(async () => false),
      incrWithExpire: jest.fn(async () => 0), // Redis 不可用返回 0
      set: jest.fn(),
    };
    service = createService(store, null, redis);
    store.stages = [createStage(1, { enemy_power: 100 })];

    const result = await service.challenge("u1", 1);

    expect(result.success).toBe(true);
    expect(redis.set).not.toHaveBeenCalled();
  });

  it("风控关闭时不限流不计数", async () => {
    const redis = {
      exists: jest.fn(async () => false),
      incrWithExpire: jest.fn(async () => 99999),
      set: jest.fn(),
    };
    service = createService(store, null, redis, { enabled: false });
    store.stages = [createStage(1, { enemy_power: 100 })];

    const result = await service.challenge("u1", 1);

    expect(result.success).toBe(true);
    expect(redis.exists).not.toHaveBeenCalled();
    expect(redis.incrWithExpire).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
  });

  it("使用后台自定义阈值触发封禁", async () => {
    let counter = 0;
    const redis = {
      exists: jest.fn(async () => false),
      incrWithExpire: jest.fn(async () => {
        counter += 1;
        return counter;
      }),
      set: jest.fn(async () => true),
    };
    // 自定义：窗口 30 秒，阈值 3 次，封禁 120 秒
    service = createService(store, null, redis, {
      enabled: true,
      windowSeconds: 30,
      limit: 3,
      banSeconds: 120,
    });
    store.stages = [createStage(1, { enemy_power: 100, daily_limit: 1000 })];

    // 第 4 次（incr 返回 4 > 3）触发封禁
    counter = 3;
    await expect(service.challenge("u1", 1)).rejects.toThrow("操作过于频繁");
    expect(redis.incrWithExpire).toHaveBeenCalledWith(
      expect.stringContaining("pve:rate:u1"),
      30,
    );
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringContaining("pve:ban:u1"),
      expect.objectContaining({ uid: "u1", count: 4 }),
      120,
    );
  });
});
