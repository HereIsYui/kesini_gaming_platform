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
import { SystemConfig } from "src/entity/systemConfig.entity";
import { RechargeRecord } from "src/entity/rechargeRecord.entity";
import { PveChallengeRecord } from "src/entity/pveChallengeRecord.entity";
import { UserFormationSlot } from "src/entity/userFormationSlot.entity";
import { UserShowcaseCard } from "src/entity/userShowcaseCard.entity";
import type { CardRarity } from "src/types/api";

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

  it("分解未配置卡片碎片时优先使用全局默认碎片", async () => {
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
      (service as any).findCardDecomposeFragmentItem(manager, {
        drop_item: "",
      } as CardItem),
    ).resolves.toBe(defaultFragment);
  });

  it("分解时卡片单独配置碎片优先使用卡片配置", async () => {
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
      (service as any).findCardDecomposeFragmentItem(manager, {
        drop_item: "9",
      } as CardItem),
    ).resolves.toBe(configuredFragment);
    expect(dropRepository.findOne).not.toHaveBeenCalled();
  });

  it("分解时禁用的默认碎片不会作为默认配置使用", async () => {
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
      (service as any).findCardDecomposeFragmentItem(manager, {
        drop_item: "",
      } as CardItem),
    ).resolves.toBe(fallbackFragment);
  });

  it("按稀有度找碎片时兼容旧名称并优先标准名称", async () => {
    const spacedFragment = {
      id: 1,
      drop_name: "R 碎片",
      drop_type: 0,
      disabled: false,
      default_fragment: false,
    };
    const standardFragment = {
      id: 9,
      drop_name: "R碎片",
      drop_type: 0,
      disabled: false,
      default_fragment: false,
    };
    const dropRepository = {
      find: jest.fn().mockResolvedValue([spacedFragment, standardFragment]),
    };
    const manager = {
      getRepository: jest.fn().mockReturnValue(dropRepository),
    };

    await expect(
      (service as any).findRarityFragmentItem(manager, "R"),
    ).resolves.toBe(standardFragment);
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
    if (operator.type === "moreThanOrEqual") {
      const actualTime =
        actual instanceof Date ? actual.getTime() : new Date(actual).getTime();
      const expectedTime =
        operator.value instanceof Date
          ? operator.value.getTime()
          : new Date(operator.value).getTime();
      return actualTime >= expectedTime;
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
      findOne: jest.fn(async (options?: any) =>
        filterByWhere(cards, options?.where)[0] || null,
      ),
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
          sellableCount: 1,
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

  it("堆叠背包会展示锁定数量并从可售数量中排除", async () => {
    const { service } = createListService([
      {
        id: 4,
        uid: "u1",
        card_id: "1",
        card_level: "N",
        card_uuid: "n-card-locked",
        can_sell: true,
        can_lottery: true,
        delete_flag: false,
        locked: true,
        createdAt: new Date("2026-01-04"),
      },
    ]);

    const result = await service.getUserCards(
      "u1",
      undefined,
      1,
      1,
      20,
      true,
    );

    expect(result.list).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cardId: 1,
          cardLevel: "N",
          count: 2,
          lockedCount: 1,
          sellableCount: 1,
          lockableUuid: "n-card",
          unlockableUuid: "n-card-locked",
        }),
      ]),
    );
  });

  it("新卡筛选只返回最近 48 小时内获得的卡片", async () => {
    const nowSpy = jest
      .spyOn(Date, "now")
      .mockReturnValue(new Date("2026-01-04T00:00:00.000Z").getTime());
    const { service } = createListService();

    try {
      const result = await service.getUserCards(
        "u1",
        undefined,
        1,
        1,
        20,
        true,
        true,
      );

      expect(result.total).toBe(1);
      expect(result.list).toEqual([
        expect.objectContaining({
          cardId: 1,
          cardLevel: "SSR",
          count: 1,
        }),
      ]);
    } finally {
      nowSpy.mockRestore();
    }
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

  it("同组单卡明细只返回当前组并按战力排序", async () => {
    const { service } = createListService([
      {
        id: 4,
        uid: "u1",
        card_id: "1",
        card_level: "N",
        card_uuid: "n-strong",
        can_sell: true,
        can_lottery: true,
        delete_flag: false,
        cultivation_level: 5,
        star_level: 1,
        potential_bp: 800,
        createdAt: new Date("2026-01-04"),
      },
      {
        id: 5,
        uid: "u1",
        card_id: "1",
        card_level: "SSR",
        card_uuid: "ssr-other",
        can_sell: true,
        can_lottery: true,
        delete_flag: false,
        createdAt: new Date("2026-01-05"),
      },
      {
        id: 6,
        uid: "u2",
        card_id: "1",
        card_level: "N",
        card_uuid: "other-user",
        can_sell: true,
        can_lottery: true,
        delete_flag: false,
        createdAt: new Date("2026-01-06"),
      },
    ]);

    const result = await service.getUserCardGroupCopies("u1", 1, "N", 1);

    expect(result.total).toBe(2);
    expect(result.list.map((card) => card.uuid)).toEqual([
      "n-strong",
      "n-card",
    ]);
    expect(result.list[0]).toEqual(
      expect.objectContaining({
        uuid: "n-strong",
        count: 1,
        sellableCount: 1,
        recyclable: true,
      }),
    );
  });

  it("同组单卡明细会返回锁定、挂售和回收状态", async () => {
    const { service } = createListService(
      [
        {
          id: 4,
          uid: "u1",
          card_id: "1",
          card_level: "N",
          card_uuid: "n-locked",
          can_sell: true,
          can_lottery: true,
          delete_flag: false,
          locked: true,
          createdAt: new Date("2026-01-04"),
        },
        {
          id: 5,
          uid: "u1",
          card_id: "1",
          card_level: "N",
          card_uuid: "n-listed",
          can_sell: true,
          can_lottery: true,
          delete_flag: false,
          createdAt: new Date("2026-01-05"),
        },
      ],
      [{ id: 1, card_uuid: "n-listed", status: "active", price: 20 }],
    );

    const result = await service.getUserCardGroupCopies("u1", 1, "N", 1);
    const open = result.list.find((card) => card.uuid === "n-card");
    const locked = result.list.find((card) => card.uuid === "n-locked");
    const listed = result.list.find((card) => card.uuid === "n-listed");

    expect(open).toEqual(
      expect.objectContaining({
        canSell: true,
        sellableCount: 1,
        lockableUuid: "n-card",
        recyclable: true,
      }),
    );
    expect(locked).toEqual(
      expect.objectContaining({
        locked: true,
        canSell: false,
        sellableCount: 0,
        unlockableUuid: "n-locked",
        recyclable: false,
      }),
    );
    expect(listed).toEqual(
      expect.objectContaining({
        isListed: true,
        canSell: false,
        sellableCount: 0,
        tradePrice: 20,
        lockableUuid: null,
        recyclable: false,
      }),
    );
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
      rechargeRecords?: Partial<RechargeRecord>[];
      pveRecords?: Partial<PveChallengeRecord>[];
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
    const rechargeRecords = (overrides.rechargeRecords || []) as RechargeRecord[];
    const pveRecords = (overrides.pveRecords || []) as PveChallengeRecord[];
    const rechargeRows = Object.values(
      rechargeRecords.reduce(
        (result, record) => {
          if (record.status !== "success" || !record.uid) {
            return result;
          }
          result[record.uid] = result[record.uid] || {
            uid: record.uid,
            amount: 0,
          };
          result[record.uid].amount += Number(record.amount || 0);
          return result;
        },
        {} as Record<string, { uid: string; amount: number }>,
      ),
    );
    const pveRows = Object.values(
      pveRecords.reduce(
        (result, record) => {
          if (record.success !== true || !record.uid) {
            return result;
          }
          result[record.uid] = result[record.uid] || {
            uid: record.uid,
            cleared: 0,
          };
          result[record.uid].cleared += 1;
          return result;
        },
        {} as Record<string, { uid: string; cleared: number }>,
      ),
    );
    const rechargeRecordRepository = createRepository({
      createQueryBuilder: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(rechargeRows),
      })),
    });
    const pveRecordRepository = createRepository({
      createQueryBuilder: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(pveRows),
      })),
    });

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
      undefined,
      undefined,
      undefined,
      rechargeRecordRepository as any,
      pveRecordRepository as any,
    );

    return { service, rechargeRecordRepository, pveRecordRepository };
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

  it("充值榜只统计成功充值金额", async () => {
    const { service } = createLeaderboardService({
      rechargeRecords: [
        { uid: "a", amount: 80, status: "success" },
        { uid: "a", amount: 40, status: "failed" },
        { uid: "b", amount: 120, status: "success" },
        { uid: "c", amount: 30, status: "success" },
      ],
    });

    const result = await service.getLeaderboard("a", 10);

    expect(result.rankings.rechargeAmount.list).toEqual([
      expect.objectContaining({ uid: "b", rank: 1, value: 120 }),
      expect.objectContaining({ uid: "a", rank: 2, value: 80 }),
      expect.objectContaining({ uid: "c", rank: 3, value: 30 }),
    ]);
    expect(result.rankings.rechargeAmount.me).toEqual(
      expect.objectContaining({ uid: "a", rank: 2, value: 80 }),
    );
  });

  it("闯关榜只统计成功通关次数", async () => {
    const { service } = createLeaderboardService({
      pveRecords: [
        { uid: "a", success: true },
        { uid: "a", success: false },
        { uid: "b", success: true },
        { uid: "b", success: true },
        { uid: "c", success: true },
      ],
    });

    const result = await service.getLeaderboard("a", 10);

    expect(result.rankings.pveCleared.list).toEqual([
      expect.objectContaining({ uid: "b", rank: 1, value: 2 }),
      expect.objectContaining({ uid: "a", rank: 2, value: 1 }),
      expect.objectContaining({ uid: "c", rank: 2, value: 1 }),
    ]);
    expect(result.rankings.pveCleared.me).toEqual(
      expect.objectContaining({ uid: "a", rank: 2, value: 1 }),
    );
  });
});

