import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { FindOptionsWhere, Like, Repository } from "typeorm";
import { Announcement } from "src/entity/announcement.entity";

interface PageQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
}

@Injectable()
export class AnnouncementService {
  constructor(
    @InjectRepository(Announcement)
    private readonly announcementRepository: Repository<Announcement>,
  ) {}

  async listPublic(now = new Date()) {
    const rows = await this.announcementRepository.find({
      where: { enabled: true, delete_flag: false },
      order: { sort_order: "ASC", id: "DESC" } as any,
      take: 5,
    });
    return {
      list: rows
        .filter((item) => this.isVisibleNow(item, now))
        .map((item) => this.toPublicView(item)),
    };
  }

  async listAdmin(query: PageQuery) {
    const { page, pageSize } = this.normalizePage(query);
    const where: FindOptionsWhere<Announcement> | FindOptionsWhere<Announcement>[] =
      query.keyword
        ? [
            { title: Like(`%${query.keyword}%`), delete_flag: false },
            { content: Like(`%${query.keyword}%`), delete_flag: false },
          ]
        : { delete_flag: false };
    const [list, total] = await this.announcementRepository.findAndCount({
      where,
      order: { sort_order: "ASC", id: "DESC" } as any,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { list, total, page, pageSize };
  }

  async getAdmin(id: number) {
    const announcement = await this.announcementRepository.findOne({
      where: { id },
    });
    if (!announcement || announcement.delete_flag === true) {
      throw new Error("公告不存在");
    }
    return announcement;
  }

  async createAdmin(input: Partial<Announcement>) {
    const announcement = this.announcementRepository.create({
      ...this.normalizeInput(input, true),
      delete_flag: false,
    });
    this.assertTimeRange(announcement.starts_at, announcement.ends_at);
    return this.announcementRepository.save(announcement);
  }

  async updateAdmin(id: number, input: Partial<Announcement>) {
    const announcement = await this.getAdmin(id);
    Object.assign(announcement, this.normalizeInput(input, false, announcement));
    this.assertTimeRange(announcement.starts_at, announcement.ends_at);
    return this.announcementRepository.save(announcement);
  }

  async deleteAdmin(id: number) {
    const announcement = await this.getAdmin(id);
    announcement.enabled = false;
    announcement.delete_flag = true;
    await this.announcementRepository.save(announcement);
    return { deleted: true };
  }

  private normalizeInput(
    input: Partial<Announcement>,
    creating: boolean,
    current?: Announcement,
  ) {
    const next: Partial<Announcement> = {};
    if (creating || input.title !== undefined) {
      next.title = this.normalizeTitle(input.title);
    }
    if (creating || input.content !== undefined) {
      next.content = this.normalizeContent(input.content);
    }
    if (creating || input.enabled !== undefined) {
      next.enabled =
        input.enabled === undefined || input.enabled === null
          ? (current?.enabled ?? true)
          : input.enabled === true;
    }
    if (creating || input.sort_order !== undefined) {
      next.sort_order = this.normalizeInteger(input.sort_order, 0);
    }
    if (creating || input.starts_at !== undefined) {
      next.starts_at = this.parseOptionalDate(input.starts_at);
    }
    if (creating || input.ends_at !== undefined) {
      next.ends_at = this.parseOptionalDate(input.ends_at);
    }
    return next;
  }

  private normalizeTitle(value: unknown) {
    const text = String(value || "").trim();
    if (text.length < 2 || text.length > 24) {
      throw new Error("标题需 2-24 字");
    }
    return text;
  }

  private normalizeContent(value: unknown) {
    const text = String(value || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) {
      throw new Error("内容不能为空");
    }
    if (text.length > 80) {
      throw new Error("内容最多 80 字");
    }
    return text;
  }

  private normalizeInteger(value: unknown, fallback: number) {
    if (value === undefined || value === null || value === "") {
      return fallback;
    }
    const numberValue = Number(value);
    if (!Number.isInteger(numberValue) || numberValue < 0) {
      throw new Error("排序无效");
    }
    return numberValue;
  }

  private parseOptionalDate(value: unknown) {
    if (value === undefined || value === null || value === "") {
      return null;
    }
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) {
      throw new Error("时间无效");
    }
    return date;
  }

  private assertTimeRange(start?: Date | null, end?: Date | null) {
    if (start && end && start.getTime() > end.getTime()) {
      throw new Error("结束时间需晚于开始时间");
    }
  }

  private isVisibleNow(item: Announcement, now: Date) {
    const current = now.getTime();
    if (item.starts_at && item.starts_at.getTime() > current) {
      return false;
    }
    if (item.ends_at && item.ends_at.getTime() < current) {
      return false;
    }
    return true;
  }

  private toPublicView(item: Announcement) {
    return {
      id: item.id,
      title: item.title,
      content: item.content,
    };
  }

  private normalizePage(query: PageQuery) {
    const page = Number(query.page || 1);
    const pageSize = Number(query.pageSize || 20);
    return {
      page: Number.isInteger(page) && page > 0 ? page : 1,
      pageSize:
        Number.isInteger(pageSize) && pageSize > 0
          ? Math.min(pageSize, 100)
          : 20,
    };
  }
}
