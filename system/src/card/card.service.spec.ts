jest.mock("uuid", () => ({
  v4: jest.fn(() => "00000000-0000-4000-8000-000000000000"),
}));

import { ArgumentMetadata, ValidationPipe } from "@nestjs/common";
import { CardService } from "./card.service";
import { GachaConfigService } from "./gacha-config.service";
import { DrawCardDto, DrawMultipleDto } from "./card.controller";
import { CardItem } from "src/entity/card.entity";
import { PoolInfo } from "src/entity/pool.entity";
import { User } from "src/entity/user.entity";
import { UserCard } from "src/entity/userCard.entity";
import { UserHistory } from "src/entity/history.entity";
import { UserGachaPity } from "src/entity/userGachaPity.entity";

describe("CardService 抽卡核心规则", () => {
  let service: CardService;

  beforeEach(() => {
    const configService = {
      getDefaultConfig: jest.fn(() => ({
        poolId: 1,
        rarityProbabilities: {
          N: 0.5,
          R: 0.3,
          SR: 0.15,
          SSR: 0.045,
          UR: 0.005,
        },
        pitySystem: {
          enabled: true,
          softPity: { count: 10, guaranteedRarity: "SR" },
          hardPity: { count: 90, guaranteedRarity: "SSR" },
        },
      })),
      getConfigByPoolId: jest.fn(async (poolId: number) => ({
        poolId,
        rarityProbabilities: {
          N: 0.5,
          R: 0.3,
          SR: 0.15,
          SSR: 0.045,
          UR: 0.005,
        },
      })),
      validateProbabilities: jest.fn(
        (probabilities: Record<string, number>) => {
          const total = Object.values(probabilities).reduce(
            (sum, probability) => sum + probability,
            0,
          );
          return Math.abs(total - 1) < 0.0001;
        },
      ),
    } as unknown as GachaConfigService;

    service = new CardService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      configService,
      {} as any,
    );
  });

  it("稀有度匹配必须精确，SR 不应命中 SSR", () => {
    expect(
      (service as any).cardSupportsRarity(
        { card_level: "SSR" } as CardItem,
        "SR",
      ),
    ).toBe(false);
    expect(
      (service as any).cardSupportsRarity(
        { card_level: "SR,SSR" } as CardItem,
        "SR",
      ),
    ).toBe(true);
    expect(
      (service as any).cardSupportsRarity(
        { card_level: "SR,SSR" } as CardItem,
        "SSR",
      ),
    ).toBe(true);
  });

  it("保底会按最低稀有度重算概率池", () => {
    jest.spyOn(service as any, "randomFloat").mockReturnValue(0.1);

    const rarity = (service as any).rollRarity(
      { N: 0.5, R: 0.3, SR: 0.15, SSR: 0.04, UR: 0.01 },
      "SSR",
    );

    expect(rarity).toBe("SSR");
  });

  it("硬保底优先于软保底", () => {
    const pity = {
      draws_since_sr: 9,
      draws_since_ssr: 89,
      draws_since_ur: 89,
    };
    const config = {
      enabled: true,
      softPity: { count: 10, guaranteedRarity: "SR" },
      hardPity: { count: 90, guaranteedRarity: "SSR" },
    };

    expect((service as any).getPityMinimumRarity(pity, config)).toBe("SSR");
  });

  it("UP 概率命中时只从当前稀有度的 UP 卡里抽取", () => {
    jest.spyOn(service as any, "randomFloat").mockReturnValue(0.1);
    const cards = [
      { id: 1, card_level: "SSR" },
      { id: 2, card_level: "SSR" },
    ] as CardItem[];

    const result = (service as any).pickCardForRarity(cards, {
      enabled: true,
      cardIds: [2],
      upRate: 0.5,
    });

    expect(result.card.id).toBe(2);
    expect(result.isUp).toBe(true);
  });

  it("SSR 合成碎片数量不能被 R 的包含关系误判", () => {
    expect((service as any).getRequiredFragments("SSR")).toBe(1000);
  });

  it("未配置卡片碎片时优先使用全局默认碎片", async () => {
    const defaultFragment = {
      id: 2,
      drop_name: "默认碎片",
      drop_type: 0,
      disabled: false,
      default_fragment: true,
    };
    const dropRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(async ({ where }) =>
        where.default_fragment === true ? defaultFragment : null,
      ),
    };
    const manager = {
      getRepository: jest.fn().mockReturnValue(dropRepository),
    };

    await expect(
      (service as any).findFragmentItem(manager, {
        drop_item: "",
      } as CardItem),
    ).resolves.toBe(defaultFragment);
  });

  it("卡片单独配置碎片时优先使用卡片配置", async () => {
    const configuredFragment = {
      id: 9,
      drop_name: "专属碎片",
      drop_type: 0,
      disabled: false,
      default_fragment: false,
    };
    const dropRepository = {
      find: jest.fn().mockResolvedValue([configuredFragment]),
      findOne: jest.fn(),
    };
    const manager = {
      getRepository: jest.fn().mockReturnValue(dropRepository),
    };

    await expect(
      (service as any).findFragmentItem(manager, {
        drop_item: "9",
      } as CardItem),
    ).resolves.toBe(configuredFragment);
    expect(dropRepository.findOne).not.toHaveBeenCalled();
  });

  it("禁用的默认碎片不会作为默认配置使用", async () => {
    const fallbackFragment = {
      id: 3,
      drop_name: "备用碎片",
      drop_type: 0,
      disabled: false,
      default_fragment: false,
    };
    const dropRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(async ({ where }) =>
        where.default_fragment === true ? null : fallbackFragment,
      ),
    };
    const manager = {
      getRepository: jest.fn().mockReturnValue(dropRepository),
    };

    await expect(
      (service as any).findFragmentItem(manager, {
        drop_item: "",
      } as CardItem),
    ).resolves.toBe(fallbackFragment);
  });
});

