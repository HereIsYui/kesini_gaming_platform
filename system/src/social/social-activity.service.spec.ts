import { FindOperator } from "typeorm";
import { User } from "src/entity/user.entity";
import { UserFriend } from "src/entity/userFriend.entity";
import { UserSocialActivity } from "src/entity/userSocialActivity.entity";
import { SocialActivityService } from "./social-activity.service";

type EntityClass<T> = new () => T;

class SocialActivityTestStore {
  users: User[] = [];
  friends: UserFriend[] = [];
  activities: UserSocialActivity[] = [];
  nextActivityId = 1;

  getRepository<T>(entity: EntityClass<T>) {
    if (entity === User) {
      return this.createArrayRepository(this.users, "uid");
    }
    if (entity === UserFriend) {
      return this.createArrayRepository(this.friends, "id");
    }
    if (entity === UserSocialActivity) {
      return this.createActivityRepository();
    }
    throw new Error("测试仓库未配置");
  }

  private createActivityRepository() {
    return {
      find: async (options?: any) => {
        let result = this.activities.filter((item) =>
          this.matchesWhereOption(item, options?.where || {}),
        );
        if (options?.order?.createdAt === "DESC") {
          result = [...result].sort(
            (left, right) =>
              Number(right.createdAt || 0) - Number(left.createdAt || 0) ||
              Number(right.id || 0) - Number(left.id || 0),
          );
        }
        return typeof options?.take === "number"
          ? result.slice(0, options.take)
          : result;
      },
      create: (value: Partial<UserSocialActivity>) =>
        ({
          ...value,
          id: this.nextActivityId++,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        }) as UserSocialActivity,
      save: async (activity: UserSocialActivity) => {
        this.activities.push(activity);
        return activity;
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
        items.push(value);
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

function createUser(uid: string, nickname: string): User {
  return {
    id: uid === "u1" ? 1 : uid === "u2" ? 2 : 3,
    uid,
    name: uid,
    nickname,
    avatar: `${uid}.png`,
    point: 0,
    card_count_n: 0,
    card_count_r: 0,
    card_count_sr: 0,
    card_count_ssr: 0,
    card_count_ur: 0,
    is_admin: false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  } as User;
}

function createFriend(
  requesterUid: string,
  receiverUid: string,
  status: UserFriend["status"] = "accepted",
): UserFriend {
  return {
    id: requesterUid === "u1" ? 1 : 2,
    requester_uid: requesterUid,
    receiver_uid: receiverUid,
    relation_key: [requesterUid, receiverUid].sort().join("::"),
    status,
    responded_at: status === "accepted" ? new Date() : null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  } as UserFriend;
}

describe("SocialActivityService 好友动态", () => {
  let store: SocialActivityTestStore;
  let service: SocialActivityService;

  beforeEach(() => {
    store = new SocialActivityTestStore();
    store.users = [
      createUser("u1", "玩家一"),
      createUser("u2", "玩家二"),
      createUser("u3", "玩家三"),
    ];
    store.friends = [
      createFriend("u1", "u2", "accepted"),
      createFriend("u1", "u3", "pending"),
    ];
    service = new SocialActivityService(store as any);
  });

  it("只返回已添加好友的动态", async () => {
    await service.recordActivity({
      actorUid: "u2",
      type: "card_upgraded",
      title: "养成卡片",
      summary: "测试卡 Lv.2",
    });
    await service.recordActivity({
      actorUid: "u3",
      type: "pve_cleared",
      title: "通关关卡",
      summary: "隐藏关",
    });
    await service.recordActivity({
      actorUid: "u1",
      type: "showcase_updated",
      title: "更新展示墙",
      summary: "展示 2 张",
    });

    const result = await service.listFriendFeed("u1");

    expect(result.list).toHaveLength(1);
    expect(result.list[0]).toMatchObject({
      title: "养成卡片",
      summary: "测试卡 Lv.2",
      user: { uid: "u2", nickname: "玩家二", avatar: "u2.png" },
    });
  });

  it("记录动态时会裁剪过长文案", async () => {
    const activity = await service.recordActivity({
      actorUid: "u2",
      type: "showcase_updated",
      title: "很长".repeat(50),
      summary: "说明".repeat(100),
    });

    expect(activity?.title.length).toBeLessThanOrEqual(80);
    expect(activity?.summary.length).toBeLessThanOrEqual(160);
  });
});
