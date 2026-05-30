import { Injectable } from "@nestjs/common";
import { DataSource, EntityManager, In } from "typeorm";
import { Guild } from "src/entity/guild.entity";
import { GuildMember } from "src/entity/guildMember.entity";
import { GuildMessage } from "src/entity/guildMessage.entity";
import { User } from "src/entity/user.entity";

const GUILD_LIST_LIMIT = 30;
const DEFAULT_MESSAGE_LIMIT = 50;
const MAX_MESSAGE_LENGTH = 120;

@Injectable()
export class GuildsService {
  constructor(private readonly dataSource: DataSource) {}

  async getOverview(uid: string) {
    const normalizedUid = this.normalizeUid(uid);
    await this.findUser(this.dataSource, normalizedUid);

    const membership = await this.findMembership(this.dataSource, normalizedUid);
    const current = membership
      ? await this.getGuildWithMembers(
          this.dataSource,
          membership.guild_id,
          membership,
        )
      : null;
    const guilds = await this.listGuildRows(this.dataSource);

    return {
      current,
      guilds: guilds.map((guild) =>
        this.toGuildView(
          guild,
          membership?.guild_id === guild.id ? membership : null,
        ),
      ),
    };
  }

  async listGuilds(uid: string) {
    const normalizedUid = this.normalizeUid(uid);
    await this.findUser(this.dataSource, normalizedUid);
    const membership = await this.findMembership(this.dataSource, normalizedUid);
    const guilds = await this.listGuildRows(this.dataSource);

    return {
      list: guilds.map((guild) =>
        this.toGuildView(
          guild,
          membership?.guild_id === guild.id ? membership : null,
        ),
      ),
    };
  }

  async listMessages(uid: string, rawLimit = DEFAULT_MESSAGE_LIMIT) {
    const normalizedUid = this.normalizeUid(uid);
    const membership = await this.requireMembership(
      this.dataSource,
      normalizedUid,
    );
    const messages = await this.dataSource.getRepository(GuildMessage).find({
      where: { guild_id: membership.guild_id },
      order: { createdAt: "DESC", id: "DESC" } as any,
      take: this.normalizeMessageLimit(rawLimit),
    });

    return {
      list: await this.toMessageViews(
        this.dataSource,
        messages.reverse(),
      ),
    };
  }

  async sendMessage(uid: string, content: string) {
    const normalizedUid = this.normalizeUid(uid);
    const normalizedContent = this.normalizeMessageContent(content);

    await this.dataSource.transaction(async (manager) => {
      const membership = await this.requireMembership(manager, normalizedUid);
      const repository = manager.getRepository(GuildMessage);
      await repository.save(
        repository.create({
          guild_id: membership.guild_id,
          sender_uid: normalizedUid,
          content: normalizedContent,
        }),
      );
    });

    return this.listMessages(normalizedUid);
  }

  async createGuild(uid: string, name: string, description?: string) {
    const normalizedUid = this.normalizeUid(uid);
    const normalizedName = this.normalizeName(name);
    const normalizedDescription = this.normalizeDescription(description);

    await this.dataSource.transaction(async (manager) => {
      await this.findUser(manager, normalizedUid);
      await this.assertNotInGuild(manager, normalizedUid);

      const guildRepository = manager.getRepository(Guild);
      const existing = await guildRepository.findOne({
        where: { name: normalizedName },
        lock: { mode: "pessimistic_read" },
      });
      if (existing) {
        throw new Error("公会名已存在");
      }

      const guild = await guildRepository.save(
        guildRepository.create({
          name: normalizedName,
          description: normalizedDescription,
          owner_uid: normalizedUid,
          member_count: 1,
        }),
      );
      const memberRepository = manager.getRepository(GuildMember);
      await memberRepository.save(
        memberRepository.create({
          guild_id: guild.id,
          uid: normalizedUid,
          role: "leader",
        }),
      );
    });

    return this.getOverview(normalizedUid);
  }

  async joinGuild(uid: string, guildId: number) {
    const normalizedUid = this.normalizeUid(uid);
    const normalizedGuildId = this.normalizeGuildId(guildId);

    await this.dataSource.transaction(async (manager) => {
      await this.findUser(manager, normalizedUid);
      await this.assertNotInGuild(manager, normalizedUid);

      const guildRepository = manager.getRepository(Guild);
      const guild = await guildRepository.findOne({
        where: { id: normalizedGuildId },
        lock: { mode: "pessimistic_write" },
      });
      if (!guild) {
        throw new Error("公会不存在");
      }

      const memberRepository = manager.getRepository(GuildMember);
      await memberRepository.save(
        memberRepository.create({
          guild_id: guild.id,
          uid: normalizedUid,
          role: "member",
        }),
      );
      guild.member_count = Number(guild.member_count || 0) + 1;
      await guildRepository.save(guild);
    });

    return this.getOverview(normalizedUid);
  }

  async leaveGuild(uid: string) {
    const normalizedUid = this.normalizeUid(uid);

    await this.dataSource.transaction(async (manager) => {
      const memberRepository = manager.getRepository(GuildMember);
      const guildRepository = manager.getRepository(Guild);
      const membership = await memberRepository.findOne({
        where: { uid: normalizedUid },
        lock: { mode: "pessimistic_write" },
      });
      if (!membership) {
        throw new Error("尚未加入公会");
      }

      const guild = await guildRepository.findOne({
        where: { id: membership.guild_id },
        lock: { mode: "pessimistic_write" },
      });
      if (!guild) {
        await memberRepository.delete({ id: membership.id });
        return;
      }

      const members = await memberRepository.find({
        where: { guild_id: guild.id },
      });
      const remainingMembers = members
        .filter((member) => member.uid !== normalizedUid)
        .sort(
          (left, right) =>
            Number(left.joinedAt || 0) - Number(right.joinedAt || 0) ||
            Number(left.id || 0) - Number(right.id || 0),
        );

      await memberRepository.delete({ id: membership.id });

      if (remainingMembers.length === 0) {
        await guildRepository.delete({ id: guild.id });
        return;
      }

      if (membership.role === "leader") {
        const nextLeader = remainingMembers[0];
        nextLeader.role = "leader";
        guild.owner_uid = nextLeader.uid;
        await memberRepository.save(nextLeader);
      }
      guild.member_count = remainingMembers.length;
      await guildRepository.save(guild);
    });

    return this.getOverview(normalizedUid);
  }

