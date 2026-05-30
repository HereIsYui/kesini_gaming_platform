import { Like } from "typeorm";
import { Announcement } from "src/entity/announcement.entity";
import { AnnouncementService } from "./announcement.service";

class AnnouncementRepository {
  rows: Announcement[] = [];
  nextId = 1;

  async find(options?: any) {
    let result = this.rows.filter((item) =>
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

  create(value: Partial<Announcement>) {
    return {
      id: this.nextId++,
      title: "",
      content: "",
      enabled: true,
      sort_order: 0,
      starts_at: null,
      ends_at: null,
      delete_flag: false,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      ...value,
    } as Announcement;
  }

  async save(value: Announcement) {
    value.updatedAt = new Date("2026-01-02T00:00:00.000Z");
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
        const operator = expected as ReturnType<typeof Like> & {
          _type?: string;
          _value?: string;
        };
        if (operator._type === "like") {
          const pattern = String(operator._value || "").replace(/%/g, "");
          return String(actual || "").includes(pattern);
        }
      }
      return actual === expected;
    });
  }
}

describe("AnnouncementService 公告栏", () => {
  let repository: AnnouncementRepository;
  let service: AnnouncementService;

  beforeEach(() => {
    repository = new AnnouncementRepository();
    service = new AnnouncementService(repository as any);
  });

  it("创建并返回后台公告列表", async () => {
    await service.createAdmin({
      title: "维护公告",
      content: "今晚维护",
      sort_order: 2,
      enabled: true,
    });

    const result = await service.listAdmin({ page: 1, pageSize: 20 });

    expect(result.total).toBe(1);
    expect(result.list[0]).toMatchObject({
      title: "维护公告",
      content: "今晚维护",
      enabled: true,
    });
  });

  it("公开列表返回已开始公告并标记当前状态", async () => {
    await service.createAdmin({ title: "当前公告", content: "奖励已发" });
    await service.createAdmin({
      title: "未开始",
      content: "稍后开放",
      starts_at: "2026-02-01T00:00:00.000Z" as any,
    });
    await service.createAdmin({
      title: "已结束",
      content: "活动结束",
      ends_at: "2025-12-31T00:00:00.000Z" as any,
    });
    await service.createAdmin({
      title: "已停用",
      content: "不展示",
      enabled: false,
    });

    const result = await service.listPublic(
      new Date("2026-01-15T00:00:00.000Z"),
    );

    expect(result.list).toEqual([
      expect.objectContaining({
        id: 3,
        title: "已结束",
        content: "活动结束",
        active: false,
      }),
      expect.objectContaining({
        id: 1,
        title: "当前公告",
        content: "奖励已发",
        active: true,
      }),
    ]);
  });

  it("校验标题、内容和时间范围", async () => {
    await expect(
      service.createAdmin({ title: "A", content: "内容" }),
    ).rejects.toThrow("标题需 2-24 字");
    await expect(
      service.createAdmin({ title: "标题", content: "" }),
    ).rejects.toThrow("内容不能为空");
    await expect(
      service.createAdmin({
        title: "标题",
        content: "内容",
        starts_at: "2026-02-01T00:00:00.000Z" as any,
        ends_at: "2026-01-01T00:00:00.000Z" as any,
      }),
    ).rejects.toThrow("结束时间需晚于开始时间");
  });

  it("删除公告后公开和后台列表都不返回", async () => {
    const announcement = await service.createAdmin({
      title: "临时公告",
      content: "稍后删除",
    });

    await service.deleteAdmin(announcement.id);

    expect((await service.listPublic()).list).toEqual([]);
    expect((await service.listAdmin({})).list).toEqual([]);
  });
});
