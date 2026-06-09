import { mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
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
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: 0 }),
      getRawMany: jest.fn().mockResolvedValue([]),
    })),
    ...overrides,
  };
}

function createDataSource(repositories: Record<string, any> = {}) {
  const manager = {
    getRepository: jest.fn(
      (entity: { name?: string }) =>
        repositories[String(entity?.name || "")] || createRepository(),
    ),
  };
  return {
    manager,
    transaction: jest.fn((callback) => callback(manager)),
  };
}

function createService(repositories: Record<string, any> = {}) {
  const gachaService = repositories.gachaService || {
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
  const dataSource = repositories.dataSource || createDataSource();
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
    dataSource as any,
    repositories.tradeListing,
    repositories.tradeRecord,
    repositories.tradeConfig,
    repositories.systemConfig,
    repositories.rechargeConfig,
    repositories.rechargeRecord,
    repositories.monthlyCardPurchase,
    repositories.launchActivityConfig,
    repositories.launchActivityClaim,
    repositories.pveStage,
    repositories.pveRecord,
    repositories.season,
    repositories.seasonShopItem,
    repositories.seasonPointRecord,
    repositories.seasonShopUsage,
    repositories.siteConfig,
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
        sort_order: 0,
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
    expect(poolRepository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        order: { sort_order: "ASC", id: "ASC" },
      }),
    );
  });

  it("更新卡池会保留上下线状态、卡池类型和排序", async () => {
    const pool = {
      id: 2,
      pool_name: "限定卡池",
      card_desc: "旧描述",
      card_type: 2,
      enabled: true,
      sort_order: 9,
    };
    const poolRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(pool),
    });
    const service = createService({ pool: poolRepository });

    await expect(
      service.updatePool(2, {
        card_type: 1,
        enabled: false,
        sort_order: 3,
      } as any),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 2,
        card_type: 1,
        enabled: false,
        sort_order: 3,
      }),
    );
    expect(poolRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 2,
        card_type: 1,
        enabled: false,
        sort_order: 3,
      }),
    );
  });

  it("更新卡池允许清空描述但不允许清空名称", async () => {
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

    await service.updatePool(2, { card_desc: null } as any);

    expect(poolRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        card_desc: "",
      }),
    );
    await expect(
      service.updatePool(2, { pool_name: "" } as any),
    ).rejects.toThrow("卡池名称不能为空");
  });

  it("创建卡片会标准化多稀有度配置", async () => {
    const cardRepository = createRepository();
    const service = createService({ card: cardRepository });

    await service.createCard({
      card_name: "多稀有度卡",
      card_level: "SSR,N,R,N",
      card_image: "/file/card-images/demo.webp",
      pool: 1,
    } as any);

    expect(cardRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        card_name: "多稀有度卡",
        card_level: "N,R,SSR",
        card_image: "/file/card-images/demo.webp",
        enabled: true,
      }),
    );
  });

  it("卡片图片上传会保存文件并返回访问路径", async () => {
    const previousFileRoot = process.env.FILE_ROOT;
    const tempDir = await mkdtemp(join(tmpdir(), "kesini-upload-"));
    process.env.FILE_ROOT = tempDir;
    const service = createService();

    try {
      const result = await service.saveCardImage({
        originalname: "card.png",
        mimetype: "image/png",
        size: 4,
        buffer: Buffer.from("test"),
      });

      expect(result.url).toMatch(/^\/file\/card-images\/.+\.png$/);
      const saved = await readFile(
        join(tempDir, result.url.replace("/file/", "")),
        "utf8",
      );
      expect(saved).toBe("test");
    } finally {
      if (previousFileRoot === undefined) {
        delete process.env.FILE_ROOT;
      } else {
        process.env.FILE_ROOT = previousFileRoot;
      }
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("卡面视频上传会保存到视频目录", async () => {
    const previousFileRoot = process.env.FILE_ROOT;
    const tempDir = await mkdtemp(join(tmpdir(), "kesini-upload-"));
    process.env.FILE_ROOT = tempDir;
    const service = createService();

    try {
      const result = await service.saveCardImage({
        originalname: "card.mp4",
        mimetype: "video/mp4",
        size: 4,
        buffer: Buffer.from("test"),
      });

      expect(result.url).toMatch(/^\/file\/card-videos\/.+\.mp4$/);
      const saved = await readFile(
        join(tempDir, result.url.replace("/file/", "")),
        "utf8",
      );
      expect(saved).toBe("test");
    } finally {
      if (previousFileRoot === undefined) {
        delete process.env.FILE_ROOT;
      } else {
        process.env.FILE_ROOT = previousFileRoot;
      }
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("卡片图片上传会拒绝非图片", async () => {
    const service = createService();

    await expect(
      service.saveCardImage({
        originalname: "card.txt",
        mimetype: "text/plain",
        size: 4,
        buffer: Buffer.from("test"),
      }),
    ).rejects.toThrow("仅支持 JPG、PNG、WEBP、MP4、WEBM 文件");
  });

  it("卡面素材上传会按类型限制大小", async () => {
    const service = createService();

    await expect(
      service.saveCardImage({
        originalname: "card.png",
        mimetype: "image/png",
        size: 2 * 1024 * 1024 + 1,
        buffer: Buffer.from("test"),
      }),
    ).rejects.toThrow("图片不能超过2MB");
    await expect(
      service.saveCardImage({
        originalname: "card.mp4",
        mimetype: "video/mp4",
        size: 10 * 1024 * 1024 + 1,
        buffer: Buffer.from("test"),
      }),
    ).rejects.toThrow("视频不能超过10MB");
  });

  it("创建卡片会拒绝空稀有度或非法稀有度", async () => {
    const service = createService();

    await expect(
      service.createCard({ card_name: "空稀有度", card_level: "" } as any),
    ).rejects.toThrow("卡片稀有度不能为空");
    await expect(
      service.createCard({
        card_name: "非法稀有度",
        card_level: "SSR,X",
      } as any),
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

  it("创建和更新卡片会保存上下架状态", async () => {
    const card = {
      id: 10,
      card_name: "测试卡",
      card_level: "N",
      enabled: true,
    };
    const cardRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(card),
    });
    const service = createService({ card: cardRepository });

    await service.createCard({
      card_name: "下架卡",
      card_level: "N",
      enabled: false,
    } as any);
    await service.updateCard(10, { enabled: false } as any);

    expect(cardRepository.save).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        card_name: "下架卡",
        enabled: false,
      }),
    );
    expect(cardRepository.save).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        id: 10,
        enabled: false,
      }),
    );
  });

  it("更新卡片允许清空描述和分解产出且不会用 null 清空卡面素材", async () => {
    const card = {
      id: 10,
      card_name: "测试卡",
      card_level: "N",
      card_desc: "旧描述",
      card_image: "old.png",
      drop_item: "1",
      card_type: 0,
      pool: 1,
    };
    const cardRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(card),
    });
    const service = createService({ card: cardRepository });

    await service.updateCard(10, {
      card_desc: null,
      card_image: null,
      drop_item: null,
    } as any);

    expect(cardRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        card_desc: "",
        card_image: "old.png",
        drop_item: "",
      }),
    );
  });

  it("更新卡片显式提交空字符串时会清空卡面素材", async () => {
    const card = {
      id: 10,
      card_name: "测试卡",
      card_level: "N",
      card_desc: "旧描述",
      card_image: "old.png",
      drop_item: "1",
      card_type: 0,
      pool: 1,
    };
    const cardRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(card),
    });
    const service = createService({ card: cardRepository });

    await service.updateCard(10, { card_image: "" } as any);

    expect(cardRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        card_image: "",
      }),
    );
  });

  it("更新卡片会拒绝空名称和空稀有度", async () => {
    const card = { id: 10, card_name: "测试卡", card_level: "N" };
    const cardRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(card),
    });
    const service = createService({ card: cardRepository });

    await expect(
      service.updateCard(10, { card_name: "" } as any),
    ).rejects.toThrow("卡片名称不能为空");
    await expect(
      service.updateCard(10, { card_level: "" } as any),
    ).rejects.toThrow("卡片稀有度不能为空");
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

  it("更新用户允许清空昵称和头像", async () => {
    const user = {
      id: 1,
      uid: "u1",
      name: "user",
      nickname: "nick",
      avatar: "avatar",
      point: 0,
      is_admin: false,
    };
    const userRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(user),
    });
    const service = createService({ user: userRepository });

    await service.updateUser(1, {
      nickname: null,
      avatar: null,
    } as any);

    expect(userRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        nickname: "",
        avatar: "",
      }),
    );
  });

  it("抽卡历史列表会补充用户昵称", async () => {
    const historyRepository = createRepository({
      findAndCount: jest
        .fn()
        .mockResolvedValue([
          [{ id: 1, uid: "1001", card_levels: "SSR", count: 1 }],
          1,
        ]),
    });
    const userRepository = createRepository({
      find: jest
        .fn()
        .mockResolvedValue([
          { uid: "1001", name: "fishpi-user", nickname: "鱼排玩家" },
        ]),
    });
    const service = createService({
      history: historyRepository,
      user: userRepository,
    });

    await expect(
      service.listHistories({ page: 1, pageSize: 20 }),
    ).resolves.toEqual(
      expect.objectContaining({
        list: [
          expect.objectContaining({
            uid: "1001",
            userName: "鱼排玩家",
          }),
        ],
      }),
    );
  });

  it("后台选项会按轻量结构返回卡池、卡片和物品", async () => {
    const poolRepository = createRepository({
      find: jest
        .fn()
        .mockResolvedValue([{ id: 1, pool_name: "常驻池", card_type: 0 }]),
    });
    const cardRepository = createRepository({
      find: jest
        .fn()
        .mockResolvedValue([
          { id: 10, card_name: "测试卡", card_level: "SSR", pool: 1 },
        ]),
    });
    const dropRepository = createRepository({
      find: jest
        .fn()
        .mockResolvedValue([
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
      seasons: [],
    });
    expect(poolRepository.find).toHaveBeenCalledWith({
      order: { sort_order: "ASC", id: "ASC" },
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

  it("更新物品时空布尔值不会覆盖原状态", async () => {
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
    const dropRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(item),
    });
    const service = createService({ drop: dropRepository });

    await service.updateDropItem(2, { disabled: null } as any);

    expect(dropRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        disabled: false,
      }),
    );
  });

  it("被引用的物品删除时改为禁用", async () => {
    const item = {
      id: 7,
      drop_name: "通用碎片",
      drop_type: 0,
      disabled: false,
    };
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

  it("更新背包和保底会拒绝空数字", async () => {
    const inventoryRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({ id: 1, num: 3 }),
    });
    const pityRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        draws_since_sr: 1,
        draws_since_ssr: 2,
        draws_since_ur: 3,
      }),
    });
    const service = createService({
      inventory: inventoryRepository,
      pity: pityRepository,
    });

    await expect(
      service.updateInventory(1, { num: null } as any),
    ).rejects.toThrow("物品数量必须为非负整数");
    await expect(
      service.updatePity(1, { draws_since_ur: null } as any),
    ).rejects.toThrow("保底计数必须为非负整数");
  });

  it("清空用户卡片数据会重置抽卡和充值相关记录", async () => {
    const userRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({ id: 3, uid: "u1" }),
    });
    const transactionUserRepository = createRepository();
    const userCardRepository = createRepository({
      delete: jest.fn().mockResolvedValue({ affected: 2 }),
    });
    const historyRepository = createRepository({
      delete: jest.fn().mockResolvedValue({ affected: 4 }),
    });
    const pityRepository = createRepository({
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    });
    const formationRepository = createRepository({
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    });
    const showcaseRepository = createRepository({
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    });
    const rechargeRecordRepository = createRepository({
      delete: jest.fn().mockResolvedValue({ affected: 3 }),
    });
    const tradeListingRepository = createRepository({
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    });
    const dataSource = createDataSource({
      User: transactionUserRepository,
      UserCard: userCardRepository,
      UserHistory: historyRepository,
      UserGachaPity: pityRepository,
      UserFormationSlot: formationRepository,
      UserShowcaseCard: showcaseRepository,
      RechargeRecord: rechargeRecordRepository,
      TradeListing: tradeListingRepository,
    });
    const service = createService({ user: userRepository, dataSource });

    await expect(service.resetUserCardData(3)).resolves.toEqual({
      uid: "u1",
      userCards: 2,
      histories: 4,
      pities: 1,
      formationSlots: 1,
      showcaseCards: 1,
      rechargeRecords: 3,
      tradeListings: 1,
    });
    expect(dataSource.transaction).toHaveBeenCalled();
    expect(userCardRepository.delete).toHaveBeenCalledWith({ uid: "u1" });
    expect(historyRepository.delete).toHaveBeenCalledWith({ uid: "u1" });
    expect(pityRepository.delete).toHaveBeenCalledWith({ uid: "u1" });
    expect(formationRepository.delete).toHaveBeenCalledWith({ uid: "u1" });
    expect(showcaseRepository.delete).toHaveBeenCalledWith({ uid: "u1" });
    expect(rechargeRecordRepository.delete).toHaveBeenCalledWith({ uid: "u1" });
    expect(tradeListingRepository.update).toHaveBeenCalledWith(
      { seller_uid: "u1", status: "active" },
      expect.objectContaining({ status: "cancelled" }),
    );
    expect(transactionUserRepository.update).toHaveBeenCalledWith(
      { id: 3 },
      {
        card_count_n: 0,
        card_count_r: 0,
        card_count_sr: 0,
        card_count_ssr: 0,
        card_count_ur: 0,
      },
    );
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
      createDataSource() as any,
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

  it("创建赛季会校验赛季编号和时间范围", async () => {
    const seasonRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((value) => Promise.resolve({ id: 1, ...value })),
    });
    const service = createService({ season: seasonRepository });

    await expect(
      service.createSeason({
        season_key: "season-2026-s1",
        name: "第一赛季",
        starts_at: "2026-05-01T00:00:00Z" as any,
        ends_at: "2026-06-01T00:00:00Z" as any,
      } as any),
    ).resolves.toEqual(
      expect.objectContaining({
        season_key: "season-2026-s1",
        name: "第一赛季",
        enabled: true,
        shop_enabled: true,
        leaderboard_enabled: true,
      }),
    );

    await expect(
      service.createSeason({
        season_key: "bad key",
        name: "异常赛季",
      } as any),
    ).rejects.toThrow("赛季编号只能包含");
    await expect(
      service.createSeason({
        season_key: "season-2026-s2",
        name: "异常赛季",
        starts_at: "2026-06-01T00:00:00Z" as any,
        ends_at: "2026-05-01T00:00:00Z" as any,
      } as any),
    ).rejects.toThrow("赛季结束时间必须晚于开始时间");
  });

  it("创建赛季商店兑换项会校验赛季和奖励", async () => {
    const seasonRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        season_key: "season-2026-s1",
        delete_flag: false,
      }),
    });
    const shopRepository = createRepository({
      save: jest.fn((value) => Promise.resolve({ id: 1, ...value })),
    });
    const service = createService({
      season: seasonRepository,
      seasonShopItem: shopRepository,
      drop: createRepository(),
      card: createRepository(),
    });

    await expect(
      service.createSeasonShopItem({
        season_key: "season-2026-s1",
        name: "星尘补给",
        cost_points: 100,
        rewards: { points: 20, items: [] },
      } as any),
    ).resolves.toEqual(
      expect.objectContaining({
        season_key: "season-2026-s1",
        name: "星尘补给",
        cost_points: 100,
      }),
    );
    expect(seasonRepository.findOne).toHaveBeenCalledWith({
      where: { season_key: "season-2026-s1", delete_flag: false },
    });

    await expect(
      service.createSeasonShopItem({
        season_key: "season-2026-s1",
        name: "空奖励",
        rewards: { points: 0, items: [] },
      } as any),
    ).rejects.toThrow("赛季商店奖励不能为空");
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
      find: jest.fn().mockResolvedValue([
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
      find: jest
        .fn()
        .mockResolvedValue([{ id: 1, drop_name: "测试道具", disabled: false }]),
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

  it("创建兑换码留空时会自动生成码", async () => {
    const redeemCodeRepository = createRepository();
    const service = createService({
      redeemCode: redeemCodeRepository,
    });

    await service.createRedeemCode({
      code: " ",
      name: "自动码",
      rewards: {
        points: 10,
        items: [],
      },
    } as any);

    expect(redeemCodeRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        code: expect.stringMatching(/^K[A-F0-9]{11}$/),
        name: "自动码",
        rewards: {
          points: 10,
          items: [],
        },
      }),
    );
  });

  it("创建兑换码支持卡片奖励", async () => {
    const redeemCodeRepository = createRepository();
    const cardRepository = createRepository({
      find: jest
        .fn()
        .mockResolvedValue([
          { id: 9, card_name: "测试卡片", card_level: "SR,SSR" },
        ]),
    });
    const service = createService({
      redeemCode: redeemCodeRepository,
      card: cardRepository,
    });

    await service.createRedeemCode({
      code: " card ",
      name: "卡片礼包",
      rewards: {
        points: 0,
        items: [],
        cards: [{ cardId: 9, rarity: "SSR", num: 2 }],
      },
    } as any);

    expect(redeemCodeRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "CARD",
        rewards: {
          points: 0,
          items: [],
          cards: [{ cardId: 9, rarity: "SSR", num: 2 }],
        },
      }),
    );
  });

  it("创建兑换码会校验卡片奖励稀有度", async () => {
    const cardRepository = createRepository({
      find: jest
        .fn()
        .mockResolvedValue([
          { id: 9, card_name: "测试卡片", card_level: "SR,SSR" },
        ]),
    });
    const service = createService({ card: cardRepository });

    await expect(
      service.createRedeemCode({
        code: "CARD",
        name: "卡片礼包",
        rewards: {
          points: 0,
          items: [],
          cards: [{ cardId: 9, rarity: "UR", num: 1 }],
        },
      } as any),
    ).rejects.toThrow("奖励卡片稀有度无效");
  });

  it("兑换码奖励不能选择已禁用物品", async () => {
    const dropRepository = createRepository({
      find: jest
        .fn()
        .mockResolvedValue([{ id: 1, drop_name: "旧道具", disabled: true }]),
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

  it("更新兑换码允许清空描述但不允许清空名称", async () => {
    const redeemCode = {
      id: 1,
      code: "WELCOME",
      name: "欢迎礼包",
      description: "旧描述",
      enabled: true,
      total_limit: null,
      used_count: 0,
      starts_at: null,
      ends_at: null,
      rewards: { points: 0, items: [] },
      delete_flag: false,
    };
    const redeemCodeRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(redeemCode),
    });
    const service = createService({ redeemCode: redeemCodeRepository });

    await service.updateRedeemCode(1, { description: null } as any);

    expect(redeemCodeRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "",
      }),
    );
    await expect(
      service.updateRedeemCode(1, { name: "" } as any),
    ).rejects.toThrow("兑换码名称不能为空");
  });

  it("交易和充值配置会拒绝空数字", async () => {
    const tradeConfigRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        enabled: true,
        fee_rate: 0,
        min_price: 1,
        max_price: 999999,
      }),
    });
    const rechargeConfigRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        enabled: false,
        gold_finger_key: "",
        fishpi_api_key: "",
        min_amount: 1,
        max_amount: 9999,
        recharge_ratio: 1,
        memo_template: "抽卡平台充值，兑换星穹币 {amount}",
      }),
    });
    const service = createService({
      tradeConfig: tradeConfigRepository,
      rechargeConfig: rechargeConfigRepository,
    });

    await expect(
      service.updateTradeConfig({ min_price: null } as any),
    ).rejects.toThrow("最低交易价格必须为正整数");
    await expect(
      service.updateRechargeConfig({ min_amount: null } as any),
    ).rejects.toThrow("最低充值金额必须为正整数");
  });

  it("充值统计会汇总金额状态和近7日", async () => {
    const makeMetricBuilder = (raw: Record<string, string>) => ({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue(raw),
    });
    const statusBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        { status: "success", count: "5" },
        { status: "pending", count: "1" },
        { status: "failed", count: "2" },
        { status: "local_failed", count: "1" },
      ]),
    };
    const rechargeRecordRepository = createRepository({
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(
          makeMetricBuilder({ count: "5", amount: "500", fishpiCost: "250" }),
        )
        .mockReturnValueOnce(
          makeMetricBuilder({ count: "1", amount: "100", fishpiCost: "50" }),
        )
        .mockReturnValueOnce(
          makeMetricBuilder({ count: "3", amount: "300", fishpiCost: "150" }),
        )
        .mockReturnValueOnce(
          makeMetricBuilder({ count: "4", amount: "400", fishpiCost: "200" }),
        )
        .mockReturnValueOnce(statusBuilder),
      find: jest.fn().mockResolvedValue([
        {
          status: "success",
          amount: 30,
          fishpi_cost: 15,
          createdAt: new Date(),
        },
        {
          status: "success",
          amount: 50,
          fishpi_cost: 25,
          createdAt: new Date(),
        },
      ]),
    });
    const service = createService({ rechargeRecord: rechargeRecordRepository });

    const result = await service.getRechargeStats();

    expect(result.summary.total).toEqual({
      count: 5,
      amount: 500,
      fishpiCost: 250,
    });
    expect(result.summary.last7Days.amount).toBe(300);
    expect(result.statusCounts).toEqual({
      pending: 1,
      success: 5,
      failed: 2,
      local_failed: 1,
    });
    expect(result.daily).toHaveLength(7);
    expect(
      result.daily.some((item) => item.count === 2 && item.amount === 80),
    ).toBe(true);
  });

  it("获取分解配置会返回默认规则", async () => {
    const systemConfigRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(null),
    });
    const service = createService({
      systemConfig: systemConfigRepository,
      drop: createRepository(),
    });

    await expect(service.getDecomposeConfig()).resolves.toEqual(
      expect.objectContaining({
        rules: expect.objectContaining({
          N: expect.objectContaining({
            drops: [expect.objectContaining({ itemId: 0, min: 1, max: 10 })],
          }),
          SSR: expect.objectContaining({
            drops: [expect.objectContaining({ itemId: 0, min: 40, max: 80 })],
          }),
        }),
      }),
    );
  });

  it("更新分解配置会保存多种碎片产出规则", async () => {
    const systemConfigRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(null),
    });
    const dropRepository = createRepository({
      find: jest.fn().mockResolvedValue([
        { id: 9, drop_name: "测试碎片", drop_type: 0, disabled: false },
        { id: 10, drop_name: "额外碎片", drop_type: 0, disabled: false },
      ]),
    });
    const service = createService({
      systemConfig: systemConfigRepository,
      drop: dropRepository,
    });

    const result = await service.updateDecomposeConfig({
      rules: {
        N: {
          drops: [
            { itemId: 9, min: 2, max: 4 },
            { itemId: 10, min: 1, max: 1 },
          ],
        },
      },
    });

    expect(systemConfigRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "decomposeConfig",
        description: "卡片分解默认产出配置",
      }),
    );
    const saved = systemConfigRepository.save.mock.calls[0][0];
    expect(JSON.parse(saved.value).rules.N.drops).toEqual([
      { itemId: 9, min: 2, max: 4 },
      { itemId: 10, min: 1, max: 1 },
    ]);
    expect(result.rules.N).toEqual(
      expect.objectContaining({
        drops: [
          expect.objectContaining({
            itemId: 9,
            itemName: "测试碎片",
            min: 2,
            max: 4,
          }),
          expect.objectContaining({
            itemId: 10,
            itemName: "额外碎片",
            min: 1,
            max: 1,
          }),
        ],
      }),
    );
  });

  it("分解配置只能选择启用的卡片碎片", async () => {
    const systemConfigRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(null),
    });
    const disabledDropRepository = createRepository({
      find: jest
        .fn()
        .mockResolvedValue([
          { id: 9, drop_name: "旧碎片", drop_type: 0, disabled: true },
        ]),
    });
    const disabledService = createService({
      systemConfig: systemConfigRepository,
      drop: disabledDropRepository,
    });

    await expect(
      disabledService.updateDecomposeConfig({
        rules: { N: { itemId: 9, min: 1, max: 1 } },
      }),
    ).rejects.toThrow("N 分解第1项碎片已禁用");

    const itemDropRepository = createRepository({
      find: jest
        .fn()
        .mockResolvedValue([
          { id: 10, drop_name: "普通道具", drop_type: 2, disabled: false },
        ]),
    });
    const itemService = createService({
      systemConfig: systemConfigRepository,
      drop: itemDropRepository,
    });

    await expect(
      itemService.updateDecomposeConfig({
        rules: { R: { itemId: 10, min: 1, max: 1 } },
      }),
    ).rejects.toThrow("R 分解第1项产出只能选择卡片碎片");
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
      find: jest
        .fn()
        .mockResolvedValue([{ id: 2, drop_name: "禁用道具", disabled: true }]),
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
      find: jest
        .fn()
        .mockResolvedValue([
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