describe("CardService 抽卡统计与历史详情", () => {
  function createRepository(overrides: Record<string, any> = {}) {
    return {
      create: jest.fn((value) => value),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      createQueryBuilder: jest.fn(),
      ...overrides,
    };
  }

  it("统计接口按可用卡池返回保底进度和剩余抽数", async () => {
    const historyRepository = createRepository({
      createQueryBuilder: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: "48" }),
      })),
      find: jest.fn().mockResolvedValue([]),
    });
    const pityRepository = createRepository({
      find: jest.fn().mockResolvedValue([
        {
          uid: "u1",
          pool_id: 2,
          draws_since_sr: 8,
          draws_since_ssr: 48,
          draws_since_ur: 48,
        },
      ]),
    });
    const service = new CardService(
      createRepository() as any,
      createRepository({
        find: jest.fn().mockResolvedValue([
          {
            id: 2,
            pool_name: "测试卡池",
            enabled: true,
            sort_order: 0,
          },
        ]),
      }) as any,
      createRepository({
        findOne: jest.fn().mockResolvedValue({
          uid: "u1",
          point: 120,
          card_count_n: 1,
          card_count_r: 2,
          card_count_sr: 3,
          card_count_ssr: 4,
          card_count_ur: 0,
        }),
      }) as any,
      createRepository() as any,
      historyRepository as any,
      createRepository() as any,
      createRepository() as any,
      pityRepository as any,
      {
        getConfigByPoolId: jest.fn().mockResolvedValue({
          pitySystem: {
            enabled: true,
            softPity: { count: 10, guaranteedRarity: "SR" },
            hardPity: { count: 90, guaranteedRarity: "SSR" },
          },
        }),
      } as any,
      {} as any,
    );

    const result = await service.getUserGachaStats("u1");

    expect(result.pity).toEqual([
      expect.objectContaining({
        poolId: 2,
        poolName: "测试卡池",
        hard: expect.objectContaining({
          count: 90,
          guaranteedRarity: "SSR",
          current: 48,
          remaining: 42,
        }),
      }),
    ]);
  });

  it("抽卡历史详情会兼容旧字段并补全卡片信息", async () => {
    const service = new CardService(
      createRepository({
        find: jest.fn().mockResolvedValue([
          {
            id: 7,
            card_name: "历史卡",
            card_desc: "描述",
            card_image: "/card.webp",
            card_type: 0,
            card_level: "SSR",
            pool: 1,
          },
        ]),
      }) as any,
      createRepository() as any,
      createRepository() as any,
      createRepository() as any,
      createRepository({
        findAndCount: jest.fn().mockResolvedValue([
          [
            {
              id: 3,
              uid: "u1",
              count: 1,
              card_ids: "7",
              card_levels: "SSR",
              card_uuids: "uuid-7",
              card_details: null,
              createdAt: new Date("2026-01-01"),
            },
          ],
          1,
        ]),
      }) as any,
      createRepository() as any,
      createRepository() as any,
      createRepository() as any,
      {} as any,
      {} as any,
    );

    const result = await service.getUserDrawHistory("u1", 1, 10);

    expect(result).toEqual(
      expect.objectContaining({
        total: 1,
        totalPages: 1,
        list: [
          expect.objectContaining({
            id: 3,
            details: [
              expect.objectContaining({
                cardId: 7,
                cardName: "历史卡",
                rarity: "SSR",
                cardUuid: "uuid-7",
              }),
            ],
          }),
        ],
      }),
    );
  });
});

