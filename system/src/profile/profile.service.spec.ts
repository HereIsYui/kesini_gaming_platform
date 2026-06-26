import { FindOperator } from "typeorm";
import { CardItem } from "src/entity/card.entity";
import { User } from "src/entity/user.entity";
import { UserCard } from "src/entity/userCard.entity";
import { UserShowcaseCard } from "src/entity/userShowcaseCard.entity";
import { ProfileService } from "./profile.service";

type EntityClass<T> = new () => T;

class ProfileTestStore {
  users: User[] = [];
  userCards: UserCard[] = [];
  cards: CardItem[] = [];
  showcase: UserShowcaseCard[] = [];
  nextShowcaseId = 1;

  getRepository<T>(entity: EntityClass<T>) {
    if (entity === User) {
      return this.createArrayRepository(this.users);
    }
    if (entity === UserCard) {
      return this.createArrayRepository(this.userCards);
    }
    if (entity === CardItem) {
      return this.createArrayRepository(this.cards);
    }
    if (entity === UserShowcaseCard) {
      return this.createShowcaseRepository();
    }
    throw new Error("测试仓库未配置");
  }

  async transaction<T>(callback: (manager: ProfileTestStore) => Promise<T>) {
    return callback(this);
  }

  private createShowcaseRepository() {
    return {
      find: async (options?: any) => {
        const result = this.showcase.filter((item) =>
          this.matchesWhere(item, options?.where || {}),
        );
        if (options?.order?.position === "ASC") {
          return [...result].sort(
            (left, right) => Number(left.position) - Number(right.position),
          );
        }
        return result;
      },
      delete: async (where: any) => {
        this.showcase = this.showcase.filter(
          (item) => !this.matchesWhere(item, where),
        );
      },
      create: (value: Partial<UserShowcaseCard>) =>
        ({
          ...value,
          id: this.nextShowcaseId++,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        }) as UserShowcaseCard,
      save: async (records: UserShowcaseCard | UserShowcaseCard[]) => {
        const list = Array.isArray(records) ? records : [records];
        list.forEach((record) => this.showcase.push(record));
        return records;
      },
    };
  }

  private createArrayRepository<T extends Record<string, any>>(items: T[]) {
    return {
      find: async (options?: any) =>
        items.filter((item) => this.matchesWhere(item, options?.where || {})),
      findOne: async (options?: any) =>
        items.find((item) => this.matchesWhere(item, options?.where || {})) ||
        null,
      save: async (records: T | T[]) => {
        const list = Array.isArray(records) ? records : [records];
        list.forEach((record) => {
          const index = items.findIndex((item) => item.id === record.id);
          if (index >= 0) {
            items[index] = record;
          } else {
            items.push(record);
          }
        });
        return records;
      },
    };
  }

  private matchesWhere(item: Record<string, any>, where: Record<string, any>) {
    return Object.entries(where || {}).every(([key, expected]) => {
      const actual = item[key];
      if (expected instanceof FindOperator) {
        const operator = expected as any;
        if (operator._type === "in") {
          return (operator._value as unknown[]).includes(actual);
        }
      }
      return actual === expected;
    });
  }
}

function createUser(uid = "u1"): User {
  return {
    id: uid === "u1" ? 1 : 2,
    uid,
    public_id: `pub-${uid}`,
    name: `name-${uid}`,
    nickname: `玩家${uid}`,
    avatar: `https://example.com/${uid}.png`,
    point: 999,
    card_count_n: 1,
    card_count_r: 2,
    card_count_sr: 3,
    card_count_ssr: 4,
    card_count_ur: 5,
    is_admin: false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  } as User;
}

function createCard(id: number, rarity = "SSR"): CardItem {
  return {
    id,
    card_name: `测试卡${id}`,
    card_desc: `测试卡${id}描述`,
    drop_item: "",
    card_image: `/file/card-images/card-${id}.png`,
    card_level: rarity,
    card_type: 0,
    pool: 1,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  } as CardItem;
}

function createUserCard(
  uid: string,
  uuid: string,
  cardId: number,
  patch: Partial<UserCard> = {},
): UserCard {
  return {
    id: cardId,
    uid,
    card_id: String(cardId),
    card_level: patch.card_level || "SSR",
    can_sell: true,
    can_lottery: true,
    card_uuid: uuid,
    delete_flag: false,
    locked: false,
    cultivation_level: 2,
    cultivation_exp: 0,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...patch,
  } as UserCard;
}

function createService(store: ProfileTestStore) {
  const formationService = {
    getFormation: jest.fn(async () => ({
      slotCount: 3,
      totalPower: 1288,
      slots: [
        { position: 1, card: { uuid: "card-a" } },
        { position: 2, card: null },
        { position: 3, card: { uuid: "card-b" } },
      ],
    })),
  };
  return new ProfileService(store as any, formationService as any);
}