describe("CardController 入参安全", () => {
  it("抽卡请求不允许客户端传入自定义概率配置", async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    const metadata: ArgumentMetadata = {
      type: "body",
      metatype: DrawCardDto,
      data: "",
    };

    await expect(
      pipe.transform(
        {
          poolId: 1,
          config: {
            rarityProbabilities: { UR: 1 },
          },
        },
        metadata,
      ),
    ).rejects.toThrow();
  });

  it("自定义多抽只允许 1 抽或 10 抽", async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    const metadata: ArgumentMetadata = {
      type: "body",
      metatype: DrawMultipleDto,
      data: "",
    };

    await expect(
      pipe.transform({ poolId: 1, count: 2 }, metadata),
    ).rejects.toThrow();
    await expect(pipe.transform({ poolId: 1, count: 10 }, metadata)).resolves
      .toEqual(expect.objectContaining({ count: 10 }));
  });
});

describe("CardService 背包筛选", () => {
  function createRepository(overrides: Record<string, any> = {}) {
    return {
      create: jest.fn((value) => value),
      find: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn(),
      save: jest.fn((value) => Promise.resolve(value)),
      ...overrides,
    };
  }

  function getFindOperatorInfo(value: any) {
    return {
      type: value?._type || value?.type,
      value: value?._value ?? value?.value,
    };
  }

  function matchesValue(actual: any, expected: any) {
    const operator = getFindOperatorInfo(expected);
    if (operator.type === "in") {
      return operator.value.includes(actual);
    }
    if (operator.type === "isNull") {
      return actual === null || actual === undefined;
    }
    return actual === expected;
  }

  function filterByWhere<T extends Record<string, any>>(
    rows: T[],
    where?: Record<string, any> | Array<Record<string, any>>,
  ) {
    if (!where) {
      return rows;
    }
    const conditions = Array.isArray(where) ? where : [where];
    return rows.filter((row) =>
      conditions.some((condition) =>
        Object.entries(condition).every(([key, expected]) =>
          matchesValue(row[key], expected),
        ),
      ),
    );
  }

  function createListService(customUserCards: Partial<UserCard>[] = []) {
    const cards = [
      {
        id: 1,
        card_name: "多稀有度卡",
        card_level: "N,R,SR,SSR",
        card_desc: "测试",
        card_type: 0,
        pool: 1,
      },
      {
        id: 2,
        card_name: "隐藏卡",
        card_level: "UR",
        card_desc: "测试",
        card_type: 0,
        pool: 2,
      },
    ] as CardItem[];
    const userCards = [
      {
        id: 1,
        uid: "u1",
        card_id: "1",
        card_level: "N",
        card_uuid: "n-card",
        can_sell: true,
        can_lottery: true,
        delete_flag: false,
        createdAt: new Date("2026-01-01"),
      },
      {
        id: 2,
        uid: "u1",
        card_id: "1",
        card_level: "SSR",
        card_uuid: "ssr-card",
        can_sell: true,
        can_lottery: true,
        delete_flag: false,
        createdAt: new Date("2026-01-02"),
      },
      {
        id: 3,
        uid: "u1",
        card_id: "2",
        card_level: "UR",
        card_uuid: "ur-card",
        can_sell: true,
        can_lottery: true,
        delete_flag: false,
        createdAt: new Date("2026-01-03"),
      },
      ...customUserCards,
    ] as UserCard[];

    const cardRepository = createRepository({
      find: jest.fn(async (options?: any) => filterByWhere(cards, options?.where)),
    });
    const userCardRepository = createRepository({
      count: jest.fn(async (options?: any) =>
        filterByWhere(userCards, options?.where).length,
      ),
      find: jest.fn(async (options?: any) =>
        filterByWhere(userCards, options?.where)
          .sort((a, b) => b.id - a.id)
          .slice(options?.skip || 0, (options?.skip || 0) + options?.take),
      ),
    });
    const userRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({ id: 1, uid: "u1" }),
    });
    const userInventories = [
      {
        id: 1,
        user_id: 1,
        item_id: 10,
        num: 5,
      },
    ];
    const dropItems = [
      {
        id: 10,
        drop_name: "测试碎片",
        drop_desc: "用于测试库存",
        drop_type: 0,
        drop_item_type: 1,
        drop_item_value: 0,
      },
    ];
    const dropRepository = createRepository({
      find: jest.fn(async (options?: any) =>
        filterByWhere(dropItems, options?.where),
      ),
    });
    const inventoryRepository = createRepository({
      find: jest.fn(async (options?: any) =>
        filterByWhere(userInventories, options?.where),
      ),
    });
    const service = new CardService(
      cardRepository as any,
      createRepository() as any,
      userRepository as any,
      userCardRepository as any,
      createRepository() as any,
      dropRepository as any,
      inventoryRepository as any,
      createRepository() as any,
      {} as any,
      {} as any,
    );

    return { service };
  }

  it("按稀有度筛选应匹配用户实际获得等级", async () => {
    const { service } = createListService();

    const result = await service.getUserCards("u1", "SSR", undefined, 1, 20);

    expect(result.total).toBe(1);
    expect(result.list).toEqual([
      expect.objectContaining({
        uuid: "ssr-card",
        cardLevel: "SSR",
      }),
    ]);
  });

  it("筛选 N 不应返回同一张多稀有度卡的 SSR 用户卡", async () => {
    const { service } = createListService();

    const result = await service.getUserCards("u1", "N", undefined, 1, 20);

    expect(result.total).toBe(1);
    expect(result.list[0]).toEqual(
      expect.objectContaining({
        uuid: "n-card",
        cardLevel: "N",
      }),
    );
  });

  it("稀有度和卡池组合筛选应同时生效", async () => {
    const { service } = createListService();

    const result = await service.getUserCards("u1", "UR", 1, 1, 20);

    expect(result.total).toBe(0);
    expect(result.list).toEqual([]);
  });

  it("筛选不到卡片时仍应返回背包物品库存", async () => {
    const { service } = createListService();

    const result = await service.getUserCards("u1", "UR", 1, 1, 20);

    expect(result.list).toEqual([]);
    expect(result.dropItems).toEqual([
      expect.objectContaining({
        id: 10,
        name: "测试碎片",
        num: 5,
      }),
    ]);
  });

  it("旧数据没有实际等级时按卡片最高稀有度兜底筛选", async () => {
    const { service } = createListService([
      {
        id: 4,
        uid: "u1",
        card_id: "1",
        card_level: null,
        card_uuid: "legacy-card",
        can_sell: true,
        can_lottery: true,
        delete_flag: false,
        createdAt: new Date("2026-01-04"),
      },
    ]);

    const result = await service.getUserCards("u1", "SSR", undefined, 1, 20);

    expect(result.total).toBe(2);
    expect(result.list.map((card) => card.uuid)).toEqual([
      "legacy-card",
      "ssr-card",
    ]);
  });

  it("非法稀有度仍会被拒绝", async () => {
    const { service } = createListService();

    await expect(service.getUserCards("u1", "X", undefined, 1, 20)).rejects.toThrow(
      "稀有度参数无效",
    );
  });
});

