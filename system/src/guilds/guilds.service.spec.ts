import { FindOperator } from "typeorm";
import { Guild } from "src/entity/guild.entity";
import { GuildActivityChestClaim } from "src/entity/guildActivityChestClaim.entity";
import { GuildBoss } from "src/entity/guildBoss.entity";
import { GuildBossChallenge } from "src/entity/guildBossChallenge.entity";
import { GuildBossRewardClaim } from "src/entity/guildBossRewardClaim.entity";
import { GuildContributionRecord } from "src/entity/guildContributionRecord.entity";
import { GuildJoinRequest } from "src/entity/guildJoinRequest.entity";
import { GuildMember } from "src/entity/guildMember.entity";
import { GuildMessage } from "src/entity/guildMessage.entity";
import { SystemConfig } from "src/entity/systemConfig.entity";
import { DropItem } from "src/entity/drop.entity";
import { User } from "src/entity/user.entity";
import { GuildsService } from "./guilds.service";

type EntityClass<T> = new () => T;

class GuildsTestStore {
  users: User[] = [];
  guilds: Guild[] = [];
  members: GuildMember[] = [];
  messages: GuildMessage[] = [];
  requests: GuildJoinRequest[] = [];
  contributions: GuildContributionRecord[] = [];
  chestClaims: GuildActivityChestClaim[] = [];
  bosses: GuildBoss[] = [];
  bossChallenges: GuildBossChallenge[] = [];
  bossRewardClaims: GuildBossRewardClaim[] = [];
  configs: SystemConfig[] = [];
  dropItems: DropItem[] = [
    {
      id: 99,
      drop_name: "星核结晶",
      drop_desc: "UR卡养成材料",
      drop_type: 0,
      drop_item_type: 0,
      drop_item_value: 0,
      disabled: false,
      default_fragment: false,
    } as DropItem,
  ];
  failNextBossSaveWithDuplicate = false;
  failNextRequestSaveWithDuplicate = false;

