import { CardItem } from "src/entity/card.entity";
import { PointLedgerRecord } from "src/entity/pointLedgerRecord.entity";
import { SystemConfig } from "src/entity/systemConfig.entity";
import { TradeListing } from "src/entity/tradeListing.entity";
import { User } from "src/entity/user.entity";
import { UserCard } from "src/entity/userCard.entity";
import { ShopRecycleService } from "./shop-recycle.service";

function createRepository(overrides: Record<string, any> = {}) {
  return {
    create: jest.fn((value) => value),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn((value) => Promise.resolve(value)),
    ...overrides,
  };
}

function createUserCard(id: number, rarity: string) {
  return {
    id,
    uid: "u1",
    card_id: "1",
    card_level: rarity,
    can_sell: true,
    can_lottery: true,
    card_uuid: `card-${id}`,
    delete_flag: false,
  } as UserCard;
}

function createService(options: {
  configRow?: SystemConfig | null;
  card?: Partial<CardItem> | null;
  user?: Partial<User> | null;
  userCards?: UserCard[];
  listings?: Partial<TradeListing>[];
  pointAfter?: number;
} = {}) {
  const systemConfigRepository = createRepository({
    findOne: jest.fn().mockResolvedValue(options.configRow ?? null),
  });
  const cardRepository = createRepository({
    findOne: jest.fn().mockResolvedValue(
      options.card === null
        ? null
        : ({
            id: 1,
            card_name: "测试卡",
            card_level: "N,R,SR,SSR,UR",
            pool: 1,
            ...options.card,
          } as CardItem),
    ),
  });
  const userRepository = createRepository({
    findOne: jest.fn().mockResolvedValue(
      options.user === null
        ? null
        : ({
            uid: "u1",
            point: 10,
            ...options.user,
          } as User),
    ),
  });
  const userCardRepository = createRepository({
    find: jest.fn().mockResolvedValue(options.userCards ?? []),
    findOne: jest.fn(async ({ where }) =>
      (options.userCards ?? []).find(
        (item) =>
          (!where?.uid || item.uid === where.uid) &&
          (!where?.card_uuid || item.card_uuid === where.card_uuid) &&
          (where?.delete_flag === undefined ||
            item.delete_flag === where.delete_flag),
      ) || null,
    ),
  });
  const listingRepository = createRepository({
    find: jest.fn().mockResolvedValue(options.listings ?? []),
    findOne: jest.fn(async ({ where }) =>
      (options.listings ?? []).find(
        (item) =>
          (!where?.card_uuid || item.card_uuid === where.card_uuid) &&
          (!where?.status || item.status === where.status),
      ) || null,
    ),
  });
  const pointLedgerRepository = createRepository({
    create: jest.fn((value) => ({ id: 11, ...value })),
    save: jest.fn((value) => Promise.resolve(value)),
  });
  const repositories = new Map<any, any>([
    [SystemConfig, systemConfigRepository],
    [CardItem, cardRepository],
    [User, userRepository],
    [UserCard, userCardRepository],
    [TradeListing, listingRepository],
    [PointLedgerRecord, pointLedgerRepository],
  ]);
  const manager = {
    getRepository: jest.fn((entity) => repositories.get(entity)),
  };
  const dataSource = {
    getRepository: jest.fn((entity) => repositories.get(entity)),
    transaction: jest.fn((callback) => callback(manager)),
  };
  const pointLedgerService = {
    applyChange: jest.fn(async (_manager, user, amount, context) => ({
      id: 9,
      uid: user.uid,
      change_amount: amount,
      point_before: user.point,
      point_after: options.pointAfter ?? user.point + amount,
      source_type: context.sourceType,
    })),
  };
  const service = new ShopRecycleService(
    dataSource as any,
    pointLedgerService as any,
  );
  return {
    service,
    dataSource,
    pointLedgerService,
    repositories: {
      systemConfigRepository,
      cardRepository,
      userRepository,
      userCardRepository,
      listingRepository,
      pointLedgerRepository,
    },
  };
}

