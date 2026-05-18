jest.mock("uuid", () => ({
  v4: jest.fn(() => "00000000-0000-4000-8000-000000000000"),
}));

import { ArgumentMetadata, ValidationPipe } from "@nestjs/common";
import { CardService } from "./card.service";
import { GachaConfigService } from "./gacha-config.service";
import { DrawCardDto, DrawMultipleDto } from "./card.controller";
import { CardItem } from "src/entity/card.entity";
import { PoolInfo } from "src/entity/pool.entity";
import { User } from "src/entity/user.entity";
import { UserCard } from "src/entity/userCard.entity";
import { UserHistory } from "src/entity/history.entity";
import { UserGachaPity } from "src/entity/userGachaPity.entity";

describe("CardService 抽卡核心规则", () => {
  let service: CardService;

  beforeEach(() => {
    const configService = {
      getDefaultConfig: jest.fn(() => ({
        poolId: 1,
        rarityProbabilities: {
          N: 0.5,
          R: 0.3,
          SR: 0.15,
          SSR: 0.045,
          UR: 0.005,
        },
        pitySystem: {
          enabled: true,
          softPity: { count: 10, guaranteedRarity: "SR" },
          hardPity: { count: 90, guaranteedRarity: "SSR" },
        },
      })),
      getConfigByPoolId: jest.fn(async (poolId: number) => ({
        poolId,
        rarityProbabilities: {
          N: 0.5,
          R: 0.3,
          SR: 0.15,
          SSR: 0.045,
          UR: 0.005,
        },
      })),
      validateProbabilities: jest.fn(
        (probabilities: Record<string, number>) => {
          const total = Object.values(probabilities).reduce(
            (sum, probability) => sum + probability,
            0,
          );
          return Math.abs(total - 1) < 0.0001;
        },
      ),
    } as unknown as GachaConfigService;

    service = new CardService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      configService,
      {} as any,
    );
  });

  it("稀有度匹配必须精确，SR 不应命中 SSR", () => {
    expect(
      (service as any).cardSupportsRarity(
        { card_level: "SSR" } as CardItem,
        "SR",
      ),
    ).toBe(false);
    expect(
      (service as any).cardSupportsRarity(
        { card_level: "SR,SSR" } as CardItem,
        "SR",
      ),
    ).toBe(true);
    expect(
      (service as any).cardSupportsRarity(
        { card_level: "SR,SSR" } as CardItem,
        "SSR",
      ),
    ).toBe(true);
  });

  it("保底会按最低稀有度重算概率池", () => {
    jest.spyOn(service as any, "randomFloat").mockReturnValue(0.1);

    const rarity = (service as any).rollRarity(
      { N: 0.5, R: 0.3, SR: 0.15, SSR: 0.04, UR: 0.01 },
      "SSR",
    );

    expect(rarity).toBe("SSR");
  });

  it("硬保底优先于软保底", () => {
    const pity = {
      draws_since_sr: 9,
      draws_since_ssr: 89,
      draws_since_ur: 89,
    };
    const config = {
      enabled: true,
      softPity: { count: 10, guaranteedRarity: "SR" },
      hardPity: { count: 90, guaranteedRarity: "SSR" },
    };

    expect((service as any).getPityMinimumRarity(pity, config)).toBe("SSR");
  });

  it("UP 概率命中时只从当前稀有度的 UP 卡里抽取", () => {
    jest.spyOn(service as any, "randomFloat").mockReturnValue(0.1);
    const cards = [
      { id: 1, card_level: "SSR" },
      { id: 2, card_level: "SSR" },
    ] as CardItem[];

    const result = (service as any).pickCardForRarity(cards, {
      enabled: true,
      cardIds: [2],
      upRate: 0.5,
    });

    expect(result.card.id).toBe(2);
    expect(result.isUp).toBe(true);
  });

  it("SSR 合成碎片数量不能被 R 的包含关系误判", () => {
    expect((service as any).getRequiredFragments("SSR")).toBe(1000);
  });
});

