import { CardItem } from "src/entity/card.entity";
import { DropItem } from "src/entity/drop.entity";
import { ShopProduct } from "src/entity/shopProduct.entity";
import { ShopPurchaseRecord } from "src/entity/shopPurchaseRecord.entity";
import { User } from "src/entity/user.entity";
import { ShopMallService } from "./shop-mall.service";

function createRepository<T extends Record<string, any>>(rows: T[] = []) {
  let nextId =
    rows.reduce((max, row) => Math.max(max, Number(row.id || 0)), 0) + 1;

  return {
    rows,
    create: jest.fn((value) => ({ ...value })),
    find: jest.fn(async (options?: any) =>
      rows.filter((row) => matchesWhere(row, options?.where)),
    ),
    findOne: jest.fn(async (options?: any) => {
      const row = rows.find((item) => matchesWhere(item, options?.where));
      return row || null;
    }),
    findAndCount: jest.fn(async (options?: any) => [
      rows.filter((row) => matchesWhere(row, options?.where)),
      rows.filter((row) => matchesWhere(row, options?.where)).length,
    ]),
    save: jest.fn(async (value: T) => {
      if (!value.id) {
        value.id = nextId++;
        rows.push(value);
        return value;
      }
      const index = rows.findIndex((row) => row.id === value.id);
      if (index >= 0) {
        rows[index] = value;
      } else {
        rows.push(value);
      }
      return value;
    }),
  };
}

function matchesWhere(row: Record<string, any>, where: any): boolean {
  if (!where) {
    return true;
  }
  if (Array.isArray(where)) {
    return where.some((item) => matchesWhere(row, item));
  }
  return Object.entries(where).every(([key, value]) => {
    if (isInOperator(value)) {
      return value._value.includes(row[key]);
    }
    if (value && typeof value === "object" && "_value" in value) {
      return String(row[key] || "").includes(String((value as any)._value || ""));
    }
    return row[key] === value;
  });
}

function isInOperator(value: any) {
  return value && value._type === "in" && Array.isArray(value._value);
}

const TEST_OFFSET_MS = 8 * 60 * 60 * 1000;
const TEST_DAY_MS = 24 * 60 * 60 * 1000;

function getDateKey(date = new Date()) {
  return new Date(date.getTime() + TEST_OFFSET_MS).toISOString().slice(0, 10);
}