describe("CardService 玩家图鉴", () => {
  function createRepository(overrides: Record<string, any> = {}) {
    return {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      ...overrides,
    };
  }

  function createCatalogService(
    options: {
      cards?: Partial<CardItem>[];
      userCards?: Partial<UserCard>[];
      fragmentCount?: number;
      fragmentCounts?: Partial<Record<CardRarity, number>>;
    } = {},
  ) {
    const cards = (
      options.cards || [
        {
          id: 1,
          card_name: "测试卡",
          card_level: "N,R,SSR",
          card_desc: "描述",
          card_image: "/file/card-images/demo.webp",
          card_type: 0,
          pool: 2,
          drop_item: "",
          enabled: true,
        },
        {
          id: 2,
          card_name: "UR卡",
          card_level: "UR",
          card_desc: "描述",
          card_image: "",
          card_type: 0,
          pool: 2,
          drop_item: "",
          enabled: true,
        },
      ]
    ) as CardItem[];
    const defaultFragment = {
      id: 5,
      drop_name: "通用碎片",
      drop_type: 0,
      disabled: false,
      default_fragment: true,
    } as DropItem;
    const rarityFragments = [
      {
        id: 11,
        drop_name: "N碎片",
        drop_type: 0,
        disabled: false,
        default_fragment: false,
      },
      {
        id: 12,
        drop_name: "R碎片",
        drop_type: 0,
        disabled: false,
        default_fragment: false,
      },
      {
        id: 13,
        drop_name: "SR碎片",
        drop_type: 0,
        disabled: false,
        default_fragment: false,
      },
      {
        id: 14,
        drop_name: "SSR碎片",
        drop_type: 0,
        disabled: false,
        default_fragment: false,
      },
    ] as DropItem[];
    const fragmentRarityByItemId = new Map<number, CardRarity>([
      [11, "N"],
      [12, "R"],
      [13, "SR"],
      [14, "SSR"],
    ]);
    const cardRepository = createRepository({
      find: jest.fn(async (options?: any) => {
        const where = options?.where || {};
        return cards.filter((card) => {
          const poolMatched = where.pool === undefined || card.pool === where.pool;
          const enabledMatched =
            where.enabled === undefined ||
            (where.enabled === true
              ? card.enabled !== false
              : card.enabled === where.enabled);
          return poolMatched && enabledMatched;
        });
      }),
    });
    const poolRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({ id: 2, enabled: true }),
    });
    const userRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({ id: 10, uid: "u1" }),
    });
    const userCardRepository = createRepository({
      find: jest.fn().mockResolvedValue(options.userCards || []),
    });
    const dropRepository = createRepository({
      find: jest.fn(async ({ where }) =>
        rarityFragments.filter((item) => {
          if (where?.drop_type !== undefined && item.drop_type !== where.drop_type) {
            return false;
          }
          if (where?.disabled !== undefined && item.disabled !== where.disabled) {
            return false;
          }
          return true;
        }),
      ),
      findOne: jest.fn(async ({ where }) =>
        where.default_fragment === true ? defaultFragment : null,
      ),
    });
    const inventoryRepository = createRepository({
      findOne: jest.fn(async ({ where }) => {
        const rarity = fragmentRarityByItemId.get(Number(where.item_id));
        return {
          user_id: 10,
          item_id: where.item_id,
          num: rarity
            ? options.fragmentCounts?.[rarity] ?? options.fragmentCount ?? 200
            : options.fragmentCount ?? 200,
        };
      }),
    });
    const manager = {
      getRepository: jest.fn((entity) =>
        entity === DropItem ? dropRepository : createRepository(),
      ),
    };
    const service = new CardService(
      cardRepository as any,
      poolRepository as any,
      userRepository as any,
      userCardRepository as any,
      {} as any,
      dropRepository as any,
      inventoryRepository as any,
      {} as any,
      {} as any,
      { manager } as any,
    );

    return {
      service,
      cardRepository,
    };
  }

  it("按卡片和稀有度返回当前卡池图鉴状态", async () => {
    const { service } = createCatalogService({
      fragmentCounts: { N: 200, R: 0, SSR: 999 },
      userCards: [
        { uid: "u1", card_id: "1", card_level: "R", delete_flag: false },
        { uid: "u1", card_id: "1", card_level: "R", delete_flag: false },
        { uid: "u1", card_id: "2", card_level: "UR", delete_flag: false },
      ],
    });

    const result = await service.getUserCatalog("u1", 2);

    expect(result.poolId).toBe(2);
    expect(result.total).toBe(4);
    expect(result.list.find((item) => item.key === "1:N")).toEqual(
      expect.objectContaining({
        collected: false,
        ownedCount: 0,
        requiredFragments: 80,
        fragmentCount: 200,
        canSynthesize: true,
      }),
    );
    expect(result.list.find((item) => item.key === "1:R")).toEqual(
      expect.objectContaining({
        collected: true,
        ownedCount: 2,
        canSynthesize: false,
      }),
    );
    expect(result.list.find((item) => item.key === "1:SSR")).toEqual(
      expect.objectContaining({
        collected: false,
        requiredFragments: 1000,
        fragmentCount: 999,
        canSynthesize: false,
      }),
    );
    expect(result.list.find((item) => item.key === "2:UR")).toEqual(
      expect.objectContaining({
        collected: true,
        requiredFragments: 0,
        canSynthesize: false,
      }),
    );
  });

  it("图鉴接口只读取指定卡池", async () => {
    const { service, cardRepository } = createCatalogService();

    await service.getUserCatalog("u1", 2);

    expect(cardRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { pool: 2 },
        order: { id: "ASC" },
      }),
    );
  });

  it("图鉴展示当前卡池下架卡片", async () => {
    const { service } = createCatalogService({
      cards: [
        {
          id: 1,
          card_name: "上架卡",
          card_level: "N",
          card_desc: "描述",
          card_image: "",
          card_type: 0,
          pool: 2,
          drop_item: "",
          enabled: true,
        },
        {
          id: 2,
          card_name: "下架卡",
          card_level: "UR",
          card_desc: "描述",
          card_image: "",
          card_type: 0,
          pool: 2,
          drop_item: "",
          enabled: false,
        },
      ],
    });

    const result = await service.getUserCatalog("u1", 2);

    expect(result.total).toBe(2);
    expect(result.list[0]).toEqual(
      expect.objectContaining({
        key: "1:N",
        card: expect.objectContaining({ card_name: "上架卡" }),
      }),
    );
    expect(result.list[1]).toEqual(
      expect.objectContaining({
        key: "2:UR",
        card: expect.objectContaining({ card_name: "下架卡" }),
      }),
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
    inventoryCounts: Partial<Record<CardRarity | "default", number>> = {},
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
    const rarityFragments = [
      { id: 11, drop_name: "N碎片", rarity: "N" },
      { id: 12, drop_name: "R碎片", rarity: "R" },
      { id: 13, drop_name: "SR碎片", rarity: "SR" },
      { id: 14, drop_name: "SSR碎片", rarity: "SSR" },
    ].map(
      (item) =>
        ({
          id: item.id,
          drop_name: item.drop_name,
          drop_type: 0,
          disabled: false,
          default_fragment: false,
          rarity: item.rarity,
        }) as DropItem & { rarity: CardRarity },
    );
    const defaultFragment = {
      id: 5,
      drop_name: "通用碎片",
      drop_type: 0,
      disabled: false,
      default_fragment: true,
    } as DropItem;
    const inventoryCountForItem = (item: DropItem & { rarity?: CardRarity }) =>
      item.id === defaultFragment.id
        ? inventoryCounts.default ?? inventoryPatch.num ?? 1000
        : inventoryCounts[item.rarity as CardRarity] ?? inventoryPatch.num ?? 1000;
    const inventories = new Map<number, UserInventory>(
      [defaultFragment, ...rarityFragments].map((item, index) => [
        item.id,
        {
          id: index + 1,
          user_id: 1,
          item_id: item.id,
          ...inventoryPatch,
          num: inventoryCountForItem(item),
        } as UserInventory,
      ]),
    );
    const cardRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(card),
    });
    const dropRepository = createRepository({
      find: jest.fn(async ({ where }) =>
        rarityFragments.filter((item) => {
          if (where?.drop_type !== undefined && item.drop_type !== where.drop_type) {
            return false;
          }
          if (where?.disabled !== undefined && item.disabled !== where.disabled) {
            return false;
          }
          return true;
        }),
      ),
      findOne: jest.fn(async ({ where }) =>
        where.default_fragment === true ? defaultFragment : null,
      ),
    });
    const userRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({ id: 1, uid: "u1" }),
    });
    const inventoryRepository = createRepository({
      findOne: jest.fn(async ({ where }) => inventories.get(Number(where.item_id)) || null),
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
      inventories,
      inventoryRepository,
      userCardRepository,
    };
  }

  it("指定 N 合成时扣 80 碎片并发 N 卡", async () => {
    const { service, inventories, inventoryRepository, userCardRepository } =
      createSynthesisService();

    const result = await service.synthesizeCard("u1", 1, "N");

    expect(inventories.get(11)?.num).toBe(920);
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

  it("通用碎片足够但 N 碎片不足时不能合成", async () => {
    const { service, inventoryRepository, userCardRepository } =
      createSynthesisService({}, {}, { default: 1000, N: 79 });

    await expect(service.synthesizeCard("u1", 1, "N")).rejects.toThrow(
      "碎片不足，需要80个碎片，当前拥有79个",
    );
    expect(inventoryRepository.save).not.toHaveBeenCalled();
    expect(userCardRepository.save).not.toHaveBeenCalled();
  });

  it("卡片配置分解碎片时合成仍扣稀有度碎片", async () => {
    const { service, inventories } = createSynthesisService(
      { drop_item: "5" },
      {},
      { default: 1000, N: 80 },
    );

    await service.synthesizeCard("u1", 1, "N");

    expect(inventories.get(11)?.num).toBe(0);
    expect(inventories.get(5)?.num).toBe(1000);
  });

  it("指定 SR 合成时扣 320 碎片并发 SR 卡", async () => {
    const { service, inventories, inventoryRepository, userCardRepository } =
      createSynthesisService();

    const result = await service.synthesizeCard("u1", 1, "SR");

    expect(inventories.get(13)?.num).toBe(680);
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

  it("指定 SSR 合成时扣 1000 碎片并发 SSR 卡", async () => {
    const { service, inventories, inventoryRepository, userCardRepository } =
      createSynthesisService();

    const result = await service.synthesizeCard("u1", 1, "SSR");

    expect(inventories.get(14)?.num).toBe(0);
    expect(inventoryRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ item_id: 14, num: 0 }),
    );
    expect(userCardRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ card_id: "1", card_level: "SSR" }),
    );
    expect(result.data).toEqual(
      expect.objectContaining({
        card_level: "SSR",
        fragments_used: 1000,
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

describe("CardService 卡片锁定", () => {
  function createRepository(overrides: Record<string, any> = {}) {
    return {
      create: jest.fn((value) => value),
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn((value) => Promise.resolve(value)),
      ...overrides,
    };
  }

  function createLockService(options: {
    userCard?: Partial<UserCard> | null;
    userCards?: Partial<UserCard>[];
    activeListing?: Partial<TradeListing> | null;
  } = {}) {
    const userCard = options.userCard === null
      ? null
      : ({
          uid: "u1",
          card_uuid: "card-uuid",
          card_id: "1",
          card_level: "SSR",
          can_sell: true,
          can_lottery: true,
          delete_flag: false,
          locked: false,
          ...options.userCard,
        } as UserCard);
    const userCardRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(userCard),
      find: jest.fn().mockResolvedValue(options.userCards || [userCard].filter(Boolean)),
    });
    const listingRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(options.activeListing || null),
    });
    const cardRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        card_name: "测试卡",
        card_level: "SSR",
        card_desc: "描述",
        card_type: 0,
        pool: 1,
      } as CardItem),
    });
    const repositories = new Map<any, any>([
      [UserCard, userCardRepository],
      [TradeListing, listingRepository],
      [CardItem, cardRepository],
    ]);
    const manager = {
      getRepository: jest.fn((entity) => repositories.get(entity)),
    };
    const dataSource = {
      transaction: jest.fn((callback) => callback(manager)),
    };
    const service = new CardService(
      cardRepository as any,
      createRepository() as any,
      createRepository() as any,
      userCardRepository as any,
      createRepository() as any,
      createRepository() as any,
      createRepository() as any,
      createRepository() as any,
      {} as any,
      dataSource as any,
    );

    return {
      service,
      userCard,
      userCardRepository,
      cardRepository,
    };
  }

  it("可切换本人卡片锁定状态", async () => {
    const { service, userCard, userCardRepository } = createLockService();

    const result = await service.updateUserCardLock("u1", "card-uuid", true);

    expect(userCard?.locked).toBe(true);
    expect(userCardRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ locked: true }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        uuid: "card-uuid",
        locked: true,
        cardName: "测试卡",
      }),
    );
  });

  it("挂售中的卡片不允许切换锁定状态", async () => {
    const { service, userCardRepository } = createLockService({
      activeListing: { id: 9, card_uuid: "card-uuid", status: "active" },
    });

    await expect(
      service.updateUserCardLock("u1", "card-uuid", true),
    ).rejects.toThrow("挂售中的卡片不能切换锁定状态");
    expect(userCardRepository.save).not.toHaveBeenCalled();
  });

  it("锁定卡片不能分解", async () => {
    const { service, userCardRepository, cardRepository } = createLockService({
      userCard: { locked: true },
    });

    await expect(service.decomposeCard("u1", "card-uuid")).rejects.toThrow(
      "已锁定的卡片不能分解",
    );
    expect(cardRepository.findOne).not.toHaveBeenCalled();
    expect(userCardRepository.save).not.toHaveBeenCalled();
  });

  it("最后一张同稀有度卡片不能分解", async () => {
    const { service, userCardRepository } = createLockService();

    await expect(service.decomposeCard("u1", "card-uuid")).rejects.toThrow(
      "至少保留一张SSR卡片，不能分解",
    );
    expect(userCardRepository.save).not.toHaveBeenCalled();
  });
});