describe("CardController 入参安全", () => {
  it("抽卡请求不允许客户端传入自定义概率配置", async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    const metadata: ArgumentMetadata = {
      type: "body",
      metatype: DrawCardDto,
      data: "",
    };

    await expect(
      pipe.transform(
        {
          poolId: 1,
          config: {
            rarityProbabilities: { UR: 1 },
          },
        },
        metadata,
      ),
    ).rejects.toThrow();
  });

  it("自定义多抽只允许 1 抽或 10 抽", async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    const metadata: ArgumentMetadata = {
      type: "body",
      metatype: DrawMultipleDto,
      data: "",
    };

    await expect(
      pipe.transform({ poolId: 1, count: 2 }, metadata),
    ).rejects.toThrow();
    await expect(pipe.transform({ poolId: 1, count: 10 }, metadata)).resolves
      .toEqual(expect.objectContaining({ count: 10 }));
  });
});

describe("CardService 抽卡积分扣除", () => {
  function createRepository(overrides: Record<string, any> = {}) {
    return {
      create: jest.fn((value) => value),
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn((value) => Promise.resolve(value)),
      ...overrides,
    };
  }

  function createDrawService(user: Partial<User>, drawCosts = { once: 10, ten: 100 }) {
    const poolRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        pool_name: "测试卡池",
        card_desc: "",
        card_type: 0,
      }),
    });
    const cardRepository = createRepository({
      find: jest.fn().mockResolvedValue([
        {
          id: 1,
          card_name: "测试卡",
          card_level: "N",
          card_desc: "测试",
          card_type: 0,
          pool: 1,
        },
      ]),
    });
    const userRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        uid: "u1",
        point: 100,
        card_count_n: 0,
        card_count_r: 0,
        card_count_sr: 0,
        card_count_ssr: 0,
        card_count_ur: 0,
        ...user,
      }),
    });
    const userCardRepository = createRepository();
    const historyRepository = createRepository();
    const pityRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(null),
    });
    const repositories = new Map<any, any>([
      [PoolInfo, poolRepository],
      [CardItem, cardRepository],
      [User, userRepository],
      [UserCard, userCardRepository],
      [UserHistory, historyRepository],
      [UserGachaPity, pityRepository],
    ]);
    const manager = {
      getRepository: jest.fn((entity) => repositories.get(entity)),
    };
    const dataSource = {
      transaction: jest.fn((callback) => callback(manager)),
    };
    const configService = {
      getDefaultConfig: jest.fn(() => ({
        poolId: 1,
        rarityProbabilities: { N: 1 },
        drawCosts,
      })),
      getConfigByPoolId: jest.fn(async (poolId: number) => ({
        poolId,
        rarityProbabilities: { N: 1 },
        drawCosts,
      })),
      validateProbabilities: jest.fn(() => true),
    } as unknown as GachaConfigService;
    const service = new CardService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      configService,
      dataSource as any,
    );

    return {
      service,
      dataSource,
      userRepository,
      userCardRepository,
      historyRepository,
      pityRepository,
    };
  }

  it("单抽成功会在同一事务内扣除单抽积分", async () => {
    const { service, userRepository, userCardRepository } = createDrawService({
      point: 10,
    });

    await service.drawOnce("u1", 1);

    expect(userCardRepository.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ card_id: "1", card_level: "N" }),
      ]),
    );
    expect(userRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        point: 0,
        card_count_n: 1,
      }),
    );
  });

  it("十连成功会扣除十连积分", async () => {
    const { service, userRepository, userCardRepository } = createDrawService({
      point: 100,
    });

    await service.drawTen("u1", 1);

    expect(userCardRepository.save.mock.calls[0][0]).toHaveLength(10);
    expect(userRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        point: 0,
        card_count_n: 10,
      }),
    );
  });

  it("积分不足时不会发卡、写历史或保存保底", async () => {
    const { service, userCardRepository, historyRepository, pityRepository } =
      createDrawService({ point: 9 });

    await expect(service.drawOnce("u1", 1)).rejects.toThrow(
      "积分不足，需要10，当前9",
    );
    expect(userCardRepository.save).not.toHaveBeenCalled();
    expect(historyRepository.save).not.toHaveBeenCalled();
    expect(pityRepository.save).not.toHaveBeenCalled();
  });

  it("非 1 抽或 10 抽会在开启事务前拒绝", async () => {
    const { service, dataSource } = createDrawService({ point: 100 });

    await expect(service.drawMultiple("u1", 2, 1)).rejects.toThrow(
      "抽卡次数仅支持1抽或10抽",
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
