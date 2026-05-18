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
    {
      getAllPoolConfigs: jest.fn(() => ({ 1: { poolId: 1 } })),
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

  it("后台选项会按轻量结构返回卡池、卡片和掉落物", async () => {
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
        { id: 20, drop_name: "测试碎片", drop_type: 0 },
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
      dropItems: [{ label: "测试碎片", value: 20, type: 0 }],
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
    await expect(service.getDropItem(4)).resolves.toBe(dropItem);
    expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(poolRepository.findOne).toHaveBeenCalledWith({ where: { id: 2 } });
    expect(cardRepository.findOne).toHaveBeenCalledWith({ where: { id: 3 } });
    expect(dropRepository.findOne).toHaveBeenCalledWith({ where: { id: 4 } });
  });
});
