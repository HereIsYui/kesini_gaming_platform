import { AdminService } from "./admin.service";

function createRepository(overrides: Record<string, any> = {}) {
  return {
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn((value) => value),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    find: jest.fn().mockResolvedValue([]),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn((value) => Promise.resolve(value)),
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: 0 }),
    })),
    ...overrides,
  };
}

function createService(repositories: Record<string, any> = {}) {
  const gachaService =
    repositories.gachaService || {
      getAllPoolConfigs: jest.fn(async () => ({ 0: { poolId: 0 } })),
      getPoolConfigsByPoolIds: jest.fn(async () => ({ 0: { poolId: 0 } })),
      getEnvConfigByPoolId: jest.fn((poolId: number) => ({
        poolId,
        rarityProbabilities: { N: 1 },
        drawCosts: { once: 10, ten: 100 },
      })),
      getConfigByPoolId: jest.fn(async (poolId: number) => ({
        poolId,
        rarityProbabilities: { N: 1 },
        drawCosts: { once: 10, ten: 100 },
      })),
      getGlobalDefaultConfigView: jest.fn(async () => ({
        poolId: 0,
        rarityProbabilities: { N: 1 },
        drawCosts: { once: 10, ten: 100 },
        enabled: false,
        source: "env",
        scope: "fallback",
        updatedAt: null,
      })),
      getFallbackConfigView: jest.fn(() => ({
        poolId: 0,
        rarityProbabilities: { N: 1 },
        drawCosts: { once: 10, ten: 100 },
        enabled: false,
        source: "env",
        scope: "fallback",
        updatedAt: null,
      })),
      getPoolConfigDetail: jest.fn(async (poolId: number) => ({
        effective: {
          poolId,
          rarityProbabilities: { N: 1 },
          drawCosts: { once: 10, ten: 100 },
          enabled: false,
          source: "env",
          scope: "fallback",
          updatedAt: null,
        },
        individualConfig: null,
        defaultConfig: {
          poolId: 0,
          rarityProbabilities: { N: 1 },
          drawCosts: { once: 10, ten: 100 },
          enabled: false,
          source: "env",
          scope: "fallback",
          updatedAt: null,
        },
        fallbackConfig: {
          poolId: 0,
          rarityProbabilities: { N: 1 },
          drawCosts: { once: 10, ten: 100 },
          enabled: false,
          source: "env",
          scope: "fallback",
          updatedAt: null,
        },
        hasIndividualConfig: false,
      })),
      savePoolConfig: jest.fn(async (_poolId, config) => config),
    };
  return new AdminService(
    repositories.user || createRepository(),
    repositories.card || createRepository(),
    repositories.pool || createRepository(),
    repositories.drop || createRepository(),
    repositories.history || createRepository(),
    repositories.inventory || createRepository(),
    repositories.pity || createRepository(),
    repositories.redeemCode || createRepository(),
    repositories.redeemUsage || createRepository(),
    repositories.exchangeItem || createRepository(),
    repositories.exchangeUsage || createRepository(),
    gachaService as any,
    { adminUids: ["admin"] } as any,
    repositories.tradeListing,
    repositories.tradeRecord,
    repositories.tradeConfig,
    repositories.rechargeConfig,
    repositories.rechargeRecord,
    repositories.launchActivityConfig,
    repositories.launchActivityClaim,
  );
}

