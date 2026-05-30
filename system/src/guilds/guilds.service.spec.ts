import { FindOperator } from "typeorm";
import { Guild } from "src/entity/guild.entity";
import { GuildMember } from "src/entity/guildMember.entity";
import { GuildMessage } from "src/entity/guildMessage.entity";
import { User } from "src/entity/user.entity";
import { GuildsService } from "./guilds.service";

type EntityClass<T> = new () => T;

class GuildsTestStore {
  users: User[] = [];
  guilds: Guild[] = [];
  members: GuildMember[] = [];
  messages: GuildMessage[] = [];
  nextGuildId = 1;
  nextMemberId = 1;
  nextMessageId = 1;

  getRepository<T>(entity: EntityClass<T>) {
    if (entity === User) {
      return this.createArrayRepository(this.users, "uid");
    }
    if (entity === Guild) {
      return this.createArrayRepository(this.guilds, "id", () => ({
        id: this.nextGuildId++,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      }));
    }
    if (entity === GuildMember) {
      return this.createArrayRepository(this.members, "id", () => ({
        id: this.nextMemberId++,
        joinedAt: new Date(
          `2026-01-01T00:00:${String(this.nextMemberId).padStart(2, "0")}.000Z`,
        ),
      }));
    }
    if (entity === GuildMessage) {
      return this.createArrayRepository(this.messages, "id", () => ({
        id: this.nextMessageId++,
        createdAt: new Date(
          `2026-01-01T00:01:${String(this.nextMessageId).padStart(2, "0")}.000Z`,
        ),
      }));
    }
    throw new Error("测试仓库未配置");
  }

  async transaction<T>(callback: (manager: GuildsTestStore) => Promise<T>) {
    return callback(this);
  }

  private createArrayRepository<T extends Record<string, any>>(
    items: T[],
    idKey = "id",
    defaults?: () => Partial<T>,
  ) {
    return {
      find: async (options?: any) => {
        let result = items.filter((item) =>
          this.matchesWhereOption(item, options?.where || {}),
        );
        if (options?.order) {
          result = [...result].sort((left, right) =>
            this.compareByOrder(left, right, options.order),
          );
        }
        if (Number.isInteger(options?.take)) {
          return result.slice(0, options.take);
        }
        return result;
      },
      findOne: async (options?: any) =>
        items.find((item) =>
          this.matchesWhereOption(item, options?.where || {}),
        ) || null,
      create: (value: Partial<T>) =>
        ({
          ...(defaults?.() || {}),
          ...value,
        }) as T,
      save: async (value: T) => {
        if (Array.isArray(value)) {
          return Promise.all(value.map((item) => this.saveOne(items, idKey, item)));
        }
        return this.saveOne(items, idKey, value);
      },
      delete: async (where: any) => {
        const before = items.length;
        for (let index = items.length - 1; index >= 0; index -= 1) {
          if (this.matchesWhereOption(items[index], where || {})) {
            items.splice(index, 1);
          }
        }
        return { affected: before - items.length };
      },
    };
  }

  private saveOne<T extends Record<string, any>>(
    items: T[],
    idKey: string,
    value: T,
  ) {
    if (value[idKey] === undefined || value[idKey] === null) {
      value[idKey] = items.length + 1;
    }
    if ("updatedAt" in value) {
      value.updatedAt = new Date("2026-01-02T00:00:00.000Z");
    }
    const index = items.findIndex((item) => item[idKey] === value[idKey]);
    if (index >= 0) {
      items[index] = value;
    } else {
      items.push(value);
    }
    return value;
  }

