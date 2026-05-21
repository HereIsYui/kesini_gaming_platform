import { DropItem } from "src/entity/drop.entity";
import { UserInventory } from "src/entity/inventory.entity";
import { LaunchActivityClaim } from "src/entity/launchActivityClaim.entity";
import { LaunchActivityConfig } from "src/entity/launchActivityConfig.entity";
import { User } from "src/entity/user.entity";
import { RewardService } from "src/reward/reward.service";
import { LaunchActivityService } from "./launch-activity.service";

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
    getRepository: jest.fn((entity) => repositories.get(entity)),
    transaction: jest.fn((callback) => callback(manager)),
  };
  return {
    service: new LaunchActivityService(dataSource as any, new RewardService()),
    dataSource,
  };
}

function createConfig(overrides: Partial<LaunchActivityConfig> = {}) {
  return {
    id: 1,
    enabled: true,
    activity_key: "launch-2026",
    name: "开服福利",
    description: "欢迎回来",
    starts_at: null,
    ends_at: null,
    rewards: { points: 100, items: [{ itemId: 2, num: 3 }] },
    ...overrides,
  } as LaunchActivityConfig;
}

describe("LaunchActivityService", () => {
  it("活动关闭、未开始、已过期时不可领取", async () => {
    const configRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(createConfig({ enabled: false })),
    });
    const { service } = createService(
      new Map<any, any>([
        [LaunchActivityConfig, configRepository],
        [LaunchActivityClaim, createRepository()],
        [User, createRepository()],
        [UserInventory, createRepository()],
        [DropItem, createRepository()],
      ]),
    );

    await expect(service.claim("u1")).rejects.toThrow("开服福利暂未开启");

    configRepository.findOne.mockResolvedValue(
      createConfig({ starts_at: new Date(Date.now() + 60_000) }),
    );
    await expect(service.claim("u1")).rejects.toThrow("开服福利尚未开始");

    configRepository.findOne.mockResolvedValue(
      createConfig({ ends_at: new Date(Date.now() - 60_000) }),
    );
    await expect(service.claim("u1")).rejects.toThrow("开服福利已结束");
  });

  it("领取成功会发放积分、物品并写入领取记录", async () => {
    const user = { id: 5, uid: "u1", point: 10 };
    const configRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(createConfig()),
    });
    const claimRepository = createRepository();
    const userRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(user),
    });
    const inventoryRepository = createRepository();
    const dropRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({
        id: 2,
        drop_name: "活动道具",
        disabled: false,
      }),
    });

    const { service } = createService(
      new Map<any, any>([
        [LaunchActivityConfig, configRepository],
        [LaunchActivityClaim, claimRepository],
        [User, userRepository],
        [UserInventory, inventoryRepository],
        [DropItem, dropRepository],
      ]),
    );

    await expect(service.claim("u1")).resolves.toEqual({
      activityKey: "launch-2026",
      name: "开服福利",
      rewards: { points: 100, items: [{ itemId: 2, num: 3 }] },
    });
    expect(userRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ point: 110 }),
    );
    expect(inventoryRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 5, item_id: 2, num: 3 }),
    );
    expect(claimRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        activity_key: "launch-2026",
        uid: "u1",
        reward_snapshot: { points: 100, items: [{ itemId: 2, num: 3 }] },
      }),
    );
  });

  it("同一用户重复领取同一活动批次会被拒绝", async () => {
    const { service } = createService(
      new Map<any, any>([
        [LaunchActivityConfig, createRepository({ findOne: jest.fn().mockResolvedValue(createConfig()) })],
        [LaunchActivityClaim, createRepository({ findOne: jest.fn().mockResolvedValue({ id: 9 }) })],
        [User, createRepository()],
        [UserInventory, createRepository()],
        [DropItem, createRepository()],
      ]),
    );

    await expect(service.claim("u1")).rejects.toThrow("开服福利已领取");
  });

  it("修改活动批次后同一用户可以领取新一期", async () => {
    const claimRepository = createRepository({
      findOne: jest.fn(({ where }) =>
        Promise.resolve(
          where.activity_key === "launch-old" ? { id: 1, uid: "u1" } : null,
        ),
      ),
    });
    const user = { id: 5, uid: "u1", point: 0 };
    const { service } = createService(
      new Map<any, any>([
        [
          LaunchActivityConfig,
          createRepository({
            findOne: jest.fn().mockResolvedValue(
              createConfig({
                activity_key: "launch-new",
                rewards: { points: 20, items: [] },
              }),
            ),
          }),
        ],
        [LaunchActivityClaim, claimRepository],
        [User, createRepository({ findOne: jest.fn().mockResolvedValue(user) })],
        [UserInventory, createRepository()],
        [DropItem, createRepository()],
      ]),
    );

    await expect(service.claim("u1")).resolves.toEqual(
      expect.objectContaining({ activityKey: "launch-new" }),
    );
  });

  it("禁用或不存在的物品不能作为奖励发放", async () => {
    const userRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({ id: 5, uid: "u1", point: 0 }),
    });
    const dropRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({ id: 2, drop_name: "禁用道具", disabled: true }),
    });
    const { service } = createService(
      new Map<any, any>([
        [LaunchActivityConfig, createRepository({ findOne: jest.fn().mockResolvedValue(createConfig()) })],
        [LaunchActivityClaim, createRepository()],
        [User, userRepository],
        [UserInventory, createRepository()],
        [DropItem, dropRepository],
      ]),
    );

    await expect(service.claim("u1")).rejects.toThrow("奖励物品已禁用");
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it("查询当前活动会返回是否已领取", async () => {
    const { service } = createService(
      new Map<any, any>([
        [LaunchActivityConfig, createRepository({ findOne: jest.fn().mockResolvedValue(createConfig({ rewards: { points: 10, items: [] } })) })],
        [LaunchActivityClaim, createRepository({ findOne: jest.fn().mockResolvedValue({ id: 1 }) })],
        [User, createRepository()],
        [UserInventory, createRepository()],
        [DropItem, createRepository()],
      ]),
    );

    await expect(service.getCurrent("u1")).resolves.toEqual({
      activity: expect.objectContaining({ activityKey: "launch-2026" }),
      available: false,
      claimed: true,
      reason: "已领取",
    });
  });
});
