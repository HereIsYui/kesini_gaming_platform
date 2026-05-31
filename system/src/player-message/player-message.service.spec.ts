import { In, Like } from "typeorm";
import { PlayerMessage } from "src/entity/playerMessage.entity";
import { PlayerMessageRead } from "src/entity/playerMessageRead.entity";
import { User } from "src/entity/user.entity";
import { PlayerMessageService } from "./player-message.service";

class ArrayRepository<T extends Record<string, any>> {
  rows: T[] = [];
  nextId = 1;

  constructor(private readonly factory: (value: Partial<T>, id: number) => T) {}

  async find(options?: any) {
    let result = this.rows.filter((item) =>
      this.matchesWhereOption(item, options?.where || {}),
    );
    if (options?.order) {
      result = [...result].sort((left, right) =>
        this.compareByOrder(left, right, options.order),
      );
    }
    if (Number.isInteger(options?.skip)) {
      result = result.slice(options.skip);
    }
    if (Number.isInteger(options?.take)) {
      result = result.slice(0, options.take);
    }
    return result;
  }

  async findAndCount(options?: any) {
    const result = await this.find(options);
    return [result, result.length] as const;
  }

  async findOne(options?: any) {
    return (
      this.rows.find((item) =>
        this.matchesWhereOption(item, options?.where || {}),
      ) || null
    );
  }

  create(value: Partial<T>) {
    return this.factory(value, this.nextId++);
  }

  async save(value: T) {
    const index = this.rows.findIndex((item) => item.id === value.id);
    if (index >= 0) {
      this.rows[index] = value;
    } else {
      this.rows.push(value);
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
      if (expected && typeof expected === "object" && "_type" in expected) {
        const operator = expected as ReturnType<typeof Like> &
          ReturnType<typeof In> & {
            _type?: string;
            _value?: string | unknown[];
          };
        if (operator._type === "like") {
          const pattern = String(operator._value || "").replace(/%/g, "");
          return String(actual || "").includes(pattern);
        }
        if (operator._type === "in") {
          return Array.isArray(operator._value)
            ? operator._value.includes(actual)
            : false;
        }
      }
      return actual === expected;
    });
  }
}

function createMessage(value: Partial<PlayerMessage>, id: number) {
  return {
    id,
    title: "",
    content: "",
    target_uid: "",
    rewards: null,
    enabled: true,
    delete_flag: false,
    createdAt: new Date(`2026-01-${String(id).padStart(2, "0")}T00:00:00.000Z`),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...value,
  } as PlayerMessage;
}

function createRead(value: Partial<PlayerMessageRead>, id: number) {
  return {
    id,
    uid: "",
    message_id: 0,
    claimed_at: null,
    reward_snapshot: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...value,
  } as PlayerMessageRead;
}

function createUser(value: Partial<User>, id: number) {
  return {
    id,
    uid: "",
    public_id: null,
    name: "",
    nickname: "",
    avatar: "",
    point: 0,
    card_count_n: 0,
    card_count_r: 0,
    card_count_sr: 0,
    card_count_ssr: 0,
    card_count_ur: 0,
    is_admin: false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...value,
  } as User;
}

