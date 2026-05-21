import { RedeemCode } from "src/entity/redeemCode.entity";
import { RedeemCodeUsage } from "src/entity/redeemCodeUsage.entity";
import { User } from "src/entity/user.entity";
import { UserInventory } from "src/entity/inventory.entity";
import { DropItem } from "src/entity/drop.entity";
import { RewardService } from "src/reward/reward.service";
import { RedeemService } from "./redeem.service";

function createRepository(overrides: Record<string, any> = {}) {
  return {
    create: jest.fn((value) => value),
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn((value) => Promise.resolve(value)),
    ...overrides,
  };
}

function createService(repositories: Map<any, any>) {
  const manager = {
    getRepository: jest.fn((entity) => repositories.get(entity)),
  };
  const dataSource = {
    transaction: jest.fn((callback) => callback(manager)),
  };
  return {
    service: new RedeemService(dataSource as any, new RewardService()),
    dataSource,
  };
}

describe("RedeemService", () => {
  it("兑换成功会发放积分、道具并写入领取记录", async () => {
    const code = {
      id: 1,
      code: "WELCOME",
      enabled: true,
      used_count: 0,
      total_limit: 10,
      rewards: { points: 100, items: [{ itemId: 2, num: 3 }] },
      delete_flag: false,
    };
    const user = { id: 5, uid: "u1", point: 0 };
    const redeemCodeRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(code),
    });
    const usageRepository = createRepository();
    const userRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(user),
    });
    const inventoryRepository = createRepository();
    const dropRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({
        id: 2,
        drop_name: "测试道具",
        disabled: false,
      }),
    });
    const { service } = createService(
      new Map<any, any>([
        [RedeemCode, redeemCodeRepository],
        [RedeemCodeUsage, usageRepository],
        [User, userRepository],
        [UserInventory, inventoryRepository],
        [DropItem, dropRepository],
      ]),
    );

    await expect(service.claim("u1", " welcome ")).resolves.toEqual({
      code: "WELCOME",
      rewards: { points: 100, items: [{ itemId: 2, num: 3 }] },
    });
    expect(userRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ point: 100 }),
    );
    expect(inventoryRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 5, item_id: 2, num: 3 }),
    );
    expect(redeemCodeRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ used_count: 1 }),
    );
    expect(usageRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ code_id: 1, uid: "u1" }),
    );
  });

  it("同一用户不能重复兑换同一个兑换码", async () => {
    const redeemCodeRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        code: "WELCOME",
        enabled: true,
        used_count: 0,
        rewards: { points: 1, items: [] },
      }),
    });
    const usageRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({ id: 9 }),
    });
    const { service } = createService(
      new Map<any, any>([
        [RedeemCode, redeemCodeRepository],
        [RedeemCodeUsage, usageRepository],
        [User, createRepository()],
        [UserInventory, createRepository()],
        [DropItem, createRepository()],
      ]),
    );

    await expect(service.claim("u1", "WELCOME")).rejects.toThrow(
      "该兑换码已领取",
    );
  });

  it("库存耗尽时拒绝兑换", async () => {
    const redeemCodeRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        code: "WELCOME",
        enabled: true,
        used_count: 1,
        total_limit: 1,
        rewards: { points: 1, items: [] },
      }),
    });
    const { service } = createService(
      new Map<any, any>([
        [RedeemCode, redeemCodeRepository],
        [RedeemCodeUsage, createRepository()],
        [User, createRepository()],
        [UserInventory, createRepository()],
        [DropItem, createRepository()],
      ]),
    );

    await expect(service.claim("u1", "WELCOME")).rejects.toThrow(
      "兑换码库存已用完",
    );
  });
});