describe("AdminService", () => {
  it("分页查询会归一化页码和每页数量", async () => {
    const userRepository = createRepository();
    const service = createService({ user: userRepository });

    await service.listUsers({ page: 0, pageSize: 999 });

    expect(userRepository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 100,
      }),
    );
  });

  it("创建卡池时校验必要字段", async () => {
    const service = createService();

    await expect(
      service.createPool({ card_desc: "desc" } as any),
    ).rejects.toThrow("卡池名称不能为空");
  });

  it("创建卡池会保存标准化后的数据", async () => {
    const poolRepository = createRepository();
    const service = createService({ pool: poolRepository });

    await service.createPool({
      pool_name: "常驻卡池",
      card_desc: "标准卡池",
      card_type: 0,
    } as any);

    expect(poolRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        pool_name: "常驻卡池",
        card_desc: "标准卡池",
        card_type: 0,
        enabled: true,
      }),
    );
  });

  it("卡池列表会显示抽卡配置模式", async () => {
    const poolRepository = createRepository({
      findAndCount: jest.fn().mockResolvedValue([
        [
          {
            id: 1,
            pool_name: "常驻卡池",
            card_type: 0,
            enabled: true,
          },
          {
            id: 2,
            pool_name: "限定卡池",
            card_type: 2,
            enabled: false,
          },
        ],
        2,
      ]),
    });
    const gachaService = {
      getPoolConfigsByPoolIds: jest.fn().mockResolvedValue({
        1: { poolId: 1, scope: "global", enabled: true },
        2: { poolId: 2, scope: "pool", enabled: true },
      }),
    };
    const service = createService({
      pool: poolRepository,
      gachaService,
    });

    await expect(service.listPools({ page: 1, pageSize: 20 })).resolves.toEqual(
      expect.objectContaining({
        list: [
          expect.objectContaining({
            id: 1,
            card_type: 0,
            enabled: true,
            gacha_config_mode: "默认配置",
          }),
          expect.objectContaining({
            id: 2,
            card_type: 2,
            enabled: false,
            gacha_config_mode: "卡池配置",
          }),
        ],
      }),
    );
    expect(gachaService.getPoolConfigsByPoolIds).toHaveBeenCalledWith([1, 2]);
  });

  it("更新卡池会保留上下线状态和卡池类型", async () => {
    const pool = {
      id: 2,
      pool_name: "限定卡池",
      card_desc: "旧描述",
      card_type: 2,
      enabled: true,
    };
    const poolRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(pool),
    });
    const service = createService({ pool: poolRepository });

    await expect(
      service.updatePool(2, {
        card_type: 1,
        enabled: false,
      } as any),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 2,
        card_type: 1,
        enabled: false,
      }),
    );
    expect(poolRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 2,
        card_type: 1,
        enabled: false,
      }),
    );
  });

  it("创建卡片会标准化多稀有度配置", async () => {
    const cardRepository = createRepository();
    const service = createService({ card: cardRepository });

    await service.createCard({
      card_name: "多稀有度卡",
      card_level: "SSR,N,R,N",
      pool: 1,
    } as any);

    expect(cardRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        card_name: "多稀有度卡",
        card_level: "N,R,SSR",
      }),
    );
  });

  it("创建卡片会拒绝空稀有度或非法稀有度", async () => {
    const service = createService();

    await expect(
      service.createCard({ card_name: "空稀有度", card_level: "" } as any),
    ).rejects.toThrow("卡片稀有度不能为空");
    await expect(
      service.createCard({ card_name: "非法稀有度", card_level: "SSR,X" } as any),
    ).rejects.toThrow("卡片稀有度不支持: X");
  });

  it("更新卡片会标准化多稀有度配置", async () => {
    const card = { id: 10, card_name: "测试卡", card_level: "N" };
    const cardRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(card),
    });
    const service = createService({ card: cardRepository });

    await service.updateCard(10, { card_level: "UR,SR,SR" } as any);

    expect(cardRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        card_level: "SR,UR",
      }),
    );
  });

  it("更新用户只保存允许变更的字段", async () => {
    const user = { id: 1, uid: "u1", point: 0, is_admin: false };
    const userRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(user),
    });
    const service = createService({ user: userRepository });

    await service.updateUser(1, {
      point: 100,
      is_admin: true,
      uid: "bad",
    } as any);

    expect(userRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "u1",
        point: 100,
        is_admin: true,
      }),
    );
  });

  it("后台选项会按轻量结构返回卡池、卡片和物品", async () => {
    const poolRepository = createRepository({
      find: jest.fn().mockResolvedValue([
        { id: 1, pool_name: "常驻池", card_type: 0 },
      ]),
    });
    const cardRepository = createRepository({
      find: jest.fn().mockResolvedValue([
        { id: 10, card_name: "测试卡", card_level: "SSR", pool: 1 },
      ]),
    });
    const dropRepository = createRepository({
      find: jest.fn().mockResolvedValue([
        { id: 20, drop_name: "测试碎片", drop_type: 0, disabled: false },
      ]),
    });
    const service = createService({
      pool: poolRepository,
      card: cardRepository,
      drop: dropRepository,
    });

    await expect(service.getOptions()).resolves.toEqual({
      pools: [{ label: "常驻池", value: 1, type: 0 }],
      cards: [{ label: "测试卡", value: 10, rarity: "SSR", pool: 1 }],
      dropItems: [
        {
          label: "测试碎片 · 卡片碎片",
          value: 20,
          type: 0,
          typeLabel: "卡片碎片",
          usageLabel: "用于卡片合成和分解产出",
          disabled: false,
          defaultFragment: false,
        },
      ],
      defaultFragmentItem: null,
    });
    expect(poolRepository.find).toHaveBeenCalledWith({
      order: { id: "DESC" },
    });
    expect(cardRepository.find).toHaveBeenCalledWith({
      order: { id: "DESC" },
    });
    expect(dropRepository.find).toHaveBeenCalledWith({
      order: { id: "DESC" },
    });
  });

  it("详情接口会读取对应仓库记录", async () => {
    const user = { id: 1, uid: "u1" };
    const pool = { id: 2, pool_name: "限定池" };
    const card = { id: 3, card_name: "限定卡" };
    const dropItem = { id: 4, drop_name: "限定碎片" };
    const userRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(user),
    });
    const poolRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(pool),
    });
    const cardRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(card),
    });
    const dropRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(dropItem),
    });
    const service = createService({
      user: userRepository,
      pool: poolRepository,
      card: cardRepository,
      drop: dropRepository,
    });

    await expect(service.getUser(1)).resolves.toBe(user);
    await expect(service.getPool(2)).resolves.toEqual(
      expect.objectContaining({
        ...pool,
        gachaConfig: expect.objectContaining({
          hasIndividualConfig: false,
        }),
      }),
    );
    await expect(service.getCard(3)).resolves.toBe(card);
    await expect(service.getDropItem(4)).resolves.toEqual({
      ...dropItem,
      disabled: false,
      default_fragment: false,
      typeLabel: "其他",
      usageLabel: "预留类型，需结合业务说明使用",
    });
    expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(poolRepository.findOne).toHaveBeenCalledWith({ where: { id: 2 } });
    expect(cardRepository.findOne).toHaveBeenCalledWith({ where: { id: 3 } });
    expect(dropRepository.findOne).toHaveBeenCalledWith({ where: { id: 4 } });
  });

  it("卡片列表支持按卡池筛选", async () => {
    const cardRepository = createRepository();
    const service = createService({ card: cardRepository });

    await service.listCards({ poolId: 12, keyword: "冥王星" });

    expect(cardRepository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          pool: 12,
          card_name: expect.any(Object),
        },
      }),
    );
  });

  it("创建物品会校验类型并标准化用途参数", async () => {
    const dropRepository = createRepository();
    const service = createService({ drop: dropRepository });

    await service.createDropItem({
      drop_name: " SSR碎片 ",
      drop_type: 0,
      drop_item_type: 9,
      drop_item_value: 99,
    } as any);

    expect(dropRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        drop_name: "SSR碎片",
        drop_type: 0,
        drop_item_type: 0,
        drop_item_value: 0,
        disabled: false,
        default_fragment: false,
      }),
    );
    await expect(
      service.createDropItem({ drop_name: "坏物品", drop_type: 99 } as any),
    ).rejects.toThrow("物品类型无效");
    await expect(
      service.createDropItem({ drop_name: "   ", drop_type: 0 } as any),
    ).rejects.toThrow("物品名称不能为空");
  });

  it("设置默认碎片会清除其他默认碎片", async () => {
    const oldDefault = {
      id: 1,
      drop_name: "旧默认碎片",
      drop_type: 0,
      disabled: false,
      default_fragment: true,
    };
    const dropRepository = createRepository({
      find: jest.fn().mockResolvedValue([oldDefault]),
    });
    const service = createService({ drop: dropRepository });

    await service.createDropItem({
      drop_name: "新默认碎片",
      drop_type: 0,
      default_fragment: true,
    } as any);

    expect(dropRepository.save).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 1,
        default_fragment: false,
      }),
    ]);
    expect(dropRepository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        drop_name: "新默认碎片",
        default_fragment: true,
      }),
    );
  });

  it("非碎片物品不能设为默认分解碎片", async () => {
    const service = createService();

    await expect(
      service.createDropItem({
        drop_name: "兑换券",
        drop_type: 2,
        default_fragment: true,
      } as any),
    ).rejects.toThrow("只有卡片碎片可以设为默认分解碎片");
  });

  it("更新默认碎片时只保留当前物品为默认", async () => {
    const item = {
      id: 2,
      drop_name: "当前碎片",
      drop_desc: "",
      drop_type: 0,
      drop_item_type: 0,
      drop_item_value: 0,
      disabled: false,
      default_fragment: false,
    };
    const oldDefault = {
      id: 1,
      drop_name: "旧默认碎片",
      drop_type: 0,
      disabled: false,
      default_fragment: true,
    };
    const dropRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(item),
      find: jest.fn().mockResolvedValue([oldDefault]),
    });
    const service = createService({ drop: dropRepository });

    await service.updateDropItem(2, { default_fragment: true } as any);

    expect(dropRepository.save).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 1,
        default_fragment: false,
      }),
    ]);
    expect(dropRepository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: 2,
        default_fragment: true,
      }),
    );
  });

  it("被引用的物品删除时改为禁用", async () => {
    const item = { id: 7, drop_name: "通用碎片", drop_type: 0, disabled: false };
    const dropRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(item),
    });
    const inventoryRepository = createRepository({
      count: jest.fn().mockResolvedValue(1),
    });
    const service = createService({
      drop: dropRepository,
      inventory: inventoryRepository,
    });

    await expect(service.deleteDropItem(7)).resolves.toEqual({
      deleted: false,
      disabled: true,
    });
    expect(dropRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ disabled: true }),
    );
    expect(dropRepository.delete).not.toHaveBeenCalled();
  });

  it("更新抽卡配置会委托配置服务校验和保存", async () => {
    const gachaService = {
      getAllPoolConfigs: jest.fn(),
      savePoolConfig: jest.fn().mockResolvedValue({ poolId: 2 }),
    };
    const service = new AdminService(
      createRepository(),
      createRepository(),
      createRepository(),
      createRepository(),
      createRepository(),
      createRepository(),
      createRepository(),
      createRepository(),
      createRepository(),
      createRepository(),
      createRepository(),
      gachaService as any,
      { adminUids: [] } as any,
    );

    await expect(
      service.updateGachaConfig(2, {
        rarityProbabilities: { N: 1 },
      } as any),
    ).resolves.toEqual({ poolId: 2 });
    expect(gachaService.savePoolConfig).toHaveBeenCalledWith(2, {
      rarityProbabilities: { N: 1 },
    });
  });

  it("获取抽卡配置只返回全局默认配置和代码兜底", async () => {
    const gachaService = {
      getGlobalDefaultConfigView: jest.fn().mockResolvedValue({
        poolId: 0,
        source: "database",
        enabled: true,
      }),
      getFallbackConfigView: jest.fn().mockReturnValue({
        poolId: 0,
        rarityProbabilities: { N: 1 },
        drawCosts: { once: 10, ten: 100 },
        source: "env",
        enabled: false,
      }),
    };
    const service = createService({
      gachaService,
    });

    await expect(service.getGachaConfig()).resolves.toEqual(
      expect.objectContaining({
        defaultConfig: { poolId: 0, source: "database", enabled: true },
        fallbackConfig: expect.objectContaining({
          poolId: 0,
          source: "env",
          enabled: false,
        }),
        pools: { 0: { poolId: 0, source: "database", enabled: true } },
        defaults: {
          0: expect.objectContaining({
            poolId: 0,
            source: "env",
            enabled: false,
          }),
        },
      }),
    );
    expect(gachaService.getGlobalDefaultConfigView).toHaveBeenCalled();
    expect(gachaService.getFallbackConfigView).toHaveBeenCalled();
  });

  it("复制抽卡配置会保存到选中的目标卡池", async () => {
    const poolRepository = createRepository({
      find: jest
        .fn()
        .mockResolvedValue([
          { id: 1, pool_name: "源卡池" },
          { id: 2, pool_name: "目标A" },
          { id: 3, pool_name: "目标B" },
        ]),
    });
    const gachaService = {
      getConfigByPoolId: jest.fn().mockResolvedValue({
        poolId: 1,
        rarityProbabilities: { N: 1 },
        upCards: { enabled: true, cardIds: [10], upRate: 0.5 },
        pitySystem: { enabled: false },
        drawCosts: { once: 12, ten: 100 },
      }),
      savePoolConfig: jest.fn(async (poolId, config) => ({
        poolId,
        ...config,
      })),
    };
    const service = createService({
      pool: poolRepository,
      gachaService,
    });

    await expect(service.copyGachaConfig(1, [2, 3, 2])).resolves.toEqual(
      expect.objectContaining({
        sourcePoolId: 1,
        targetPoolIds: [2, 3],
      }),
    );
    expect(gachaService.getConfigByPoolId).toHaveBeenCalledWith(1);
    expect(gachaService.savePoolConfig).toHaveBeenCalledTimes(2);
    expect(gachaService.savePoolConfig).toHaveBeenCalledWith(
      2,
      expect.objectContaining({
        enabled: true,
        rarityProbabilities: { N: 1 },
        upCards: { enabled: true, cardIds: [10], upRate: 0.5 },
        drawCosts: { once: 12, ten: 100 },
      }),
    );
  });

  it("创建兑换码会标准化码值和奖励", async () => {
    const redeemCodeRepository = createRepository();
    const dropRepository = createRepository({
      find: jest.fn().mockResolvedValue([
        { id: 1, drop_name: "测试道具", disabled: false },
      ]),
    });
    const service = createService({
      redeemCode: redeemCodeRepository,
      drop: dropRepository,
    });

    await service.createRedeemCode({
      code: " welcome ",
      name: "欢迎礼包",
      rewards: {
        points: 100,
        items: [{ itemId: 1, num: 2 }],
      },
    } as any);

    expect(redeemCodeRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "WELCOME",
        name: "欢迎礼包",
        enabled: true,
        rewards: {
          points: 100,
          items: [{ itemId: 1, num: 2 }],
        },
      }),
    );
  });

  it("兑换码奖励不能选择已禁用物品", async () => {
    const dropRepository = createRepository({
      find: jest.fn().mockResolvedValue([
        { id: 1, drop_name: "旧道具", disabled: true },
      ]),
    });
    const service = createService({ drop: dropRepository });

    await expect(
      service.createRedeemCode({
        code: "OLD",
        name: "旧道具礼包",
        rewards: { points: 0, items: [{ itemId: 1, num: 1 }] },
      } as any),
    ).rejects.toThrow("奖励物品已禁用");
  });

  it("后台开服活动配置会保存奖励和活动批次", async () => {
    const configRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        enabled: false,
        activity_key: "launch-old",
        name: "旧活动",
        description: "",
        starts_at: null,
        ends_at: null,
        rewards: { points: 10, items: [] },
      }),
    });
    const service = createService({
      launchActivityConfig: configRepository,
      drop: createRepository(),
    });

    await service.updateLaunchActivityConfig({
      enabled: true,
      activity_key: "launch-new",
      name: "开服福利",
      rewards: { points: 100, items: [] },
    } as any);

    expect(configRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        activity_key: "launch-new",
        name: "开服福利",
        rewards: { points: 100, items: [] },
      }),
    );
  });

  it("后台开服活动配置会拒绝非法批次和禁用奖励物品", async () => {
    const configRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        enabled: true,
        activity_key: "launch-old",
        name: "开服福利",
        description: "",
        starts_at: null,
        ends_at: null,
        rewards: { points: 10, items: [] },
      }),
    });
    const dropRepository = createRepository({
      find: jest.fn().mockResolvedValue([
        { id: 2, drop_name: "禁用道具", disabled: true },
      ]),
    });
    const service = createService({
      launchActivityConfig: configRepository,
      drop: dropRepository,
    });

    await expect(
      service.updateLaunchActivityConfig({ activity_key: "中文批次" } as any),
    ).rejects.toThrow("活动批次只能包含字母");
    await expect(
      service.updateLaunchActivityConfig({
        rewards: { points: 0, items: [{ itemId: 2, num: 1 }] },
      } as any),
    ).rejects.toThrow("奖励物品已禁用");
  });

  it("创建兑换商店项会校验消耗和奖励物品", async () => {
    const exchangeItemRepository = createRepository();
    const dropRepository = createRepository({
      find: jest.fn().mockResolvedValue([
        { id: 1, drop_name: "活动代币", drop_type: 2, disabled: false },
        { id: 2, drop_name: "通用碎片", drop_type: 0, disabled: false },
      ]),
    });
    const service = createService({
      exchangeItem: exchangeItemRepository,
      drop: dropRepository,
    });

    await service.createExchangeItem({
      name: "代币换碎片",
      costs: [{ itemId: 1, num: 5 }],
      rewards: { points: 100, items: [{ itemId: 2, num: 1 }] },
      total_limit: 10,
      user_limit: 1,
      sort_order: 2,
    } as any);

    expect(exchangeItemRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "代币换碎片",
        enabled: true,
        used_count: 0,
        delete_flag: false,
        costs: [{ itemId: 1, num: 5 }],
        rewards: { points: 100, items: [{ itemId: 2, num: 1 }] },
      }),
    );
  });

  it("兑换商店消耗不能选择虚拟星穹币物品", async () => {
    const dropRepository = createRepository({
      find: jest.fn().mockResolvedValue([
        { id: 1, drop_name: "星穹币物品", drop_type: 1, disabled: false },
      ]),
    });
    const service = createService({ drop: dropRepository });

    await expect(
      service.createExchangeItem({
        name: "错误兑换",
        costs: [{ itemId: 1, num: 1 }],
        rewards: { points: 10, items: [] },
      } as any),
    ).rejects.toThrow("消耗物品不能选择虚拟星穹币");
  });

  it("删除兑换商店项会软删除并停用", async () => {
    const item = { id: 9, name: "旧兑换", enabled: true, delete_flag: false };
    const exchangeItemRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(item),
    });
    const service = createService({ exchangeItem: exchangeItemRepository });

    await expect(service.deleteExchangeItem(9)).resolves.toEqual({
      deleted: true,
    });
    expect(exchangeItemRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false, delete_flag: true }),
    );
  });
});
