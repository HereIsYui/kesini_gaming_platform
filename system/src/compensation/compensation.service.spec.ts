import { CompensationGrant } from "src/entity/compensationGrant.entity";
import { User } from "src/entity/user.entity";
import { COMPENSATION_BATCH_KEY } from "./compensation.constants";
import { CompensationService } from "./compensation.service";

class ArrayRepository<T extends Record<string, any>> {
  rows: T[] = [];
  nextId = 1;

  constructor(private readonly factory: (value: Partial<T>, id: number) => T) {}

  async findOne(options?: any) {
    return (
      this.rows.find((row) => this.matchesWhere(row, options?.where || {})) ||
      null
    );
  }

  create(value: Partial<T>) {
    return this.factory(value, this.nextId++);
  }

  async save(value: T) {
    const index = this.rows.findIndex((row) => row.id === value.id);
    if (index >= 0) {
      this.rows[index] = value;
    } else {
      this.rows.push(value);
    }
    return value;
  }

  private matchesWhere(item: Record<string, any>, where: Record<string, any>) {
    return Object.entries(where).every(
      ([key, expected]) => item[key] === expected,
    );
  }
}

function createGrant(value: Partial<CompensationGrant>, id: number) {
  return {
    id,
    batch_key: COMPENSATION_BATCH_KEY,
    uid: "u1",
    user_name: "玩家",
    recharge_amount: 0,
    monthly_amount: 0,
    total_amount: 0,
    claimed: false,
    claimed_at: null,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    ...value,
  } as CompensationGrant;
}

function createUser(value: Partial<User>, id: number) {
  return {
    id,
    uid: "u1",
    public_id: null,
    name: "user",
    nickname: "玩家",
    avatar: "",
    point: 0,
    card_count_n: 0,
    card_count_r: 0,
    card_count_sr: 0,
    card_count_ssr: 0,
    card_count_ur: 0,
    is_admin: false,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    ...value,
  } as User;
}

function createHarness() {
  const grants = new ArrayRepository<CompensationGrant>(createGrant);
  const users = new ArrayRepository<User>(createUser);
  const manager = {
    getRepository: jest.fn((entity) => getRepository(entity)),
  };
  const dataSource = {
    getRepository: jest.fn((entity) => getRepository(entity)),
    transaction: jest.fn((handler) => handler(manager)),
  };
  const pointLedgerService = {
    applyChange: jest.fn(async (_manager, user: User, amount: number) => {
      const pointBefore = Number(user.point || 0);
      user.point = pointBefore + amount;
      return {
        point_before: pointBefore,
        point_after: user.point,
      };
    }),
  };
  const service = new CompensationService(
    dataSource as any,
    pointLedgerService as any,
  );

  function getRepository(entity: unknown) {
    const name = (entity as { name?: string })?.name;
    if (name === "CompensationGrant") {
      return grants;
    }
    if (name === "User") {
      return users;
    }
    throw new Error(`未知仓库: ${name}`);
  }

  return {
    service,
    grants,
    users,
    manager,
    dataSource,
    pointLedgerService,
  };
}

describe("CompensationService", () => {
  it("有未领取补偿时返回可领取", async () => {
    const { service, grants } = createHarness();
    grants.rows.push(
      createGrant({
        uid: "u1",
        recharge_amount: 150,
        monthly_amount: 3072,
        total_amount: 3222,
      }, 1),
    );

    await expect(service.getMine("u1")).resolves.toEqual({
      available: true,
      batchKey: COMPENSATION_BATCH_KEY,
      title: "充值补偿",
      rechargeAmount: 150,
      monthlyAmount: 3072,
      totalAmount: 3222,
      claimed: false,
    });
  });

  it("无补偿或已领取时返回不可领取", async () => {
    const { service, grants } = createHarness();
    grants.rows.push(
      createGrant({
        uid: "u1",
        total_amount: 100,
        claimed: true,
        claimed_at: new Date("2026-07-01T01:00:00.000Z"),
      }, 1),
    );

    await expect(service.getMine("u1")).resolves.toEqual({ available: false });
    await expect(service.getMine("u2")).resolves.toEqual({ available: false });
  });

  it("领取后增加星穹币并写入流水", async () => {
    const { service, grants, users, manager, pointLedgerService } =
      createHarness();
    const grant = createGrant({
      uid: "u1",
      recharge_amount: 1500,
      monthly_amount: 6144,
      total_amount: 7644,
    }, 1);
    const user = createUser({ uid: "u1", point: 20 }, 1);
    grants.rows.push(grant);
    users.rows.push(user);

    await expect(
      service.claim("u1", COMPENSATION_BATCH_KEY),
    ).resolves.toEqual(
      expect.objectContaining({
        available: false,
        claimed: true,
        rechargeAmount: 1500,
        monthlyAmount: 6144,
        totalAmount: 7644,
        pointAfter: 7664,
      }),
    );
    expect(user.point).toBe(7664);
    expect(grant.claimed).toBe(true);
    expect(grant.claimed_at).toBeInstanceOf(Date);
    expect(pointLedgerService.applyChange).toHaveBeenCalledWith(
      manager,
      user,
      7644,
      expect.objectContaining({
        sourceType: "admin_adjust",
        sourceId: `compensation:${COMPENSATION_BATCH_KEY}:u1`,
        title: "充值补偿",
        metadata: {
          batchKey: COMPENSATION_BATCH_KEY,
          rechargeAmount: 1500,
          monthlyAmount: 6144,
        },
      }),
    );
  });

  it("重复领取会被拒绝", async () => {
    const { service, grants, users, pointLedgerService } = createHarness();
    grants.rows.push(
      createGrant({
        uid: "u1",
        total_amount: 100,
        claimed: true,
        claimed_at: new Date("2026-07-01T01:00:00.000Z"),
      }, 1),
    );
    users.rows.push(createUser({ uid: "u1", point: 20 }, 1));

    await expect(service.claim("u1", COMPENSATION_BATCH_KEY)).rejects.toThrow(
      "已领取",
    );
    expect(pointLedgerService.applyChange).not.toHaveBeenCalled();
  });

  it("用户不存在时不能领取，用户创建后可领取", async () => {
    const { service, grants, users } = createHarness();
    grants.rows.push(
      createGrant({
        uid: "u1",
        monthly_amount: 3072,
        total_amount: 3072,
      }, 1),
    );

    await expect(service.claim("u1", COMPENSATION_BATCH_KEY)).rejects.toThrow(
      "用户不存在",
    );

    users.rows.push(createUser({ uid: "u1", point: 0 }, 1));
    await expect(service.claim("u1", COMPENSATION_BATCH_KEY)).resolves.toEqual(
      expect.objectContaining({ pointAfter: 3072 }),
    );
  });

  it("只有充值或只有月卡补偿都可以领取", async () => {
    const { service, grants, users } = createHarness();
    grants.rows.push(
      createGrant(
        { uid: "recharge", recharge_amount: 150, total_amount: 150 },
        1,
      ),
      createGrant(
        { uid: "monthly", monthly_amount: 3072, total_amount: 3072 },
        2,
      ),
    );
    users.rows.push(
      createUser({ uid: "recharge", point: 0 }, 1),
      createUser({ uid: "monthly", point: 0 }, 2),
    );

    await expect(
      service.claim("recharge", COMPENSATION_BATCH_KEY),
    ).resolves.toEqual(expect.objectContaining({ pointAfter: 150 }));
    await expect(
      service.claim("monthly", COMPENSATION_BATCH_KEY),
    ).resolves.toEqual(expect.objectContaining({ pointAfter: 3072 }));
  });
});