  private compareByOrder(
    left: Record<string, any>,
    right: Record<string, any>,
    order: Record<string, "ASC" | "DESC">,
  ) {
    for (const [key, direction] of Object.entries(order)) {
      const leftValue = left[key] instanceof Date ? left[key].getTime() : left[key];
      const rightValue =
        right[key] instanceof Date ? right[key].getTime() : right[key];
      if (leftValue === rightValue) {
        continue;
      }
      const result = leftValue > rightValue ? 1 : -1;
      return direction === "DESC" ? -result : result;
    }
    return 0;
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

async function createGuild(
  service: GuildsService,
  uid = "u1",
  name = "星海会",
) {
  return service.createGuild(uid, name, "一起收集");
}

describe("GuildsService 公会系统", () => {
  let store: GuildsTestStore;
  let service: GuildsService;

  beforeEach(() => {
    store = new GuildsTestStore();
    store.users = [createUser("u1"), createUser("u2"), createUser("u3")];
    service = new GuildsService(store as any);
  });

  it("创建公会后成为会长并返回成员", async () => {
    const result = await createGuild(service);

    expect(store.guilds).toHaveLength(1);
    expect(store.members).toHaveLength(1);
    expect(result.current?.guild).toMatchObject({
      name: "星海会",
      description: "一起收集",
      memberCount: 1,
      role: "leader",
      joined: true,
    });
    expect(result.current?.members[0]).toMatchObject({
      uid: "u1",
      nickname: "玩家u1",
      role: "leader",
    });
  });

  it("不能重复创建、加入或使用重名公会", async () => {
    await createGuild(service, "u1", "星海会");
    await expect(createGuild(service, "u1", "新公会")).rejects.toThrow(
      "已加入公会",
    );
    await expect(service.joinGuild("u1", 1)).rejects.toThrow("已加入公会");
    await expect(createGuild(service, "u2", "星海会")).rejects.toThrow(
      "公会名已存在",
    );
  });

  it("可以加入公会并查看成员", async () => {
    await createGuild(service, "u1", "星海会");

    const result = await service.joinGuild("u2", 1);

    expect(result.current?.guild).toMatchObject({
      id: 1,
      name: "星海会",
      memberCount: 2,
      role: "member",
    });
    expect(result.current?.members.map((member) => member.uid)).toEqual([
      "u1",
      "u2",
    ]);
    expect(store.guilds[0].member_count).toBe(2);
  });

  it("普通成员退出后从公会移除", async () => {
    await createGuild(service, "u1", "星海会");
    await service.joinGuild("u2", 1);

    const result = await service.leaveGuild("u2");

    expect(result.current).toBeNull();
    expect(store.members.map((member) => member.uid)).toEqual(["u1"]);
    expect(store.guilds[0].member_count).toBe(1);
  });

  it("会长退出时转让给最早成员", async () => {
    await createGuild(service, "u1", "星海会");
    await service.joinGuild("u2", 1);
    await service.joinGuild("u3", 1);

    await service.leaveGuild("u1");
    const overview = await service.getOverview("u2");

    expect(store.guilds[0].owner_uid).toBe("u2");
    expect(store.guilds[0].member_count).toBe(2);
    expect(overview.current?.guild.role).toBe("leader");
    expect(overview.current?.members.map((member) => member.uid)).toEqual([
      "u2",
      "u3",
    ]);
  });

  it("会长独自退出时解散公会", async () => {
    await createGuild(service, "u1", "星海会");

    const result = await service.leaveGuild("u1");

    expect(result.current).toBeNull();
    expect(store.guilds).toHaveLength(0);
    expect(store.members).toHaveLength(0);
  });

  it("校验公会名和目标公会", async () => {
    await expect(service.createGuild("u1", "A")).rejects.toThrow(
      "公会名需 2-16 字",
    );
    await expect(service.createGuild("u1", "星海会!")).rejects.toThrow(
      "公会名格式错误",
    );
    await expect(service.joinGuild("u1", 404)).rejects.toThrow("公会不存在");
  });

  it("公会成员可以发送并读取消息", async () => {
    await createGuild(service, "u1", "星海会");
    await service.joinGuild("u2", 1);

    const sent = await service.sendMessage("u1", "  大家好  ");
    await service.sendMessage("u2", "一起抽卡");
    const messages = await service.listMessages("u1");

    expect(sent.list[0]).toMatchObject({
      content: "大家好",
      sender: {
        uid: "u1",
        nickname: "玩家u1",
      },
    });
    expect(messages.list.map((message) => message.content)).toEqual([
      "大家好",
      "一起抽卡",
    ]);
    expect((messages.list[0].sender as any).point).toBeUndefined();
  });

  it("未加入公会不能发送或读取消息", async () => {
    await createGuild(service, "u1", "星海会");

    await expect(service.sendMessage("u2", "你好")).rejects.toThrow(
      "尚未加入公会",
    );
    await expect(service.listMessages("u2")).rejects.toThrow("尚未加入公会");
  });

  it("校验消息内容并限制读取数量", async () => {
    await createGuild(service, "u1", "星海会");
    await expect(service.sendMessage("u1", "   ")).rejects.toThrow("请输入消息");
    await expect(service.sendMessage("u1", "满".repeat(121))).rejects.toThrow(
      "消息最多 120 字",
    );

    await service.sendMessage("u1", "第一条");
    await service.sendMessage("u1", "第二条");

    const messages = await service.listMessages("u1", 1);
    expect(messages.list.map((message) => message.content)).toEqual(["第二条"]);
  });
});
