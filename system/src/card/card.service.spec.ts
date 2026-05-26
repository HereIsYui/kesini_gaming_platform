jest.mock("uuid", () => ({
  v4: jest.fn(() => "00000000-0000-4000-8000-000000000000"),
}));

import { ArgumentMetadata, ValidationPipe } from "@nestjs/common";
import { CardService } from "./card.service";
import { GachaConfigService } from "./gacha-config.service";
import {
  DrawCardDto,
  DrawMultipleDto,
  SynthesizeCardDto,
} from "./card.controller";
import { CardItem } from "src/entity/card.entity";
import { DropItem } from "src/entity/drop.entity";
import { UserInventory } from "src/entity/inventory.entity";
import { PoolInfo } from "src/entity/pool.entity";
import { User } from "src/entity/user.entity";
import { UserCard } from "src/entity/userCard.entity";
import { UserHistory } from "src/entity/history.entity";
import { UserGachaPity } from "src/entity/userGachaPity.entity";
import { TradeListing } from "src/entity/tradeListing.entity";

describe("CardService 抽卡核心规则", () => {
  let service: CardService;

  beforeEach(() => {
    const configService = {
      getDefaultConfig: jest.fn(() => ({
        poolId: 1,
        rarityProbabilities: {
          N: 0.5025,
          R: 0.3025,
          SR: 0.15,
          SSR: 0.045,
          UR: 0,
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
          N: 0.5025,
          R: 0.3025,
          SR: 0.15,
          SSR: 0.045,
          UR: 0,
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
    await expect(
      pipe.transform({ poolId: 1, count: 10 }, metadata),
    ).resolves.toEqual(expect.objectContaining({ count: 10 }));
  });

  it("合成请求只允许合法目标稀有度", async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    const metadata: ArgumentMetadata = {
      type: "body",
      metatype: SynthesizeCardDto,
      data: "",
    };

    await expect(
      pipe.transform({ card_id: 1, rarity: "SSR" }, metadata),
    ).resolves.toEqual(expect.objectContaining({ card_id: 1, rarity: "SSR" }));
    await expect(
      pipe.transform({ card_id: 1, rarity: "LR" }, metadata),
    ).rejects.toThrow();
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

  function createListService(
    customUserCards: Partial<UserCard>[] = [],
    activeListings: Partial<TradeListing>[] = [],
  ) {
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
      find: jest.fn(async (options?: any) =>
        filterByWhere(cards, options?.where),
      ),
    });
    const userCardRepository = createRepository({
      count: jest.fn(
        async (options?: any) =>
          filterByWhere(userCards, options?.where).length,
      ),
      find: jest.fn(async (options?: any) => {
        const start = options?.skip || 0;
        const end =
          options?.take === undefined ? undefined : start + options.take;
        return filterByWhere(userCards, options?.where)
          .sort((a, b) => b.id - a.id)
          .slice(start, end);
      }),
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
    const tradeListingRepository = createRepository({
      find: jest.fn(async (options?: any) =>
        filterByWhere(activeListings, options?.where),
      ),
    });
    const dataSource = {
      getRepository: jest.fn((entity) =>
        entity === TradeListing ? tradeListingRepository : undefined,
      ),
    };
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
      dataSource as any,
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

  it("堆叠背包会按卡池和稀有度聚合", async () => {
    const { service } = createListService(
      [
        {
          id: 4,
          uid: "u1",
          card_id: "1",
          card_level: "N",
          card_uuid: "n-card-2",
          can_sell: true,
          can_lottery: true,
          delete_flag: false,
          createdAt: new Date("2026-01-04"),
        },
        {
          id: 5,
          uid: "u1",
          card_id: "1",
          card_level: "SSR",
          card_uuid: "ssr-listed",
          can_sell: true,
          can_lottery: true,
          delete_flag: false,
          createdAt: new Date("2026-01-05"),
        },
      ],
      [{ id: 1, card_uuid: "ssr-listed", status: "active" }],
    );

    const result = await service.getUserCards(
      "u1",
      undefined,
      1,
      1,
      20,
      true,
    );

    expect(result.total).toBe(2);
    expect(result.list).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cardId: 1,
          cardLevel: "N",
          count: 2,
          listedCount: 0,
          sellableCount: 2,
          canSell: true,
        }),
        expect.objectContaining({
          cardId: 1,
          cardLevel: "SSR",
          count: 2,
          listedCount: 1,
          sellableCount: 1,
          canSell: true,
        }),
      ]),
    );
  });

  it("堆叠背包必须指定卡池", async () => {
    const { service } = createListService();

    await expect(
      service.getUserCards("u1", undefined, undefined, 1, 20, true),
    ).rejects.toThrow("请选择卡池");
  });

  it("非法稀有度仍会被拒绝", async () => {
    const { service } = createListService();

    await expect(
      service.getUserCards("u1", "X", undefined, 1, 20),
    ).rejects.toThrow("稀有度参数无效");
  });
});

describe("CardService 排行榜", () => {
  function createRepository(overrides: Record<string, any> = {}) {
    return {
      find: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn(),
      save: jest.fn((value) => Promise.resolve(value)),
      ...overrides,
    };
  }

  function createLeaderboardService(
    overrides: {
      users?: Partial<User>[];
      cards?: Partial<CardItem>[];
      userCards?: Partial<UserCard>[];
    } = {},
  ) {
    const users = (overrides.users || [
      { id: 1, uid: "a", name: "a", nickname: "阿尔法", avatar: "a.png" },
      { id: 2, uid: "b", name: "b", nickname: "贝塔", avatar: "b.png" },
      { id: 3, uid: "c", name: "c", nickname: "伽马", avatar: "c.png" },
      { id: 4, uid: "d", name: "d", nickname: "德尔塔", avatar: "d.png" },
    ]) as User[];
    const cards = (overrides.cards || [
      { id: 1, card_name: "多等级卡", card_level: "N,R", pool: 1 },
      { id: 2, card_name: "SSR卡", card_level: "SSR", pool: 1 },
      { id: 3, card_name: "UR卡", card_level: "UR", pool: 2 },
      { id: 4, card_name: "高等级卡", card_level: "SR,SSR", pool: 2 },
    ]) as CardItem[];
    const userCards = (overrides.userCards || [
      { id: 1, uid: "a", card_id: "1", card_level: "N", delete_flag: false },
      { id: 2, uid: "a", card_id: "1", card_level: "R", delete_flag: false },
      { id: 3, uid: "a", card_id: "2", card_level: "SSR", delete_flag: false },
      { id: 4, uid: "a", card_id: "3", card_level: "UR", delete_flag: false },
      { id: 5, uid: "a", card_id: "3", card_level: "UR", delete_flag: true },
      { id: 6, uid: "b", card_id: "1", card_level: "N", delete_flag: false },
      { id: 7, uid: "b", card_id: "2", card_level: null, delete_flag: false },
      { id: 8, uid: "c", card_id: "3", card_level: "UR", delete_flag: false },
      { id: 9, uid: "c", card_id: "4", card_level: "SR", delete_flag: false },
      { id: 10, uid: "c", card_id: "4", card_level: "SSR", delete_flag: false },
    ]) as UserCard[];

    const service = new CardService(
      createRepository({ find: jest.fn().mockResolvedValue(cards) }) as any,
      createRepository() as any,
      createRepository({ find: jest.fn().mockResolvedValue(users) }) as any,
      createRepository({
        find: jest
          .fn()
          .mockResolvedValue(userCards.filter((card) => !card.delete_flag)),
      }) as any,
      createRepository() as any,
      createRepository() as any,
      createRepository() as any,
      createRepository() as any,
      {} as any,
      {} as any,
    );

    return { service };
  }

  it("当前收藏口径不统计已分解卡片", async () => {
    const { service } = createLeaderboardService();

    const result = await service.getLeaderboard("a", 10);

    expect(result.rankings.totalCards.me).toEqual(
      expect.objectContaining({ uid: "a", value: 4 }),
    );
    expect(result.rankings.urCards.me).toEqual(
      expect.objectContaining({ uid: "a", value: 1 }),
    );
  });

  it("SSR 和 UR 榜单按实际稀有度统计，旧空等级按最高稀有度兜底", async () => {
    const { service } = createLeaderboardService();

    const result = await service.getLeaderboard("b", 10);

    expect(result.rankings.ssrCards.me).toEqual(
      expect.objectContaining({ uid: "b", value: 1 }),
    );
    expect(result.rankings.ssrCards.list.slice(0, 3)).toEqual([
      expect.objectContaining({ uid: "a", rank: 1, value: 1 }),
      expect.objectContaining({ uid: "b", rank: 1, value: 1 }),
      expect.objectContaining({ uid: "c", rank: 1, value: 1 }),
    ]);
  });

  it("集齐卡池按卡片和稀有度版本完整判断", async () => {
    const { service } = createLeaderboardService();

    const result = await service.getLeaderboard("c", 10);

    expect(result.rankings.completedPools.me).toEqual(
      expect.objectContaining({ uid: "c", value: 1 }),
    );
    expect(result.rankings.completedPools.list).toEqual([
      expect.objectContaining({ uid: "a", value: 1 }),
      expect.objectContaining({ uid: "c", value: 1 }),
    ]);
  });

  it("数量为 0 的用户不会出现在榜单和我的排名中", async () => {
    const { service } = createLeaderboardService();

    const result = await service.getLeaderboard("d", 2);

    expect(result.rankings.totalCards.list.map((entry) => entry.uid)).toEqual([
      "a",
      "c",
    ]);
    expect(result.rankings.totalCards.me).toBeNull();
  });

  it("limit 超过 100 时会按 100 截断", async () => {
    const users = Array.from({ length: 120 }, (_, index) => ({
      id: index + 1,
      uid: `u${String(index).padStart(3, "0")}`,
      name: `用户${index}`,
      nickname: `用户${index}`,
      avatar: "",
    }));
    const { service } = createLeaderboardService({
      users,
      cards: [{ id: 1, card_name: "N卡", card_level: "N", pool: 1 }],
      userCards: users.map((user, index) => ({
        id: index + 1,
        uid: user.uid,
        card_id: "1",
        card_level: "N",
        delete_flag: false,
      })),
    });

    const result = await service.getLeaderboard("u119", 150);

    expect(result.rankings.totalCards.list).toHaveLength(100);
    expect(result.rankings.totalCards.me).toEqual(
      expect.objectContaining({ uid: "u119", value: 1 }),
    );
  });
});

describe("CardService 碎片合成", () => {
  function createRepository(overrides: Record<string, any> = {}) {
    return {
      create: jest.fn((value) => value),
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn((value) => Promise.resolve(value)),
      ...overrides,
    };
  }

  function createSynthesisService(
    cardPatch: Partial<CardItem> = {},
    inventoryPatch: Partial<UserInventory> = {},
  ) {
    const card = {
      id: 1,
      card_name: "多稀有度卡",
      card_level: "N,R,SR,SSR",
      drop_item: "",
      card_desc: "测试",
      card_type: 0,
      pool: 1,
      ...cardPatch,
    } as CardItem;
    const fragment = {
      id: 5,
      drop_name: "通用碎片",
      drop_type: 0,
      disabled: false,
      default_fragment: true,
    } as DropItem;
    const inventory = {
      id: 1,
      user_id: 1,
      item_id: 5,
      num: 1000,
      ...inventoryPatch,
    } as UserInventory;
    const cardRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(card),
    });
    const dropRepository = createRepository({
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(async ({ where }) =>
        where.default_fragment === true ? fragment : null,
      ),
    });
    const userRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({ id: 1, uid: "u1" }),
    });
    const inventoryRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(inventory),
    });
    const userCardRepository = createRepository();
    const repositories = new Map<any, any>([
      [CardItem, cardRepository],
      [DropItem, dropRepository],
      [User, userRepository],
      [UserInventory, inventoryRepository],
      [UserCard, userCardRepository],
    ]);
    const manager = {
      getRepository: jest.fn((entity) => repositories.get(entity)),
    };
    const dataSource = {
      transaction: jest.fn((callback) => callback(manager)),
    };
    const service = new CardService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      dataSource as any,
    );

    return {
      service,
      inventoryRepository,
      userCardRepository,
    };
  }

  it("指定 N 合成时扣 80 碎片并发 N 卡", async () => {
    const { service, inventoryRepository, userCardRepository } =
      createSynthesisService();

    const result = await service.synthesizeCard("u1", 1, "N");

    expect(inventoryRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ num: 920 }),
    );
    expect(userCardRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ card_id: "1", card_level: "N" }),
    );
    expect(result.data).toEqual(
      expect.objectContaining({
        card_level: "N",
        fragments_used: 80,
      }),
    );
  });

  it("指定 SR 合成时扣 320 碎片并发 SR 卡", async () => {
    const { service, inventoryRepository, userCardRepository } =
      createSynthesisService();

    const result = await service.synthesizeCard("u1", 1, "SR");

    expect(inventoryRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ num: 680 }),
    );
    expect(userCardRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ card_id: "1", card_level: "SR" }),
    );
    expect(result.data).toEqual(
      expect.objectContaining({
        card_level: "SR",
        fragments_used: 320,
      }),
    );
  });

  it("提交卡片不支持的稀有度会拒绝", async () => {
    const { service, userCardRepository } = createSynthesisService({
      card_level: "N,R",
    });

    await expect(service.synthesizeCard("u1", 1, "SSR")).rejects.toThrow(
      "卡片不支持该稀有度",
    );
    expect(userCardRepository.save).not.toHaveBeenCalled();
  });

  it("提交 UR 仍不可合成", async () => {
    const { service, userCardRepository } = createSynthesisService({
      card_level: "N,UR",
    });

    await expect(service.synthesizeCard("u1", 1, "UR")).rejects.toThrow(
      "不能合成UR卡片",
    );
    expect(userCardRepository.save).not.toHaveBeenCalled();
  });

  it("不传目标稀有度时保持旧逻辑使用最高稀有度", async () => {
    const { service, inventoryRepository, userCardRepository } =
      createSynthesisService({ card_level: "N,R,SR" });

    const result = await service.synthesizeCard("u1", 1);

    expect(inventoryRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ num: 680 }),
    );
    expect(userCardRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ card_id: "1", card_level: "SR" }),
    );
    expect(result.data).toEqual(
      expect.objectContaining({
        card_level: "SR",
        fragments_used: 320,
      }),
    );
  });
});