describe("CardService 卡片养成", () => {
  function createRepository(overrides: Record<string, any> = {}) {
    return {
      create: jest.fn((value) => value),
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn((value) => Promise.resolve(value)),
      ...overrides,
    };
  }

  function createUpgradeService(options: {
    userCard?: Partial<UserCard> | null;
    card?: Partial<CardItem>;
    inventory?: Partial<UserInventory> | null;
    inventoryCounts?: Partial<Record<CardRarity | "default", number>>;
    activeListing?: Partial<TradeListing> | null;
  } = {}) {
    const userCard = options.userCard === null
      ? null
      : ({
          uid: "u1",
          card_uuid: "card-uuid",
          card_id: "1",
          card_level: "R",
          can_sell: true,
          can_lottery: true,
          delete_flag: false,
          locked: false,
          cultivation_level: 2,
          cultivation_exp: 10,
          ...options.userCard,
        } as UserCard);
    const card = {
      id: 1,
      card_name: "养成测试卡",
      card_level: "R",
      card_desc: "描述",
      card_type: 0,
      pool: 1,
      drop_item: "",
      ...options.card,
    } as CardItem;
    const defaultFragment = {
      id: 5,
      drop_name: "通用碎片",
      drop_type: 0,
      disabled: false,
      default_fragment: true,
    } as DropItem;
    const rarityFragments = [
      { id: 11, drop_name: "N碎片", rarity: "N" },
      { id: 12, drop_name: "R碎片", rarity: "R" },
      { id: 13, drop_name: "SR碎片", rarity: "SR" },
      { id: 14, drop_name: "SSR碎片", rarity: "SSR" },
    ].map(
      (item) =>
        ({
          id: item.id,
          drop_name: item.drop_name,
          drop_type: 0,
          disabled: false,
          default_fragment: false,
          rarity: item.rarity,
        }) as DropItem & { rarity: CardRarity },
    );
    const inventoryCountForItem = (item: DropItem & { rarity?: CardRarity }) =>
      item.id === defaultFragment.id
        ? options.inventoryCounts?.default ?? options.inventory?.num ?? 100
        : options.inventoryCounts?.[item.rarity as CardRarity] ??
          options.inventory?.num ??
          100;
    const inventories = new Map<number, UserInventory>(
      [defaultFragment, ...rarityFragments].map((item, index) => [
        item.id,
        {
          id: index + 1,
          user_id: 1,
          item_id: item.id,
          ...(options.inventory || {}),
          num: inventoryCountForItem(item),
        } as UserInventory,
      ]),
    );
    const effectiveRarity = (userCard?.card_level || card.card_level || "R") as CardRarity;
    const rarityFragmentIds: Record<Exclude<CardRarity, "UR">, number> = {
      N: 11,
      R: 12,
      SR: 13,
      SSR: 14,
    };
    const inventoryItemId =
      effectiveRarity === "UR" ? 5 : rarityFragmentIds[effectiveRarity];
    const inventory =
      options.inventory === null
        ? null
        : inventories.get(inventoryItemId);
    const userCardRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(userCard),
    });
    const cardRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(card),
    });
    const userRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({ id: 1, uid: "u1" }),
    });
    const dropRepository = createRepository({
      find: jest.fn(async ({ where }) =>
        rarityFragments.filter((item) => {
          if (where?.drop_type !== undefined && item.drop_type !== where.drop_type) {
            return false;
          }
          if (where?.disabled !== undefined && item.disabled !== where.disabled) {
            return false;
          }
          return true;
        }),
      ),
      findOne: jest.fn(async ({ where }) =>
        where.default_fragment === true ? defaultFragment : null,
      ),
    });
    const inventoryRepository = createRepository({
      findOne: jest.fn(async ({ where }) =>
        options.inventory === null
          ? null
          : inventories.get(Number(where.item_id)) || null,
      ),
    });
    const listingRepository = createRepository({
      find: jest
        .fn()
        .mockResolvedValue(options.activeListing ? [options.activeListing] : []),
      findOne: jest.fn().mockResolvedValue(options.activeListing || null),
    });
    const repositories = new Map<any, any>([
      [UserCard, userCardRepository],
      [CardItem, cardRepository],
      [User, userRepository],
      [DropItem, dropRepository],
      [UserInventory, inventoryRepository],
      [TradeListing, listingRepository],
    ]);
    const manager = {
      getRepository: jest.fn((entity) => repositories.get(entity)),
    };
    const dataSource = {
      manager,
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
      userCard,
      inventory,
      inventories,
      userCardRepository,
      inventoryRepository,
    };
  }

  it("升级会消耗对应碎片并提升等级与战力", async () => {
    const { service, userCard, inventory, userCardRepository, inventoryRepository } =
      createUpgradeService();

    const result = await service.upgradeUserCard("u1", "card-uuid");

    expect(inventory?.num).toBe(84);
    expect(userCard?.cultivation_level).toBe(3);
    expect(userCard?.cultivation_exp).toBe(26);
    expect(inventoryRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ num: 84 }),
    );
    expect(userCardRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ cultivation_level: 3, cultivation_exp: 26 }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        cardName: "养成测试卡",
        rarity: "R",
        before: expect.objectContaining({ level: 2, power: 202 }),
        after: expect.objectContaining({ level: 3, power: 224 }),
        cost: expect.objectContaining({
          itemName: "R碎片",
          num: 16,
          remaining: 84,
        }),
      }),
    );
  });

  it("预览会返回碎片不足原因", async () => {
    const { service } = createUpgradeService({
      inventory: { num: 1 },
    });

    const result = await service.getUserCardUpgradePreview("u1", "card-uuid");

    expect(result).toEqual(
      expect.objectContaining({
        canUpgrade: false,
        unavailableReason: "碎片不足，需要16个R碎片，当前拥有1个",
        cost: expect.objectContaining({ owned: 1, num: 16 }),
      }),
    );
  });

  it("卡片配置分解碎片时养成仍扣稀有度碎片", async () => {
    const { service, inventories } = createUpgradeService({
      card: { drop_item: "5" },
      inventoryCounts: { default: 100, R: 16 },
    });

    await service.upgradeUserCard("u1", "card-uuid");

    expect(inventories.get(12)?.num).toBe(0);
    expect(inventories.get(5)?.num).toBe(100);
  });

  it.each([
    ["N", 11, 8],
    ["SR", 13, 32],
    ["SSR", 14, 60],
  ] as Array<[CardRarity, number, number]>)(
    "%s 养成消耗对应稀有度碎片",
    async (rarity, itemId, cost) => {
      const { service, inventories, inventoryRepository } = createUpgradeService({
        userCard: { card_level: rarity, cultivation_level: 2, cultivation_exp: 0 },
        card: { card_level: rarity },
        inventoryCounts: { [rarity]: cost },
      });

      const result = await service.upgradeUserCard("u1", "card-uuid");

      expect(inventories.get(itemId)?.num).toBe(0);
      expect(inventoryRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ item_id: itemId, num: 0 }),
      );
      expect(result.cost).toEqual(
        expect.objectContaining({
          itemName: `${rarity}碎片`,
          num: cost,
          remaining: 0,
        }),
      );
    },
  );

  it("UR 养成消耗默认碎片", async () => {
    const { service, inventories } = createUpgradeService({
      userCard: { card_level: "UR", cultivation_level: 2, cultivation_exp: 50 },
      card: { card_level: "UR" },
      inventoryCounts: { default: 100 },
    });

    const result = await service.upgradeUserCard("u1", "card-uuid");

    expect(inventories.get(5)?.num).toBe(0);
    expect(result).toEqual(
      expect.objectContaining({
        rarity: "UR",
        cost: expect.objectContaining({
          itemName: "通用碎片",
          num: 100,
          remaining: 0,
        }),
      }),
    );
  });

  it("锁定卡片不能养成", async () => {
    const { service, userCardRepository, inventoryRepository } =
      createUpgradeService({
        userCard: { locked: true },
      });

    await expect(service.upgradeUserCard("u1", "card-uuid")).rejects.toThrow(
      "已锁定的卡片不能养成",
    );
    expect(userCardRepository.save).not.toHaveBeenCalled();
    expect(inventoryRepository.save).not.toHaveBeenCalled();
  });

  it("挂售中的卡片不能养成", async () => {
    const { service, userCardRepository, inventoryRepository } =
      createUpgradeService({
        activeListing: { id: 9, card_uuid: "card-uuid", status: "active" },
      });

    await expect(service.upgradeUserCard("u1", "card-uuid")).rejects.toThrow(
      "挂售中的卡片不能养成",
    );
    expect(userCardRepository.save).not.toHaveBeenCalled();
    expect(inventoryRepository.save).not.toHaveBeenCalled();
  });

  it("达到等级上限后不能继续养成", async () => {
    const { service, userCardRepository } = createUpgradeService({
      userCard: { cultivation_level: 30 },
    });

    await expect(service.upgradeUserCard("u1", "card-uuid")).rejects.toThrow(
      "卡片已达到当前稀有度等级上限",
    );
    expect(userCardRepository.save).not.toHaveBeenCalled();
  });
});

