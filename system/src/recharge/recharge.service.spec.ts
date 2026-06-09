import axios from "axios";
import { CardItem } from "src/entity/card.entity";
import { DropItem } from "src/entity/drop.entity";
import { RechargeConfig } from "src/entity/rechargeConfig.entity";
import { RechargeRecord } from "src/entity/rechargeRecord.entity";
import { SystemConfig } from "src/entity/systemConfig.entity";
import { User } from "src/entity/user.entity";
import { UserInventory } from "src/entity/inventory.entity";
import { VipDailyClaim } from "src/entity/vipDailyClaim.entity";
import { RewardService } from "src/reward/reward.service";
import { RechargeService } from "./recharge.service";

jest.mock("axios");

const mockedAxios = axios as jest.Mocked<typeof axios>;

function createRepository(overrides: Record<string, any> = {}) {
  return {
    create: jest.fn((value) => value),
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn((value) => Promise.resolve(value)),
    ...overrides,
  };
}

function createService(
  repositories: Map<any, any>,
  deps: { rewardService?: RewardService } = {},
) {
  const repositoryMap = new Map<any, any>([
    [SystemConfig, createRepository()],
    [VipDailyClaim, createRepository()],
    [DropItem, createRepository({ find: jest.fn().mockResolvedValue([]) })],
    [CardItem, createRepository({ find: jest.fn().mockResolvedValue([]) })],
    [UserInventory, createRepository()],
    ...repositories,
  ]);
  const manager = {
    getRepository: jest.fn((entity) => repositoryMap.get(entity)),
  };
  const dataSource = {
    getRepository: jest.fn((entity) => repositoryMap.get(entity)),
    transaction: jest.fn((callback) => callback(manager)),
  };
  return {
    service: new RechargeService(
      dataSource as any,
      undefined,
      undefined,
      deps.rewardService,
    ),
    dataSource,
  };
}

function expectedGameVip(patch: Record<string, any> = {}) {
  return {
    checked: false,
    active: false,
    tier: 0,
    label: "未同步",
    sources: [],
    sourceLabels: [],
    sweepLimit: 0,
    tradeFeeDiscount: 0,
    dailyRewards: { points: 0, items: [] },
    dailyClaimed: false,
    dailyClaimDate: expect.any(String),
    ...patch,
  };
}

function createEnabledConfig(overrides: Partial<RechargeConfig> = {}) {
  return {
    id: 1,
    enabled: true,
    gold_finger_key: "gold-key",
    fishpi_api_key: "api-key",
    min_amount: 1,
    max_amount: 9999,
    recharge_ratio: 1,
    memo_template: "抽卡平台充值 {amount}",
    ...overrides,
  };
}

