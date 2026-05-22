import { DropItem } from "src/entity/drop.entity";
import { ExchangeShopItem } from "src/entity/exchangeShopItem.entity";
import { ExchangeShopUsage } from "src/entity/exchangeShopUsage.entity";
import { UserInventory } from "src/entity/inventory.entity";
import { User } from "src/entity/user.entity";
import { ExchangeService } from "./exchange.service";

function createRepository(overrides: Record<string, any> = {}) {
  return {
    create: jest.fn((value) => value),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn((value) => Promise.resolve(value)),
    ...overrides,
  };
}

function createService(repositories: Map<any, any>) {
  const manager = {
    getRepository: jest.fn((entity) => repositories.get(entity)),
  };
  const dataSource = {
    transaction: jest.fn((callback) => callback(manager)),
  };
  return {
    service: new ExchangeService(dataSource as any),
    dataSource,
  };
}

describe("ExchangeService", () => {
  it("可兑换列表只返回时间有效的启用兑换项并给出可兑换状态", async () => {
    const now = Date.now();
    const userRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({ id: 5, uid: "u1" }),
    });
    const shopRepository = createRepository({
      find: jest.fn().mockResolvedValue([
        {
          id: 1,
          name: "代币换星穹币",
          enabled: true,
          delete_flag: false,
          costs: [{ itemId: 10, num: 2 }],
          rewards: { points: 100, items: [] },
          used_count: 0,
          total_limit: 10,
          user_limit: 2,
          sort_order: 0,
        },
        {
          id: 2,
          name: "未来兑换",
          enabled: true,
          delete_flag: false,
          starts_at: new Date(now + 60_000),
          costs: [{ itemId: 10, num: 2 }],
          rewards: { points: 100, items: [] },
        },
      ]),
    });
    const inventoryRepository = createRepository({
      find: jest.fn().mockResolvedValue([{ user_id: 5, item_id: 10, num: 3 }]),
    });
    const dropRepository = createRepository({
      find: jest.fn().mockResolvedValue([
        { id: 10, drop_name: "活动代币", drop_type: 2, disabled: false },
      ]),
    });
    const { service } = createService(
      new Map<any, any>([
        [User, userRepository],
        [ExchangeShopItem, shopRepository],
        [ExchangeShopUsage, createRepository()],
        [UserInventory, inventoryRepository],
        [DropItem, dropRepository],
      ]),
    );

    await expect(service.listAvailableItems("u1")).resolves.toEqual([
      expect.objectContaining({
        id: 1,
        canExchange: true,
        unavailableReason: "",
        remaining: 10,
        usedByUser: 0,
      }),
    ]);
  });

  it("兑换成功后同时扣物品、发星穹币和物品、写兑换记录", async () => {
    const shopItem = {
      id: 1,
      name: "代币换碎片",
      enabled: true,
      delete_flag: false,
      costs: [{ itemId: 10, num: 2 }],
      rewards: { points: 50, items: [{ itemId: 20, num: 1 }] },
      used_count: 0,
      total_limit: 10,
      user_limit: 3,
    };
    const user = { id: 5, uid: "u1", point: 0 };
    const costInventory = { id: 7, user_id: 5, item_id: 10, num: 10 };
    const shopRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(shopItem),
    });
    const userRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(user),
    });
    const inventoryRepository = createRepository({
      find: jest.fn().mockResolvedValue([costInventory]),
      findOne: jest.fn().mockResolvedValue(null),
    });
    const usageRepository = createRepository();
    const dropRepository = createRepository({
      find: jest.fn().mockResolvedValue([
        { id: 10, drop_name: "活动代币", drop_type: 2, disabled: false },
        { id: 20, drop_name: "通用碎片", drop_type: 0, disabled: false },
      ]),
    });
    const { service } = createService(
      new Map<any, any>([
        [ExchangeShopItem, shopRepository],
        [ExchangeShopUsage, usageRepository],
        [User, userRepository],
        [UserInventory, inventoryRepository],
        [DropItem, dropRepository],
      ]),
    );

    await expect(service.claim("u1", 1, 2)).resolves.toEqual({
      exchangeItemId: 1,
      count: 2,
      costs: [{ itemId: 10, num: 4 }],
      rewards: { points: 100, items: [{ itemId: 20, num: 2 }] },
    });
    expect(inventoryRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ item_id: 10, num: 6 }),
    );
    expect(userRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ point: 100 }),
    );
    expect(inventoryRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 5, item_id: 20, num: 2 }),
    );
    expect(shopRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ used_count: 2 }),
    );
    expect(usageRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ shop_item_id: 1, uid: "u1", count: 2 }),
    );
  });

  it("物品不足时拒绝兑换", async () => {
    const service = createClaimService({
      inventoryNum: 1,
      costNum: 2,
    });

    await expect(service.claim("u1", 1, 1)).rejects.toThrow("物品不足");
  });

  it("库存不足时拒绝兑换", async () => {
    const service = createClaimService({
      totalLimit: 1,
      usedCount: 1,
      inventoryNum: 10,
    });

    await expect(service.claim("u1", 1, 1)).rejects.toThrow("兑换项库存不足");
  });

  it("单用户限兑生效", async () => {
    const service = createClaimService({
      userLimit: 1,
      usageCount: 1,
      inventoryNum: 10,
    });

    await expect(service.claim("u1", 1, 1)).rejects.toThrow(
      "超过单用户限兑次数",
    );
  });

  it("禁用物品不能作为兑换消耗或奖励", async () => {
    const service = createClaimService({
      inventoryNum: 10,
      dropItems: [{ id: 10, drop_name: "旧代币", drop_type: 2, disabled: true }],
    });

    await expect(service.claim("u1", 1, 1)).rejects.toThrow("消耗物品已禁用");
  });
});

function createClaimService({
  costNum = 2,
  inventoryNum = 10,
  totalLimit = 10,
  usedCount = 0,
  userLimit = null,
  usageCount = 0,
  dropItems = [
    { id: 10, drop_name: "活动代币", drop_type: 2, disabled: false },
  ],
}: {
  costNum?: number;
  inventoryNum?: number;
  totalLimit?: number | null;
  usedCount?: number;
  userLimit?: number | null;
  usageCount?: number;
  dropItems?: Array<Record<string, any>>;
}) {
  const shopRepository = createRepository({
    findOne: jest.fn().mockResolvedValue({
      id: 1,
      name: "代币换星穹币",
      enabled: true,
      delete_flag: false,
      costs: [{ itemId: 10, num: costNum }],
      rewards: { points: 10, items: [] },
      total_limit: totalLimit,
      used_count: usedCount,
      user_limit: userLimit,
    }),
  });
  const usageRepository = createRepository({
    find: jest
      .fn()
      .mockResolvedValue(
        usageCount > 0 ? [{ shop_item_id: 1, uid: "u1", count: usageCount }] : [],
      ),
  });
  const { service } = createService(
    new Map<any, any>([
      [ExchangeShopItem, shopRepository],
      [ExchangeShopUsage, usageRepository],
      [User, createRepository({ findOne: jest.fn().mockResolvedValue({ id: 5, uid: "u1", point: 0 }) })],
      [
        UserInventory,
        createRepository({
          find: jest
            .fn()
            .mockResolvedValue([{ user_id: 5, item_id: 10, num: inventoryNum }]),
        }),
      ],
      [DropItem, createRepository({ find: jest.fn().mockResolvedValue(dropItems) })],
    ]),
  );
  return service;
}
