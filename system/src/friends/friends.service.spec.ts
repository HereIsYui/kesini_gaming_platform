import { FindOperator } from "typeorm";
import { User } from "src/entity/user.entity";
import { UserFriend } from "src/entity/userFriend.entity";
import { FriendsService } from "./friends.service";

type EntityClass<T> = new () => T;

class FriendsTestStore {
  users: User[] = [];
  friends: UserFriend[] = [];
  nextFriendId = 1;

  getRepository<T>(entity: EntityClass<T>) {
    if (entity === User) {
      return this.createArrayRepository(this.users, "uid");
    }
    if (entity === UserFriend) {
      return this.createFriendRepository();
    }
    throw new Error("测试仓库未配置");
  }

  async transaction<T>(callback: (manager: FriendsTestStore) => Promise<T>) {
    return callback(this);
  }

  private createFriendRepository() {
    return {
      find: async (options?: any) => {
        const result = this.friends.filter((item) =>
          this.matchesWhereOption(item, options?.where || {}),
        );
        if (options?.order?.createdAt === "DESC") {
          return [...result].sort(
            (left, right) =>
              Number(right.createdAt || 0) - Number(left.createdAt || 0),
          );
        }
        if (options?.order?.updatedAt === "DESC") {
          return [...result].sort(
            (left, right) =>
              Number(right.updatedAt || 0) - Number(left.updatedAt || 0),
          );
        }
        return result;
      },
      findOne: async (options?: any) =>
        this.friends.find((item) =>
          this.matchesWhereOption(item, options?.where || {}),
        ) || null,
      create: (value: Partial<UserFriend>) =>
        ({
          ...value,
          id: this.nextFriendId++,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        }) as UserFriend,
      save: async (relation: UserFriend) => {
        relation.updatedAt = new Date("2026-01-02T00:00:00.000Z");
        const index = this.friends.findIndex((item) => item.id === relation.id);
        if (index >= 0) {
          this.friends[index] = relation;
        } else {
          this.friends.push(relation);
        }
        return relation;
      },
    };
  }

  private createArrayRepository<T extends Record<string, any>>(
    items: T[],
    idKey = "id",
  ) {
    return {
      find: async (options?: any) =>
        items.filter((item) =>
          this.matchesWhereOption(item, options?.where || {}),
        ),
      findOne: async (options?: any) =>
        items.find((item) =>
          this.matchesWhereOption(item, options?.where || {}),
        ) || null,
      create: (value: Partial<T>) => ({
        ...value,
        [idKey]: value[idKey] ?? items.length + 1,
      }),
      save: async (value: T) => {
        const key = value[idKey];
        const index = items.findIndex((item) => item[idKey] === key);
        if (index >= 0) {
          items[index] = value;
        } else {
          items.push(value);
        }
        return value;
      },
    };
  }

