import { PointLedgerRecord } from "src/entity/pointLedgerRecord.entity";
import { User } from "src/entity/user.entity";
import { PointLedgerService } from "./point-ledger.service";

function createRepository(overrides: Record<string, any> = {}) {
  return {
    create: jest.fn((value) => value),
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn((value) => Promise.resolve(value)),
    createQueryBuilder: jest.fn(),
    ...overrides,
  };
}

describe("PointLedgerService", () => {
  it("星穹币变动会同步更新用户余额并写入流水", async () => {
    const user = { uid: "u1", point: 20 } as User;
    const userRepository = createRepository();
    const ledgerRepository = createRepository({
      create: jest.fn((value) => ({ id: 1, ...value })),
      save: jest.fn((value) => Promise.resolve(value)),
    });
    const manager = {
      getRepository: jest.fn((entity) =>
        entity === User ? userRepository : ledgerRepository,
      ),
    };
    const service = new PointLedgerService({} as any);

    await expect(
      service.applyChange(manager as any, user, 30, {
        sourceType: "recharge",
        sourceId: "r1",
        title: "星穹币充值",
        metadata: { requestId: "r1" },
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        uid: "u1",
        change_amount: 30,
        point_before: 20,
        point_after: 50,
        source_type: "recharge",
      }),
    );
    expect(userRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ point: 50 }),
    );
    expect(ledgerRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "u1",
        change_amount: 30,
        source_id: "r1",
      }),
    );
  });

  it("支出后余额为负时拒绝写入流水", async () => {
    const user = { uid: "u1", point: 5 } as User;
    const userRepository = createRepository();
    const ledgerRepository = createRepository();
    const manager = {
      getRepository: jest.fn((entity) =>
        entity === User ? userRepository : ledgerRepository,
      ),
    };
    const service = new PointLedgerService({} as any);

    await expect(
      service.applyChange(manager as any, user, -10, {
        sourceType: "draw_once",
        sourceId: 1,
        title: "单抽",
      }),
    ).rejects.toThrow("星穹币不足");
    expect(userRepository.save).not.toHaveBeenCalled();
    expect(ledgerRepository.save).not.toHaveBeenCalled();
  });

  it("用户流水支持分页、收支筛选和来源筛选", async () => {
    const record = {
      id: 7,
      uid: "u1",
      change_amount: -10,
      point_before: 50,
      point_after: 40,
      source_type: "draw_once",
      source_id: "1",
      title: "单抽：测试池",
      metadata: { poolName: "测试池" },
      createdAt: new Date("2026-05-21T00:00:00Z"),
    } as PointLedgerRecord;
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[record], 1]),
    };
    const ledgerRepository = createRepository({
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    });
    const userRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({ uid: "u1", point: 40 }),
    });
    const dataSource = {
      getRepository: jest.fn((entity) =>
        entity === User ? userRepository : ledgerRepository,
      ),
    };
    const service = new PointLedgerService(dataSource as any);

    await expect(
      service.listUserRecords("u1", {
        page: 2,
        pageSize: 10,
        type: "expense",
        sourceType: "draw_once",
      }),
    ).resolves.toEqual({
      list: [
        expect.objectContaining({
          id: 7,
          changeAmount: -10,
          sourceType: "draw_once",
          sourceLabel: "单抽消耗",
        }),
      ],
      total: 1,
      page: 2,
      pageSize: 10,
      totalPages: 1,
      currentPoint: 40,
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      "record.change_amount < 0",
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      "record.source_type = :sourceType",
      { sourceType: "draw_once" },
    );
    expect(queryBuilder.skip).toHaveBeenCalledWith(10);
    expect(queryBuilder.take).toHaveBeenCalledWith(10);
  });
});
