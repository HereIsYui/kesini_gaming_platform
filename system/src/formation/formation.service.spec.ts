import { FindOperator } from "typeorm";
import { CardItem } from "src/entity/card.entity";
import { TradeListing } from "src/entity/tradeListing.entity";
import { UserCard } from "src/entity/userCard.entity";
import { UserFormationSlot } from "src/entity/userFormationSlot.entity";
import { FormationService } from "./formation.service";

type EntityClass<T> = new () => T;

class FormationTestStore {
  slots: UserFormationSlot[] = [];
  userCards: UserCard[] = [];
  cards: CardItem[] = [];
  listings: TradeListing[] = [];
  nextSlotId = 1;

  getRepository<T>(entity: EntityClass<T>) {
    if (entity === UserFormationSlot) {
      return this.createSlotRepository();
    }
    if (entity === UserCard) {
      return this.createArrayRepository(this.userCards);
    }
    if (entity === CardItem) {
      return this.createArrayRepository(this.cards);
    }
    if (entity === TradeListing) {
      return this.createArrayRepository(this.listings);
    }
    throw new Error("测试仓库未配置");
  }

  async transaction<T>(callback: (manager: FormationTestStore) => Promise<T>) {
    return callback(this);
  }

  private createSlotRepository() {
    return {
      find: async (options?: any) => {
        const result = this.slots.filter((item) =>
          this.matchesWhere(item, options?.where || {}),
        );
        if (options?.order?.position === "ASC") {
          return [...result].sort((left, right) => left.position - right.position);
        }
        return result;
      },
      findOne: async (options?: any) =>
        this.slots.find((item) =>
          this.matchesWhere(item, options?.where || {}),
        ) || null,
      delete: async (where: any) => {
        this.slots = this.slots.filter((item) => !this.matchesWhere(item, where));
      },
      create: (value: Partial<UserFormationSlot>) => ({
        ...value,
        id: this.nextSlotId++,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
      save: async (records: UserFormationSlot | UserFormationSlot[]) => {
        const list = Array.isArray(records) ? records : [records];
        list.forEach((record) => {
          this.slots.push(record);
        });
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
    };
  }

  private matchesWhere(item: Record<string, any>, where: Record<string, any>) {
    return Object.entries(where || {}).every(([key, expected]) => {
      const actual = item[key];
      if (expected instanceof FindOperator) {
        const values = (expected as any)._value as unknown[];
        return values.includes(actual);
      }
      return actual === expected;
    });
  }
}

function createCard(id: number, rarity = "SSR"): CardItem {
  return {
    id,
    card_name: `测试卡${id}`,
    card_desc: `测试卡${id}描述`,
    card_image: "",
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
  options: Partial<UserCard> = {},
): UserCard {
  return {
    id: cardId,
    uid,
    card_id: String(cardId),
    card_level: options.card_level || "SSR",
    can_sell: true,
    can_lottery: true,
    card_uuid: uuid,
    delete_flag: false,
    locked: false,
    cultivation_level: 1,
    cultivation_exp: 0,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...options,
  } as UserCard;
}

function createService(store: FormationTestStore) {
  return new FormationService(store as any);
}

describe("FormationService 阵容编队", () => {
  let store: FormationTestStore;
  let service: FormationService;

  beforeEach(() => {
    store = new FormationTestStore();
    store.cards = [createCard(1, "SSR"), createCard(2, "SR"), createCard(3, "UR")];
    store.userCards = [
      createUserCard("u1", "card-a", 1, {
        card_level: "SSR",
        cultivation_level: 3,
      }),
      createUserCard("u1", "card-b", 2, {
        card_level: "SR",
        cultivation_level: 2,
      }),
      createUserCard("u1", "card-c", 3, {
        card_level: "UR",
        locked: true,
      }),
    ];
    service = createService(store);
  });

  it("空阵容返回三个空位和 0 战力", async () => {
    const result = await service.getFormation("u1");

    expect(result.slotCount).toBe(3);
    expect(result.totalPower).toBe(0);
    expect(result.slots).toEqual([
      { position: 1, card: null },
      { position: 2, card: null },
      { position: 3, card: null },
    ]);
  });

  it("保存阵容后返回卡片与总战力", async () => {
    const result = await service.saveFormation("u1", [
      { position: 1, cardUuid: "card-a" },
      { position: 2, cardUuid: "card-b" },
    ]);

    expect(result.totalPower).toBe(1102);
    expect(result.slots[0].card).toMatchObject({
      uuid: "card-a",
      cardName: "测试卡1",
      cultivationLevel: 3,
      power: 744,
    });
    expect(result.slots[1].card).toMatchObject({
      uuid: "card-b",
      cardName: "测试卡2",
      cultivationLevel: 2,
      power: 358,
    });
  });

  it("阵容战力包含星级加成", async () => {
    const target = store.userCards.find((card) => card.card_uuid === "card-a");
    if (target) {
      target.star_level = 1;
    }

    const result = await service.saveFormation("u1", [
      { position: 1, cardUuid: "card-a" },
      { position: 2, cardUuid: "card-b" },
    ]);

    expect(result.totalPower).toBe(1222);
    expect(result.slots[0].card).toMatchObject({
      starLevel: 1,
      starMaxLevel: 5,
      power: 864,
    });
  });

  it("保存时会清空未传入的位置", async () => {
    await service.saveFormation("u1", [
      { position: 1, cardUuid: "card-a" },
      { position: 2, cardUuid: "card-b" },
    ]);

    const result = await service.saveFormation("u1", [
      { position: 2, cardUuid: "card-b" },
    ]);

    expect(result.slots[0].card).toBeNull();
    expect(result.slots[1].card?.uuid).toBe("card-b");
    expect(result.slots[2].card).toBeNull();
    expect(store.slots).toHaveLength(1);
  });

  it("非本人或已删除卡不能上阵", async () => {
    store.userCards.push(createUserCard("u2", "other-card", 1));
    store.userCards.push(
      createUserCard("u1", "deleted-card", 1, { delete_flag: true }),
    );

    await expect(
      service.saveFormation("u1", [{ position: 1, cardUuid: "other-card" }]),
    ).rejects.toThrow("阵容中包含无效卡片");
    await expect(
      service.saveFormation("u1", [{ position: 1, cardUuid: "deleted-card" }]),
    ).rejects.toThrow("阵容中包含无效卡片");
  });

  it("同一卡片和同一位置不能重复配置", async () => {
    await expect(
      service.saveFormation("u1", [
        { position: 1, cardUuid: "card-a" },
        { position: 2, cardUuid: "card-a" },
      ]),
    ).rejects.toThrow("同一张卡片不能重复上阵");

    await expect(
      service.saveFormation("u1", [
        { position: 1, cardUuid: "card-a" },
        { position: 1, cardUuid: "card-b" },
      ]),
    ).rejects.toThrow("阵容位置重复");
  });

  it("挂售中的卡片不能上阵", async () => {
    store.listings.push({
      id: 1,
      seller_uid: "u1",
      card_uuid: "card-a",
      card_id: 1,
      card_level: "SSR",
      price: 100,
      fee_rate: 0,
      status: "active",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    } as TradeListing);

    await expect(
      service.saveFormation("u1", [{ position: 1, cardUuid: "card-a" }]),
    ).rejects.toThrow("挂售中的卡片不能上阵");
  });

  it("锁定卡允许上阵", async () => {
    const result = await service.saveFormation("u1", [
      { position: 3, cardUuid: "card-c" },
    ]);

    expect(result.slots[2].card).toMatchObject({
      uuid: "card-c",
      cardLevel: "UR",
      locked: true,
    });
  });
});