  getRepository<T>(entity: EntityClass<T>) {
    if (entity === User) {
      return this.createArrayRepository(this.users, "uid");
    }
    if (entity === Guild) {
      return this.createArrayRepository(this.guilds, "id", () => ({
        createdAt: this.date(0),
        updatedAt: this.date(0),
      }));
    }
    if (entity === GuildMember) {
      return this.createArrayRepository(this.members, "id", () => ({
        joinedAt: this.date(this.members.length + 1),
      }));
    }
    if (entity === GuildMessage) {
      return this.createArrayRepository(this.messages, "id", () => ({
        createdAt: this.date(this.messages.length + 30),
      }));
    }
    if (entity === GuildJoinRequest) {
      const repository = this.createArrayRepository(this.requests, "id", () => ({
        createdAt: this.date(this.requests.length + 60),
        updatedAt: this.date(this.requests.length + 60),
      }));
      const originalSave = repository.save;
      repository.save = async (value: GuildJoinRequest | GuildJoinRequest[]) => {
        if (this.failNextRequestSaveWithDuplicate && !Array.isArray(value)) {
          this.failNextRequestSaveWithDuplicate = false;
          this.requests.push({
            ...value,
            id: this.requests.length + 1,
            pending_key: "pending",
          });
          throw { code: "ER_DUP_ENTRY" };
        }
        return originalSave(value as any);
      };
      return repository;
    }
    if (entity === GuildContributionRecord) {
      return this.createArrayRepository(this.contributions, "id", () => ({
        createdAt: this.date(this.contributions.length + 90),
      }));
    }
    if (entity === GuildActivityChestClaim) {
      return this.createArrayRepository(this.chestClaims, "id", () => ({
        createdAt: this.date(this.chestClaims.length + 120),
      }));
    }
    if (entity === GuildBoss) {
      const repository = this.createArrayRepository(this.bosses, "id", () => ({
        createdAt: this.date(this.bosses.length + 150),
        updatedAt: this.date(this.bosses.length + 150),
      }));
      const originalSave = repository.save;
      repository.save = async (value: GuildBoss | GuildBoss[]) => {
        if (this.failNextBossSaveWithDuplicate && !Array.isArray(value)) {
          this.failNextBossSaveWithDuplicate = false;
          this.bosses.push({
            ...value,
            id: this.bosses.length + 1,
          });
          throw { code: "ER_DUP_ENTRY" };
        }
        return originalSave(value as any);
      };
      return repository;
    }
    if (entity === GuildBossChallenge) {
      return this.createArrayRepository(this.bossChallenges, "id", () => ({
        createdAt: this.date(this.bossChallenges.length + 180),
      }));
    }
    if (entity === GuildBossRewardClaim) {
      return this.createArrayRepository(this.bossRewardClaims, "id", () => ({
        createdAt: this.date(this.bossRewardClaims.length + 210),
      }));
    }
    if (entity === SystemConfig) {
      return this.createArrayRepository(this.configs, "id", () => ({
        updatedAt: this.date(this.configs.length + 240),
      }));
    }
    if (entity === DropItem) {
      return this.createArrayRepository(this.dropItems, "id");
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
      count: async (options?: any) =>
        items.filter((item) =>
          this.matchesWhereOption(item, options?.where || {}),
        ).length,
      create: (value: Partial<T>) =>
        ({
          ...(defaults?.() || {}),
          ...value,
        }) as T,
      save: async (value: T | T[]) => {
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
      value.updatedAt = this.date(500);
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

  private date(offsetSeconds: number) {
    return new Date(`2026-01-01T00:${String(offsetSeconds % 60).padStart(2, "0")}:00.000Z`);
  }
}

function createUser(uid: string, point = 10000): User {
  return {
    id: uid === "u1" ? 1 : uid === "u2" ? 2 : uid === "u3" ? 3 : 4,
    uid,
    name: `name-${uid}`,
    nickname: `玩家${uid}`,
    avatar: `https://example.com/${uid}.png`,
    point,
    card_count_n: 0,
    card_count_r: 0,
    card_count_sr: 0,
    card_count_ssr: 0,
    card_count_ur: 0,
    is_admin: false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  } as User;
}

function createFormation(power = 18000) {
  return {
    slotCount: 3,
    totalPower: power,
    slots: [
      {
        position: 1,
        card: {
          uuid: "c1",
          cardId: 1,
          cardName: "攻击卡",
          cardLevel: "SSR",
          battleRole: "attack",
          power,
          basePower: power,
          potentialPower: 0,
          potentialGrade: "C",
        },
      },
      { position: 2, card: null },
      { position: 3, card: null },
    ],
  };
}

function createService(store: GuildsTestStore, power = 18000) {
  const formationService = {
    getFormation: jest.fn(async () => createFormation(power)),
  };
  const rewardService = {
    grantRewards: jest.fn(async (manager: GuildsTestStore, user: User, rewards: any) => {
      user.point = Number(user.point || 0) + Number(rewards.points || 0);
      await manager.getRepository(User).save(user as any);
    }),
  };
  const pointLedgerService = {
    applyChange: jest.fn(async (manager: GuildsTestStore, user: User, amount: number) => {
      const next = Number(user.point || 0) + Number(amount || 0);
      if (next < 0) {
        throw new Error("余额不足");
      }
      user.point = next;
      await manager.getRepository(User).save(user as any);
      return { id: 1 };
    }),
  };
  const service = new GuildsService(
    store as any,
    formationService as any,
    rewardService as any,
    pointLedgerService as any,
  );
  return { service, formationService, rewardService, pointLedgerService };
}

async function createGuild(service: GuildsService, uid = "u1", name = "星海会") {
  return service.createGuild(uid, name, "一起收集");
}

describe("GuildsService 公会玩法", () => {
  let store: GuildsTestStore;
  let service: GuildsService;
  let rewardService: { grantRewards: jest.Mock };
  let pointLedgerService: { applyChange: jest.Mock };

  beforeEach(() => {
    store = new GuildsTestStore();
    store.users = [
      createUser("u1"),
      createUser("u2"),
      createUser("u3"),
      createUser("u4"),
    ];
    const created = createService(store);
    service = created.service;
    rewardService = created.rewardService;
    pointLedgerService = created.pointLedgerService;
  });

  it("创建公会后带默认成长字段和会长", async () => {
    const result = await createGuild(service);

    expect(result.current?.guild).toMatchObject({
      name: "星海会",
      level: 1,
      exp: 0,
      fund: 0,
      memberLimit: 20,
      joinMode: "open",
      role: "leader",
    });
    expect(result.current?.members[0]).toMatchObject({
      uid: "u1",
      role: "leader",
      totalContribution: 0,
    });
    expect(result.current?.boss?.name).toBe("星渊守卫");
  });

  it("审批加入会创建申请且不会直接入会", async () => {
    await createGuild(service);
    await service.updateSettings("u1", { joinMode: "approval" });

    const result = await service.joinGuild("u2", 1);

    expect(result.current).toBeNull();
    expect(result.applied).toBe(true);
    expect(store.requests).toHaveLength(1);
    expect(store.requests[0]).toMatchObject({
      guild_id: 1,
      uid: "u2",
      status: "pending",
      pending_key: "pending",
    });
    expect(store.members.map((member) => member.uid)).toEqual(["u1"]);
  });

  it("重复申请只保留一个待处理申请", async () => {
    await createGuild(service);
    await service.updateSettings("u1", { joinMode: "approval" });

    await service.joinGuild("u2", 1);
    await expect(service.joinGuild("u2", 1)).rejects.toThrow("已申请");

    const pendingRequests = store.requests.filter(
      (request) => request.status === "pending",
    );
    expect(pendingRequests).toHaveLength(1);
    expect(pendingRequests[0].pending_key).toBe("pending");
  });

  it("申请唯一键冲突后返回已申请", async () => {
    await createGuild(service);
    await service.updateSettings("u1", { joinMode: "approval" });
    store.failNextRequestSaveWithDuplicate = true;

    await expect(service.joinGuild("u2", 1)).rejects.toThrow("已申请");

    expect(
      store.requests.filter((request) => request.status === "pending"),
    ).toHaveLength(1);
  });

  it("批准申请后加入公会，满员时拒绝批准", async () => {
    await createGuild(service);
    await service.updateSettings("u1", { joinMode: "approval" });
    await service.joinGuild("u2", 1);

    await service.approveJoinRequest("u1", 1);

    expect(store.requests[0].status).toBe("approved");
    expect(store.requests[0].pending_key).toBeNull();
    expect(store.members.map((member) => member.uid)).toEqual(["u1", "u2"]);

    store.guilds[0].member_limit = 2;
    store.guilds[0].member_count = 2;
    await service.joinGuild("u3", 1);
    await expect(service.approveJoinRequest("u1", 2)).rejects.toThrow("人数已满");
  });

  it("加入公会后取消其他待处理申请", async () => {
    await createGuild(service, "u1", "星海会");
    await service.updateSettings("u1", { joinMode: "approval" });
    await createGuild(service, "u3", "月影会");
    await service.updateSettings("u3", { joinMode: "approval" });
    await createGuild(service, "u4", "晨星会");

    await service.joinGuild("u2", 1);
    await service.joinGuild("u2", 2);
    await service.joinGuild("u2", 3);

    expect(store.members.some((member) => member.uid === "u2")).toBe(true);
    expect(store.requests.map((request) => request.status)).toEqual([
      "canceled",
      "canceled",
    ]);
    expect(store.requests.every((request) => request.pending_key === null)).toBe(
      true,
    );
  });

  it("申请人已加入其他公会时审批会取消申请", async () => {
    await createGuild(service);
    await service.updateSettings("u1", { joinMode: "approval" });
    await service.joinGuild("u2", 1);
    store.members.push({
      id: 10,
      guild_id: 99,
      uid: "u2",
      role: "member",
      total_contribution: 0,
      weekly_contribution: 0,
      weekly_contribution_key: "2026-W01",
      daily_donate_count: 0,
      joinedAt: new Date("2026-01-01T00:00:00.000Z"),
    } as GuildMember);

    await expect(service.approveJoinRequest("u1", 1)).rejects.toThrow(
      "已加入公会",
    );

    expect(store.requests[0].status).toBe("canceled");
    expect(store.requests[0].pending_key).toBeNull();
  });

  it("签到每天一次，增加个人贡献、公会经验资金和星穹币", async () => {
    await createGuild(service);

    await service.checkIn("u1");

    expect(store.members[0].total_contribution).toBe(10);
    expect(store.guilds[0]).toMatchObject({ exp: 10, fund: 10 });
    expect(store.users[0].point).toBe(10010);
    expect(store.contributions[0]).toMatchObject({
      source_type: "check_in",
      contribution: 10,
      activity: 10,
    });
    expect(rewardService.grantRewards).toHaveBeenCalled();
    await expect(service.checkIn("u1")).rejects.toThrow("已签到");
  });

  it("捐献扣星穹币并限制每日次数", async () => {
    await createGuild(service);

    await service.donate("u1", 500);
    await service.donate("u1", 100);
    await service.donate("u1", 1000);

    expect(store.users[0].point).toBe(8400);
    expect(store.members[0].daily_donate_count).toBe(3);
    expect(store.members[0].total_contribution).toBe(185);
    expect(pointLedgerService.applyChange).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ uid: "u1" }),
      -500,
      expect.objectContaining({ sourceType: "guild_donate" }),
    );
    await expect(service.donate("u1", 100)).rejects.toThrow("次数已用完");
  });

  it("星穹币不足时捐献失败", async () => {
    store.users[0].point = 50;
    await createGuild(service);

    await expect(service.donate("u1", 100)).rejects.toThrow("余额不足");
  });

  it("经验达到阈值后自动升级并扩容", async () => {
    await createGuild(service);
    store.guilds[0].exp = 490;

    await service.checkIn("u1");

    expect(store.guilds[0].level).toBe(2);
    expect(store.guilds[0].exp).toBe(0);
    expect(store.guilds[0].member_limit).toBe(22);
  });

  it("会长可任命副会长，副会长只能移出普通成员", async () => {
    await createGuild(service);
    await service.joinGuild("u2", 1);
    await service.joinGuild("u3", 1);

    await service.promoteMember("u1", "u2");
    await service.kickMember("u2", "u3");

    expect(store.members.find((member) => member.uid === "u2")?.role).toBe(
      "officer",
    );
    expect(store.members.map((member) => member.uid)).toEqual(["u1", "u2"]);
    await expect(service.kickMember("u2", "u1")).rejects.toThrow("权限不足");
  });

  it("会长退出时最早加入的副会长继任", async () => {
    await createGuild(service);
    await service.joinGuild("u2", 1);
    await service.joinGuild("u3", 1);
    await service.promoteMember("u1", "u3");

    await service.leaveGuild("u1");

    expect(store.guilds[0].owner_uid).toBe("u3");
    expect(store.members.find((member) => member.uid === "u3")?.role).toBe(
      "leader",
    );
  });

  it("首领每日共享血量并限制挑战次数", async () => {
    await createGuild(service);
    await service.joinGuild("u2", 1);
    store.bosses[0].hp = 900000;

    const result = await service.challengeBoss("u1");

    expect(result.damage).toBeGreaterThan(0);
    expect(result.reward?.items).toEqual([
      expect.objectContaining({ itemName: "星核结晶", num: 5 }),
    ]);
    expect(store.bosses[0].hp).toBeLessThan(900000);
    expect(store.bossChallenges).toHaveLength(1);
    expect(store.members[0].total_contribution).toBe(20);
    expect(store.contributions[0]).toMatchObject({
      source_type: "boss",
      activity: 20,
    });
  });

  it("每日首领创建遇到唯一键冲突时重新读取", async () => {
    await createGuild(service);
    store.bosses = [];
    store.failNextBossSaveWithDuplicate = true;

    const result = await service.getOverview("u1");

    expect(result.current?.boss?.name).toBe("星渊守卫");
    expect(store.bosses).toHaveLength(1);
  });

  it("击败首领后当天造成伤害成员可领奖且只能一次", async () => {
    const created = createService(store, 50000);
    service = created.service;
    rewardService = created.rewardService;
    await createGuild(service);
    store.bosses[0].hp = 100;

    const challenge = await service.challengeBoss("u1");
    const claim = await service.claimBossReward("u1");

    expect(challenge.defeated).toBe(true);
    expect(store.guilds[0].fund).toBe(100);
    expect(store.members[0].total_contribution).toBe(50);
    expect(claim.reward?.points).toBe(100);
    expect(claim.reward?.items).toEqual([
      expect.objectContaining({ itemName: "星核结晶", num: 20 }),
    ]);
    expect(store.bossRewardClaims).toHaveLength(1);
    expect(rewardService.grantRewards).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ uid: "u1" }),
      expect.objectContaining({ points: 100 }),
      expect.objectContaining({ sourceType: "guild_boss" }),
    );
    await expect(service.claimBossReward("u1")).rejects.toThrow("已领取");
  });

  it("活跃箱要求当天贡献且不可重复领取", async () => {
    await createGuild(service);
    await service.checkIn("u1");
    await service.donate("u1", 1000);

    const result = await service.claimActivityChest("u1", 100);

    expect(result.reward?.points).toBe(20);
    expect(result.reward?.items).toEqual([
      expect.objectContaining({ itemName: "星核结晶", num: 5 }),
    ]);
    expect(store.chestClaims).toHaveLength(1);
    await expect(service.claimActivityChest("u1", 100)).rejects.toThrow(
      "已领取",
    );
  });

  it("跨周后本周贡献重置并重新累加", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-05T00:00:00.000Z"));
    try {
      await createGuild(service);
      store.members[0].weekly_contribution = 999;
      store.members[0].weekly_contribution_key = "2025-W52";

      await service.donate("u1", 100);

      expect(store.members[0].weekly_contribution).toBe(10);
      expect(store.members[0].weekly_contribution_key).toBe("2026-W02");
      expect(store.members[0].total_contribution).toBe(10);
    } finally {
      jest.useRealTimers();
    }
  });

  it("最后一名成员退出后清理公会关联数据", async () => {
    const created = createService(store, 50000);
    service = created.service;
    rewardService = created.rewardService;
    await createGuild(service);
    await service.sendMessage("u1", "大家好");
    await service.checkIn("u1");
    await service.donate("u1", 1000);
    store.bosses[0].hp = 100;
    await service.challengeBoss("u1");
    await service.claimBossReward("u1");
    await service.claimActivityChest("u1", 100);

    await service.leaveGuild("u1");

    expect(store.guilds).toHaveLength(0);
    expect(store.members).toHaveLength(0);
    expect(store.messages).toHaveLength(0);
    expect(store.requests).toHaveLength(0);
    expect(store.contributions).toHaveLength(0);
    expect(store.chestClaims).toHaveLength(0);
    expect(store.bosses).toHaveLength(0);
    expect(store.bossChallenges).toHaveLength(0);
    expect(store.bossRewardClaims).toHaveLength(0);
  });

  it("公会列表按等级、成员、更新时间和编号排序", async () => {
    await createGuild(service, "u1", "星海会");
    await createGuild(service, "u2", "月影会");
    store.guilds[0].level = 2;
    store.guilds[0].member_count = 1;
    store.guilds[1].level = 3;
    store.guilds[1].member_count = 1;

    const result = await service.listGuilds("u3");

    expect(result.list.map((guild) => guild.name)).toEqual(["月影会", "星海会"]);
  });

  it("消息仍按时间倒序读取", async () => {
    await createGuild(service);
    await service.joinGuild("u2", 1);

    await service.sendMessage("u1", "大家好");
    await service.sendMessage("u2", "一起打");
    const messages = await service.listMessages("u1");

    expect(messages.list.map((message) => message.content)).toEqual([
      "一起打",
      "大家好",
    ]);
  });
});
