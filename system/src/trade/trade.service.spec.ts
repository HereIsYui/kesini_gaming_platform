import { CardItem } from "src/entity/card.entity";
import { PoolInfo } from "src/entity/pool.entity";
import { TradeConfig } from "src/entity/tradeConfig.entity";
import { TradeListing } from "src/entity/tradeListing.entity";
import { TradeRecord } from "src/entity/tradeRecord.entity";
import { User } from "src/entity/user.entity";
import { UserCard } from "src/entity/userCard.entity";
import { TradeService } from "./trade.service";

function createRepository(overrides: Record<string, any> = {}) {
  return {
    create: jest.fn((value) => value),
    find: jest.fn().mockResolvedValue([]),
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
    getRepository: jest.fn((entity) => repositories.get(entity)),
  };
  return {
    service: new TradeService(dataSource as any),
    dataSource,
  };
}

describe("TradeService", () => {
  it("挂售成功后记录卡片UUID和创建时手续费率", async () => {
    const listingRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn(async (value) => ({ id: 1, createdAt: new Date(), ...value })),
    });
    const { service } = createService(
      new Map<any, any>([
        [
          TradeConfig,
          createRepository({
            findOne: jest.fn().mockResolvedValue({
              id: 1,
              enabled: true,
              fee_rate: 0.05,
              min_price: 1,
              max_price: 999999,
            }),
          }),
        ],
        [TradeListing, listingRepository],
        [
          UserCard,
          createRepository({
            findOne: jest.fn().mockResolvedValue({
              uid: "seller",
              card_uuid: "card-uuid",
              card_id: "7",
              card_level: "SSR",
              can_sell: true,
              delete_flag: false,
            }),
          }),
        ],
        [
          CardItem,
          createRepository({
            findOne: jest.fn().mockResolvedValue({
              id: 7,
              card_name: "测试卡",
              card_desc: "描述",
              card_type: 0,
              card_level: "N,R,SR,SSR",
              pool: 2,
            }),
          }),
        ],
        [
          PoolInfo,
          createRepository({
            findOne: jest.fn().mockResolvedValue({ id: 2, pool_name: "测试池" }),
          }),
        ],
      ]),
    );

    await expect(service.createListing("seller", "card-uuid", 100)).resolves.toEqual(
      expect.objectContaining({
        id: 1,
        cardUuid: "card-uuid",
        price: 100,
        feeRate: 0.05,
        sellerIncome: 95,
      }),
    );
    expect(listingRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        seller_uid: "seller",
        card_uuid: "card-uuid",
        card_level: "SSR",
        price: 100,
        fee_rate: 0.05,
        status: "active",
      }),
    );
  });

  it("重复挂售同一张卡会被拒绝", async () => {
    const { service } = createCreateListingService({
      activeListing: { id: 9, card_uuid: "card-uuid", status: "active" },
    });

    await expect(service.createListing("seller", "card-uuid", 100)).rejects.toThrow(
      "这张卡片已在交易中",
    );
  });

  it("购买成功会扣买家星穹币、给卖家实收并保持UUID不变", async () => {
    const listing = {
      id: 1,
      seller_uid: "seller",
      buyer_uid: null,
      card_uuid: "card-uuid",
      card_id: 7,
      card_level: "SSR",
      price: 100,
      fee_rate: 0.05,
      status: "active",
    };
    const userCard = {
      uid: "seller",
      card_uuid: "card-uuid",
      card_id: "7",
      delete_flag: false,
    };
    const buyer = { uid: "buyer", point: 120 };
    const seller = { uid: "seller", point: 10 };
    const userRepository = createRepository({
      findOne: jest.fn(async ({ where }) =>
        where.uid === "buyer" ? buyer : seller,
      ),
    });
    const userCardRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(userCard),
    });
    const listingRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(listing),
    });
    const recordRepository = createRepository({
      save: jest.fn(async (value) => ({ id: 6, ...value })),
    });
    const { service } = createService(
      new Map<any, any>([
        [
          TradeConfig,
          createRepository({
            findOne: jest.fn().mockResolvedValue({
              id: 1,
              enabled: true,
              fee_rate: 0,
              min_price: 1,
              max_price: 999999,
            }),
          }),
        ],
        [TradeListing, listingRepository],
        [TradeRecord, recordRepository],
        [UserCard, userCardRepository],
        [User, userRepository],
        [
          CardItem,
          createRepository({
            findOne: jest.fn().mockResolvedValue({
              id: 7,
              card_name: "测试卡",
              card_desc: "描述",
              card_type: 0,
              pool: 2,
            }),
          }),
        ],
        [
          PoolInfo,
          createRepository({
            findOne: jest.fn().mockResolvedValue({ id: 2, pool_name: "测试池" }),
          }),
        ],
      ]),
    );

    await expect(service.buyListing("buyer", 1)).resolves.toEqual(
      expect.objectContaining({
        cardUuid: "card-uuid",
        price: 100,
        feeAmount: 5,
        sellerIncome: 95,
        buyerPoint: 20,
      }),
    );
    expect(userRepository.save).toHaveBeenCalledWith([
      expect.objectContaining({ uid: "buyer", point: 20 }),
      expect.objectContaining({ uid: "seller", point: 105 }),
    ]);
    expect(userCardRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ uid: "buyer", card_uuid: "card-uuid" }),
    );
    expect(recordRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        seller_uid: "seller",
        buyer_uid: "buyer",
        card_uuid: "card-uuid",
      }),
    );
  });

  it("星穹币不足时购买失败且不保存资产变更", async () => {
    const listingRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        seller_uid: "seller",
        card_uuid: "card-uuid",
        card_id: 7,
        card_level: "SSR",
        price: 100,
        fee_rate: 0,
        status: "active",
      }),
      save: jest.fn(),
    });
    const userCardRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({
        uid: "seller",
        card_uuid: "card-uuid",
        delete_flag: false,
      }),
      save: jest.fn(),
    });
    const userRepository = createRepository({
      findOne: jest.fn(async ({ where }) =>
        where.uid === "buyer"
          ? { uid: "buyer", point: 9 }
          : { uid: "seller", point: 0 },
      ),
      save: jest.fn(),
    });
    const { service } = createService(
      new Map<any, any>([
        [
          TradeConfig,
          createRepository({
            findOne: jest.fn().mockResolvedValue({
              id: 1,
              enabled: true,
              fee_rate: 0,
              min_price: 1,
              max_price: 999999,
            }),
          }),
        ],
        [TradeListing, listingRepository],
        [TradeRecord, createRepository()],
        [UserCard, userCardRepository],
        [User, userRepository],
      ]),
    );

    await expect(service.buyListing("buyer", 1)).rejects.toThrow("星穹币不足");
    expect(userRepository.save).not.toHaveBeenCalled();
    expect(userCardRepository.save).not.toHaveBeenCalled();
    expect(listingRepository.save).not.toHaveBeenCalled();
  });

  it("取消挂售只允许取消交易中的挂单", async () => {
    const listing = {
      id: 1,
      seller_uid: "seller",
      status: "active",
      cancelled_at: null,
    };
    const listingRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(listing),
    });
    const { service } = createService(
      new Map<any, any>([[TradeListing, listingRepository]]),
    );

    await expect(service.cancelListing("seller", 1)).resolves.toEqual(
      expect.objectContaining({ id: 1, status: "cancelled" }),
    );
    expect(listingRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: "cancelled" }),
    );
  });
});

function createCreateListingService({
  activeListing = null,
}: {
  activeListing?: Record<string, any> | null;
}) {
  const service = createService(
    new Map<any, any>([
      [
        TradeConfig,
        createRepository({
          findOne: jest.fn().mockResolvedValue({
            id: 1,
            enabled: true,
            fee_rate: 0,
            min_price: 1,
            max_price: 999999,
          }),
        }),
      ],
      [
        TradeListing,
        createRepository({
          findOne: jest.fn().mockResolvedValue(activeListing),
        }),
      ],
      [
        UserCard,
        createRepository({
          findOne: jest.fn().mockResolvedValue({
            uid: "seller",
            card_uuid: "card-uuid",
            card_id: "7",
            card_level: "SSR",
            can_sell: true,
            delete_flag: false,
          }),
        }),
      ],
      [
        CardItem,
        createRepository({
          findOne: jest.fn().mockResolvedValue({
            id: 7,
            card_name: "测试卡",
            card_desc: "描述",
            card_type: 0,
            card_level: "SSR",
            pool: 1,
          }),
        }),
      ],
      [PoolInfo, createRepository()],
    ]),
  );
  return service;
}
