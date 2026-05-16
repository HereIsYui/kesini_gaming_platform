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
});
