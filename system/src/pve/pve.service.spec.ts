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
      save: async (value: T) => {
        const key = value[idKey];
        const index = items.findIndex((item) => item[idKey] === key);
        if (index >= 0) {
          items[index] = value;
        } else {
          items.push(value);
        }
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

function createService(store: PveTestStore) {
  const pointLedgerService = {
    applyChange: jest.fn(async (_manager, user: User, amount: number) => {
      user.point = Number(user.point || 0) + amount;
      return {};
    }),
  };
  return new PveService(
    store as any,
    new FormationService(store as any),
    new RewardService(pointLedgerService as any),
  );
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
      todayCount: 1,
      remainingAttempts: 2,
      canChallenge: true,
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
});
