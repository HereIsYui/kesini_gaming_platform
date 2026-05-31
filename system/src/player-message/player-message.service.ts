import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { FindOptionsWhere, In, Like, Repository } from "typeorm";
import { PlayerMessage } from "src/entity/playerMessage.entity";
import { PlayerMessageRead } from "src/entity/playerMessageRead.entity";
import { User } from "src/entity/user.entity";

interface PageQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
}

@Injectable()
export class PlayerMessageService {
  constructor(
    @InjectRepository(PlayerMessage)
    private readonly messageRepository: Repository<PlayerMessage>,
    @InjectRepository(PlayerMessageRead)
    private readonly readRepository: Repository<PlayerMessageRead>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async listMine(uid: string) {
    const normalizedUid = this.normalizeUid(uid);
    const list = await this.messageRepository.find({
      where: [
        { target_uid: "", enabled: true, delete_flag: false },
        { target_uid: normalizedUid, enabled: true, delete_flag: false },
      ],
      order: { id: "DESC" } as any,
      take: 50,
    });
    const readIds = await this.getReadIds(
      normalizedUid,
      list.map((item) => item.id),
    );
    const rows = list.map((item) => this.toPlayerView(item, readIds));
    return {
      list: rows,
      unread: rows.filter((item) => !item.read).length,
    };
  }

  async markRead(uid: string, id: number) {
    const normalizedUid = this.normalizeUid(uid);
    const message = await this.getVisibleForUser(normalizedUid, id);
    const existing = await this.readRepository.findOne({
      where: { uid: normalizedUid, message_id: message.id },
    });
    if (!existing) {
      await this.readRepository.save(
        this.readRepository.create({
          uid: normalizedUid,
          message_id: message.id,
        }),
      );
    }
    return { read: true };
  }

  async listAdmin(query: PageQuery) {
    const { page, pageSize } = this.normalizePage(query);
    const keyword = String(query.keyword || "").trim();
    const baseWhere = { delete_flag: false };
    const where: FindOptionsWhere<PlayerMessage> | FindOptionsWhere<PlayerMessage>[] =
      keyword
        ? [
            { ...baseWhere, title: Like(`%${keyword}%`) },
            { ...baseWhere, content: Like(`%${keyword}%`) },
            { ...baseWhere, target_uid: Like(`%${keyword}%`) },
          ]
        : baseWhere;
    const [list, total] = await this.messageRepository.findAndCount({
      where,
      order: { id: "DESC" } as any,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return {
      list: await this.decorateAdminList(list),
      total,
      page,
      pageSize,
    };
  }

  async getAdmin(id: number) {
    const message = await this.messageRepository.findOne({ where: { id } });
    if (!message || message.delete_flag === true) {
      throw new Error("消息不存在");
    }
    return this.decorateAdmin(message);
  }

  async createAdmin(input: Partial<PlayerMessage>) {
    const message = this.messageRepository.create({
      ...(await this.normalizeInput(input, true)),
      delete_flag: false,
    });
    return this.decorateAdmin(await this.messageRepository.save(message));
  }

  async updateAdmin(id: number, input: Partial<PlayerMessage>) {
    const message = await this.messageRepository.findOne({ where: { id } });
    if (!message || message.delete_flag === true) {
      throw new Error("消息不存在");
    }
    Object.assign(message, await this.normalizeInput(input, false, message));
    return this.decorateAdmin(await this.messageRepository.save(message));
  }

  async deleteAdmin(id: number) {
    const message = await this.messageRepository.findOne({ where: { id } });
    if (!message || message.delete_flag === true) {
      throw new Error("消息不存在");
    }
    message.enabled = false;
    message.delete_flag = true;
    await this.messageRepository.save(message);
    return { deleted: true };
  }

  private async getVisibleForUser(uid: string, id: number) {
    const message = await this.messageRepository.findOne({ where: { id } });
    if (
      !message ||
      message.delete_flag === true ||
      message.enabled !== true ||
      !this.canRead(uid, message)
    ) {
      throw new Error("消息不存在");
    }
    return message;
  }

  private canRead(uid: string, message: PlayerMessage) {
    return !message.target_uid || message.target_uid === uid;
  }

  private async normalizeInput(
    input: Partial<PlayerMessage>,
    creating: boolean,
    current?: PlayerMessage,
  ) {
    const next: Partial<PlayerMessage> = {};
    if (creating || input.title !== undefined) {
      next.title = this.normalizeTitle(input.title);
    }
    if (creating || input.content !== undefined) {
      next.content = this.normalizeContent(input.content);
    }
    if (creating || input.target_uid !== undefined) {
      next.target_uid = await this.resolveTargetUid(input.target_uid);
    } else if (creating) {
      next.target_uid = "";
    }
    if (creating || input.enabled !== undefined) {
      next.enabled =
        input.enabled === undefined || input.enabled === null
          ? (current?.enabled ?? true)
          : input.enabled === true;
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
    if (text.length > 240) {
      throw new Error("内容最多 240 字");
    }
    return text;
  }

  private normalizeUid(value: unknown) {
    const text = String(value || "").trim();
    if (!text) {
      throw new Error("请先登录");
    }
    return text;
  }

  private async resolveTargetUid(value: unknown) {
    const text = String(value || "").trim();
    if (!text) {
      return "";
    }
    const user = await this.userRepository.findOne({
      where: [{ uid: text }, { public_id: text }],
    } as any);
    if (!user) {
      throw new Error("玩家不存在");
    }
    return user.uid;
  }

  private async getReadIds(uid: string, messageIds: number[]) {
    if (messageIds.length === 0) {
      return new Set<number>();
    }
    const reads = await this.readRepository.find({
      where: { uid, message_id: In(messageIds) },
    });
    return new Set(reads.map((item) => item.message_id));
  }

  private toPlayerView(item: PlayerMessage, readIds: Set<number>) {
    return {
      id: item.id,
      title: item.title,
      content: item.content,
      read: readIds.has(item.id),
      createdAt: item.createdAt?.toISOString?.() || item.createdAt || null,
    };
  }

  private async decorateAdminList(list: PlayerMessage[]) {
    const userMap = await this.getUserMap(list.map((item) => item.target_uid));
    return list.map((item) => this.toAdminView(item, userMap));
  }

  private async decorateAdmin(message: PlayerMessage) {
    const userMap = await this.getUserMap([message.target_uid]);
    return this.toAdminView(message, userMap);
  }

  private async getUserMap(uids: string[]) {
    const values = [...new Set(uids.filter(Boolean))];
    if (values.length === 0) {
      return new Map<string, User>();
    }
    const users = await this.userRepository.find({ where: { uid: In(values) } });
    return new Map(users.map((user) => [user.uid, user]));
  }

  private toAdminView(item: PlayerMessage, userMap: Map<string, User>) {
    const user = item.target_uid ? userMap.get(item.target_uid) : null;
    return {
      ...item,
      targetName: item.target_uid
        ? user?.nickname || user?.name || item.target_uid
        : "全体玩家",
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