describe("CardService 抽卡积分扣除", () => {
  function createRepository(overrides: Record<string, any> = {}) {
    return {
      create: jest.fn((value) => value),
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn((value) => Promise.resolve(value)),
      ...overrides,
    };
  }

  function createDrawService(user: Partial<User>, drawCosts = { once: 10, ten: 100 }) {
    const poolRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        pool_name: "测试卡池",
        card_desc: "",
        card_type: 0,
      }),
    });
    const cardRepository = createRepository({
      find: jest.fn().mockResolvedValue([
        {
          id: 1,
          card_name: "测试卡",
          card_level: "N",
          card_desc: "测试",
          card_type: 0,
          pool: 1,
        },
      ]),
    });
    const userRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        uid: "u1",
        point: 100,
        card_count_n: 0,
        card_count_r: 0,
        card_count_sr: 0,
        card_count_ssr: 0,
        card_count_ur: 0,
        ...user,
      }),
    });
    const userCardRepository = createRepository();
    const historyRepository = createRepository();
    const pityRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(null),
    });
    const repositories = new Map<any, any>([
      [PoolInfo, poolRepository],
      [CardItem, cardRepository],
      [User, userRepository],
      [UserCard, userCardRepository],
      [UserHistory, historyRepository],
      [UserGachaPity, pityRepository],
    ]);
    const manager = {
      getRepository: jest.fn((entity) => repositories.get(entity)),
    };
    const dataSource = {
      transaction: jest.fn((callback) => callback(manager)),
    };
    const configService = {
      getDefaultConfig: jest.fn(() => ({
        poolId: 1,
        rarityProbabilities: { N: 1 },
        drawCosts,
      })),
      getConfigByPoolId: jest.fn(async (poolId: number) => ({
        poolId,
        rarityProbabilities: { N: 1 },
        drawCosts,
      })),
      validateProbabilities: jest.fn(() => true),
    } as unknown as GachaConfigService;
    const service = new CardService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      configService,
      dataSource as any,
    );

    return {
      service,
      dataSource,
      userRepository,
      userCardRepository,
      historyRepository,
      pityRepository,
    };
  }

  it("单抽成功会在同一事务内扣除单抽积分", async () => {
    const { service, userRepository, userCardRepository } = createDrawService({
      point: 10,
    });

    await service.drawOnce("u1", 1);

    expect(userCardRepository.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ card_id: "1", card_level: "N" }),
      ]),
    );
    expect(userRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        point: 0,
        card_count_n: 1,
      }),
    );
  });

  it("十连成功会扣除十连积分", async () => {
    const { service, userRepository, userCardRepository } = createDrawService({
      point: 100,
    });

    await service.drawTen("u1", 1);

    expect(userCardRepository.save.mock.calls[0][0]).toHaveLength(10);
    expect(userRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        point: 0,
        card_count_n: 10,
      }),
    );
  });

  it("积分不足时不会发卡、写历史或保存保底", async () => {
    const { service, userCardRepository, historyRepository, pityRepository } =
      createDrawService({ point: 9 });

    await expect(service.drawOnce("u1", 1)).rejects.toThrow(
      "积分不足，需要10，当前9",
    );
    expect(userCardRepository.save).not.toHaveBeenCalled();
    expect(historyRepository.save).not.toHaveBeenCalled();
    expect(pityRepository.save).not.toHaveBeenCalled();
  });

  it("非 1 抽或 10 抽会在开启事务前拒绝", async () => {
    const { service, dataSource } = createDrawService({ point: 100 });

    await expect(service.drawMultiple("u1", 2, 1)).rejects.toThrow(
      "抽卡次数仅支持1抽或10抽",
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