describe("CardService 一键分解", () => {
  function createRepository(overrides: Record<string, any> = {}) {
    return {
      create: jest.fn((value) => value),
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn((value) => Promise.resolve(value)),
      ...overrides,
    };
  }

  function createBulkDecomposeService(
    overrides: {
      userCards?: Partial<UserCard>[];
      activeListings?: Partial<TradeListing>[];
    } = {},
  ) {
    const cards = [
      { id: 1, card_name: "N卡", card_level: "N", drop_item: "" },
      { id: 2, card_name: "R卡", card_level: "R", drop_item: "" },
      { id: 3, card_name: "SR卡", card_level: "SR", drop_item: "" },
      { id: 4, card_name: "UR卡", card_level: "UR", drop_item: "" },
    ] as CardItem[];
    const userCards = (overrides.userCards || [
      {
        id: 1,
        uid: "u1",
        card_id: "1",
        card_level: "N",
        card_uuid: "n-card",
        delete_flag: false,
        createdAt: new Date("2026-01-01"),
      },
      {
        id: 5,
        uid: "u1",
        card_id: "1",
        card_level: "N",
        card_uuid: "n-card-keep",
        delete_flag: false,
        createdAt: new Date("2026-01-05"),
      },
      {
        id: 2,
        uid: "u1",
        card_id: "2",
        card_level: "R",
        card_uuid: "r-card",
        delete_flag: false,
        createdAt: new Date("2026-01-02"),
      },
      {
        id: 6,
        uid: "u1",
        card_id: "2",
        card_level: "R",
        card_uuid: "r-card-keep",
        delete_flag: false,
        createdAt: new Date("2026-01-06"),
      },
      {
        id: 3,
        uid: "u1",
        card_id: "3",
        card_level: "SR",
        card_uuid: "sr-listed",
        delete_flag: false,
      },
      {
        id: 4,
        uid: "u1",
        card_id: "4",
        card_level: "UR",
        card_uuid: "ur-card",
        delete_flag: false,
      },
    ]) as UserCard[];
    const activeListings = (overrides.activeListings || [
      { id: 1, card_uuid: "sr-listed", status: "active" },
    ]) as TradeListing[];
    const fragment = {
      id: 5,
      drop_name: "通用碎片",
      drop_type: 0,
      disabled: false,
      default_fragment: true,
    } as DropItem;
    const inventory = {
      id: 1,
      user_id: 1,
      item_id: 5,
      num: 10,
    } as UserInventory;
    const cardRepository = createRepository({
      find: jest.fn(async () => cards),
    });
    const userRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({ id: 1, uid: "u1" }),
    });
    const userCardRepository = createRepository({
      find: jest.fn(async () =>
        userCards.filter((card) => card.uid === "u1" && !card.delete_flag),
      ),
    });
    const tradeListingRepository = createRepository({
      find: jest.fn(async () => activeListings),
    });
    const dropRepository = createRepository({
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(async ({ where }) =>
        where.default_fragment === true ? fragment : null,
      ),
    });
    const inventoryRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(inventory),
    });
    const repositories = new Map<any, any>([
      [CardItem, cardRepository],
      [User, userRepository],
      [UserCard, userCardRepository],
      [TradeListing, tradeListingRepository],
      [DropItem, dropRepository],
      [UserInventory, inventoryRepository],
    ]);
    const manager = {
      getRepository: jest.fn((entity) => repositories.get(entity)),
    };
    const dataSource = {
      getRepository: jest.fn((entity) => repositories.get(entity)),
      transaction: jest.fn((callback) => callback(manager)),
    };
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
      dataSource as any,
    );

    return {
      service,
      inventory,
      inventoryRepository,
      userCardRepository,
    };
  }

  it("一键分解预览会统计可分解数量并排除挂售卡", async () => {
    const { service } = createBulkDecomposeService();

    const result = await service.previewBulkDecompose("u1", ["N", "R", "SR"]);

    expect(result.total).toBe(2);
    expect(result.reservedCount).toBe(2);
    expect(result.skippedListed).toBe(1);
    expect(result.countsByRarity).toEqual(
      expect.objectContaining({ N: 1, R: 1, SR: 0 }),
    );
  });

  it("一键分解会批量删除卡片并聚合碎片入账", async () => {
    const { service, inventory, inventoryRepository, userCardRepository } =
      createBulkDecomposeService();

    const result = await service.bulkDecomposeCards("u1", ["N", "R"]);

    expect(result.decomposed).toBe(2);
    expect(result.fragments).toHaveLength(1);
    expect(result.fragments[0]).toEqual(
      expect.objectContaining({ itemId: 5, itemName: "通用碎片" }),
    );
    expect(result.fragments[0].count).toBeGreaterThanOrEqual(11);
    expect(userCardRepository.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ card_uuid: "n-card", delete_flag: true }),
        expect.objectContaining({ card_uuid: "r-card", delete_flag: true }),
      ]),
    );
    expect(userCardRepository.save).not.toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ card_uuid: "n-card-keep", delete_flag: true }),
        expect.objectContaining({ card_uuid: "r-card-keep", delete_flag: true }),
      ]),
    );
    expect(inventoryRepository.save).toHaveBeenCalledTimes(1);
    expect(inventory.num).toBe(10 + result.fragments[0].count);
  });

  it("一键分解拒绝选择 UR", async () => {
    const { service } = createBulkDecomposeService();

    await expect(service.bulkDecomposeCards("u1", ["UR"])).rejects.toThrow(
      "UR卡片不可以一键分解",
    );
  });

  it("没有可分解卡片时返回 0 且不写入库存", async () => {
    const { service, inventoryRepository } = createBulkDecomposeService();

    const result = await service.bulkDecomposeCards("u1", ["SSR"]);

    expect(result.decomposed).toBe(0);
    expect(result.fragments).toEqual([]);
    expect(inventoryRepository.save).not.toHaveBeenCalled();
  });
});