describe("RechargeService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.isAxiosError.mockImplementation((error: any) =>
      Boolean(error?.isAxiosError),
    );
    mockedAxios.get.mockResolvedValue({ data: { userPoint: 9999 } });
  });

  it("查询当前用户鱼排积分", async () => {
    const userRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({
        uid: "u1",
        name: "fish-user",
        point: 20,
      }),
    });
    mockedAxios.get.mockResolvedValue({
      data: { code: 0, data: { userPoint: 156625, userName: "fish-user" } },
    });

    const { service } = createService(
      new Map<any, any>([
        [RechargeConfig, createRepository()],
        [RechargeRecord, createRepository()],
        [User, userRepository],
      ]),
    );

    await expect(service.getFishpiPoint("u1")).resolves.toEqual({
      userName: "fish-user",
      point: 156625,
      vip: {
        checked: false,
        active: false,
        levelCode: "",
        expiresAt: null,
      },
      gameVip: expectedGameVip(),
    });
    expect(mockedAxios.get).toHaveBeenCalledWith(
      "https://fishpi.cn/user/fish-user/point",
      expect.objectContaining({
        headers: expect.objectContaining({
          "User-Agent": "Kesini-Gacha-Platform/1.0",
        }),
      }),
    );
  });

  it("鱼排会员查询成功时返回VIP状态", async () => {
    const expiresAt = new Date(Date.now() + 86400_000).toISOString();
    const userRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({
        uid: "123456",
        name: "fish-user",
        point: 20,
      }),
    });
    mockedAxios.get
      .mockResolvedValueOnce({
        data: { code: 0, data: { userPoint: 156625, userName: "fish-user" } },
      })
      .mockResolvedValueOnce({
        data: {
          code: 0,
          data: {
            oId: "123456",
            lvCode: "VIP2_MONTH",
            state: 1,
            expiresAt,
          },
        },
      });

    const { service } = createService(
      new Map<any, any>([
        [
          RechargeConfig,
          createRepository({
            findOne: jest.fn().mockResolvedValue(createEnabledConfig()),
          }),
        ],
        [RechargeRecord, createRepository()],
        [User, userRepository],
      ]),
    );

    await expect(service.getFishpiPoint("123456")).resolves.toEqual({
      userName: "fish-user",
      point: 156625,
      vip: {
        checked: true,
        active: true,
        levelCode: "VIP2_MONTH",
        expiresAt,
      },
      gameVip: expectedGameVip({
        checked: true,
        active: true,
        tier: 2,
        label: "VIP2",
        sources: ["fishpi"],
        sourceLabels: ["鱼排"],
        sweepLimit: 10,
        tradeFeeDiscount: 0.04,
        dailyRewards: { points: 15, items: [] },
      }),
    });
    expect(mockedAxios.get).toHaveBeenNthCalledWith(
      2,
      "https://fishpi.cn/api/membership/123456?apiKey=api-key",
      expect.objectContaining({
        headers: expect.objectContaining({
          "User-Agent": "Kesini-Gacha-Platform/1.0",
        }),
      }),
    );
  });

  it("鱼排会员state为0时返回非VIP", async () => {
    const expiresAt = new Date(Date.now() + 86400_000).toISOString();
    const userRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({
        uid: "123456",
        name: "fish-user",
      }),
    });
    mockedAxios.get
      .mockResolvedValueOnce({
        data: { code: 0, data: { userPoint: 100 } },
      })
      .mockResolvedValueOnce({
        data: { code: 0, data: { lvCode: "VIP1_MONTH", state: 0, expiresAt } },
      });

    const { service } = createService(
      new Map<any, any>([
        [
          RechargeConfig,
          createRepository({
            findOne: jest.fn().mockResolvedValue(createEnabledConfig()),
          }),
        ],
        [RechargeRecord, createRepository()],
        [User, userRepository],
      ]),
    );

    await expect(service.getFishpiPoint("123456")).resolves.toMatchObject({
      vip: {
        checked: true,
        active: false,
        levelCode: "VIP1_MONTH",
        expiresAt,
      },
    });
  });

  it("鱼排会员state有效时缺少过期时间仍返回VIP", async () => {
    const userRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({
        uid: "123456",
        name: "fish-user",
      }),
    });
    mockedAxios.get
      .mockResolvedValueOnce({
        data: { code: 0, data: { userPoint: 100 } },
      })
      .mockResolvedValueOnce({
        data: { code: 0, data: { lvCode: "VIP1_MONTH", state: 1 } },
      });

    const { service } = createService(
      new Map<any, any>([
        [
          RechargeConfig,
          createRepository({
            findOne: jest.fn().mockResolvedValue(createEnabledConfig()),
          }),
        ],
        [RechargeRecord, createRepository()],
        [User, userRepository],
      ]),
    );

    await expect(service.getFishpiPoint("123456")).resolves.toMatchObject({
      vip: {
        checked: true,
        active: true,
        levelCode: "VIP1_MONTH",
        expiresAt: null,
      },
    });
  });

  it("鱼排会员兼容数字过期时间", async () => {
    const expireTime = Date.now() + 86400_000;
    const userRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({
        uid: "123456",
        name: "fish-user",
      }),
    });
    mockedAxios.get
      .mockResolvedValueOnce({
        data: { code: 0, data: { userPoint: 100 } },
      })
      .mockResolvedValueOnce({
        data: { code: 0, data: { levelCode: "VIP3_YEAR", state: 1, expireTime } },
      });

    const { service } = createService(
      new Map<any, any>([
        [
          RechargeConfig,
          createRepository({
            findOne: jest.fn().mockResolvedValue(createEnabledConfig()),
          }),
        ],
        [RechargeRecord, createRepository()],
        [User, userRepository],
      ]),
    );

    await expect(service.getFishpiPoint("123456")).resolves.toMatchObject({
      vip: {
        checked: true,
        active: true,
        levelCode: "VIP3_YEAR",
        expiresAt: new Date(expireTime).toISOString(),
      },
    });
  });

  it("鱼排会员直接查询非VIP时从配置列表兜底", async () => {
    const expiresAt = new Date(Date.now() + 86400_000).toISOString();
    const userRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({
        uid: "123456",
        name: "fish-user",
      }),
    });
    mockedAxios.get
      .mockResolvedValueOnce({
        data: { code: 0, data: { userPoint: 100 } },
      })
      .mockResolvedValueOnce({
        data: { code: 0, data: { lvCode: "", state: 0 } },
      })
      .mockResolvedValueOnce({
        data: {
          code: 0,
          data: [
            {
              userId: "123456",
              userName: "fish-user",
              lvCode: "VIP2_MONTH",
              expiresAt,
            },
          ],
        },
      });

    const { service } = createService(
      new Map<any, any>([
        [
          RechargeConfig,
          createRepository({
            findOne: jest.fn().mockResolvedValue(createEnabledConfig()),
          }),
        ],
        [RechargeRecord, createRepository()],
        [User, userRepository],
      ]),
    );

    await expect(service.getFishpiPoint("123456")).resolves.toMatchObject({
      vip: {
        checked: true,
        active: true,
        levelCode: "VIP2_MONTH",
        expiresAt,
      },
    });
    expect(mockedAxios.get).toHaveBeenNthCalledWith(
      3,
      "https://fishpi.cn/api/memberships/configs?apiKey=api-key",
      expect.any(Object),
    );
  });

  it("鱼排会员过期时返回非VIP", async () => {
    const expiresAt = new Date(Date.now() - 86400_000).toISOString();
    const userRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({
        uid: "123456",
        name: "fish-user",
      }),
    });
    mockedAxios.get
      .mockResolvedValueOnce({
        data: { code: 0, data: { userPoint: 100 } },
      })
      .mockResolvedValueOnce({
        data: { code: 0, data: { lvCode: "VIP1_MONTH", state: 1, expiresAt } },
      });

    const { service } = createService(
      new Map<any, any>([
        [
          RechargeConfig,
          createRepository({
            findOne: jest.fn().mockResolvedValue(createEnabledConfig()),
          }),
        ],
        [RechargeRecord, createRepository()],
        [User, userRepository],
      ]),
    );

    await expect(service.getFishpiPoint("123456")).resolves.toMatchObject({
      vip: {
        checked: true,
        active: false,
        levelCode: "VIP1_MONTH",
        expiresAt,
      },
    });
  });

  it("缺少鱼排会员密钥时只返回积分", async () => {
    const userRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({
        uid: "123456",
        name: "fish-user",
      }),
    });
    mockedAxios.get.mockResolvedValueOnce({
      data: { code: 0, data: { userPoint: 100 } },
    });

    const { service } = createService(
      new Map<any, any>([
        [
          RechargeConfig,
          createRepository({
            findOne: jest
              .fn()
              .mockResolvedValue(createEnabledConfig({ fishpi_api_key: "" })),
          }),
        ],
        [RechargeRecord, createRepository()],
        [User, userRepository],
      ]),
    );

    await expect(service.getFishpiPoint("123456")).resolves.toEqual({
      userName: "fish-user",
      point: 100,
      vip: {
        checked: false,
        active: false,
        levelCode: "",
        expiresAt: null,
      },
      gameVip: expectedGameVip(),
    });
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  });

  it("VIP每日礼包只能领取一次并发放奖励", async () => {
    const user = {
      id: 1,
      uid: "123456",
      name: "fish-user",
      point: 20,
    };
    const userRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(user),
      save: jest.fn(async (value) => value),
    });
    const claimRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => ({ id: 1, createdAt: new Date(), ...value })),
      save: jest.fn(async (value) => value),
    });
    const inventoryRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => ({ id: 1, ...value })),
      save: jest.fn(async (value) => value),
    });
    mockedAxios.get
      .mockResolvedValueOnce({
        data: {
          code: 0,
          data: {
            lvCode: "VIP3_MONTH",
            state: 1,
            expiresAt: "2099-01-01T00:00:00.000Z",
          },
        },
      })
      .mockResolvedValueOnce({
        data: { code: 0, data: { userName: "fish-user" } },
      });

    const { service } = createService(
      new Map<any, any>([
        [
          RechargeConfig,
          createRepository({
            findOne: jest.fn().mockResolvedValue(createEnabledConfig()),
          }),
        ],
        [RechargeRecord, createRepository()],
        [User, userRepository],
        [
          SystemConfig,
          createRepository({
            findOne: jest.fn().mockResolvedValue({
              key: "game_vip_benefits",
              value: JSON.stringify({
                tiers: {
                  1: {
                    sweepLimit: 5,
                    tradeFeeDiscount: 0.02,
                    dailyRewards: { points: 10, items: [] },
                  },
                  2: {
                    sweepLimit: 10,
                    tradeFeeDiscount: 0.04,
                    dailyRewards: { points: 15, items: [] },
                  },
                  3: {
                    sweepLimit: 20,
                    tradeFeeDiscount: 0.06,
                    dailyRewards: {
                      points: 25,
                      items: [{ itemId: 1, num: 2 }],
                    },
                  },
                  4: {
                    sweepLimit: 50,
                    tradeFeeDiscount: 0.08,
                    dailyRewards: { points: 40, items: [] },
                  },
                },
              }),
            }),
          }),
        ],
        [VipDailyClaim, claimRepository],
        [
          DropItem,
          createRepository({
            findOne: jest.fn().mockResolvedValue({
              id: 1,
              drop_name: "SR碎片",
              disabled: false,
            }),
          }),
        ],
        [UserInventory, inventoryRepository],
      ]),
      { rewardService: new RewardService() },
    );

    await expect(service.claimVipDailyPack("123456")).resolves.toMatchObject({
      claimed: true,
      vipLevel: 3,
      rewards: { points: 25, items: [{ itemId: 1, num: 2 }] },
      pointAfter: 45,
    });
    expect(claimRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "123456",
        vip_level: 3,
      }),
    );
    expect(userRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ uid: "123456", point: 45 }),
    );
    expect(inventoryRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 1, item_id: 1, num: 2 }),
    );

    mockedAxios.get
      .mockResolvedValueOnce({
        data: {
          code: 0,
          data: {
            lvCode: "VIP3_MONTH",
            state: 1,
            expiresAt: "2099-01-01T00:00:00.000Z",
          },
        },
      })
      .mockResolvedValueOnce({
        data: { code: 0, data: { userName: "fish-user" } },
      });
    claimRepository.findOne
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce({ id: 1 });
    await expect(service.claimVipDailyPack("123456")).rejects.toThrow(
      "今日已领",
    );
  });

  it("鱼排会员查询失败时不影响积分", async () => {
    const userRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({
        uid: "123456",
        name: "fish-user",
      }),
    });
    mockedAxios.get
      .mockResolvedValueOnce({
        data: { code: 0, data: { userPoint: 100 } },
      })
      .mockRejectedValueOnce(new Error("membership down"));

    const { service } = createService(
      new Map<any, any>([
        [
          RechargeConfig,
          createRepository({
            findOne: jest.fn().mockResolvedValue(createEnabledConfig()),
          }),
        ],
        [RechargeRecord, createRepository()],
        [User, userRepository],
      ]),
    );

    await expect(service.getFishpiPoint("123456")).resolves.toEqual({
      userName: "fish-user",
      point: 100,
      vip: {
        checked: false,
        active: false,
        levelCode: "",
        expiresAt: null,
      },
      gameVip: expectedGameVip(),
    });
  });

  it("鱼排积分查询缺少用户名时返回错误", async () => {
    const { service } = createService(
      new Map<any, any>([
        [RechargeConfig, createRepository()],
        [RechargeRecord, createRepository()],
        [
          User,
          createRepository({
            findOne: jest.fn().mockResolvedValue({ uid: "u1", name: "" }),
          }),
        ],
      ]),
    );

    await expect(service.getFishpiPoint("u1")).rejects.toThrow(
      "缺少鱼排用户名",
    );
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it("鱼排积分查询结果异常时返回错误", async () => {
    mockedAxios.get.mockResolvedValue({ data: { code: 0, data: {} } });

    const { service } = createService(
      new Map<any, any>([
        [RechargeConfig, createRepository()],
        [RechargeRecord, createRepository()],
        [
          User,
          createRepository({
            findOne: jest
              .fn()
              .mockResolvedValue({ uid: "u1", name: "fish-user" }),
          }),
        ],
      ]),
    );

    await expect(service.getFishpiPoint("u1")).rejects.toThrow(
      "鱼排积分查询结果异常",
    );
  });

  it("配置关闭或缺少金手指密钥时拒绝充值", async () => {
    const configRepository = createRepository({
      findOne: jest
        .fn()
        .mockResolvedValue(createEnabledConfig({ enabled: false })),
    });
    const { service } = createService(
      new Map<any, any>([
        [RechargeConfig, configRepository],
        [RechargeRecord, createRepository()],
        [User, createRepository()],
      ]),
    );

    await expect(service.recharge("u1", 10, "r1")).rejects.toThrow(
      "充值功能暂未开启",
    );

    configRepository.findOne.mockResolvedValue(
      createEnabledConfig({ enabled: true, gold_finger_key: "" }),
    );
    await expect(service.recharge("u1", 10, "r2")).rejects.toThrow(
      "充值暂不可用",
    );
  });

  it("非法金额会被拒绝", async () => {
    const { service } = createService(
      new Map<any, any>([
        [RechargeConfig, createRepository()],
        [RechargeRecord, createRepository()],
        [User, createRepository()],
      ]),
    );

    await expect(service.recharge("u1", 0, "r1")).rejects.toThrow(
      "充值金额必须为正整数",
    );
    await expect(service.recharge("u1", 1.5, "r2")).rejects.toThrow(
      "充值金额必须为正整数",
    );
  });

  it("鱼排扣分失败时不会增加星穹币并记录失败", async () => {
    const user = { uid: "u1", name: "fish-user", point: 20 };
    let savedRecord: any = null;
    const recordRepository = createRepository({
      create: jest.fn((value) => ({ id: 1, ...value })),
      findOne: jest.fn(async ({ where }) => {
        if (where.uid) {
          return null;
        }
        if (where.id === 1) {
          return savedRecord;
        }
        return null;
      }),
      save: jest.fn(async (value) => {
        savedRecord = { ...value, id: value.id || 1 };
        return savedRecord;
      }),
    });
    const userRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(user),
      save: jest.fn(async (value) => value),
    });
    mockedAxios.post.mockRejectedValue({
      isAxiosError: true,
      response: { data: { code: -1, msg: "鱼排余额不足" } },
      message: "request failed",
    });

    const { service } = createService(
      new Map<any, any>([
        [
          RechargeConfig,
          createRepository({
            findOne: jest.fn().mockResolvedValue(createEnabledConfig()),
          }),
        ],
        [RechargeRecord, recordRepository],
        [User, userRepository],
      ]),
    );

    await expect(service.recharge("u1", 10, "request-1")).rejects.toThrow(
      "鱼排余额不足",
    );
    expect(user.point).toBe(20);
    expect(userRepository.save).not.toHaveBeenCalled();
    expect(savedRecord).toEqual(
      expect.objectContaining({
        status: "failed",
        failure_reason: "鱼排余额不足",
      }),
    );
  });

  it("鱼排积分查询失败时不会调用扣分接口", async () => {
    const user = { uid: "u1", name: "fish-user", point: 20 };
    let savedRecord: any = null;
    const recordRepository = createRepository({
      create: jest.fn((value) => ({ id: 1, ...value })),
      findOne: jest.fn(async ({ where }) => {
        if (where.uid) {
          return null;
        }
        if (where.id === 1) {
          return savedRecord;
        }
        return null;
      }),
      save: jest.fn(async (value) => {
        savedRecord = { ...value, id: value.id || 1 };
        return savedRecord;
      }),
    });
    mockedAxios.get.mockRejectedValue({
      isAxiosError: true,
      response: { data: { code: -1, msg: "查询失败" } },
      message: "request failed",
    });

    const { service } = createService(
      new Map<any, any>([
        [
          RechargeConfig,
          createRepository({
            findOne: jest.fn().mockResolvedValue(createEnabledConfig()),
          }),
        ],
        [RechargeRecord, recordRepository],
        [
          User,
          createRepository({ findOne: jest.fn().mockResolvedValue(user) }),
        ],
      ]),
    );

    await expect(service.recharge("u1", 10, "query-failed")).rejects.toThrow(
      "查询失败",
    );
    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(savedRecord).toEqual(
      expect.objectContaining({
        status: "failed",
        failure_reason: "查询失败",
      }),
    );
  });

  it("鱼排积分为负数时不会调用扣分接口", async () => {
    const user = { uid: "u1", name: "fish-user", point: 20 };
    let savedRecord: any = null;
    const recordRepository = createRepository({
      create: jest.fn((value) => ({ id: 1, ...value })),
      findOne: jest.fn(async ({ where }) => {
        if (where.uid) {
          return null;
        }
        if (where.id === 1) {
          return savedRecord;
        }
        return null;
      }),
      save: jest.fn(async (value) => {
        savedRecord = { ...value, id: value.id || 1 };
        return savedRecord;
      }),
    });
    mockedAxios.get.mockResolvedValue({ data: { userPoint: -1 } });

    const { service } = createService(
      new Map<any, any>([
        [
          RechargeConfig,
          createRepository({
            findOne: jest.fn().mockResolvedValue(createEnabledConfig()),
          }),
        ],
        [RechargeRecord, recordRepository],
        [
          User,
          createRepository({ findOne: jest.fn().mockResolvedValue(user) }),
        ],
      ]),
    );

    await expect(service.recharge("u1", 10, "negative")).rejects.toThrow(
      "鱼排积分为负数，无法充值",
    );
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("鱼排积分不足时不会调用扣分接口", async () => {
    const user = { uid: "u1", name: "fish-user", point: 20 };
    let savedRecord: any = null;
    const recordRepository = createRepository({
      create: jest.fn((value) => ({ id: 1, ...value })),
      findOne: jest.fn(async ({ where }) => {
        if (where.uid) {
          return null;
        }
        if (where.id === 1) {
          return savedRecord;
        }
        return null;
      }),
      save: jest.fn(async (value) => {
        savedRecord = { ...value, id: value.id || 1 };
        return savedRecord;
      }),
    });
    mockedAxios.get.mockResolvedValue({ data: { userPoint: 9 } });

    const { service } = createService(
      new Map<any, any>([
        [
          RechargeConfig,
          createRepository({
            findOne: jest.fn().mockResolvedValue(createEnabledConfig()),
          }),
        ],
        [RechargeRecord, recordRepository],
        [
          User,
          createRepository({ findOne: jest.fn().mockResolvedValue(user) }),
        ],
      ]),
    );

    await expect(service.recharge("u1", 10, "insufficient")).rejects.toThrow(
      "鱼排积分不足，需要10，当前9",
    );
    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(savedRecord).toEqual(
      expect.objectContaining({
        status: "failed",
        failure_reason: "鱼排积分不足，需要10，当前9",
      }),
    );
  });

  it("鱼排查询密钥为空时仍会用新接口校验积分并完成充值", async () => {
    const user = { uid: "u1", name: "fish-user", point: 20 };
    let savedRecord: any = null;
    const recordRepository = createRepository({
      create: jest.fn((value) => ({ id: 1, ...value })),
      findOne: jest.fn(async ({ where }) => {
        if (where.uid) {
          return null;
        }
        if (where.id === 1) {
          return savedRecord;
        }
        return null;
      }),
      save: jest.fn(async (value) => {
        savedRecord = { ...value, id: value.id || 1 };
        return savedRecord;
      }),
    });
    const userRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(user),
      save: jest.fn(async (value) => value),
    });
    mockedAxios.post.mockResolvedValue({
      data: { code: 0, msg: "ok" },
    });

    const { service } = createService(
      new Map<any, any>([
        [
          RechargeConfig,
          createRepository({
            findOne: jest
              .fn()
              .mockResolvedValue(createEnabledConfig({ fishpi_api_key: "" })),
          }),
        ],
        [RechargeRecord, recordRepository],
        [User, userRepository],
      ]),
    );

    await expect(service.recharge("u1", 30, "request-2")).resolves.toEqual({
      requestId: "request-2",
      amount: 30,
      fishpiCost: 30,
      pointBefore: 20,
      pointAfter: 50,
    });
    expect(mockedAxios.post).toHaveBeenCalledWith(
      "https://fishpi.cn/user/edit/points",
      expect.objectContaining({
        goldFingerKey: "gold-key",
        userName: "fish-user",
        point: -30,
        memo: "抽卡平台充值 30",
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          "User-Agent": "Kesini-Gacha-Platform/1.0",
        }),
      }),
    );
    expect(mockedAxios.get).toHaveBeenCalledWith(
      "https://fishpi.cn/user/fish-user/point",
      expect.objectContaining({
        headers: expect.objectContaining({
          "User-Agent": "Kesini-Gacha-Platform/1.0",
        }),
      }),
    );
    expect(userRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ point: 50 }),
    );
    expect(savedRecord).toEqual(
      expect.objectContaining({
        status: "success",
        point_before: 20,
        point_after: 50,
      }),
    );
  });

  it("按后台充值比例扣鱼排积分并发放星穹币", async () => {
    const user = { uid: "u1", name: "fish-user", point: 20 };
    let savedRecord: any = null;
    const recordRepository = createRepository({
      create: jest.fn((value) => ({ id: 1, ...value })),
      findOne: jest.fn(async ({ where }) => {
        if (where.uid) {
          return null;
        }
        if (where.id === 1) {
          return savedRecord;
        }
        return null;
      }),
      save: jest.fn(async (value) => {
        savedRecord = { ...value, id: value.id || 1 };
        return savedRecord;
      }),
    });
    const userRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(user),
      save: jest.fn(async (value) => value),
    });
    mockedAxios.post.mockResolvedValue({
      data: { code: 0, msg: "ok" },
    });

    const { service } = createService(
      new Map<any, any>([
        [
          RechargeConfig,
          createRepository({
            findOne: jest.fn().mockResolvedValue(
              createEnabledConfig({
                recharge_ratio: 2,
                memo_template: "扣鱼排 {fishpiCost} 到账 {amount}",
              }),
            ),
          }),
        ],
        [RechargeRecord, recordRepository],
        [User, userRepository],
      ]),
    );

    await expect(service.recharge("u1", 30, "request-ratio")).resolves.toEqual({
      requestId: "request-ratio",
      amount: 60,
      fishpiCost: 30,
      pointBefore: 20,
      pointAfter: 80,
    });
    expect(mockedAxios.post).toHaveBeenCalledWith(
      "https://fishpi.cn/user/edit/points",
      expect.objectContaining({
        point: -30,
        memo: "扣鱼排 30 到账 60",
      }),
      expect.anything(),
    );
    expect(userRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ point: 80 }),
    );
    expect(savedRecord).toEqual(
      expect.objectContaining({
        amount: 60,
        fishpi_cost: 30,
        point_after: 80,
        status: "success",
      }),
    );
  });

  it("相同流水号成功记录重复提交会直接返回原结果", async () => {
    const existing = {
      uid: "u1",
      request_id: "same",
      amount: 10,
      fishpi_cost: 10,
      point_before: 5,
      point_after: 15,
      status: "success",
    };
    const { service } = createService(
      new Map<any, any>([
        [
          RechargeConfig,
          createRepository({
            findOne: jest.fn().mockResolvedValue(createEnabledConfig()),
          }),
        ],
        [
          RechargeRecord,
          createRepository({
            findOne: jest.fn().mockResolvedValue(existing),
          }),
        ],
        [
          User,
          createRepository({
            findOne: jest.fn().mockResolvedValue({
              uid: "u1",
              name: "fish-user",
              point: 15,
            }),
          }),
        ],
      ]),
    );

    await expect(service.recharge("u1", 10, "same")).resolves.toEqual({
      requestId: "same",
      amount: 10,
      fishpiCost: 10,
      pointBefore: 5,
      pointAfter: 15,
    });
    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });
});
