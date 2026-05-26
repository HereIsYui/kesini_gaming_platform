import { RedeemCode } from "src/entity/redeemCode.entity";
import { RedeemCodeUsage } from "src/entity/redeemCodeUsage.entity";
import { User } from "src/entity/user.entity";
import { UserInventory } from "src/entity/inventory.entity";
import { DropItem } from "src/entity/drop.entity";
import { CardItem } from "src/entity/card.entity";
import { UserCard } from "src/entity/userCard.entity";
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
  it("兑换成功会发放星穹币、道具并写入领取记录", async () => {
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

  it("兑换码可以发放指定卡片奖励", async () => {
    const code = {
      id: 2,
      code: "CARD",
      name: "卡片礼包",
      enabled: true,
      used_count: 0,
      total_limit: null,
      rewards: {
        points: 0,
        items: [],
        cards: [{ cardId: 9, rarity: "SSR", num: 2 }],
      },
      delete_flag: false,
    };
    const user = {
      id: 5,
      uid: "u1",
      point: 0,
      card_count_n: 0,
      card_count_r: 0,
      card_count_sr: 0,
      card_count_ssr: 1,
      card_count_ur: 0,
    };
    const redeemCodeRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(code),
    });
    const usageRepository = createRepository();
    const userRepository = createRepository({
      findOne: jest.fn().mockResolvedValue(user),
    });
    const cardRepository = createRepository({
      find: jest.fn().mockResolvedValue([
        { id: 9, card_name: "测试卡片", card_level: "SR,SSR" },
      ]),
    });
    const userCardRepository = createRepository();
    const { service } = createService(
      new Map<any, any>([
        [RedeemCode, redeemCodeRepository],
        [RedeemCodeUsage, usageRepository],
        [User, userRepository],
        [UserInventory, createRepository()],
        [DropItem, createRepository()],
        [CardItem, cardRepository],
        [UserCard, userCardRepository],
      ]),
    );

    await expect(service.claim("u1", "card")).resolves.toEqual({
      code: "CARD",
      rewards: {
        points: 0,
        items: [],
        cards: [{ cardId: 9, rarity: "SSR", num: 2 }],
      },
    });
    expect(userCardRepository.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          uid: "u1",
          card_id: "9",
          card_level: "SSR",
          can_sell: true,
          can_lottery: true,
          delete_flag: false,
        }),
      ]),
    );
    expect(userCardRepository.save.mock.calls[0][0]).toHaveLength(2);
    expect(userRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ card_count_ssr: 3 }),
    );
    expect(usageRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        reward_snapshot: {
          points: 0,
          items: [],
          cards: [{ cardId: 9, rarity: "SSR", num: 2 }],
        },
      }),
    );
  });

  it("兑换码卡片奖励会校验稀有度", async () => {
    const redeemCodeRepository = createRepository({
      findOne: jest.fn().mockResolvedValue({
        id: 3,
        code: "CARD",
        name: "卡片礼包",
        enabled: true,
        used_count: 0,
        total_limit: null,
        rewards: {
          points: 0,
          items: [],
          cards: [{ cardId: 9, rarity: "UR", num: 1 }],
        },
        delete_flag: false,
      }),
    });
    const cardRepository = createRepository({
      find: jest.fn().mockResolvedValue([
        { id: 9, card_name: "测试卡片", card_level: "SR,SSR" },
      ]),
    });
    const { service } = createService(
      new Map<any, any>([
        [RedeemCode, redeemCodeRepository],
        [RedeemCodeUsage, createRepository()],
        [
          User,
          createRepository({
            findOne: jest.fn().mockResolvedValue({ id: 5, uid: "u1" }),
          }),
        ],
        [UserInventory, createRepository()],
        [DropItem, createRepository()],
        [CardItem, cardRepository],
        [UserCard, createRepository()],
      ]),
    );

    await expect(service.claim("u1", "CARD")).rejects.toThrow(
      "奖励卡片稀有度无效",
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
