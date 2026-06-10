import { MonthlyCardPurchaseRecord } from "src/entity/monthlyCardPurchaseRecord.entity";
import { MonthlyCardSubscription } from "src/entity/monthlyCardSubscription.entity";
import { SystemConfig } from "src/entity/systemConfig.entity";
import { User } from "src/entity/user.entity";
import { MonthlyCardService } from "./monthly-card.service";

function createRepository(rows: any[] = []) {
  return {
    rows,
    create: jest.fn((value) => ({ ...value })),
    find: jest.fn(async (query?: any) => {
      const where = query?.where || {};
      return rows.filter((row) =>
        Object.entries(where).every(([key, value]) => row[key] === value),
      );
    }),
    findOne: jest.fn(async (query?: any) => {
      const where = query?.where || {};
      return (
        rows.find((row) =>
          Object.entries(where).every(([key, value]) => row[key] === value),
        ) || null
      );
    }),
    save: jest.fn(async (value) => {
      const next = { ...value };
      if (!next.id) {
        next.id = rows.length + 1;
        rows.push(next);
        return next;
      }
      const index = rows.findIndex((row) => row.id === next.id);
      if (index >= 0) {
        rows[index] = { ...rows[index], ...next };
        return rows[index];
      }
      rows.push(next);
      return next;
    }),
  };
}

function createService(options: {
  config?: Record<string, unknown> | null;
  user?: Record<string, unknown> | null;
  subscriptions?: any[];
  rechargeService?: Record<string, any>;
} = {}) {
  const repositories = new Map<any, any>([
    [
      SystemConfig,
      createRepository(
        options.config === undefined
          ? []
          : [
              {
                key: "monthly_card_config",
                value:
                  options.config === null
                    ? ""
                    : JSON.stringify(options.config),
              },
            ],
      ),
    ],
    [
      User,
      createRepository(
        options.user === null
          ? []
          : [
              {
                id: 1,
                uid: "u1",
                name: "fish-user",
                ...(options.user || {}),
              },
            ],
      ),
    ],
    [MonthlyCardPurchaseRecord, createRepository()],
    [MonthlyCardSubscription, createRepository(options.subscriptions || [])],
  ]);
  const manager = {
    getRepository: jest.fn((entity) => repositories.get(entity)),
  };
  const dataSource = {
    getRepository: jest.fn((entity) => repositories.get(entity)),
    transaction: jest.fn((callback) => callback(manager)),
  };
  const rechargeService = {
    deductFishpiPoints: jest.fn().mockResolvedValue({ code: 0 }),
    getGameVipStatus: jest.fn().mockResolvedValue({
      checked: false,
      active: false,
      tier: 0,
      label: "未同步",
      sources: [],
      sourceLabels: [],
      sourceTiers: { fishpi: 0, badge: 0, monthly_card: 0 },
      sweepLimit: 0,
      tradeFeeDiscount: 0,
      dailyRewards: { points: 0, items: [] },
      dailyClaimed: false,
      dailyClaimDate: "2026-06-09",
    }),
    getGameVipBenefitOverview: jest.fn().mockResolvedValue([
      {
        tier: 1,
        label: "VIP1",
        sweepLimit: 5,
        tradeFeeDiscount: 0.02,
        dailyRewards: { points: 10, items: [] },
      },
      {
        tier: 2,
        label: "VIP2",
        sweepLimit: 10,
        tradeFeeDiscount: 0.04,
        dailyRewards: { points: 15, items: [] },
      },
      {
        tier: 3,
        label: "VIP3",
        sweepLimit: 20,
        tradeFeeDiscount: 0.06,
        dailyRewards: { points: 25, items: [] },
      },
      {
        tier: 4,
        label: "VIP4",
        sweepLimit: 50,
        tradeFeeDiscount: 0.08,
        dailyRewards: { points: 40, items: [] },
      },
    ]),
    getThirdPartyErrorResponse: jest.fn((error) => ({
      message: error instanceof Error ? error.message : "失败",
    })),
    sanitizeThirdPartyResponse: jest.fn((value) => value || null),
    ...(options.rechargeService || {}),
  };
  return {
    service: new MonthlyCardService(dataSource as any, rechargeService as any),
    repositories,
    rechargeService,
  };
}

