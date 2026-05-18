jest.mock("uuid", () => ({
  v4: jest.fn(() => "00000000-0000-4000-8000-000000000000"),
}));

import { ArgumentMetadata, ValidationPipe } from "@nestjs/common";
import { CardService } from "./card.service";
import { GachaConfigService } from "./gacha-config.service";
import { DrawCardDto } from "./card.controller";
import { CardItem } from "src/entity/card.entity";

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
});