  private async getGuildWithMembers(
    manager: DataSource | EntityManager,
    guildId: number,
    membership: GuildMember,
  ) {
    const guild = await manager.getRepository(Guild).findOne({
      where: { id: guildId },
    });
    if (!guild) {
      return null;
    }

    return {
      guild: this.toGuildView(guild, membership),
      members: await this.getMembers(manager, guild.id),
    };
  }

  private async getMembers(manager: DataSource | EntityManager, guildId: number) {
    const members = await manager.getRepository(GuildMember).find({
      where: { guild_id: guildId },
      order: { joinedAt: "ASC", id: "ASC" } as any,
    });
    if (members.length === 0) {
      return [];
    }

    const users = await manager.getRepository(User).find({
      where: { uid: In([...new Set(members.map((member) => member.uid))]) },
    });
    const userMap = new Map(users.map((user) => [user.uid, user]));

    return members.map((member) => {
      const user = userMap.get(member.uid);
      return {
        uid: member.uid,
        nickname: this.publicName(user, member.uid),
        avatar: user?.avatar || "",
        role: member.role,
        joinedAt: member.joinedAt,
      };
    });
  }

  private async toMessageViews(
    manager: DataSource | EntityManager,
    messages: GuildMessage[],
  ) {
    if (messages.length === 0) {
      return [];
    }

    const users = await manager.getRepository(User).find({
      where: {
        uid: In([...new Set(messages.map((message) => message.sender_uid))]),
      },
    });
    const userMap = new Map(users.map((user) => [user.uid, user]));

    return messages.map((message) => {
      const user = userMap.get(message.sender_uid);
      return {
        id: message.id,
        content: message.content,
        createdAt: message.createdAt,
        sender: {
          uid: message.sender_uid,
          nickname: this.publicName(user, message.sender_uid),
          avatar: user?.avatar || "",
        },
      };
    });
  }

  private async listGuildRows(manager: DataSource | EntityManager) {
    return manager.getRepository(Guild).find({
      order: { member_count: "DESC", updatedAt: "DESC", id: "ASC" } as any,
      take: GUILD_LIST_LIMIT,
    });
  }

  private async assertNotInGuild(
    manager: DataSource | EntityManager,
    uid: string,
  ) {
    const membership = await this.findMembership(manager, uid);
    if (membership) {
      throw new Error("已加入公会");
    }
  }

  private async requireMembership(
    manager: DataSource | EntityManager,
    uid: string,
  ) {
    const membership = await this.findMembership(manager, uid);
    if (!membership) {
      throw new Error("尚未加入公会");
    }
    return membership;
  }

  private async findMembership(
    manager: DataSource | EntityManager,
    uid: string,
  ) {
    return manager.getRepository(GuildMember).findOne({ where: { uid } });
  }

  private async findUser(manager: DataSource | EntityManager, uid: string) {
    const user = await manager.getRepository(User).findOne({ where: { uid } });
    if (!user) {
      throw new Error("玩家不存在");
    }
    return user;
  }

  private toGuildView(guild: Guild, membership?: GuildMember | null) {
    return {
      id: guild.id,
      name: guild.name,
      description: guild.description || "",
      memberCount: Number(guild.member_count || 0),
      role: membership?.role || null,
      joined: Boolean(membership),
      createdAt: guild.createdAt || null,
    };
  }

  private normalizeUid(uid: string) {
    const value = String(uid || "").trim();
    if (!value) {
      throw new Error("玩家不存在");
    }
    return value;
  }

  private normalizeGuildId(guildId: number) {
    const value = Number(guildId);
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error("公会不存在");
    }
    return value;
  }

  private normalizeName(name: string) {
    const value = String(name || "")
      .trim()
      .replace(/\s+/g, " ");
    if (value.length < 2 || value.length > 16) {
      throw new Error("公会名需 2-16 字");
    }
    if (!/^[\u4e00-\u9fa5A-Za-z0-9 _-]+$/.test(value)) {
      throw new Error("公会名格式错误");
    }
    return value;
  }

  private normalizeDescription(description?: string) {
    return String(description || "")
      .trim()
      .slice(0, 60);
  }

  private normalizeMessageLimit(value: number) {
    const limit = Number(value || DEFAULT_MESSAGE_LIMIT);
    if (!Number.isInteger(limit) || limit <= 0) {
      return DEFAULT_MESSAGE_LIMIT;
    }
    return Math.min(100, limit);
  }

  private normalizeMessageContent(content: string) {
    const value = String(content || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!value) {
      throw new Error("请输入消息");
    }
    if (value.length > MAX_MESSAGE_LENGTH) {
      throw new Error(`消息最多 ${MAX_MESSAGE_LENGTH} 字`);
    }
    return value;
  }

  private publicName(user: User | undefined, uid: string) {
    const nickname = String(user?.nickname || "").trim();
    const name = String(user?.name || "").trim();
    if (nickname && nickname !== uid) {
      return nickname;
    }
    if (name && name !== uid) {
      return name;
    }
    return "玩家";
  }
}
