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
  it("启用的单池配置会覆盖全局默认配置", async () => {
    const repository = createRepository({
      find: jest.fn().mockResolvedValue([
        {
          pool_id: 0,
          enabled: true,
          rarity_probabilities: { N: 1, R: 0, SR: 0, SSR: 0, UR: 0 },
          up_cards: null,
          pity_system: { enabled: true },
          single_draw_cost: 10,
          ten_draw_cost: 100,
        },
        {
          pool_id: 1,
          enabled: true,
          rarity_probabilities: { N: 0, R: 0, SR: 0, SSR: 1, UR: 0 },
          up_cards: null,
          pity_system: { enabled: false },
          single_draw_cost: 12,
          ten_draw_cost: 108,
        },
      ]),
    });
    const service = createConfigService(repository);

    await expect(service.getConfigByPoolId(1)).resolves.toEqual(
      expect.objectContaining({
        poolId: 1,
        rarityProbabilities: { N: 0, R: 0, SR: 0, SSR: 1, UR: 0 },
        pitySystem: { enabled: false },
        drawCosts: { once: 12, ten: 108 },
      }),
    );
  });

  it("单池配置关闭时回退启用的全局默认配置", async () => {
    const repository = createRepository({
      find: jest.fn().mockResolvedValue([
        {
          pool_id: 0,
          enabled: true,
          rarity_probabilities: { N: 0, R: 1, SR: 0, SSR: 0, UR: 0 },
          up_cards: null,
          pity_system: { enabled: false },
          single_draw_cost: 8,
          ten_draw_cost: 80,
        },
        {
          pool_id: 1,
          enabled: false,
          rarity_probabilities: { N: 0, R: 0, SR: 0, SSR: 1, UR: 0 },
          single_draw_cost: 12,
          ten_draw_cost: 108,
        },
      ]),
    });
    const service = createConfigService(repository);

    await expect(service.getConfigByPoolId(1)).resolves.toEqual(
      expect.objectContaining({
        poolId: 1,
        rarityProbabilities: { N: 0, R: 1, SR: 0, SSR: 0, UR: 0 },
        pitySystem: { enabled: false },
        drawCosts: { once: 8, ten: 80 },
      }),
    );
  });

  it("没有全局默认配置时回退代码默认配置", async () => {
    const repository = createRepository({
      find: jest.fn().mockResolvedValue([]),
    });
    const service = createConfigService(repository);

    await expect(service.getConfigByPoolId(99)).resolves.toEqual(
      expect.objectContaining({
        poolId: 99,
        rarityProbabilities: {
          N: 0.5,
          R: 0.3,
          SR: 0.15,
          SSR: 0.045,
          UR: 0.005,
        },
        drawCosts: { once: 10, ten: 100 },
      }),
    );
  });

  it("保存全局默认配置时允许 poolId 为 0 并写入默认抽卡星穹币消耗", async () => {
    const repository = createRepository();
    const service = createConfigService(repository);

    await service.savePoolConfig(0, {
      rarityProbabilities: { N: 1 },
    } as any);

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        single_draw_cost: 10,
        ten_draw_cost: 100,
      }),
    );
  });

  it("保存配置时拒绝非正整数抽卡星穹币消耗", async () => {
    const service = createConfigService(createRepository());

    await expect(
      service.savePoolConfig(0, {
        rarityProbabilities: { N: 1 },
        drawCosts: { once: 0, ten: 100 },
      } as any),
    ).rejects.toThrow("抽卡星穹币消耗必须为正整数");
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