describe("CardService 抽卡星穹币扣除", () => {
  function createRepository(overrides: Record<string, any> = {}) {
    return {
      create: jest.fn((value) => value),
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn((value) => Promise.resolve(value)),
      ...overrides,
    };
  }

  function createDrawService(
    user: Partial<User>,
    drawCosts = { once: 10, ten: 100 },
    pointLedgerService?: any,
    pool: Partial<PoolInfo> = {},
  ) {
    const poolRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        pool_name: "测试卡池",
        card_desc: "",
        card_type: 0,
        enabled: true,
        ...pool,
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
      pointLedgerService,
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

  it("单抽成功会在同一事务内扣除单抽星穹币", async () => {
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

  it("抽卡扣星穹币时会写入星穹币流水", async () => {
    const pointLedgerService = {
      applyChange: jest.fn(async (_manager, user, amount, context) => {
        const pointBefore = user.point || 0;
        user.point = pointBefore + amount;
        return {
          point_before: pointBefore,
          point_after: user.point,
          ...context,
        };
      }),
    };
    const { service } = createDrawService(
      { point: 10 },
      { once: 10, ten: 100 },
      pointLedgerService,
    );

    await service.drawOnce("u1", 1);

    expect(pointLedgerService.applyChange).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ uid: "u1" }),
      -10,
      expect.objectContaining({
        sourceType: "draw_once",
        sourceId: 1,
        title: "单抽：测试卡池",
      }),
    );
  });

  it("十连成功会扣除十连星穹币", async () => {
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

  it("星穹币不足时不会发卡、写历史或保存保底", async () => {
    const { service, userCardRepository, historyRepository, pityRepository } =
      createDrawService({ point: 9 });

    await expect(service.drawOnce("u1", 1)).rejects.toThrow(
      "星穹币不足，需要10，当前9",
    );
    expect(userCardRepository.save).not.toHaveBeenCalled();
    expect(historyRepository.save).not.toHaveBeenCalled();
    expect(pityRepository.save).not.toHaveBeenCalled();
  });

  it("卡池下线后不能抽取", async () => {
    const { service, userCardRepository } = createDrawService(
      { point: 10 },
      { once: 10, ten: 100 },
      undefined,
      { enabled: false },
    );

    await expect(service.drawOnce("u1", 1)).rejects.toThrow("已下线");
    expect(userCardRepository.save).not.toHaveBeenCalled();
  });

  it("非 1 抽或 10 抽会在开启事务前拒绝", async () => {
    const { service, dataSource } = createDrawService({ point: 100 });

    await expect(service.drawMultiple("u1", 2, 1)).rejects.toThrow(
      "抽卡次数仅支持1抽或10抽",
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