describe("ShopRecycleService", () => {
  it("默认回收配置使用低价方案", async () => {
    const { service } = createService();

    await expect(service.getConfig()).resolves.toEqual({
      enabled: true,
      priceN: 1,
      priceR: 2,
      priceSR: 5,
      priceSSR: 15,
      priceUR: 0,
    });
  });

  it("保存回收配置会校验非负整数", async () => {
    const { service } = createService();

    await expect(service.updateConfig({ priceN: -1 } as any)).rejects.toThrow(
      "N 回收价无效",
    );
    await expect(service.updateConfig({ priceUR: 1.2 } as any)).rejects.toThrow(
      "UR 回收价无效",
    );
  });

  it.each([
    ["N", 1],
    ["R", 2],
    ["SR", 5],
    ["SSR", 15],
  ])("回收 %s 卡按配置发放星穹币", async (rarity, price) => {
    const userCards = [createUserCard(1, rarity), createUserCard(2, rarity)];
    const { service, repositories, pointLedgerService } = createService({
      userCards,
    });

    const result = await service.recycleCards("u1", {
      cardId: 1,
      rarity,
      poolId: 1,
      count: 1,
    });

    expect(result).toEqual(
      expect.objectContaining({
        rarity,
        count: 1,
        unitPrice: price,
        rewardPoints: price,
        pointBefore: 10,
        pointAfter: 10 + price,
      }),
    );
    expect(repositories.userCardRepository.save).toHaveBeenCalledWith([
      expect.objectContaining({ delete_flag: true }),
    ]);
    expect(pointLedgerService.applyChange).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ uid: "u1" }),
      price,
      expect.objectContaining({
        sourceType: "shop_recycle",
        metadata: expect.objectContaining({ rarity, count: 1 }),
      }),
    );
  });

  it("当前组只有一张时拒绝回收", async () => {
    const { service, repositories, pointLedgerService } = createService({
      userCards: [createUserCard(1, "N")],
    });

    await expect(
      service.recycleCards("u1", { cardId: 1, rarity: "N", poolId: 1, count: 1 }),
    ).rejects.toThrow("至少保留一张");
    expect(repositories.userCardRepository.save).not.toHaveBeenCalled();
    expect(pointLedgerService.applyChange).not.toHaveBeenCalled();
  });

  it("挂售中的卡不会被回收但会作为保留卡", async () => {
    const userCards = [createUserCard(1, "SSR"), createUserCard(2, "SSR")];
    const { service, repositories, pointLedgerService } = createService({
      userCards,
      listings: [{ card_uuid: "card-1", status: "active" }],
    });

    await expect(
      service.recycleCards("u1", {
        cardId: 1,
        rarity: "SSR",
        poolId: 1,
        count: 1,
      }),
    ).resolves.toEqual(expect.objectContaining({ count: 1 }));
    expect(repositories.userCardRepository.save).toHaveBeenCalledWith([
      expect.objectContaining({ card_uuid: "card-2", delete_flag: true }),
    ]);
    expect(pointLedgerService.applyChange).toHaveBeenCalled();
  });

  it("锁定卡不会被回收但会作为保留卡", async () => {
    const lockedCard = createUserCard(1, "SSR");
    lockedCard.locked = true;
    const userCards = [lockedCard, createUserCard(2, "SSR")];
    const { service, repositories, pointLedgerService } = createService({
      userCards,
    });

    await expect(
      service.recycleCards("u1", {
        cardId: 1,
        rarity: "SSR",
        poolId: 1,
        count: 1,
      }),
    ).resolves.toEqual(expect.objectContaining({ count: 1 }));
    expect(repositories.userCardRepository.save).toHaveBeenCalledWith([
      expect.objectContaining({ card_uuid: "card-2", delete_flag: true }),
    ]);
    expect(pointLedgerService.applyChange).toHaveBeenCalled();
  });

  it("回收预览会排除锁定卡", async () => {
    const lockedCard = createUserCard(1, "R");
    lockedCard.locked = true;
    const { service } = createService({
      userCards: [lockedCard, createUserCard(2, "R"), createUserCard(3, "R")],
    });

    await expect(service.getRecyclePreview("u1", 1, "R")).resolves.toEqual(
      expect.objectContaining({
        availableCount: 2,
      }),
    );
  });

  it("回收价为 0 时仍写入回收流水", async () => {
    const userCards = [createUserCard(1, "N"), createUserCard(2, "N")];
    const { service, repositories, pointLedgerService } = createService({
      configRow: {
        key: "shopRecycleConfig",
        value: JSON.stringify({
          enabled: true,
          prices: { N: 0, R: 2, SR: 5, SSR: 15, UR: 50 },
        }),
      } as SystemConfig,
      userCards,
    });

    const result = await service.recycleCards("u1", {
      cardId: 1,
      rarity: "N",
      poolId: 1,
      count: 1,
    });

    expect(result).toEqual(
      expect.objectContaining({
        unitPrice: 0,
        rewardPoints: 0,
        pointBefore: 10,
        pointAfter: 10,
        ledgerId: 11,
      }),
    );
    expect(pointLedgerService.applyChange).not.toHaveBeenCalled();
    expect(repositories.pointLedgerRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        change_amount: 0,
        source_type: "shop_recycle",
      }),
    );
  });

  it("请求数量超过可回收数量时不改余额不删卡", async () => {
    const userCards = [
      createUserCard(1, "R"),
      createUserCard(2, "R"),
      createUserCard(3, "R"),
    ];
    const { service, repositories, pointLedgerService } = createService({
      userCards,
    });

    await expect(
      service.recycleCards("u1", { cardId: 1, rarity: "R", poolId: 1, count: 3 }),
    ).rejects.toThrow("可回收数量不足");
    expect(repositories.userCardRepository.save).not.toHaveBeenCalled();
    expect(pointLedgerService.applyChange).not.toHaveBeenCalled();
  });

  it("分组回收拒绝 UR", async () => {
    const { service } = createService({
      userCards: [createUserCard(1, "UR"), createUserCard(2, "UR")],
    });

    await expect(
      service.recycleCards("u1", {
        cardId: 1,
        rarity: "UR",
        poolId: 1,
        count: 1,
      }),
    ).rejects.toThrow("UR不可回收");
  });

  it("精确回收只删除指定单卡并返回 count 1", async () => {
    const userCards = [createUserCard(1, "SR"), createUserCard(2, "SR")];
    const { service, repositories, pointLedgerService } = createService({
      userCards,
    });

    const result = await service.recycleCard("u1", "card-1");

    expect(result).toEqual(
      expect.objectContaining({
        rarity: "SR",
        count: 1,
        unitPrice: 5,
        rewardPoints: 5,
        pointAfter: 15,
      }),
    );
    expect(repositories.userCardRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ card_uuid: "card-1", delete_flag: true }),
    );
    expect(userCards[1].delete_flag).toBe(false);
    expect(pointLedgerService.applyChange).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ uid: "u1" }),
      5,
      expect.objectContaining({
        sourceType: "shop_recycle",
        metadata: expect.objectContaining({
          cardUuid: "card-1",
          count: 1,
        }),
      }),
    );
  });

  it("精确回收拒绝锁定、挂售和最后一张", async () => {
    const lockedCard = createUserCard(1, "R");
    lockedCard.locked = true;
    await expect(
      createService({
        userCards: [lockedCard, createUserCard(2, "R")],
      }).service.recycleCard("u1", "card-1"),
    ).rejects.toThrow("已锁定");

    await expect(
      createService({
        userCards: [createUserCard(1, "R"), createUserCard(2, "R")],
        listings: [{ card_uuid: "card-1", status: "active" }],
      }).service.recycleCard("u1", "card-1"),
    ).rejects.toThrow("挂售中");

    await expect(
      createService({
        userCards: [createUserCard(1, "R")],
      }).service.recycleCard("u1", "card-1"),
    ).rejects.toThrow("至少保留一张");
  });

  it("精确回收拒绝 UR 和非本人卡片", async () => {
    await expect(
      createService({
        userCards: [createUserCard(1, "UR"), createUserCard(2, "UR")],
      }).service.recycleCard("u1", "card-1"),
    ).rejects.toThrow("UR不可回收");

    await expect(
      createService({
        userCards: [createUserCard(1, "SSR"), createUserCard(2, "SSR")],
      }).service.recycleCard("u2", "card-1"),
    ).rejects.toThrow("用户没有这张卡片");
  });
});
