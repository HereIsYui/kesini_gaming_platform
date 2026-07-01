import { Injectable } from "@nestjs/common";
import { DataSource, EntityManager, In, Repository } from "typeorm";
import { Guild } from "src/entity/guild.entity";
import { GuildActivityChestClaim } from "src/entity/guildActivityChestClaim.entity";
import { GuildBoss } from "src/entity/guildBoss.entity";
import { GuildBossChallenge } from "src/entity/guildBossChallenge.entity";
import { GuildBossRewardClaim } from "src/entity/guildBossRewardClaim.entity";
import { GuildContributionRecord } from "src/entity/guildContributionRecord.entity";
import {
  GuildJoinRequest,
  type GuildJoinRequestStatus,
} from "src/entity/guildJoinRequest.entity";
import { GuildMember, GuildMemberRole } from "src/entity/guildMember.entity";
import { GuildMessage } from "src/entity/guildMessage.entity";
import { RedeemRewards } from "src/entity/redeemCode.entity";
import { DropItem } from "src/entity/drop.entity";
import { SystemConfig } from "src/entity/systemConfig.entity";
import { User } from "src/entity/user.entity";
import { FormationService } from "src/formation/formation.service";
import { PointLedgerService } from "src/point-ledger/point-ledger.service";
import {
  PveBattleCard,
  PveBattleReport,
  PveBattleSimulator,
} from "src/pve/pve-battle-simulator";
import { RewardService } from "src/reward/reward.service";
import {
  ensureUsersPublicIds,
  getUserPublicId,
} from "src/utils/user-public-id";
import {
  DEFAULT_GUILD_CONFIG,
  GUILD_CONFIG_KEY,
  GuildConfig,
  normalizeGuildConfig,
} from "./guild.config";

const GUILD_LIST_LIMIT = 30;
const DEFAULT_MESSAGE_LIST_LIMIT = 30;
const MAX_MESSAGE_LIST_LIMIT = 30;
const MAX_MESSAGE_LENGTH = 120;
const MAX_ANNOUNCEMENT_LENGTH = 160;
const MAX_DESCRIPTION_LENGTH = 80;
const GUILD_BOSS_NAME = "星渊守卫";
const STAR_CORE_CRYSTAL_NAME = "星核结晶";
const BOSS_CHALLENGE_STAR_CORE_REWARD = 5;
const BOSS_DEFEAT_STAR_CORE_REWARD = 20;
const GUILD_EXP_THRESHOLDS = [
  500,
  1200,
  2400,
  4200,
  6800,
  10000,
  14000,
  19000,
  25000,
];
const DONATE_OPTIONS: Record<number, number> = {
  100: 10,
  500: 55,
  1000: 120,
};
const CHEST_REWARDS: Record<number, number> = {
  100: 20,
  300: 50,
  600: 100,
};
const CHEST_STAR_CORE_REWARDS: Record<number, number> = {
  100: 5,
  300: 15,
  600: 30,
};

type GuildManager = DataSource | EntityManager;

interface GuildSettingsInput {
  description?: string;
  announcement?: string;
  joinMode?: string;
}

@Injectable()
export class GuildsService {
  private readonly battleSimulator = new PveBattleSimulator();

  constructor(
    private readonly dataSource: DataSource,
    private readonly formationService: FormationService,
    private readonly rewardService: RewardService,
    private readonly pointLedgerService: PointLedgerService,
  ) {}

  async getOverview(uid: string) {
    const normalizedUid = this.normalizeUid(uid);
    await this.findUser(this.dataSource, normalizedUid);
    const config = await this.readConfig(this.dataSource);
    const dateKey = this.currentDateKey();

    const membership = await this.findMembership(this.dataSource, normalizedUid);
    const current = membership
      ? await this.getGuildWithMembers(
          this.dataSource,
          membership.guild_id,
          membership,
          dateKey,
          config,
        )
      : null;
    const guilds = await this.listGuildRows(this.dataSource);
    const pendingRequests = await this.findPendingRequestsForUser(
      this.dataSource,
      normalizedUid,
    );
    const pendingGuildIds = new Set(
      pendingRequests.map((request) => request.guild_id),
    );

    return {
      current,
      guilds: guilds.map((guild) =>
        this.toGuildView(
          guild,
          membership?.guild_id === guild.id ? membership : null,
          {
            nextLevelExp: this.getNextLevelExp(guild, config),
            applied: pendingGuildIds.has(guild.id),
          },
        ),
      ),
      pendingRequests: pendingRequests.map((request) =>
        this.toOwnRequestView(request),
      ),
    };
  }

  async listGuilds(uid: string) {
    const normalizedUid = this.normalizeUid(uid);
    await this.findUser(this.dataSource, normalizedUid);
    const config = await this.readConfig(this.dataSource);
    const membership = await this.findMembership(this.dataSource, normalizedUid);
    const pendingRequests = await this.findPendingRequestsForUser(
      this.dataSource,
      normalizedUid,
    );
    const pendingGuildIds = new Set(
      pendingRequests.map((request) => request.guild_id),
    );
    const guilds = await this.listGuildRows(this.dataSource);

    return {
      list: guilds.map((guild) =>
        this.toGuildView(
          guild,
          membership?.guild_id === guild.id ? membership : null,
          {
            nextLevelExp: this.getNextLevelExp(guild, config),
            applied: pendingGuildIds.has(guild.id),
          },
        ),
      ),
    };
  }