describe("MonthlyCardService", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-06-09T00:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it("默认月卡配置关闭", async () => {
    const { service } = createService();

    await expect(service.getPublicConfig()).resolves.toMatchObject({
      enabled: false,
      durationDays: 30,
      ice_enabled: false,
      ice_price: 0,
      platinum_enabled: false,
      platinum_price: 0,
      cards: expect.arrayContaining([
        expect.objectContaining({ cardType: "ice", label: "星穹月卡" }),
        expect.objectContaining({ cardType: "platinum", label: "星耀月卡" }),
      ]),
      benefitTiers: expect.arrayContaining([
        expect.objectContaining({
          tier: 3,
          sweepLimit: 20,
          dailyRewards: { points: 25, items: [] },
        }),
        expect.objectContaining({
          tier: 4,
          sweepLimit: 50,
          dailyRewards: { points: 40, items: [] },
        }),
      ]),
    });
  });

  it("月卡未开启时不能购买", async () => {
    const { service } = createService();

    await expect(
      service.purchase("u1", { cardType: "ice", requestId: "r1" }),
    ).rejects.toThrow("月卡暂未开启");
  });

  it("购买星穹月卡开通VIP3", async () => {
    const { service, repositories, rechargeService } = createService({
      config: {
        enabled: true,
        ice_enabled: true,
        ice_price: 30,
      },
    });

    await expect(
      service.purchase("u1", { cardType: "ice", requestId: "r1" }),
    ).resolves.toMatchObject({
      requestId: "r1",
      cardType: "ice",
      vipLevel: 3,
      fishpiCost: 30,
      status: "success",
      startsAt: "2026-06-09T00:00:00.000Z",
      expiresAt: "2026-07-09T00:00:00.000Z",
    });
    expect(rechargeService.deductFishpiPoints).toHaveBeenCalledWith(
      "u1",
      30,
      "星穹月卡购买",
    );
    expect(repositories.get(MonthlyCardSubscription).rows).toEqual([
      expect.objectContaining({
        uid: "u1",
        card_type: "ice",
        vip_level: 3,
        expires_at: new Date("2026-07-09T00:00:00.000Z"),
      }),
    ]);
  });

  it("同档续费从原到期时间延长", async () => {
    const { service } = createService({
      config: {
        enabled: true,
        ice_enabled: true,
        ice_price: 30,
      },
      subscriptions: [
        {
          id: 1,
          uid: "u1",
          card_type: "ice",
          vip_level: 3,
          expires_at: new Date("2026-06-19T00:00:00.000Z"),
        },
      ],
    });

    await expect(
      service.purchase("u1", { cardType: "ice", requestId: "r2" }),
    ).resolves.toMatchObject({
      startsAt: "2026-06-19T00:00:00.000Z",
      expiresAt: "2026-07-19T00:00:00.000Z",
    });
  });

  it("小冰VIP只显示星穹月卡永久", async () => {
    const { service } = createService({
      rechargeService: {
        getGameVipStatus: jest.fn().mockResolvedValue({
          checked: true,
          active: true,
          tier: 3,
          label: "VIP3",
          sources: ["badge"],
          sourceLabels: ["小冰"],
          sourceTiers: { fishpi: 0, badge: 3, monthly_card: 0 },
          sweepLimit: 20,
          tradeFeeDiscount: 0.06,
          dailyRewards: { points: 25, items: [] },
          dailyClaimed: false,
          dailyClaimDate: "2026-06-09",
        }),
      },
    });

    const result = await service.getMyStatus("u1");
    expect(result.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cardType: "ice", permanent: true }),
        expect.objectContaining({ cardType: "platinum", permanent: false }),
      ]),
    );
  });

  it("小冰白金VIP只显示星耀月卡永久", async () => {
    const { service } = createService({
      rechargeService: {
        getGameVipStatus: jest.fn().mockResolvedValue({
          checked: true,
          active: true,
          tier: 4,
          label: "VIP4",
          sources: ["badge"],
          sourceLabels: ["小冰"],
          sourceTiers: { fishpi: 0, badge: 4, monthly_card: 0 },
          sweepLimit: 50,
          tradeFeeDiscount: 0.08,
          dailyRewards: { points: 40, items: [] },
          dailyClaimed: false,
          dailyClaimDate: "2026-06-09",
        }),
      },
    });

    const result = await service.getMyStatus("u1");
    expect(result.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cardType: "ice", permanent: false }),
        expect.objectContaining({ cardType: "platinum", permanent: true }),
      ]),
    );
  });

  it("鱼排VIP不显示永久月卡", async () => {
    const { service } = createService({
      rechargeService: {
        getGameVipStatus: jest.fn().mockResolvedValue({
          checked: true,
          active: true,
          tier: 4,
          label: "VIP4",
          sources: ["fishpi"],
          sourceLabels: ["鱼排"],
          sourceTiers: { fishpi: 4, badge: 0, monthly_card: 0 },
          sweepLimit: 50,
          tradeFeeDiscount: 0.08,
          dailyRewards: { points: 40, items: [] },
          dailyClaimed: false,
          dailyClaimDate: "2026-06-09",
        }),
      },
    });

    const result = await service.getMyStatus("u1");
    expect(result.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cardType: "ice", permanent: false }),
        expect.objectContaining({ cardType: "platinum", permanent: false }),
      ]),
    );
  });
});
