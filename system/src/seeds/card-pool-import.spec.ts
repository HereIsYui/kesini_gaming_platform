import {
  importCardPools,
  parseCardName,
  parseCardPoolRows,
  ParsedPool,
} from "./card-pool-import";

describe("腾讯文档卡池导入解析", () => {
  it("无等级括号时默认使用 N,R,SR,SSR", () => {
    expect(parseCardName("立春")).toEqual({
      cardName: "立春",
      cardLevel: "N,R,SR,SSR",
    });
  });

  it("有效等级括号会去括号并覆盖等级", () => {
    expect(parseCardName("午安(R)")).toEqual({
      cardName: "午安",
      cardLevel: "R",
      specialRule: "午安(R) => 午安[R]",
    });
    expect(parseCardName("吊毛午安(SR)").cardLevel).toBe("SR");
    expect(parseCardName("游客午安(SSR)").cardLevel).toBe("SSR");
    expect(parseCardName("话事人午安(N)").cardLevel).toBe("N");
  });

  it("非等级括号保持完整卡名", () => {
    expect(parseCardName("狗（狼）")).toEqual({
      cardName: "狗（狼）",
      cardLevel: "N,R,SR,SSR",
    });
    expect(parseCardName("苦力怕猫（猫）")).toEqual({
      cardName: "苦力怕猫（猫）",
      cardLevel: "N,R,SR,SSR",
    });
  });

  it("冥王星隐藏款特殊导入为 UR", () => {
    expect(parseCardName("冥王星(隐藏款)")).toEqual({
      cardName: "冥王星",
      cardLevel: "UR",
      specialRule: "冥王星(隐藏款) => 冥王星[UR]",
    });
  });

  it("卡名行与下一行介绍按同列配对", () => {
    const pools = parseCardPoolRows([
      ["卡池"],
      ["测试池", "测试卡", "稀有卡(SSR)"],
      ["", "测试介绍", "稀有介绍"],
    ]);

    expect(pools).toEqual([
      {
        poolName: "测试池",
        cardDesc: "由腾讯文档导入",
        cardType: 0,
        cards: [
          {
            rawName: "测试卡",
            cardName: "测试卡",
            cardLevel: "N,R,SR,SSR",
            cardDesc: "测试介绍",
            cardType: 0,
            specialRule: undefined,
          },
          {
            rawName: "稀有卡(SSR)",
            cardName: "稀有卡",
            cardLevel: "SSR",
            cardDesc: "稀有介绍",
            cardType: 0,
            specialRule: "稀有卡(SSR) => 稀有卡[SSR]",
          },
        ],
      },
    ]);
  });

  it("已有卡池和卡片会更新而不是重复新增", async () => {
    const pools: ParsedPool[] = [
      {
        poolName: "测试池",
        cardDesc: "由腾讯文档导入",
        cardType: 0,
        cards: [
          {
            rawName: "测试卡",
            cardName: "测试卡",
            cardLevel: "N,R,SR,SSR",
            cardDesc: "新介绍",
            cardType: 0,
          },
        ],
      },
    ];
    const existingPool = {
      id: 1,
      pool_name: "测试池",
      card_desc: "旧介绍",
      card_type: 1,
    };
    const existingCard = {
      id: 10,
      pool: 1,
      card_name: "测试卡",
      card_level: "N",
      card_desc: "旧介绍",
      card_type: 0,
      drop_item: "",
    };
    const manager = {
      find: jest
        .fn()
        .mockResolvedValueOnce([existingPool])
        .mockResolvedValueOnce([existingCard]),
      create: jest.fn((_entity, value) => value),
      save: jest.fn(async (_entity, value) => value),
    };

    const result = await importCardPools(manager as any, {
      dryRun: false,
      pools,
    });

    expect(result.pools.updated).toBe(1);
    expect(result.cards.updated).toBe(1);
    expect(result.cards.created).toBe(0);
    expect(manager.save).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ card_level: "N,R,SR,SSR", card_desc: "新介绍" }),
    );
  });
});
