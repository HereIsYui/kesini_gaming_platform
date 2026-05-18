import { GachaConfigService } from "./gacha-config.service";

function createRepository(overrides: Record<string, any> = {}) {
  return {
    create: jest.fn((value) => value),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn((value) => Promise.resolve(value)),
    ...overrides,
  };
}

function createConfigService(repository: any) {
  return new GachaConfigService(
    {
      gachaProbabilities: {
        standard: { N: 0.5, R: 0.3, SR: 0.15, SSR: 0.045, UR: 0.005 },
        limited: { N: 0.5, R: 0.3, SR: 0.15, SSR: 0.045, UR: 0.005 },
        beginner: { N: 0.5, R: 0.3, SR: 0.15, SSR: 0.045, UR: 0.005 },
        event: { N: 0.5, R: 0.3, SR: 0.15, SSR: 0.045, UR: 0.005 },
      },
      gachaPityConfigs: {
        standard: { enabled: true },
        limited: { enabled: true },
        beginner: { enabled: true },
        event: { enabled: true },
      },
      upCardConfigs: {
        limited: undefined,
        event: undefined,
      },
    } as any,
    repository,
  );
}

describe("GachaConfigService", () => {
  it("数据库启用配置会覆盖环境变量默认配置", async () => {
    const repository = createRepository({
      findOne: jest.fn().mockResolvedValue({
        pool_id: 1,
        enabled: true,
        rarity_probabilities: { N: 0, R: 0, SR: 0, SSR: 1, UR: 0 },
        up_cards: null,
        pity_system: { enabled: false },
      }),
    });
    const service = createConfigService(repository);

    await expect(service.getConfigByPoolId(1)).resolves.toEqual(
      expect.objectContaining({
        poolId: 1,
        rarityProbabilities: { N: 0, R: 0, SR: 0, SSR: 1, UR: 0 },
        pitySystem: { enabled: false },
      }),
    );
  });

  it("数据库配置关闭时回退环境变量默认配置", async () => {
    const repository = createRepository({
      findOne: jest.fn().mockResolvedValue({
        pool_id: 1,
        enabled: false,
        rarity_probabilities: { N: 0, R: 0, SR: 0, SSR: 1, UR: 0 },
      }),
    });
    const service = createConfigService(repository);

    await expect(service.getConfigByPoolId(1)).resolves.toEqual(
      expect.objectContaining({
        poolId: 1,
        rarityProbabilities: { N: 0.5, R: 0.3, SR: 0.15, SSR: 0.045, UR: 0.005 },
      }),
    );
  });

  it("保存配置时拒绝概率总和错误", async () => {
    const service = createConfigService(createRepository());

    await expect(
      service.savePoolConfig(1, {
        rarityProbabilities: { N: 0.6, R: 0.6 },
      } as any),
    ).rejects.toThrow("稀有度概率配置无效");
  });

  it("保存配置时拒绝非法稀有度", async () => {
    const service = createConfigService(createRepository());

    await expect(
      service.savePoolConfig(1, {
        rarityProbabilities: { N: 0.5, R: 0.3, SR: 0.1, SSR: 0.09, X: 0.01 },
      } as any),
    ).rejects.toThrow("稀有度X不支持");
  });
});
