import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, FindOptionsWhere, In, Like, Repository } from "typeorm";
import { CardItem } from "src/entity/card.entity";
import { DropItem } from "src/entity/drop.entity";
import { PlayerMessage } from "src/entity/playerMessage.entity";
import { PlayerMessageRead } from "src/entity/playerMessageRead.entity";
import { RedeemRewards } from "src/entity/redeemCode.entity";
import { User } from "src/entity/user.entity";
import { RewardService } from "src/reward/reward.service";

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
    private readonly dataSource: DataSource,
    private readonly rewardService: RewardService,
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
    const readMap = await this.getReadMap(
      normalizedUid,
      list.map((item) => item.id),
    );
    const rows = list.map((item) => this.toPlayerView(item, readMap));
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

  async claimReward(uid: string, id: number) {
    const normalizedUid = this.normalizeUid(uid);
    return this.dataSource.transaction(async (manager) => {
      const messageRepository = manager.getRepository(PlayerMessage);
      const readRepository = manager.getRepository(PlayerMessageRead);
      const userRepository = manager.getRepository(User);
      const message = await messageRepository.findOne({ where: { id } });
      if (
        !message ||
        message.delete_flag === true ||
        message.enabled !== true ||
        !this.canRead(normalizedUid, message)
      ) {
        throw new Error("消息不存在");
      }
      const rewards = this.normalizeMessageRewards(message.rewards);
      let read = await readRepository.findOne({
        where: { uid: normalizedUid, message_id: message.id },
        lock: { mode: "pessimistic_write" },
      });
      if (read?.claimed_at) {
        throw new Error("奖励已领取");
      }
      const user = await userRepository.findOne({
        where: { uid: normalizedUid },
        lock: { mode: "pessimistic_write" },
      });
      if (!user) {
        throw new Error("玩家不存在");
      }
      await this.rewardService.assertRewardItemsAvailable(
        manager.getRepository(DropItem),
        rewards.items,
      );
      await this.rewardService.assertRewardCardsAvailable(
        manager.getRepository(CardItem),
        rewards.cards || [],
      );
      if (!read) {
        read = readRepository.create({
          uid: normalizedUid,
          message_id: message.id,
        });
      }
      read.claimed_at = new Date();
      read.reward_snapshot = this.cloneRewards(rewards);
      await readRepository.save(read);
      await this.rewardService.grantRewards(manager, user, rewards, {
        sourceType: "player_message",
        sourceId: message.id,
        title: `消息奖励：${message.title}`,
        metadata: { messageId: message.id, title: message.title },
      });
      return {
        claimed: true,
        rewards,
      };
    });
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
    if (creating || input.rewards !== undefined) {
      next.rewards = await this.normalizeOptionalRewards(input.rewards);
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

  private async normalizeOptionalRewards(value: unknown) {
    if (value === undefined || value === null || value === "") {
      return null;
    }
    if (this.isEmptyRewardInput(value)) {
      return null;
    }
    const rewards = this.rewardService.normalizeRewards(value, "奖励不能为空");
    await this.rewardService.assertRewardItemsAvailable(
      this.dataSource.getRepository(DropItem),
      rewards.items,
    );
    await this.rewardService.assertRewardCardsAvailable(
      this.dataSource.getRepository(CardItem),
      rewards.cards || [],
    );
    return rewards;
  }

  private isEmptyRewardInput(value: unknown) {
    const rewards = (value || {}) as Partial<RedeemRewards>;
    const points = Number(rewards.points || 0);
    const itemCount = Array.isArray(rewards.items)
      ? rewards.items.filter((item) => Number(item.itemId) > 0 || Number(item.num) > 0)
          .length
      : 0;
    const cardCount = Array.isArray(rewards.cards)
      ? rewards.cards.filter(
          (card) =>
            Number(card.cardId) > 0 ||
            Number(card.num) > 0 ||
            String(card.rarity || "").trim(),
        ).length
      : 0;
    return points === 0 && itemCount === 0 && cardCount === 0;
  }

  private normalizeMessageRewards(value: unknown) {
    try {
      return this.rewardService.normalizeRewards(value, "消息没有奖励");
    } catch (error) {
      if (error instanceof Error && error.message === "消息没有奖励") {
        throw new Error("没有可领取奖励");
      }
      throw error;
    }
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

  private async getReadMap(uid: string, messageIds: number[]) {
    if (messageIds.length === 0) {
      return new Map<number, PlayerMessageRead>();
    }
    const reads = await this.readRepository.find({
      where: { uid, message_id: In(messageIds) },
    });
    return new Map(reads.map((item) => [item.message_id, item]));
  }

  private toPlayerView(item: PlayerMessage, readMap: Map<number, PlayerMessageRead>) {
    const read = readMap.get(item.id);
    const rewards = this.getOptionalRewardsView(item.rewards);
    return {
      id: item.id,
      title: item.title,
      content: item.content,
      read: Boolean(read),
      claimed: Boolean(read?.claimed_at),
      hasReward: Boolean(rewards),
      rewards,
      createdAt: item.createdAt?.toISOString?.() || item.createdAt || null,
    };
  }

  private getOptionalRewardsView(rewards?: RedeemRewards | null) {
    if (!rewards) {
      return null;
    }
    try {
      return this.rewardService.normalizeRewards(rewards, "奖励不能为空");
    } catch {
      return null;
    }
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

  private cloneRewards(rewards: RedeemRewards): RedeemRewards {
    return JSON.parse(JSON.stringify(rewards)) as RedeemRewards;
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