describe("PlayerMessageService 玩家消息", () => {
  let messages: ArrayRepository<PlayerMessage>;
  let reads: ArrayRepository<PlayerMessageRead>;
  let users: ArrayRepository<User>;
  let dataSource: { getRepository: jest.Mock; transaction: jest.Mock };
  let rewardService: {
    normalizeRewards: jest.Mock;
    assertRewardItemsAvailable: jest.Mock;
    assertRewardCardsAvailable: jest.Mock;
    grantRewards: jest.Mock;
  };
  let service: PlayerMessageService;

  beforeEach(() => {
    messages = new ArrayRepository<PlayerMessage>(createMessage);
    reads = new ArrayRepository<PlayerMessageRead>(createRead);
    users = new ArrayRepository<User>(createUser);
    users.rows.push(
      createUser({ uid: "u1", public_id: "p1", nickname: "玩家一" }, 1),
      createUser({ uid: "u2", public_id: "p2", nickname: "玩家二" }, 2),
    );
    dataSource = {
      getRepository: jest.fn((entity) => getRepository(entity)),
      transaction: jest.fn((handler) =>
        handler({ getRepository: (entity: unknown) => getRepository(entity) }),
      ),
    };
    rewardService = {
      normalizeRewards: jest.fn((rewards) => rewards),
      assertRewardItemsAvailable: jest.fn(),
      assertRewardCardsAvailable: jest.fn(),
      grantRewards: jest.fn(),
    };
    service = new PlayerMessageService(
      messages as any,
      reads as any,
      users as any,
      dataSource as any,
      rewardService as any,
    );
  });

  function getRepository(entity: unknown) {
    const name = (entity as { name?: string })?.name;
    if (name === "PlayerMessage") {
      return messages;
    }
    if (name === "PlayerMessageRead") {
      return reads;
    }
    if (name === "User") {
      return users;
    }
    return new ArrayRepository<any>((value, id) => ({ id, ...value }));
  }

  it("返回全员和本人消息并统计未读", async () => {
    await service.createAdmin({ title: "全员消息", content: "奖励已发" });
    await service.createAdmin({
      title: "给二号",
      content: "只给二号",
      target_uid: "p2",
    });
    await service.createAdmin({
      title: "给一号",
      content: "只给一号",
      target_uid: "p1",
    });

    await service.markRead("u1", 1);
    const result = await service.listMine("u1");

    expect(result.unread).toBe(1);
    expect(result.list.map((item) => item.title)).toEqual(["给一号", "全员消息"]);
    expect(result.list[1].read).toBe(true);
  });

  it("领取消息奖励后标记已领取并发放奖励", async () => {
    const message = await service.createAdmin({
      title: "奖励消息",
      content: "奖励已发",
      rewards: { points: 30, items: [] },
    });

    const result = await service.claimReward("u1", message.id);
    const overview = await service.listMine("u1");

    expect(result).toEqual({
      claimed: true,
      rewards: { points: 30, items: [] },
    });
    expect(reads.rows[0]).toMatchObject({
      uid: "u1",
      message_id: message.id,
      reward_snapshot: { points: 30, items: [] },
    });
    expect(reads.rows[0].claimed_at).toBeInstanceOf(Date);
    expect(rewardService.grantRewards).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ uid: "u1" }),
      { points: 30, items: [] },
      expect.objectContaining({
        sourceType: "player_message",
        sourceId: message.id,
      }),
    );
    expect(overview.list[0]).toEqual(
      expect.objectContaining({
        read: true,
        claimed: true,
        hasReward: true,
      }),
    );
  });

  it("消息奖励只能领取一次", async () => {
    const message = await service.createAdmin({
      title: "奖励消息",
      content: "奖励已发",
      rewards: { points: 30, items: [] },
    });

    await service.claimReward("u1", message.id);

    await expect(service.claimReward("u1", message.id)).rejects.toThrow(
      "奖励已领取",
    );
  });

  it("无奖励消息不能领取", async () => {
    const message = await service.createAdmin({
      title: "普通消息",
      content: "只读消息",
    });
    rewardService.normalizeRewards.mockImplementationOnce(() => {
      throw new Error("消息没有奖励");
    });

    await expect(service.claimReward("u1", message.id)).rejects.toThrow(
      "没有可领取奖励",
    );
  });

  it("不能读取其他玩家定向消息", async () => {
    const message = await service.createAdmin({
      title: "定向消息",
      content: "只给二号",
      target_uid: "p2",
    });

    await expect(service.markRead("u1", message.id)).rejects.toThrow(
      "消息不存在",
    );
  });

  it("后台创建时校验收件玩家和内容", async () => {
    await expect(
      service.createAdmin({ title: "消息", content: "内容", target_uid: "none" }),
    ).rejects.toThrow("玩家不存在");
    await expect(
      service.createAdmin({ title: "A", content: "内容" }),
    ).rejects.toThrow("标题需 2-24 字");
    await expect(
      service.createAdmin({ title: "消息", content: "" }),
    ).rejects.toThrow("内容不能为空");
  });

  it("删除后玩家和后台都不返回", async () => {
    const message = await service.createAdmin({
      title: "临时消息",
      content: "稍后删除",
    });

    await service.deleteAdmin(message.id);

    expect((await service.listMine("u1")).list).toEqual([]);
    expect((await service.listAdmin({})).list).toEqual([]);
  });
});