describe("CardService 卡片升星", () => {
  function createRepository(overrides: Record<string, any> = {}) {
    return {
      create: jest.fn((value) => value),
      find: jest.fn(),
      findOne: jest.fn(),
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

  function createStarService(options: {
    cards?: Partial<CardItem>[];
    userCards?: Partial<UserCard>[];
    activeListings?: Partial<TradeListing>[];
    formation?: Partial<UserFormationSlot>[];
    showcase?: Partial<UserShowcaseCard>[];
  } = {}) {
    const cards = (options.cards || [
      {
        id: 1,
        card_name: "同名卡",
        card_level: "SSR",
        card_desc: "描述",
        card_type: 0,
        pool: 1,
      },
      {
        id: 2,
        card_name: "同名卡",
        card_level: "SSR",
        card_desc: "描述",
        card_type: 0,
        pool: 2,
      },
      {
        id: 3,
        card_name: "同名卡",
        card_level: "SR",
        card_desc: "描述",
        card_type: 0,
        pool: 1,
      },
      {
        id: 4,
        card_name: "异名卡",
        card_level: "SSR",
        card_desc: "描述",
        card_type: 0,
        pool: 1,
      },
      {
        id: 5,
        card_name: "UR卡",
        card_level: "UR",
        card_desc: "描述",
        card_type: 0,
        pool: 1,
      },
    ]) as CardItem[];
    const userCards = (options.userCards || [
      {
        id: 1,
        uid: "u1",
        card_id: "1",
        card_level: "SSR",
        card_uuid: "target",
        can_sell: true,
        can_lottery: true,
        delete_flag: false,
        locked: false,
        cultivation_level: 2,
        cultivation_exp: 0,
        star_level: 0,
        createdAt: new Date("2026-01-02"),
      },
      {
        id: 2,
        uid: "u1",
        card_id: "2",
        card_level: "SSR",
        card_uuid: "source",
        can_sell: true,
        can_lottery: true,
        delete_flag: false,
        locked: false,
        cultivation_level: 1,
        cultivation_exp: 0,
        star_level: 0,
        createdAt: new Date("2026-01-01"),
      },
    ]) as UserCard[];
    const activeListings = (options.activeListings || []) as TradeListing[];
    const formation = (options.formation || []) as UserFormationSlot[];
    const showcase = (options.showcase || []) as UserShowcaseCard[];
    const cardRepository = createRepository({
      findOne: jest.fn(async ({ where }) =>
        cards.find((card) => card.id === Number(where.id)) || null,
      ),
      find: jest.fn(async (options?: any) =>
        filterByWhere(cards, options?.where),
      ),
    });
    const userCardRepository = createRepository({
      findOne: jest.fn(async ({ where }) =>
        userCards.find(
          (card) =>
            card.uid === where.uid &&
            card.card_uuid === where.card_uuid &&
            card.delete_flag === where.delete_flag,
        ) || null,
      ),
      find: jest.fn(async (options?: any) =>
        filterByWhere(userCards, options?.where),
      ),
      save: jest.fn(async (value) => value),
    });
    const userRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({ id: 1, uid: "u1" }),
    });
    const dropRepository = createRepository({
      find: jest.fn().mockResolvedValue([]),
    });
    const inventoryRepository = createRepository({
      find: jest.fn().mockResolvedValue([]),
    });
    const tradeListingRepository = createRepository({
      find: jest.fn(async (options?: any) =>
        filterByWhere(activeListings, options?.where),
      ),
    });
    const formationRepository = createRepository({
      find: jest.fn(async (options?: any) =>
        filterByWhere(formation, options?.where),
      ),
    });
    const showcaseRepository = createRepository({
      find: jest.fn(async (options?: any) =>
        filterByWhere(showcase, options?.where),
      ),
    });
    const repositories = new Map<any, any>([
      [UserCard, userCardRepository],
      [CardItem, cardRepository],
      [TradeListing, tradeListingRepository],
      [UserFormationSlot, formationRepository],
      [UserShowcaseCard, showcaseRepository],
    ]);
    const manager = {
      getRepository: jest.fn((entity) => repositories.get(entity)),
    };
    const dataSource = {
      manager,
      getRepository: jest.fn((entity) => repositories.get(entity)),
      transaction: jest.fn((callback) => callback(manager)),
    };
    const socialActivityService = {
      recordActivity: jest.fn(),
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
      undefined,
      undefined,
      socialActivityService as any,
    );

    return {
      service,
      userCards,
      userCardRepository,
      socialActivityService,
    };
  }

  it("同名同稀有度卡可消耗副卡升星并增加战力", async () => {
    const { service, userCards, userCardRepository, socialActivityService } =
      createStarService();

    const result = await service.starUserCard("u1", "target", "source");

    expect(userCards.find((card) => card.card_uuid === "target")?.star_level).toBe(
      1,
    );
    expect(userCards.find((card) => card.card_uuid === "source")?.delete_flag).toBe(
      true,
    );
    expect(userCardRepository.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ card_uuid: "target", star_level: 1 }),
        expect.objectContaining({ card_uuid: "source", delete_flag: true }),
      ]),
    );
    expect(result).toEqual(
      expect.objectContaining({
        before: expect.objectContaining({ starLevel: 0, power: 672 }),
        after: expect.objectContaining({ starLevel: 1, power: 792 }),
        source: expect.objectContaining({ uuid: "source" }),
        powerGain: 120,
      }),
    );
    expect(socialActivityService.recordActivity).toHaveBeenCalledWith(
      expect.objectContaining({ type: "card_starred" }),
      expect.anything(),
    );
  });

  it("满星卡片不能继续升星", async () => {
    const { service, userCardRepository } = createStarService({
      userCards: [
        {
          uid: "u1",
          card_id: "1",
          card_level: "SSR",
          card_uuid: "target",
          delete_flag: false,
          locked: false,
          star_level: 5,
        },
        {
          uid: "u1",
          card_id: "2",
          card_level: "SSR",
          card_uuid: "source",
          delete_flag: false,
          locked: false,
        },
      ],
    });

    await expect(service.starUserCard("u1", "target", "source")).rejects.toThrow(
      "满星",
    );
    expect(userCardRepository.save).not.toHaveBeenCalled();
  });

  it("目标卡锁定或挂售时不能升星", async () => {
    await expect(
      createStarService({
        userCards: [
          {
            uid: "u1",
            card_id: "1",
            card_level: "SSR",
            card_uuid: "target",
            delete_flag: false,
            locked: true,
          },
          {
            uid: "u1",
            card_id: "2",
            card_level: "SSR",
            card_uuid: "source",
            delete_flag: false,
            locked: false,
          },
        ],
      }).service.starUserCard("u1", "target", "source"),
    ).rejects.toThrow("已锁定");

    await expect(
      createStarService({
        activeListings: [{ card_uuid: "target", status: "active" }],
      }).service.starUserCard("u1", "target", "source"),
    ).rejects.toThrow("挂售中");
  });

  it("预览无可用副卡时返回原因", async () => {
    const { service } = createStarService({
      userCards: [
        {
          uid: "u1",
          card_id: "1",
          card_level: "SSR",
          card_uuid: "target",
          delete_flag: false,
          locked: false,
          star_level: 0,
        },
      ],
    });

    const result = await service.getUserCardStarPreview("u1", "target");

    expect(result).toEqual(
      expect.objectContaining({
        canStar: false,
        unavailableReason: "没有可消耗卡片",
        candidates: [],
      }),
    );
  });

  it("不同名或不同稀有度卡不能作为副卡", async () => {
    const { service } = createStarService({
      userCards: [
        {
          uid: "u1",
          card_id: "1",
          card_level: "SSR",
          card_uuid: "target",
          delete_flag: false,
          locked: false,
        },
        {
          uid: "u1",
          card_id: "3",
          card_level: "SR",
          card_uuid: "sr-source",
          delete_flag: false,
          locked: false,
        },
        {
          uid: "u1",
          card_id: "4",
          card_level: "SSR",
          card_uuid: "name-source",
          delete_flag: false,
          locked: false,
        },
      ],
    });

    await expect(service.starUserCard("u1", "target", "sr-source")).rejects.toThrow(
      "只能消耗同名同稀有度卡片",
    );
    await expect(
      service.starUserCard("u1", "target", "name-source"),
    ).rejects.toThrow("只能消耗同名同稀有度卡片");
  });

  it("副卡锁定、挂售、上阵或展示时不能消耗", async () => {
    await expect(
      createStarService({
        userCards: [
          {
            uid: "u1",
            card_id: "1",
            card_level: "SSR",
            card_uuid: "target",
            delete_flag: false,
            locked: false,
          },
          {
            uid: "u1",
            card_id: "2",
            card_level: "SSR",
            card_uuid: "source",
            delete_flag: false,
            locked: true,
          },
        ],
      }).service.starUserCard("u1", "target", "source"),
    ).rejects.toThrow("消耗卡片已锁定");

    await expect(
      createStarService({
        activeListings: [{ card_uuid: "source", status: "active" }],
      }).service.starUserCard("u1", "target", "source"),
    ).rejects.toThrow("消耗卡片挂售中");

    await expect(
      createStarService({
        formation: [{ uid: "u1", card_uuid: "source", position: 1 }],
      }).service.starUserCard("u1", "target", "source"),
    ).rejects.toThrow("消耗卡片上阵中");

    await expect(
      createStarService({
        showcase: [{ uid: "u1", card_uuid: "source", position: 1 }],
      }).service.starUserCard("u1", "target", "source"),
    ).rejects.toThrow("消耗卡片展示中");
  });

  it("UR 卡也可以升星", async () => {
    const { service } = createStarService({
      userCards: [
        {
          uid: "u1",
          card_id: "5",
          card_level: "UR",
          card_uuid: "target",
          delete_flag: false,
          locked: false,
          cultivation_level: 1,
          star_level: 0,
        },
        {
          uid: "u1",
          card_id: "5",
          card_level: "UR",
          card_uuid: "source",
          delete_flag: false,
          locked: false,
          cultivation_level: 1,
          star_level: 0,
        },
      ],
    });

    const result = await service.starUserCard("u1", "target", "source");

    expect(result.powerGain).toBe(200);
  });

  it.each([
    ["N", 20],
    ["R", 36],
    ["SR", 64],
    ["SSR", 120],
    ["UR", 200],
  ] as Array<[CardRarity, number]>)("%s 每星增加固定战力", async (rarity, gain) => {
    const { service } = createStarService({
      cards: [
        {
          id: 1,
          card_name: "星卡",
          card_level: rarity,
          card_desc: "描述",
          card_type: 0,
          pool: 1,
        },
        {
          id: 2,
          card_name: "星卡",
          card_level: rarity,
          card_desc: "描述",
          card_type: 0,
          pool: 1,
        },
      ],
      userCards: [
        {
          uid: "u1",
          card_id: "1",
          card_level: rarity,
          card_uuid: "target",
          delete_flag: false,
          locked: false,
          cultivation_level: 1,
          star_level: 0,
        },
        {
          uid: "u1",
          card_id: "2",
          card_level: rarity,
          card_uuid: "source",
          delete_flag: false,
          locked: false,
          cultivation_level: 1,
          star_level: 0,
        },
      ],
    });

    const result = await service.starUserCard("u1", "target", "source");

    expect(result.powerGain).toBe(gain);
  });

  it("背包分组会按星级战力展示并返回可升星入口", async () => {
    const { service } = createStarService({
      userCards: [
        {
          id: 1,
          uid: "u1",
          card_id: "1",
          card_level: "SSR",
          card_uuid: "target",
          can_sell: true,
          can_lottery: true,
          delete_flag: false,
          locked: false,
          cultivation_level: 1,
          star_level: 1,
          createdAt: new Date("2026-01-02"),
        },
        {
          id: 2,
          uid: "u1",
          card_id: "2",
          card_level: "SSR",
          card_uuid: "source",
          can_sell: true,
          can_lottery: true,
          delete_flag: false,
          locked: false,
          cultivation_level: 1,
          star_level: 0,
          createdAt: new Date("2026-01-01"),
        },
      ],
    });

    const result = await service.getUserCards("u1", "SSR", 1, 1, 20, true);

    expect(result.list[0]).toEqual(
      expect.objectContaining({
        starLevel: 1,
        power: 720,
        canStar: true,
        starableUuid: "target",
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
      systemConfigRow?: Partial<SystemConfig> | null;
      extraDropItems?: Partial<DropItem>[];
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
    const dropItems = [fragment, ...((overrides.extraDropItems || []) as DropItem[])];
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
      find: jest.fn(async ({ where }) =>
        dropItems.filter((item) => {
          if (where?.id !== undefined && item.id !== where.id) {
            return false;
          }
          if (where?.drop_type !== undefined && item.drop_type !== where.drop_type) {
            return false;
          }
          if (where?.disabled !== undefined && item.disabled !== where.disabled) {
            return false;
          }
          return true;
        }),
      ),
      findOne: jest.fn(async ({ where }) => {
        if (where?.default_fragment === true) {
          return fragment;
        }
        return (
          dropItems.find((item) => {
            if (where?.id !== undefined && item.id !== where.id) {
              return false;
            }
            if (where?.drop_type !== undefined && item.drop_type !== where.drop_type) {
              return false;
            }
            if (where?.disabled !== undefined && item.disabled !== where.disabled) {
              return false;
            }
            return true;
          }) || null
        );
      }),
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
      [
        SystemConfig,
        createRepository({
          findOne: jest.fn().mockResolvedValue(overrides.systemConfigRow || null),
        }),
      ],
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

  it("一键分解预览会跳过锁定卡片", async () => {
    const { service } = createBulkDecomposeService({
      userCards: [
        {
          id: 1,
          uid: "u1",
          card_id: "1",
          card_level: "N",
          card_uuid: "n-card-old",
          delete_flag: false,
          locked: false,
          createdAt: new Date("2026-01-01"),
        },
        {
          id: 2,
          uid: "u1",
          card_id: "1",
          card_level: "N",
          card_uuid: "n-card-locked",
          delete_flag: false,
          locked: true,
          createdAt: new Date("2026-01-02"),
        },
        {
          id: 3,
          uid: "u1",
          card_id: "1",
          card_level: "N",
          card_uuid: "n-card-keep",
          delete_flag: false,
          locked: false,
          createdAt: new Date("2026-01-03"),
        },
      ],
      activeListings: [],
    });

    const result = await service.previewBulkDecompose("u1", ["N"]);

    expect(result.total).toBe(2);
    expect(result.skippedLocked).toBe(1);
    expect(result.countsByRarity).toEqual(expect.objectContaining({ N: 2 }));
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

  it("一键分解会使用后台分解配置的碎片和数量范围", async () => {
    const { service } = createBulkDecomposeService({
      systemConfigRow: {
        key: "decomposeConfig",
        value: JSON.stringify({
          rules: {
            N: { itemId: 9, min: 3, max: 3 },
          },
        }),
      },
      extraDropItems: [
        {
          id: 9,
          drop_name: "N级配置碎片",
          drop_type: 0,
          disabled: false,
        },
      ],
    });

    const result = await service.bulkDecomposeCards("u1", ["N"]);

    expect(result.decomposed).toBe(1);
    expect(result.fragments).toEqual([
      expect.objectContaining({
        itemId: 9,
        itemName: "N级配置碎片",
        count: 3,
      }),
    ]);
  });

  it("一键分解支持同一等级配置多种碎片产出", async () => {
    const { service } = createBulkDecomposeService({
      systemConfigRow: {
        key: "decomposeConfig",
        value: JSON.stringify({
          rules: {
            N: {
              drops: [
                { itemId: 9, min: 3, max: 3 },
                { itemId: 10, min: 2, max: 2 },
              ],
            },
          },
        }),
      },
      extraDropItems: [
        {
          id: 9,
          drop_name: "N级配置碎片",
          drop_type: 0,
          disabled: false,
        },
        {
          id: 10,
          drop_name: "N级额外碎片",
          drop_type: 0,
          disabled: false,
        },
      ],
    });

    const result = await service.bulkDecomposeCards("u1", ["N"]);

    expect(result.decomposed).toBe(1);
    expect(result.fragments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemId: 9,
          itemName: "N级配置碎片",
          count: 3,
        }),
        expect.objectContaining({
          itemId: 10,
          itemName: "N级额外碎片",
          count: 2,
        }),
      ]),
    );
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
    cards: Partial<CardItem>[] = [
      {
        id: 1,
        card_name: "测试卡",
        card_level: "N",
        card_desc: "测试",
        card_type: 0,
        pool: 1,
        enabled: true,
      },
    ],
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
      find: jest.fn(async (options?: any) => {
        const where = options?.where || {};
        return cards.filter((card) => {
          const poolMatched = where.pool === undefined || card.pool === where.pool;
          const enabledMatched =
            where.enabled === undefined ||
            (where.enabled === true
              ? card.enabled !== false
              : card.enabled === where.enabled);
          return poolMatched && enabledMatched;
        });
      }),
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
      cardRepository,
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

  it("抽卡只使用上架卡片", async () => {
    const { service, cardRepository, userCardRepository } = createDrawService(
      { point: 10 },
      { once: 10, ten: 100 },
      undefined,
      {},
      [
        {
          id: 1,
          card_name: "下架卡",
          card_level: "N",
          card_desc: "测试",
          card_type: 0,
          pool: 1,
          enabled: false,
        },
        {
          id: 2,
          card_name: "上架卡",
          card_level: "N",
          card_desc: "测试",
          card_type: 0,
          pool: 1,
          enabled: true,
        },
      ],
    );

    await service.drawOnce("u1", 1);

    expect(cardRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { pool: 1, enabled: true } }),
    );
    expect(userCardRepository.save).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ card_id: "2" })]),
    );
  });

  it("非 1 抽或 10 抽会在开启事务前拒绝", async () => {
    const { service, dataSource } = createDrawService({ point: 100 });

    await expect(service.drawMultiple("u1", 2, 1)).rejects.toThrow(
      "抽卡次数仅支持1抽或10抽",
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