describe("ProfileService 玩家主页", () => {
  let store: ProfileTestStore;
  let service: ProfileService;

  beforeEach(() => {
    store = new ProfileTestStore();
    store.users = [createUser("u1"), createUser("u2")];
    store.cards = [createCard(1, "SSR"), createCard(2, "UR"), createCard(3, "SR")];
    store.userCards = [
      createUserCard("u1", "card-a", 1, { cultivation_level: 3 }),
      createUserCard("u1", "card-b", 2, {
        card_level: "UR",
        cultivation_level: 1,
      }),
      createUserCard("u1", "deleted-card", 3, { delete_flag: true }),
      createUserCard("u2", "other-card", 1),
    ];
    service = createService(store);
  });

  it("公开主页不返回敏感字段", async () => {
    const result = await service.getProfile("u1");

    expect(result.user).toEqual({
      uid: "u1",
      publicId: "pub-u1",
      nickname: "玩家u1",
      avatar: "https://example.com/u1.png",
      cardCounts: { N: 1, R: 2, SR: 3, SSR: 4, UR: 5 },
      totalCards: 15,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    expect((result.user as any).point).toBeUndefined();
    expect((result.user as any).is_admin).toBeUndefined();
    expect(result.formation).toEqual({
      slotCount: 3,
      filledCount: 2,
      totalPower: 1288,
    });
    expect(result.showcase).toEqual([]);
  });

  it("保存展示墙后按选择顺序返回", async () => {
    const result = await service.saveShowcase("u1", ["card-b", "card-a"]);

    expect(store.showcase).toMatchObject([
      { uid: "u1", card_uuid: "card-b", position: 1 },
      { uid: "u1", card_uuid: "card-a", position: 2 },
    ]);
    expect(result.showcase.map((card) => card.uuid)).toEqual([
      "card-b",
      "card-a",
    ]);
    expect(result.showcase[0]).toMatchObject({
      cardName: "测试卡2",
      cardLevel: "UR",
      position: 1,
    });
  });

  it("重复卡片不能保存", async () => {
    await expect(
      service.saveShowcase("u1", ["card-a", "card-a"]),
    ).rejects.toThrow("展示卡片不能重复");
  });

  it("非本人或已删除卡不能保存", async () => {
    await expect(
      service.saveShowcase("u1", ["other-card"]),
    ).rejects.toThrow("展示墙包含无效卡片");

    await expect(
      service.saveShowcase("u1", ["deleted-card"]),
    ).rejects.toThrow("展示墙包含无效卡片");
  });

  it("最多展示六张卡片", async () => {
    await expect(
      service.saveShowcase("u1", [
        "card-a",
        "card-b",
        "card-c",
        "card-d",
        "card-e",
        "card-f",
        "card-g",
      ]),
    ).rejects.toThrow("最多展示 6 张卡片");
  });

  it("空展示墙会清空旧记录", async () => {
    await service.saveShowcase("u1", ["card-a"]);

    const result = await service.saveShowcase("u1", []);

    expect(store.showcase).toEqual([]);
    expect(result.showcase).toEqual([]);
  });

  it("公开查询会跳过失效展示卡", async () => {
    store.showcase = [
      {
        id: 1,
        uid: "u1",
        card_uuid: "card-a",
        position: 1,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      } as UserShowcaseCard,
      {
        id: 2,
        uid: "u1",
        card_uuid: "deleted-card",
        position: 2,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      } as UserShowcaseCard,
    ];

    const result = await service.getProfile("u1");

    expect(result.showcase.map((card) => card.uuid)).toEqual(["card-a"]);
  });

  it("展示墙战力包含星级加成", async () => {
    const target = store.userCards.find((card) => card.card_uuid === "card-a");
    if (target) {
      target.star_level = 2;
    }
    store.showcase = [
      {
        id: 1,
        uid: "u1",
        card_uuid: "card-a",
        position: 1,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      } as UserShowcaseCard,
    ];

    const result = await service.getProfile("u1");

    expect(result.showcase[0]).toMatchObject({
      starLevel: 2,
      starMaxLevel: 5,
      power: 984,
    });
  });

  it("可用公开编号查询主页", async () => {
    const result = await service.getPublicProfile("pub-u1");

    expect((result.user as any).uid).toBeUndefined();
    expect(result.user.publicId).toBe("pub-u1");
  });

  it("旧的主页地址仍然可用", async () => {
    const result = await service.getPublicProfile("u1");

    expect((result.user as any).uid).toBeUndefined();
    expect(result.user.publicId).toBe("pub-u1");
  });

  it("老玩家查询时会补公开编号", async () => {
    store.users[0].public_id = null;

    const result = await service.getProfile("u1");

    expect(result.user.publicId).toMatch(/^[0-9a-f]{16}$/);
    expect(store.users[0].public_id).toBe(result.user.publicId);
  });
});