  async listMessages(uid: string, rawLimit = DEFAULT_MESSAGE_LIST_LIMIT) {
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
      list: await this.toMessageViews(this.dataSource, messages),
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
      const config = await this.readConfig(manager);
      this.assertGuildEnabled(config);
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
          announcement: "",
          owner_uid: normalizedUid,
          member_count: 1,
          level: 1,
          exp: 0,
          fund: 0,
          join_mode: "open",
          member_limit: config.baseMemberLimit,
        }),
      );
      const memberRepository = manager.getRepository(GuildMember);
      await memberRepository.save(
        memberRepository.create({
          guild_id: guild.id,
          uid: normalizedUid,
          role: "leader",
          total_contribution: 0,
          weekly_contribution: 0,
          weekly_contribution_key: this.currentWeekKey(),
          daily_donate_count: 0,
        }),
      );
      await this.cancelOtherPendingRequests(manager, normalizedUid);
    });

    return this.getOverview(normalizedUid);
  }

  async updateAnnouncement(uid: string, announcement?: string) {
    const normalizedUid = this.normalizeUid(uid);
    const normalizedAnnouncement = this.normalizeAnnouncement(announcement);

    await this.dataSource.transaction(async (manager) => {
      const membership = await this.requireMembership(manager, normalizedUid);
      this.assertCanEditAnnouncement(membership);
      const guild = await this.lockGuild(manager, membership.guild_id);
      guild.announcement = normalizedAnnouncement;
      await manager.getRepository(Guild).save(guild);
    });

    return this.getOverview(normalizedUid);
  }

  async updateSettings(uid: string, body: GuildSettingsInput) {
    const normalizedUid = this.normalizeUid(uid);

    await this.dataSource.transaction(async (manager) => {
      const membership = await this.requireMembership(manager, normalizedUid);
      if (membership.role !== "leader") {
        throw new Error("权限不足");
      }
      const guild = await this.lockGuild(manager, membership.guild_id);
      if (body.description !== undefined) {
        guild.description = this.normalizeDescription(body.description);
      }
      if (body.announcement !== undefined) {
        guild.announcement = this.normalizeAnnouncement(body.announcement);
      }
      if (body.joinMode !== undefined) {
        guild.join_mode = this.normalizeJoinMode(body.joinMode);
      }
      await manager.getRepository(Guild).save(guild);
    });

    return this.getOverview(normalizedUid);
  }

  async joinGuild(uid: string, guildId: number) {
    const normalizedUid = this.normalizeUid(uid);
    const normalizedGuildId = this.normalizeGuildId(guildId);
    let applied = false;

    await this.dataSource.transaction(async (manager) => {
      const config = await this.readConfig(manager);
      this.assertGuildEnabled(config);
      await this.findUser(manager, normalizedUid);
      await this.assertNotInGuild(manager, normalizedUid);

      const guild = await this.lockGuild(manager, normalizedGuildId);
      if (this.getGuildJoinMode(guild) === "approval") {
        await this.createJoinRequest(manager, guild, normalizedUid);
        applied = true;
        return;
      }

      await this.addMember(manager, guild, normalizedUid, "member", config);
    });

    return {
      ...(await this.getOverview(normalizedUid)),
      applied,
    };
  }

  async cancelJoinRequest(uid: string, requestId: number) {
    const normalizedUid = this.normalizeUid(uid);
    const normalizedRequestId = this.normalizeId(requestId, "申请不存在");

    await this.dataSource.transaction(async (manager) => {
      const request = await manager.getRepository(GuildJoinRequest).findOne({
        where: { id: normalizedRequestId },
        lock: { mode: "pessimistic_write" },
      });
      if (
        !request ||
        request.uid !== normalizedUid ||
        request.status !== "pending"
      ) {
        throw new Error("申请不存在");
      }
      await this.setJoinRequestStatus(manager, request, "canceled");
    });

    return this.getOverview(normalizedUid);
  }

  async approveJoinRequest(uid: string, requestId: number) {
    const reviewerUid = this.normalizeUid(uid);
    const normalizedRequestId = this.normalizeId(requestId, "申请不存在");
    let applicantAlreadyJoined = false;

    await this.dataSource.transaction(async (manager) => {
      const config = await this.readConfig(manager);
      const reviewer = await this.requireMembership(manager, reviewerUid);
      this.assertCanReview(reviewer);
      const request = await manager.getRepository(GuildJoinRequest).findOne({
        where: {
          id: normalizedRequestId,
          guild_id: reviewer.guild_id,
          status: "pending",
        },
        lock: { mode: "pessimistic_write" },
      });
      if (!request) {
        throw new Error("申请不存在");
      }
      const applicantMembership = await this.findMembership(manager, request.uid);
      if (applicantMembership) {
        request.reviewer_uid = reviewerUid;
        await this.setJoinRequestStatus(manager, request, "canceled");
        applicantAlreadyJoined = true;
        return;
      }
      const guild = await this.lockGuild(manager, request.guild_id);
      await this.addMember(
        manager,
        guild,
        request.uid,
        "member",
        config,
        request.id,
      );
      request.reviewer_uid = reviewerUid;
      await this.setJoinRequestStatus(manager, request, "approved");
      await this.cancelOtherPendingRequests(manager, request.uid, request.id);
    });

    if (applicantAlreadyJoined) {
      throw new Error("已加入公会");
    }

    return this.getOverview(reviewerUid);
  }

  async rejectJoinRequest(uid: string, requestId: number) {
    const reviewerUid = this.normalizeUid(uid);
    const normalizedRequestId = this.normalizeId(requestId, "申请不存在");

    await this.dataSource.transaction(async (manager) => {
      const reviewer = await this.requireMembership(manager, reviewerUid);
      this.assertCanReview(reviewer);
      const request = await manager.getRepository(GuildJoinRequest).findOne({
        where: {
          id: normalizedRequestId,
          guild_id: reviewer.guild_id,
          status: "pending",
        },
        lock: { mode: "pessimistic_write" },
      });
      if (!request) {
        throw new Error("申请不存在");
      }
      request.reviewer_uid = reviewerUid;
      await this.setJoinRequestStatus(manager, request, "rejected");
    });

    return this.getOverview(reviewerUid);
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
        .sort((left, right) => this.compareMembersForLeader(left, right));

      await memberRepository.delete({ id: membership.id });

      if (remainingMembers.length === 0) {
        await this.deleteGuildCascade(manager, guild.id);
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

  async checkIn(uid: string) {
    const normalizedUid = this.normalizeUid(uid);
    const dateKey = this.currentDateKey();

    await this.dataSource.transaction(async (manager) => {
      const config = await this.readConfig(manager);
      this.assertGuildEnabled(config);
      const { guild, member, user } = await this.requireGuildContext(
        manager,
        normalizedUid,
      );
      if (member.last_check_in_date === dateKey) {
        throw new Error("已签到");
      }
      member.last_check_in_date = dateKey;
      await this.applyGuildGrowth(manager, guild, member, 10, 10, config);
      await this.addContributionRecord(manager, {
        guildId: guild.id,
        uid: normalizedUid,
        dateKey,
        sourceType: "check_in",
        contribution: 10,
        activity: 10,
      });
      await this.rewardService.grantRewards(
        manager,
        user,
        this.pointsReward(config.checkInReward.points),
        {
          sourceType: "guild_check_in",
          sourceId: `${guild.id}:${dateKey}`,
          title: "公会签到",
          metadata: { guildId: guild.id, dateKey },
        },
      );
    });

    return this.getOverview(normalizedUid);
  }

  async donate(uid: string, amount: number) {
    const normalizedUid = this.normalizeUid(uid);
    const normalizedAmount = this.normalizeDonateAmount(amount);
    const contribution = DONATE_OPTIONS[normalizedAmount];
    const dateKey = this.currentDateKey();

    await this.dataSource.transaction(async (manager) => {
      const config = await this.readConfig(manager);
      this.assertGuildEnabled(config);
      if (!config.donateOptions.includes(normalizedAmount)) {
        throw new Error("档位无效");
      }
      const { guild, member, user } = await this.requireGuildContext(
        manager,
        normalizedUid,
      );
      const donateCount =
        member.last_donate_date === dateKey
          ? Number(member.daily_donate_count || 0)
          : 0;
      if (donateCount >= config.dailyDonateLimit) {
        throw new Error("次数已用完");
      }
      if (Number(user.point || 0) < normalizedAmount) {
        throw new Error("余额不足");
      }

      await this.pointLedgerService.applyChange(
        manager,
        user,
        -normalizedAmount,
        {
          sourceType: "guild_donate",
          sourceId: `${guild.id}:${dateKey}`,
          title: "公会捐献",
          metadata: { guildId: guild.id, dateKey, amount: normalizedAmount },
        },
      );

      member.last_donate_date = dateKey;
      member.daily_donate_count = donateCount + 1;
      await this.applyGuildGrowth(
        manager,
        guild,
        member,
        contribution,
        contribution,
        config,
      );
      await this.addContributionRecord(manager, {
        guildId: guild.id,
        uid: normalizedUid,
        dateKey,
        sourceType: "donate",
        contribution,
        activity: contribution,
        metadata: { amount: normalizedAmount },
      });
    });

    return this.getOverview(normalizedUid);
  }

  async promoteMember(uid: string, targetUid: string) {
    const operatorUid = this.normalizeUid(uid);
    const normalizedTargetUid = this.normalizeUid(targetUid);

    await this.dataSource.transaction(async (manager) => {
      const operator = await this.requireMembership(manager, operatorUid);
      if (operator.role !== "leader") {
        throw new Error("权限不足");
      }
      const target = await this.requireGuildMember(
        manager,
        operator.guild_id,
        normalizedTargetUid,
      );
      if (target.role !== "member") {
        throw new Error("职位无效");
      }
      target.role = "officer";
      await manager.getRepository(GuildMember).save(target);
    });

    return this.getOverview(operatorUid);
  }

  async demoteMember(uid: string, targetUid: string) {
    const operatorUid = this.normalizeUid(uid);
    const normalizedTargetUid = this.normalizeUid(targetUid);

    await this.dataSource.transaction(async (manager) => {
      const operator = await this.requireMembership(manager, operatorUid);
      if (operator.role !== "leader") {
        throw new Error("权限不足");
      }
      const target = await this.requireGuildMember(
        manager,
        operator.guild_id,
        normalizedTargetUid,
      );
      if (target.role !== "officer") {
        throw new Error("职位无效");
      }
      target.role = "member";
      await manager.getRepository(GuildMember).save(target);
    });

    return this.getOverview(operatorUid);
  }

  async kickMember(uid: string, targetUid: string) {
    const operatorUid = this.normalizeUid(uid);
    const normalizedTargetUid = this.normalizeUid(targetUid);

    await this.dataSource.transaction(async (manager) => {
      if (operatorUid === normalizedTargetUid) {
        throw new Error("不能移出自己");
      }
      const operator = await this.requireMembership(manager, operatorUid);
      if (!this.isOfficerOrLeader(operator)) {
        throw new Error("权限不足");
      }
      const target = await this.requireGuildMember(
        manager,
        operator.guild_id,
        normalizedTargetUid,
      );
      if (operator.role === "officer" && target.role !== "member") {
        throw new Error("权限不足");
      }
      if (target.role === "leader") {
        throw new Error("不能移出会长");
      }
      const guild = await this.lockGuild(manager, operator.guild_id);
      await manager.getRepository(GuildMember).delete({ id: target.id });
      guild.member_count = Math.max(1, Number(guild.member_count || 1) - 1);
      await manager.getRepository(Guild).save(guild);
    });

    return this.getOverview(operatorUid);
  }

  async transferLeader(uid: string, targetUid: string) {
    const operatorUid = this.normalizeUid(uid);
    const normalizedTargetUid = this.normalizeUid(targetUid);

    await this.dataSource.transaction(async (manager) => {
      if (operatorUid === normalizedTargetUid) {
        throw new Error("不能转让自己");
      }
      const operator = await this.requireMembership(manager, operatorUid);
      if (operator.role !== "leader") {
        throw new Error("权限不足");
      }
      const target = await this.requireGuildMember(
        manager,
        operator.guild_id,
        normalizedTargetUid,
      );
      const guild = await this.lockGuild(manager, operator.guild_id);
      operator.role = "member";
      target.role = "leader";
      guild.owner_uid = target.uid;
      await manager.getRepository(GuildMember).save([operator, target]);
      await manager.getRepository(Guild).save(guild);
    });

    return this.getOverview(operatorUid);
  }

  async challengeBoss(uid: string) {
    const normalizedUid = this.normalizeUid(uid);
    const dateKey = this.currentDateKey();
    const formation = await this.formationService.getFormation(normalizedUid);
    const cards = this.getFormationBattleCards(formation);
    if (cards.length === 0) {
      throw new Error("阵容为空");
    }

    let challengeResult: {
      battleReport: PveBattleReport;
      damage: number;
      reward: RedeemRewards | null;
      defeated: boolean;
      boss: any;
    } | null = null;

    await this.dataSource.transaction(async (manager) => {
      const config = await this.readConfig(manager);
      this.assertGuildEnabled(config);
      const { guild, member, user } = await this.requireGuildContext(
        manager,
        normalizedUid,
      );
      const boss = await this.ensureDailyBoss(manager, guild, dateKey, config);
      if (boss.defeated || Number(boss.hp || 0) <= 0) {
        throw new Error("已击败");
      }

      const attempts = await manager.getRepository(GuildBossChallenge).count({
        where: { guild_id: guild.id, uid: normalizedUid, date_key: dateKey },
      });
      if (attempts >= config.bossAttempts) {
        throw new Error("次数已用完");
      }

      const battle = this.simulateBossBattle(cards, boss, guild);
      const damage = Math.max(
        0,
        Math.min(
          Number(boss.hp || 0),
          Math.round(Number(boss.hp || 0) - battle.report.enemyHp),
        ),
      );
      if (damage <= 0) {
        throw new Error("未造成伤害");
      }

      const hadDamageToday =
        (await manager.getRepository(GuildBossChallenge).count({
          where: {
            guild_id: guild.id,
            uid: normalizedUid,
            date_key: dateKey,
          },
        })) > 0;
      const reward = hadDamageToday
        ? null
        : await this.pointsAndStarCoreReward(
            manager,
            20,
            BOSS_CHALLENGE_STAR_CORE_REWARD,
          );
      if (reward) {
        await this.rewardService.grantRewards(manager, user, reward, {
          sourceType: "guild_boss",
          sourceId: `${guild.id}:${dateKey}:first`,
          title: "首领挑战",
          metadata: { guildId: guild.id, dateKey },
        });
      }

      boss.hp = Math.max(0, Number(boss.hp || 0) - damage);
      const defeated = boss.hp <= 0;
      if (defeated) {
        boss.defeated = true;
        boss.defeated_at = new Date();
      }
      await manager.getRepository(GuildBoss).save(boss);

      await manager.getRepository(GuildBossChallenge).save(
        manager.getRepository(GuildBossChallenge).create({
          guild_id: guild.id,
          boss_id: boss.id,
          uid: normalizedUid,
          date_key: dateKey,
          damage,
          battle_report: battle.report,
          formation_snapshot: battle.formationSnapshot,
          reward_snapshot: reward,
        }),
      );

      await this.applyGuildGrowth(manager, guild, member, 20, 0, config);
      await this.addContributionRecord(manager, {
        guildId: guild.id,
        uid: normalizedUid,
        dateKey,
        sourceType: "boss",
        contribution: 20,
        activity: 20,
        metadata: { damage },
      });
      if (defeated) {
        await this.applyGuildGrowth(manager, guild, member, 30, 100, config);
        await this.addContributionRecord(manager, {
          guildId: guild.id,
          uid: normalizedUid,
          dateKey,
          sourceType: "boss_defeat",
          contribution: 30,
          activity: 0,
          metadata: { bossId: boss.id },
        });
      }

      challengeResult = {
        battleReport: battle.report,
        damage,
        reward,
        defeated,
        boss: await this.buildBossView(
          manager,
          guild,
          member,
          dateKey,
          config,
          boss,
        ),
      };
    });

    return {
      ...(challengeResult || {}),
      overview: await this.getOverview(normalizedUid),
    };
  }

  async claimBossReward(uid: string) {
    const normalizedUid = this.normalizeUid(uid);
    const dateKey = this.currentDateKey();

    let reward: RedeemRewards | null = null;
    await this.dataSource.transaction(async (manager) => {
      const config = await this.readConfig(manager);
      this.assertGuildEnabled(config);
      const { guild, member, user } = await this.requireGuildContext(
        manager,
        normalizedUid,
      );
      const boss = await this.ensureDailyBoss(manager, guild, dateKey, config);
      if (!boss.defeated) {
        throw new Error("尚未击败");
      }
      const damageCount = await manager.getRepository(GuildBossChallenge).count({
        where: {
          guild_id: guild.id,
          uid: normalizedUid,
          date_key: dateKey,
        },
      });
      if (damageCount <= 0) {
        throw new Error("暂无奖励");
      }
      const claimRepository = manager.getRepository(GuildBossRewardClaim);
      const claimed = await claimRepository.findOne({
        where: { guild_id: guild.id, uid: normalizedUid, date_key: dateKey },
        lock: { mode: "pessimistic_write" },
      });
      if (claimed) {
        throw new Error("已领取");
      }
      reward = await this.pointsAndStarCoreReward(
        manager,
        100,
        BOSS_DEFEAT_STAR_CORE_REWARD,
      );
      await this.rewardService.grantRewards(manager, user, reward, {
        sourceType: "guild_boss",
        sourceId: `${guild.id}:${dateKey}:defeat`,
        title: "首领奖励",
        metadata: { guildId: guild.id, dateKey },
      });
      await claimRepository.save(
        claimRepository.create({
          guild_id: guild.id,
          uid: normalizedUid,
          date_key: dateKey,
          reward_snapshot: reward,
        }),
      );
      void member;
    });

    return {
      reward,
      overview: await this.getOverview(normalizedUid),
    };
  }

  async claimActivityChest(uid: string, threshold: number) {
    const normalizedUid = this.normalizeUid(uid);
    const normalizedThreshold = this.normalizeChestThreshold(threshold);
    const dateKey = this.currentDateKey();

    let reward: RedeemRewards | null = null;
    await this.dataSource.transaction(async (manager) => {
      const config = await this.readConfig(manager);
      this.assertGuildEnabled(config);
      if (!config.activeChestThresholds.includes(normalizedThreshold)) {
        throw new Error("宝箱不存在");
      }
      const { guild, user } = await this.requireGuildContext(
        manager,
        normalizedUid,
      );
      const activity = await this.sumGuildActivity(
        manager,
        guild.id,
        dateKey,
      );
      if (activity < normalizedThreshold) {
        throw new Error("活跃不足");
      }
      const ownActivity = await this.sumMemberActivity(
        manager,
        guild.id,
        normalizedUid,
        dateKey,
      );
      if (ownActivity <= 0) {
        throw new Error("暂无贡献");
      }
      const claimRepository = manager.getRepository(GuildActivityChestClaim);
      const claimed = await claimRepository.findOne({
        where: {
          guild_id: guild.id,
          uid: normalizedUid,
          date_key: dateKey,
          threshold: normalizedThreshold,
        },
        lock: { mode: "pessimistic_write" },
      });
      if (claimed) {
        throw new Error("已领取");
      }
      reward = await this.pointsAndStarCoreReward(
        manager,
        this.getChestReward(normalizedThreshold),
        this.getChestStarCoreReward(normalizedThreshold),
      );
      await this.rewardService.grantRewards(manager, user, reward, {
        sourceType: "guild_chest",
        sourceId: `${guild.id}:${dateKey}:${normalizedThreshold}`,
        title: "活跃箱",
        metadata: { guildId: guild.id, dateKey, threshold: normalizedThreshold },
      });
      await claimRepository.save(
        claimRepository.create({
          guild_id: guild.id,
          uid: normalizedUid,
          date_key: dateKey,
          threshold: normalizedThreshold,
          reward_snapshot: reward,
        }),
      );
    });

    return {
      reward,
      overview: await this.getOverview(normalizedUid),
    };
  }

  private async getGuildWithMembers(
    manager: GuildManager,
    guildId: number,
    membership: GuildMember,
    dateKey: string,
    config: GuildConfig,
  ) {
    const guild = await manager.getRepository(Guild).findOne({
      where: { id: guildId },
    });
    if (!guild) {
      return null;
    }
    const boss = await this.ensureDailyBoss(manager, guild, dateKey, config);

    return {
      guild: this.toGuildView(guild, membership, {
        nextLevelExp: this.getNextLevelExp(guild, config),
      }),
      members: await this.getMembers(manager, guild.id, membership),
      dailyStatus: await this.buildDailyStatus(
        manager,
        guild,
        membership,
        dateKey,
        config,
      ),
      activityChests: await this.buildActivityChests(
        manager,
        guild,
        membership,
        dateKey,
        config,
      ),
      boss: await this.buildBossView(
        manager,
        guild,
        membership,
        dateKey,
        config,
        boss,
      ),
      requests: this.isOfficerOrLeader(membership)
        ? await this.getPendingRequestViews(manager, guild.id)
        : [],
    };
  }

  private async getMembers(
    manager: GuildManager,
    guildId: number,
    currentMember?: GuildMember,
  ) {
    const members = await manager.getRepository(GuildMember).find({
      where: { guild_id: guildId },
      order: { joinedAt: "ASC", id: "ASC" } as any,
    });
    if (members.length === 0) {
      return [];
    }

    const userRepository = manager.getRepository(User);
    const users = await userRepository.find({
      where: { uid: In([...new Set(members.map((member) => member.uid))]) },
    });
    await ensureUsersPublicIds(userRepository, users);
    const userMap = new Map(users.map((user) => [user.uid, user]));

    return members.map((member) => {
      const user = userMap.get(member.uid);
      return {
        uid: member.uid,
        publicId: user ? getUserPublicId(user) : member.uid,
        nickname: this.publicName(user, member.uid),
        avatar: user?.avatar || "",
        role: member.role,
        totalContribution: Number(member.total_contribution || 0),
        weeklyContribution: Number(member.weekly_contribution || 0),
        canManage: currentMember
          ? this.canManageMember(currentMember, member)
          : false,
        joinedAt: member.joinedAt,
      };
    });
  }

  private async toMessageViews(
    manager: GuildManager,
    messages: GuildMessage[],
  ) {
    if (messages.length === 0) {
      return [];
    }

    const userRepository = manager.getRepository(User);
    const users = await userRepository.find({
      where: {
        uid: In([...new Set(messages.map((message) => message.sender_uid))]),
      },
    });
    await ensureUsersPublicIds(userRepository, users);
    const userMap = new Map(users.map((user) => [user.uid, user]));

    return messages.map((message) => {
      const user = userMap.get(message.sender_uid);
      return {
        id: message.id,
        content: message.content,
        createdAt: message.createdAt,
        sender: {
          uid: message.sender_uid,
          publicId: user ? getUserPublicId(user) : message.sender_uid,
          nickname: this.publicName(user, message.sender_uid),
          avatar: user?.avatar || "",
        },
      };
    });
  }

  private async listGuildRows(manager: GuildManager) {
    return manager.getRepository(Guild).find({
      order: {
        level: "DESC",
        member_count: "DESC",
        updatedAt: "DESC",
        id: "ASC",
      } as any,
      take: GUILD_LIST_LIMIT,
    });
  }

  private async findPendingRequestsForUser(manager: GuildManager, uid: string) {
    return manager.getRepository(GuildJoinRequest).find({
      where: { uid, status: "pending" },
      order: { createdAt: "DESC", id: "DESC" } as any,
    });
  }

  private async getPendingRequestViews(manager: GuildManager, guildId: number) {
    const requests = await manager.getRepository(GuildJoinRequest).find({
      where: { guild_id: guildId, status: "pending" },
      order: { createdAt: "ASC", id: "ASC" } as any,
    });
    if (requests.length === 0) {
      return [];
    }
    const users = await manager.getRepository(User).find({
      where: { uid: In([...new Set(requests.map((request) => request.uid))]) },
    });
    await ensureUsersPublicIds(manager.getRepository(User), users);
    const userMap = new Map(users.map((user) => [user.uid, user]));
    return requests.map((request) => {
      const user = userMap.get(request.uid);
      return {
        id: request.id,
        guildId: request.guild_id,
        status: request.status,
        createdAt: request.createdAt,
        user: {
          uid: request.uid,
          publicId: user ? getUserPublicId(user) : request.uid,
          nickname: this.publicName(user, request.uid),
          avatar: user?.avatar || "",
        },
      };
    });
  }

  private async createJoinRequest(
    manager: EntityManager,
    guild: Guild,
    uid: string,
  ) {
    const requestRepository = manager.getRepository(GuildJoinRequest);
    const existing = await requestRepository.findOne({
      where: { guild_id: guild.id, uid, status: "pending" },
      lock: { mode: "pessimistic_read" },
    });
    if (existing) {
      throw new Error("已申请");
    }
    try {
      await requestRepository.save(
        requestRepository.create({
          guild_id: guild.id,
          uid,
          status: "pending",
          pending_key: "pending",
        }),
      );
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) {
        throw error;
      }
      const duplicated = await requestRepository.findOne({
        where: { guild_id: guild.id, uid, status: "pending" },
      });
      if (duplicated) {
        throw new Error("已申请");
      }
      throw error;
    }
  }

  private async setJoinRequestStatus(
    manager: EntityManager,
    request: GuildJoinRequest,
    status: GuildJoinRequestStatus,
  ) {
    request.status = status;
    request.pending_key = status === "pending" ? "pending" : null;
    await manager.getRepository(GuildJoinRequest).save(request);
  }

  private async cancelOtherPendingRequests(
    manager: EntityManager,
    uid: string,
    keepRequestId = 0,
  ) {
    const requestRepository = manager.getRepository(GuildJoinRequest);
    const requests = await requestRepository.find({
      where: { uid, status: "pending" },
    });
    const updates = requests
      .filter((request) => Number(request.id || 0) !== Number(keepRequestId || 0))
      .map((request) => {
        request.status = "canceled";
        request.pending_key = null;
        return request;
      });
    if (updates.length > 0) {
      await requestRepository.save(updates);
    }
  }

  private async addMember(
    manager: EntityManager,
    guild: Guild,
    uid: string,
    role: GuildMemberRole,
    config: GuildConfig,
    keepPendingRequestId = 0,
  ) {
    const limit =
      Number(guild.member_limit || 0) > 0
        ? Number(guild.member_limit)
        : this.getMemberLimit(guild, config);
    if (Number(guild.member_count || 0) >= limit) {
      throw new Error("人数已满");
    }
    const memberRepository = manager.getRepository(GuildMember);
    await memberRepository.save(
      memberRepository.create({
        guild_id: guild.id,
        uid,
        role,
        total_contribution: 0,
        weekly_contribution: 0,
        weekly_contribution_key: this.currentWeekKey(),
        daily_donate_count: 0,
      }),
    );
    guild.member_count = Number(guild.member_count || 0) + 1;
    guild.member_limit = limit;
    await manager.getRepository(Guild).save(guild);
    await this.cancelOtherPendingRequests(manager, uid, keepPendingRequestId);
  }

  private async requireGuildContext(manager: EntityManager, uid: string) {
    const member = await manager.getRepository(GuildMember).findOne({
      where: { uid },
      lock: { mode: "pessimistic_write" },
    });
    if (!member) {
      throw new Error("尚未加入公会");
    }
    const guild = await this.lockGuild(manager, member.guild_id);
    const user = await manager.getRepository(User).findOne({
      where: { uid },
      lock: { mode: "pessimistic_write" },
    });
    if (!user) {
      throw new Error("玩家不存在");
    }
    return { guild, member, user };
  }

  private async requireGuildMember(
    manager: EntityManager,
    guildId: number,
    uid: string,
  ) {
    const member = await manager.getRepository(GuildMember).findOne({
      where: { guild_id: guildId, uid },
      lock: { mode: "pessimistic_write" },
    });
    if (!member) {
      throw new Error("成员不存在");
    }
    return member;
  }

  private async lockGuild(manager: EntityManager, guildId: number) {
    const guild = await manager.getRepository(Guild).findOne({
      where: { id: guildId },
      lock: { mode: "pessimistic_write" },
    });
    if (!guild) {
      throw new Error("公会不存在");
    }
    return guild;
  }

  private async applyGuildGrowth(
    manager: EntityManager,
    guild: Guild,
    member: GuildMember,
    contribution: number,
    fund: number,
    config: GuildConfig,
  ) {
    const normalizedContribution = Math.max(0, Math.round(contribution || 0));
    const normalizedFund = Math.max(0, Math.round(fund || 0));
    if (normalizedContribution > 0) {
      const weekKey = this.currentWeekKey();
      if (
        member.weekly_contribution_key &&
        member.weekly_contribution_key !== weekKey
      ) {
        member.weekly_contribution = 0;
      }
      member.weekly_contribution_key = weekKey;
      member.total_contribution =
        Number(member.total_contribution || 0) + normalizedContribution;
      member.weekly_contribution =
        Number(member.weekly_contribution || 0) + normalizedContribution;
    }
    guild.exp = Number(guild.exp || 0) + normalizedContribution;
    guild.fund = Number(guild.fund || 0) + normalizedFund;
    this.normalizeGuildLevel(guild, config);
    await manager.getRepository(GuildMember).save(member);
    await manager.getRepository(Guild).save(guild);
  }

  private normalizeGuildLevel(guild: Guild, config: GuildConfig) {
    guild.level = Math.max(1, Math.min(config.maxLevel, Number(guild.level || 1)));
    guild.exp = Math.max(0, Math.round(Number(guild.exp || 0)));
    while (guild.level < config.maxLevel) {
      const required = GUILD_EXP_THRESHOLDS[guild.level - 1];
      if (!required || guild.exp < required) {
        break;
      }
      guild.exp -= required;
      guild.level += 1;
    }
    guild.member_limit = this.getMemberLimit(guild, config);
  }

  private getMemberLimit(guild: Guild, config: GuildConfig) {
    const level = Math.max(1, Number(guild.level || 1));
    return Math.min(
      config.baseMemberLimit +
        (Math.min(level, config.maxLevel) - 1) * config.memberLimitPerLevel,
      config.baseMemberLimit +
        (config.maxLevel - 1) * config.memberLimitPerLevel,
    );
  }

  private getNextLevelExp(guild: Guild, config: GuildConfig) {
    const level = Math.max(1, Number(guild.level || 1));
    if (level >= config.maxLevel) {
      return 0;
    }
    return GUILD_EXP_THRESHOLDS[level - 1] || 0;
  }

  private async addContributionRecord(
    manager: EntityManager,
    input: {
      guildId: number;
      uid: string;
      dateKey: string;
      sourceType: GuildContributionRecord["source_type"];
      contribution: number;
      activity: number;
      metadata?: Record<string, unknown>;
    },
  ) {
    const repository = manager.getRepository(GuildContributionRecord);
    await repository.save(
      repository.create({
        guild_id: input.guildId,
        uid: input.uid,
        date_key: input.dateKey,
        source_type: input.sourceType,
        contribution: input.contribution,
        activity: input.activity,
        metadata: input.metadata || null,
      }),
    );
  }

  private async buildDailyStatus(
    manager: GuildManager,
    guild: Guild,
    member: GuildMember,
    dateKey: string,
    config: GuildConfig,
  ) {
    const [guildActivity, myContribution, bossAttempts] = await Promise.all([
      this.sumGuildActivity(manager, guild.id, dateKey),
      this.sumMemberContribution(manager, guild.id, member.uid, dateKey),
      manager.getRepository(GuildBossChallenge).count({
        where: { guild_id: guild.id, uid: member.uid, date_key: dateKey },
      }),
    ]);
    const donateCount =
      member.last_donate_date === dateKey
        ? Number(member.daily_donate_count || 0)
        : 0;
    return {
      dateKey,
      checkedIn: member.last_check_in_date === dateKey,
      donateCount,
      donateLimit: config.dailyDonateLimit,
      bossAttempts,
      bossAttemptLimit: config.bossAttempts,
      myContributionToday: myContribution,
      guildActivity,
      contributedToday: myContribution > 0,
    };
  }

  private async buildActivityChests(
    manager: GuildManager,
    guild: Guild,
    member: GuildMember,
    dateKey: string,
    config: GuildConfig,
  ) {
    const [activity, ownActivity, claims] = await Promise.all([
      this.sumGuildActivity(manager, guild.id, dateKey),
      this.sumMemberActivity(manager, guild.id, member.uid, dateKey),
      manager.getRepository(GuildActivityChestClaim).find({
        where: { guild_id: guild.id, uid: member.uid, date_key: dateKey },
      }),
    ]);
    const claimedSet = new Set(claims.map((claim) => Number(claim.threshold)));
    return Promise.all(
      config.activeChestThresholds.map(async (threshold) => {
        const claimed = claimedSet.has(threshold);
        const unlocked = activity >= threshold;
        return {
          threshold,
          reward: await this.pointsAndStarCoreReward(
            manager,
            this.getChestReward(threshold),
            this.getChestStarCoreReward(threshold),
          ),
          unlocked,
          claimed,
          available: unlocked && ownActivity > 0 && !claimed,
        };
      }),
    );
  }

  private async ensureDailyBoss(
    manager: GuildManager,
    guild: Guild,
    dateKey: string,
    config: GuildConfig,
  ) {
    const repository = manager.getRepository(GuildBoss);
    let boss = await repository.findOne({
      where: { guild_id: guild.id, date_key: dateKey },
    });
    if (boss) {
      return boss;
    }
    const maxHp = this.getBossMaxHp(guild, config);
    try {
      boss = await repository.save(
        repository.create({
          guild_id: guild.id,
          date_key: dateKey,
          name: GUILD_BOSS_NAME,
          level: Math.max(1, Number(guild.level || 1)),
          max_hp: maxHp,
          hp: maxHp,
          defeated: false,
          defeated_at: null,
        }),
      );
      return boss;
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) {
        throw error;
      }
      const existing = await repository.findOne({
        where: { guild_id: guild.id, date_key: dateKey },
      });
      if (existing) {
        return existing;
      }
      throw error;
    }
  }

  private getBossMaxHp(guild: Guild, config: GuildConfig) {
    return (
      config.bossHpBase + Math.max(1, Number(guild.level || 1)) * config.bossHpPerLevel
    );
  }

  private async buildBossView(
    manager: GuildManager,
    guild: Guild,
    member: GuildMember,
    dateKey: string,
    config: GuildConfig,
    boss?: GuildBoss | null,
  ) {
    const currentBoss = boss || (await this.ensureDailyBoss(manager, guild, dateKey, config));
    const [attempts, challenges, claim] = await Promise.all([
      manager.getRepository(GuildBossChallenge).count({
        where: { guild_id: guild.id, uid: member.uid, date_key: dateKey },
      }),
      manager.getRepository(GuildBossChallenge).find({
        where: { guild_id: guild.id, uid: member.uid, date_key: dateKey },
      }),
      manager.getRepository(GuildBossRewardClaim).findOne({
        where: { guild_id: guild.id, uid: member.uid, date_key: dateKey },
      }),
    ]);
    const myDamage = challenges.reduce(
      (sum, challenge) => sum + Number(challenge.damage || 0),
      0,
    );
    const rewardClaimed = Boolean(claim);
    return {
      id: currentBoss.id,
      name: currentBoss.name || GUILD_BOSS_NAME,
      dateKey: currentBoss.date_key,
      level: Number(currentBoss.level || 1),
      maxHp: Number(currentBoss.max_hp || 0),
      hp: Number(currentBoss.hp || 0),
      defeated: currentBoss.defeated === true || Number(currentBoss.hp || 0) <= 0,
      defeatedAt: currentBoss.defeated_at || null,
      attempts,
      attemptLimit: config.bossAttempts,
      myDamage,
      reward: await this.pointsAndStarCoreReward(
        manager,
        100,
        BOSS_DEFEAT_STAR_CORE_REWARD,
      ),
      rewardClaimed,
      canClaim:
        (currentBoss.defeated === true || Number(currentBoss.hp || 0) <= 0) &&
        myDamage > 0 &&
        !rewardClaimed,
    };
  }

  private simulateBossBattle(
    cards: PveBattleCard[],
    boss: GuildBoss,
    guild: Guild,
  ) {
    const bossLevel = Math.max(1, Number(boss.level || guild.level || 1));
    const enemyPower = Math.max(1000, bossLevel * 2400);
    return this.battleSimulator.simulate({
      cards,
      enemyPower,
      battleConfig: {
        traits: [],
        enemyHp: Math.max(1, Number(boss.hp || 1)),
        enemyAttack: 260 + bossLevel * 180,
        roundLimit: 8,
        boss: true,
      },
    });
  }

  private getFormationBattleCards(formation: any): PveBattleCard[] {
    return (formation?.slots || [])
      .map((slot: any) => slot?.card)
      .filter((card: any) => card && Number(card.power || 0) > 0)
      .map((card: any) => ({
        uuid: card.uuid,
        cardId: card.cardId,
        cardName: card.cardName,
        cardLevel: card.cardLevel,
        battleRole: card.battleRole,
        power: card.power,
        basePower: card.basePower,
        potentialPower: card.potentialPower,
        potentialGrade: card.potentialGrade,
      }));
  }

  private async sumGuildActivity(
    manager: GuildManager,
    guildId: number,
    dateKey: string,
  ) {
    const records = await manager.getRepository(GuildContributionRecord).find({
      where: { guild_id: guildId, date_key: dateKey },
    });
    return records.reduce((sum, record) => sum + Number(record.activity || 0), 0);
  }

  private async sumMemberActivity(
    manager: GuildManager,
    guildId: number,
    uid: string,
    dateKey: string,
  ) {
    const records = await manager.getRepository(GuildContributionRecord).find({
      where: { guild_id: guildId, uid, date_key: dateKey },
    });
    return records.reduce((sum, record) => sum + Number(record.activity || 0), 0);
  }

  private async sumMemberContribution(
    manager: GuildManager,
    guildId: number,
    uid: string,
    dateKey: string,
  ) {
    const records = await manager.getRepository(GuildContributionRecord).find({
      where: { guild_id: guildId, uid, date_key: dateKey },
    });
    return records.reduce(
      (sum, record) => sum + Number(record.contribution || 0),
      0,
    );
  }

  private async deleteGuildCascade(manager: EntityManager, guildId: number) {
    await manager
      .getRepository(GuildActivityChestClaim)
      .delete({ guild_id: guildId });
    await manager
      .getRepository(GuildBossRewardClaim)
      .delete({ guild_id: guildId });
    await manager
      .getRepository(GuildBossChallenge)
      .delete({ guild_id: guildId });
    await manager
      .getRepository(GuildContributionRecord)
      .delete({ guild_id: guildId });
    await manager.getRepository(GuildMessage).delete({ guild_id: guildId });
    await manager.getRepository(GuildJoinRequest).delete({ guild_id: guildId });
    await manager.getRepository(GuildBoss).delete({ guild_id: guildId });
    await manager.getRepository(GuildMember).delete({ guild_id: guildId });
    await manager.getRepository(Guild).delete({ id: guildId });
  }

  private async readConfig(manager: GuildManager): Promise<GuildConfig> {
    const repository = manager.getRepository(SystemConfig);
    const row = await repository.findOne({ where: { key: GUILD_CONFIG_KEY } });
    if (!row?.value) {
      return { ...DEFAULT_GUILD_CONFIG };
    }
    try {
      return normalizeGuildConfig(JSON.parse(row.value));
    } catch {
      return { ...DEFAULT_GUILD_CONFIG };
    }
  }

  private async assertNotInGuild(manager: GuildManager, uid: string) {
    const membership = await this.findMembership(manager, uid);
    if (membership) {
      throw new Error("已加入公会");
    }
  }

  private async requireMembership(manager: GuildManager, uid: string) {
    const membership = await this.findMembership(manager, uid);
    if (!membership) {
      throw new Error("尚未加入公会");
    }
    return membership;
  }

  private async findMembership(manager: GuildManager, uid: string) {
    return manager.getRepository(GuildMember).findOne({ where: { uid } });
  }

  private async findUser(manager: GuildManager, uid: string) {
    const user = await manager.getRepository(User).findOne({ where: { uid } });
    if (!user) {
      throw new Error("玩家不存在");
    }
    return user;
  }

  private toGuildView(
    guild: Guild,
    membership?: GuildMember | null,
    options?: { nextLevelExp?: number; applied?: boolean },
  ) {
    const config = DEFAULT_GUILD_CONFIG;
    return {
      id: guild.id,
      name: guild.name,
      description: guild.description || "",
      announcement: guild.announcement || "",
      memberCount: Number(guild.member_count || 0),
      level: Math.max(1, Number(guild.level || 1)),
      exp: Math.max(0, Number(guild.exp || 0)),
      nextLevelExp:
        options?.nextLevelExp ??
        this.getNextLevelExp(guild, normalizeGuildConfig(config)),
      fund: Math.max(0, Number(guild.fund || 0)),
      memberLimit:
        Number(guild.member_limit || 0) > 0
          ? Number(guild.member_limit)
          : this.getMemberLimit(guild, config),
      joinMode: this.getGuildJoinMode(guild),
      role: membership?.role || null,
      joined: Boolean(membership),
      applied: options?.applied === true,
      createdAt: guild.createdAt || null,
    };
  }

  private toOwnRequestView(request: GuildJoinRequest) {
    return {
      id: request.id,
      guildId: request.guild_id,
      status: request.status,
      createdAt: request.createdAt,
    };
  }

  private canManageMember(operator: GuildMember, target: GuildMember) {
    if (operator.uid === target.uid) {
      return false;
    }
    if (operator.role === "leader") {
      return target.role !== "leader";
    }
    if (operator.role === "officer") {
      return target.role === "member";
    }
    return false;
  }

  private assertCanEditAnnouncement(member: GuildMember) {
    if (!this.isOfficerOrLeader(member)) {
      throw new Error("权限不足");
    }
  }

  private assertCanReview(member: GuildMember) {
    if (!this.isOfficerOrLeader(member)) {
      throw new Error("权限不足");
    }
  }

  private isOfficerOrLeader(member: GuildMember) {
    return member.role === "leader" || member.role === "officer";
  }

  private compareMembersForLeader(left: GuildMember, right: GuildMember) {
    const roleWeight = (role: GuildMemberRole) =>
      role === "officer" ? 0 : role === "member" ? 1 : 2;
    return (
      roleWeight(left.role) - roleWeight(right.role) ||
      Number(left.joinedAt || 0) - Number(right.joinedAt || 0) ||
      Number(left.id || 0) - Number(right.id || 0)
    );
  }

  private getGuildJoinMode(guild: Guild) {
    return guild.join_mode === "approval" ? "approval" : "open";
  }

  private assertGuildEnabled(config: GuildConfig) {
    if (config.enabled === false) {
      throw new Error("公会未开放");
    }
  }

  private async pointsAndStarCoreReward(
    manager: GuildManager,
    points: number,
    starCoreCount: number,
  ): Promise<RedeemRewards> {
    const reward = this.pointsReward(points);
    if (starCoreCount <= 0) {
      return reward;
    }
    const starCore = await this.findStarCoreCrystalItem(manager);
    if (!starCore) {
      return reward;
    }
    return {
      ...reward,
      items: [
        {
          itemId: starCore.id,
          itemName: starCore.drop_name,
          num: starCoreCount,
        } as any,
      ],
    };
  }

  private pointsReward(points: number): RedeemRewards {
    return { points: Math.max(0, Math.round(points || 0)), items: [] };
  }

  private getChestReward(threshold: number) {
    return CHEST_REWARDS[threshold] || Math.max(1, Math.floor(threshold / 10));
  }

  private getChestStarCoreReward(threshold: number) {
    return CHEST_STAR_CORE_REWARDS[threshold] || 0;
  }

  private async findStarCoreCrystalItem(
    manager: GuildManager,
  ): Promise<DropItem | null> {
    const repository = manager.getRepository(DropItem);
    const items = await repository.find({
      where: { drop_type: 0, disabled: false },
    });
    return (
      items.find(
        (item) =>
          this.normalizeItemName(item.drop_name) ===
          this.normalizeItemName(STAR_CORE_CRYSTAL_NAME),
      ) || null
    );
  }

  private normalizeItemName(name: string) {
    return String(name || "").replace(/\s+/g, "");
  }

  private currentDateKey(now = new Date()) {
    return new Date(now.getTime() + 8 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
  }

  private currentWeekKey(now = new Date()) {
    const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const date = new Date(
      Date.UTC(
        shifted.getUTCFullYear(),
        shifted.getUTCMonth(),
        shifted.getUTCDate(),
      ),
    );
    const day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const week = Math.ceil(
      ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
    );
    return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
  }

  private isUniqueConstraintError(error: unknown) {
    const source = error as {
      code?: string;
      errno?: number;
      driverError?: { code?: string; errno?: number };
      message?: string;
    };
    const code = source?.code || source?.driverError?.code || "";
    const errno = source?.errno || source?.driverError?.errno || 0;
    const message = String(source?.message || "").toLowerCase();
    return (
      code === "ER_DUP_ENTRY" ||
      code === "SQLITE_CONSTRAINT" ||
      errno === 1062 ||
      message.includes("duplicate") ||
      message.includes("unique")
    );
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

  private normalizeId(value: number, message: string) {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error(message);
    }
    return id;
  }

  private normalizeDonateAmount(amount: number) {
    const value = Number(amount);
    if (!Number.isInteger(value) || !DONATE_OPTIONS[value]) {
      throw new Error("档位无效");
    }
    return value;
  }

  private normalizeChestThreshold(threshold: number) {
    const value = Number(threshold);
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error("宝箱不存在");
    }
    return value;
  }

  private normalizeJoinMode(value: string) {
    return String(value || "").trim() === "approval" ? "approval" : "open";
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
      .slice(0, MAX_DESCRIPTION_LENGTH);
  }

  private normalizeAnnouncement(announcement?: string) {
    return String(announcement || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_ANNOUNCEMENT_LENGTH);
  }

  private normalizeMessageLimit(value: number) {
    const limit = Number(value || DEFAULT_MESSAGE_LIST_LIMIT);
    if (!Number.isInteger(limit) || limit <= 0) {
      return DEFAULT_MESSAGE_LIST_LIMIT;
    }
    return Math.min(MAX_MESSAGE_LIST_LIMIT, limit);
  }

  private normalizeMessageContent(content: string) {
    const value = String(content || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!value) {
      throw new Error("请输入消息");
    }
    if (value.length > MAX_MESSAGE_LENGTH) {
      throw new Error(`消息最多${MAX_MESSAGE_LENGTH}字`);
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