function getIsoWeekKey(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  const day = date.getUTCDay() || 7;
  const thursday = new Date(date);
  thursday.setUTCDate(date.getUTCDate() + 4 - day);
  const year = thursday.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(
    ((thursday.getTime() - yearStart.getTime()) / TEST_DAY_MS + 1) / 7,
  );
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function currentPeriodKeys() {
  const dateKey = getDateKey();
  return {
    dateKey,
    weekKey: getIsoWeekKey(dateKey),
    monthKey: dateKey.slice(0, 7),
  };
}

function createService({
  products = [],
  purchases = [],
  users = [{ id: 1, uid: "u1", name: "fish", point: 500 }],
  dropItems = [{ id: 10, drop_name: "通用碎片", disabled: false }],
  cards = [],
}: {
  products?: any[];
  purchases?: any[];
  users?: any[];
  dropItems?: any[];
  cards?: any[];
} = {}) {
  const repositories = new Map<any, any>([
    [ShopProduct, createRepository(products)],
    [ShopPurchaseRecord, createRepository(purchases)],
    [User, createRepository(users)],
    [DropItem, createRepository(dropItems)],
    [CardItem, createRepository(cards)],
  ]);
  const manager = {
    getRepository: jest.fn((entity) => repositories.get(entity)),
  };
  const dataSource = {
    manager,
    getRepository: jest.fn((entity) => repositories.get(entity)),
    transaction: jest.fn((callback) => callback(manager)),
  };
  const rewardService = {
    normalizeRewards: jest.fn((rewards) => rewards),
    assertRewardItemsAvailable: jest.fn(),
    assertRewardCardsAvailable: jest.fn(),
    grantRewards: jest.fn(async (_manager, user, rewards) => {
      user.point = Number(user.point || 0) + Number(rewards.points || 0);
    }),
  };
  const pointLedgerService = {
    applyChange: jest.fn(async (_manager, user, amount) => {
      const pointAfter = Number(user.point || 0) + Number(amount || 0);
      if (pointAfter < 0) {
        throw new Error("余额不足");
      }
      user.point = pointAfter;
      return { point_after: pointAfter };
    }),
  };
  const rechargeService = {
    ensureConfig: jest.fn(async () => ({ gold_finger_key: "key" })),
    deductFishpiPoints: jest.fn(),
  };
  const achievementService = {
    evaluateAndUnlock: jest.fn(),
  };

  return {
    service: new ShopMallService(
      dataSource as any,
      rewardService as any,
      pointLedgerService as any,
      rechargeService as any,
      achievementService as any,
    ),
    repositories,
    rewardService,
    pointLedgerService,
    rechargeService,
    achievementService,
  };
}

describe("ShopMallService", () => {
  it("列出当前可见商品并返回库存和购买状态", async () => {
    const { service } = createService({
      users: [{ id: 1, uid: "u1", name: "fish", point: 50 }],
      products: [
        {
          id: 1,
          name: "碎片包",
          description: "",
          enabled: true,
          delete_flag: false,
          currency_type: "star_coin",
          price: 100,
          rewards: { points: 0, items: [{ itemId: 10, num: 2 }] },
          used_count: 1,
          total_limit: 3,
          user_limit: 2,
          sort_order: 0,
        },
        {
          id: 2,
          name: "过期包",
          enabled: true,
          delete_flag: false,
          currency_type: "star_coin",
          price: 1,
          rewards: { points: 0, items: [{ itemId: 10, num: 1 }] },
          ends_at: new Date(Date.now() - 1000),
        },
      ],
    });

    await expect(service.listProducts("u1")).resolves.toEqual([
      expect.objectContaining({
        id: 1,
        remaining: 2,
        canBuy: false,
        unavailableReason: "余额不足",
        rewards: {
          points: 0,
          items: [expect.objectContaining({ itemName: "通用碎片" })],
        },
      }),
    ]);
  });

  it("星穹币购买会扣款、发奖并写购买记录", async () => {
    const { service, repositories, pointLedgerService, rewardService } =
      createService({
        products: [
          {
            id: 1,
            name: "碎片包",
            enabled: true,
            delete_flag: false,
            currency_type: "star_coin",
            price: 100,
            rewards: { points: 10, items: [{ itemId: 10, num: 1 }] },
            used_count: 0,
            total_limit: 5,
            user_limit: 2,
          },
        ],
      });

    const result = await service.buy("u1", 1, {
      count: 2,
      requestId: "buy-1",
    });

    expect(result).toEqual(
      expect.objectContaining({
        productId: 1,
        count: 2,
        currencyType: "star_coin",
        costAmount: 200,
        pointAfter: 320,
      }),
    );
    expect(pointLedgerService.applyChange).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ uid: "u1" }),
      -200,
      expect.objectContaining({ sourceType: "shop_buy" }),
    );
    expect(rewardService.grantRewards).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ uid: "u1" }),
      { points: 20, items: [{ itemId: 10, num: 2 }] },
      expect.objectContaining({ sourceType: "shop_reward" }),
    );
    expect(repositories.get(ShopPurchaseRecord).rows).toEqual([
      expect.objectContaining({ status: "success", cost_amount: 200 }),
    ]);
    expect(repositories.get(ShopProduct).rows[0].used_count).toBe(2);
  });

  it("星穹币商品不能配置高于价格的星穹币奖励", async () => {
    const { service } = createService();

    await expect(
      service.createAdminProduct({
        name: "循环包",
        enabled: true,
        currency_type: "star_coin",
        price: 100,
        rewards: { points: 100, items: [] },
      }),
    ).rejects.toThrow("星穹币奖励不能高于价格");
  });

  it("商城限购字段为 0 时按不限处理", async () => {
    const { service } = createService();

    await expect(
      service.createAdminProduct({
        name: "648大礼包",
        enabled: true,
        currency_type: "fishpi_point",
        price: 648,
        total_limit: 0,
        user_limit: 1,
        daily_limit: 0,
        weekly_limit: 0,
        monthly_limit: 0,
        rewards: { points: 1296, items: [], cards: [] },
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        total_limit: null,
        user_limit: 1,
        daily_limit: null,
        weekly_limit: null,
        monthly_limit: null,
      }),
    );
  });

  it("商品列表返回每日每周每月限购进度", async () => {
    const keys = currentPeriodKeys();
    const { service } = createService({
      products: [
        {
          id: 1,
          name: "星核礼包",
          description: "",
          enabled: true,
          delete_flag: false,
          currency_type: "star_coin",
          price: 1,
          rewards: { points: 0, items: [{ itemId: 10, num: 1 }] },
          used_count: 0,
          user_limit: 10,
          daily_limit: 2,
          weekly_limit: 3,
          monthly_limit: 4,
          sort_order: 0,
        },
      ],
      purchases: [
        {
          id: 1,
          uid: "u1",
          product_id: 1,
          status: "success",
          count: 2,
          date_key: keys.dateKey,
          week_key: keys.weekKey,
          month_key: keys.monthKey,
        },
      ],
    });

    await expect(service.listProducts("u1")).resolves.toEqual([
      expect.objectContaining({
        id: 1,
        usedByUser: 2,
        usedToday: 2,
        usedThisWeek: 2,
        usedThisMonth: 2,
        dailyLimit: 2,
        weeklyLimit: 3,
        monthlyLimit: 4,
        canBuy: false,
        unavailableReason: "今日已满",
      }),
    ]);
  });

  it("达到每日限购后不能继续购买", async () => {
    const keys = currentPeriodKeys();
    const { service } = createService({
      products: [
        {
          id: 1,
          name: "每日礼包",
          enabled: true,
          delete_flag: false,
          currency_type: "star_coin",
          price: 1,
          rewards: { points: 0, items: [{ itemId: 10, num: 1 }] },
          used_count: 0,
          daily_limit: 1,
        },
      ],
      purchases: [
        {
          id: 1,
          uid: "u1",
          product_id: 1,
          status: "success",
          count: 1,
          date_key: keys.dateKey,
          week_key: keys.weekKey,
          month_key: keys.monthKey,
        },
      ],
    });

    await expect(
      service.buy("u1", 1, { count: 1, requestId: "daily-limit" }),
    ).rejects.toThrow("今日已满");
  });

  it("达到每周限购后不能继续购买", async () => {
    const keys = currentPeriodKeys();
    const { service } = createService({
      products: [
        {
          id: 1,
          name: "每周礼包",
          enabled: true,
          delete_flag: false,
          currency_type: "star_coin",
          price: 1,
          rewards: { points: 0, items: [{ itemId: 10, num: 1 }] },
          used_count: 0,
          weekly_limit: 1,
        },
      ],
      purchases: [
        {
          id: 1,
          uid: "u1",
          product_id: 1,
          status: "success",
          count: 1,
          date_key: "2000-01-01",
          week_key: keys.weekKey,
          month_key: keys.monthKey,
        },
      ],
    });

    await expect(
      service.buy("u1", 1, { count: 1, requestId: "weekly-limit" }),
    ).rejects.toThrow("本周已满");
  });

  it("达到每月限购后不能继续购买", async () => {
    const keys = currentPeriodKeys();
    const { service } = createService({
      products: [
        {
          id: 1,
          name: "每月礼包",
          enabled: true,
          delete_flag: false,
          currency_type: "star_coin",
          price: 1,
          rewards: { points: 0, items: [{ itemId: 10, num: 1 }] },
          used_count: 0,
          monthly_limit: 1,
        },
      ],
      purchases: [
        {
          id: 1,
          uid: "u1",
          product_id: 1,
          status: "success",
          count: 1,
          date_key: "2000-01-01",
          week_key: "2000-W01",
          month_key: keys.monthKey,
        },
      ],
    });

    await expect(
      service.buy("u1", 1, { count: 1, requestId: "monthly-limit" }),
    ).rejects.toThrow("本月已满");
  });

  it("未成功记录不计入周期限购，成功购买写入周期", async () => {
    const keys = currentPeriodKeys();
    const { service, repositories } = createService({
      products: [
        {
          id: 1,
          name: "每日礼包",
          enabled: true,
          delete_flag: false,
          currency_type: "star_coin",
          price: 1,
          rewards: { points: 0, items: [{ itemId: 10, num: 1 }] },
          used_count: 0,
          daily_limit: 1,
        },
      ],
      purchases: [
        {
          id: 1,
          uid: "u1",
          product_id: 1,
          status: "failed",
          count: 1,
          date_key: keys.dateKey,
          week_key: keys.weekKey,
          month_key: keys.monthKey,
        },
      ],
    });

    await expect(
      service.buy("u1", 1, { count: 1, requestId: "success-period" }),
    ).resolves.toEqual(expect.objectContaining({ productId: 1, count: 1 }));
    expect(repositories.get(ShopPurchaseRecord).rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          request_id: "success-period",
          status: "success",
          date_key: keys.dateKey,
          week_key: keys.weekKey,
          month_key: keys.monthKey,
        }),
      ]),
    );
  });
});