  private matchesWhereOption(
    item: Record<string, any>,
    where: Record<string, any> | Array<Record<string, any>>,
  ) {
    if (Array.isArray(where)) {
      return where.some((entry) => this.matchesWhere(item, entry));
    }
    return this.matchesWhere(item, where);
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

function createUser(uid: string): User {
  return {
    id: uid === "u1" ? 1 : uid === "u2" ? 2 : 3,
    uid,
    name: `name-${uid}`,
    nickname: `玩家${uid}`,
    avatar: `https://example.com/${uid}.png`,
    point: 999,
    card_count_n: 0,
    card_count_r: 0,
    card_count_sr: 0,
    card_count_ssr: 0,
    card_count_ur: 0,
    is_admin: false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  } as User;
}

function createRelation(
  store: FriendsTestStore,
  requesterUid: string,
  receiverUid: string,
  status: UserFriend["status"] = "pending",
): UserFriend {
  const relation = {
    id: store.nextFriendId++,
    requester_uid: requesterUid,
    receiver_uid: receiverUid,
    relation_key: [requesterUid, receiverUid].sort().join("::"),
    status,
    responded_at:
      status === "pending" ? null : new Date("2026-01-02T00:00:00.000Z"),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  } as UserFriend;
  store.friends.push(relation);
  return relation;
}

describe("FriendsService 好友系统", () => {
  let store: FriendsTestStore;
  let service: FriendsService;

  beforeEach(() => {
    store = new FriendsTestStore();
    store.users = [createUser("u1"), createUser("u2"), createUser("u3")];
    service = new FriendsService(store as any);
  });

  it("发送好友申请并返回公开信息", async () => {
    const result = await service.sendRequest("u1", "u2");

    expect(store.friends).toHaveLength(1);
    expect(store.friends[0]).toMatchObject({
      requester_uid: "u1",
      receiver_uid: "u2",
      relation_key: "u1::u2",
      status: "pending",
    });
    expect(result).toMatchObject({
      status: "pending",
      user: {
        uid: "u2",
        nickname: "玩家u2",
        avatar: "https://example.com/u2.png",
      },
    });
    expect((result!.user as any).point).toBeUndefined();
  });

  it("可以通过玩家名发送好友申请", async () => {
    const result = await service.sendRequest("u1", "name-u2");

    expect(store.friends[0]).toMatchObject({
      requester_uid: "u1",
      receiver_uid: "u2",
      relation_key: "u1::u2",
      status: "pending",
    });
    expect(result).toMatchObject({
      status: "pending",
      user: { uid: "u2", nickname: "玩家u2" },
    });
  });

  it("不能重复申请、添加自己或添加不存在玩家", async () => {
    await service.sendRequest("u1", "u2");

    await expect(service.sendRequest("u1", "u2")).rejects.toThrow("已申请");
    await expect(service.sendRequest("u2", "u1")).rejects.toThrow("对方已申请");
    await expect(service.sendRequest("u1", "u1")).rejects.toThrow(
      "不能添加自己",
    );
    await expect(service.sendRequest("u1", "missing")).rejects.toThrow(
      "玩家不存在",
    );
  });

  it("通过好友申请后出现在好友列表", async () => {
    const relation = createRelation(store, "u2", "u1");

    const accepted = await service.acceptRequest("u1", relation.id);
    const overview = await service.getOverview("u1");

    expect(accepted).toMatchObject({
      status: "accepted",
      user: { uid: "u2" },
    });
    expect(store.friends[0].status).toBe("accepted");
    expect(store.friends[0].responded_at).toBeInstanceOf(Date);
    expect(overview.counts).toEqual({ friends: 1, incoming: 0, outgoing: 0 });
    expect(overview.friends[0].user.uid).toBe("u2");
  });

  it("拒绝申请后不进入好友列表", async () => {
    const relation = createRelation(store, "u2", "u1");

    const rejected = await service.rejectRequest("u1", relation.id);
    const overview = await service.getOverview("u1");

    expect(rejected).toMatchObject({
      status: "rejected",
      user: { uid: "u2" },
    });
    expect(overview.counts).toEqual({ friends: 0, incoming: 0, outgoing: 0 });
  });

  it("取消自己的申请后可以重新申请", async () => {
    const relation = createRelation(store, "u1", "u2");

    const cancelled = await service.cancelRequest("u1", relation.id);
    expect(cancelled).toMatchObject({
      status: "cancelled",
      user: { uid: "u2" },
    });

    const next = await service.sendRequest("u2", "u1");
    expect(next).toMatchObject({
      status: "pending",
      user: { uid: "u1" },
    });
    expect(store.friends).toHaveLength(1);
    expect(store.friends[0]).toMatchObject({
      requester_uid: "u2",
      receiver_uid: "u1",
      status: "pending",
    });
  });

  it("删除好友后从列表移除", async () => {
    createRelation(store, "u1", "u2", "accepted");

    const removed = await service.removeFriend("u1", "u2");
    const overview = await service.getOverview("u1");

    expect(removed).toEqual({ uid: "u2" });
    expect(store.friends[0].status).toBe("cancelled");
    expect(overview.friends).toEqual([]);
  });

  it("列表区分好友、收到和发出", async () => {
    createRelation(store, "u1", "u2", "accepted");
    createRelation(store, "u3", "u1", "pending");
    createRelation(store, "u1", "u3", "cancelled");
    createRelation(store, "u1", "u3", "pending").relation_key = "u1::u3-next";

    const overview = await service.getOverview("u1");

    expect(overview.counts).toEqual({ friends: 1, incoming: 1, outgoing: 1 });
    expect(overview.friends[0].user.uid).toBe("u2");
    expect(overview.incoming[0].user.uid).toBe("u3");
    expect(overview.outgoing[0].user.uid).toBe("u3");
  });
});
