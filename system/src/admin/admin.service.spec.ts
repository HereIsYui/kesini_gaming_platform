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
    {
      getAllPoolConfigs: jest.fn(async () => ({ 1: { poolId: 1 } })),
      savePoolConfig: jest.fn(async (_poolId, config) => config),
    } as any,
    { adminUids: ["admin"] } as any,
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
        },
      ],
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
    await expect(service.getPool(2)).resolves.toBe(pool);
    await expect(service.getCard(3)).resolves.toBe(card);
    await expect(service.getDropItem(4)).resolves.toEqual({
      ...dropItem,
      disabled: false,
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
      }),
    );
    await expect(
      service.createDropItem({ drop_name: "坏物品", drop_type: 99 } as any),
    ).rejects.toThrow("物品类型无效");
    await expect(
      service.createDropItem({ drop_name: "   ", drop_type: 0 } as any),
    ).rejects.toThrow("物品名称不能为空");
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

  it("兑换商店消耗不能选择虚拟积分物品", async () => {
    const dropRepository = createRepository({
      find: jest.fn().mockResolvedValue([
        { id: 1, drop_name: "积分物品", drop_type: 1, disabled: false },
      ]),
    });
    const service = createService({ drop: dropRepository });

    await expect(
      service.createExchangeItem({
        name: "错误兑换",
        costs: [{ itemId: 1, num: 1 }],
        rewards: { points: 10, items: [] },
      } as any),
    ).rejects.toThrow("消耗物品不能选择虚拟积分");
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
