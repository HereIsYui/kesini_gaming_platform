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
});
