import { Injectable, Optional } from "@nestjs/common";
import { Between, DataSource, EntityManager, In } from "typeorm";
import { CardItem } from "src/entity/card.entity";
import { DropItem } from "src/entity/drop.entity";
import { PveChallengeRecord } from "src/entity/pveChallengeRecord.entity";
import { PveStage } from "src/entity/pveStage.entity";
import type { RedeemRewards } from "src/entity/redeemCode.entity";
import { User } from "src/entity/user.entity";
import { FormationService } from "src/formation/formation.service";
import {
  FishpiVipView,
  RechargeService,
} from "src/recharge/recharge.service";
import { RewardService } from "src/reward/reward.service";
import { SocialActivityService } from "src/social/social-activity.service";

export interface PvePageQuery {
  page?: number;
  pageSize?: number;
  focus?: string;
}

export interface PveSweepInput {
  stageIds: number[];
}

export interface PveSweepStageResult {
  stageId: number;
  stageName: string;
  success: boolean;
  rewards: RedeemRewards | null;
}

export interface PveSweepResult {
  vipLevel: number;
  vipLabel: string;
  dailyLimit: number;
  usedToday: number;
  remaining: number;
  swept: number;
  skipped: Array<{
    stageId: number;
    stageName: string;
    reason: string;
  }>;
  list: PveSweepStageResult[];
  pointAfter: number;
}

type RewardLookup = {
  itemMap: Map<number, DropItem>;
  cardMap: Map<number, CardItem>;
};

@Injectable()
export class PveService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly formationService: FormationService,
    private readonly rewardService: RewardService,
    @Optional()
    private readonly socialActivityService?: SocialActivityService,
    @Optional()
    private readonly rechargeService?: RechargeService,
  ) {}

  async listStages(uid: string, query: PvePageQuery = {}) {
    const requestedPage = this.normalizePage(query.page);
    const pageSize = this.normalizePageSize(query.pageSize);
    const shouldFocusNextUncleared =
      String(query.focus || "").trim() === "nextUncleared";
    const stageRepository = this.dataSource.getRepository(PveStage);
    const recordRepository = this.dataSource.getRepository(PveChallengeRecord);
    const [stages, formation, todayRecords] = await Promise.all([
      stageRepository.find({
        where: { delete_flag: false, enabled: true },
        order: { sort_order: "ASC", id: "ASC" } as any,
      }),
      this.formationService.getFormation(uid),
      recordRepository.find({
        where: {
          uid,
          createdAt: Between(...this.getTodayRange()),
        },
      }),
    ]);
    const visibleStages = stages.filter((stage) =>
      this.isStageInVisibleTime(stage),
    );
    const total = visibleStages.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const visibleStageIds = visibleStages.map((stage) => Number(stage.id));
    const allClearedRecords = visibleStageIds.length
      ? await recordRepository.find({
          where: {
            uid,
            stage_id: In(visibleStageIds),
            success: true,
          },
        })
      : [];
    const allClearedStageIds = new Set(
      allClearedRecords.map((record) => Number(record.stage_id)),
    );
    const nextUnclearedIndex = visibleStages.findIndex(
      (stage) => !allClearedStageIds.has(Number(stage.id)),
    );
    const nextUnclearedStageId =
      nextUnclearedIndex >= 0 ? Number(visibleStages[nextUnclearedIndex].id) : null;
    const nextUnclearedPage =
      nextUnclearedIndex >= 0
        ? Math.floor(nextUnclearedIndex / pageSize) + 1
        : null;
    const page =
      shouldFocusNextUncleared && nextUnclearedPage
        ? nextUnclearedPage
        : Math.min(requestedPage, totalPages);
    const pageStages = visibleStages.slice(
      (page - 1) * pageSize,
      page * pageSize,
    );
    const pageStageIds = pageStages.map((stage) => Number(stage.id));
    const rewardLookup = await this.buildRewardLookup(
      this.dataSource,
      pageStages.map((stage) => stage.rewards),
    );
    const todayCountMap = todayRecords.reduce((map, record) => {
      map.set(record.stage_id, (map.get(record.stage_id) || 0) + 1);
      return map;
    }, new Map<number, number>());

    return {
      formation: {
        slotCount: formation.slotCount,
        filledCount: formation.slots.filter((slot) => Boolean(slot.card)).length,
        totalPower: formation.totalPower,
      },
      list: pageStages.map((stage) =>
        this.toStageView(
          stage,
          formation.totalPower,
          todayCountMap.get(stage.id) || 0,
          rewardLookup,
          allClearedStageIds.has(Number(stage.id)),
        ),
      ),
      total,
      page,
      pageSize,
      totalPages,
      nextUnclearedStageId,
      nextUnclearedPage,
    };
  }

  async challenge(uid: string, stageId: number) {
    if (!Number.isInteger(Number(stageId)) || Number(stageId) <= 0) {
      throw new Error("关卡参数无效");
    }

    return this.dataSource.transaction(async (manager) => {
      const stage = await manager.getRepository(PveStage).findOne({
        where: { id: Number(stageId), delete_flag: false },
        lock: { mode: "pessimistic_read" },
      });
      if (!stage) {
        throw new Error("关卡不存在");
      }
      this.assertStageCanChallenge(stage);

      const todayCount = await manager
        .getRepository(PveChallengeRecord)
        .count({
          where: {
            uid,
            stage_id: stage.id,
            createdAt: Between(...this.getTodayRange()),
          },
        });
      const dailyLimit = this.normalizeDailyLimit(stage.daily_limit);
      if (todayCount >= dailyLimit) {
        throw new Error("今日挑战次数已用完");
      }

      const [user, formation] = await Promise.all([
        manager.getRepository(User).findOne({
          where: { uid },
          lock: { mode: "pessimistic_write" },
        }),
        this.formationService.getFormation(uid),
      ]);
      if (!user) {
        throw new Error("用户不存在");
      }
      if (!formation.slots.some((slot) => Boolean(slot.card))) {
        throw new Error("请先配置阵容");
      }

      const formationPower = Number(formation.totalPower || 0);
      const enemyPower = this.normalizePower(stage.enemy_power);
      const success = formationPower >= enemyPower;
      const clearedBefore =
        (await manager.getRepository(PveChallengeRecord).count({
          where: {
            uid,
            stage_id: stage.id,
            success: true,
          },
        })) > 0;
      const firstClearRewards = success
        ? this.rewardService.normalizeRewards(stage.rewards, "关卡奖励不能为空")
        : null;
      const rewardSnapshot = firstClearRewards
        ? clearedBefore
          ? this.toRepeatRewards(firstClearRewards)
          : firstClearRewards
        : null;

      if (this.hasGrantableRewards(rewardSnapshot)) {
        await this.assertRewardAvailable(manager, rewardSnapshot);
      }

      const recordRepository = manager.getRepository(PveChallengeRecord);
      const record = await recordRepository.save(
        recordRepository.create({
          uid,
          stage_id: stage.id,
          stage_name: stage.name,
          formation_power: formationPower,
          enemy_power: enemyPower,
          success,
          reward_snapshot: rewardSnapshot,
          mode: "challenge",
        }),
      );

      if (this.hasGrantableRewards(rewardSnapshot)) {
        await this.rewardService.grantRewards(manager, user, rewardSnapshot, {
          sourceType: "pve",
          sourceId: stage.id,
          title: `关卡奖励：${stage.name}`,
          metadata: {
            stageId: stage.id,
            stageName: stage.name,
            formationPower,
            enemyPower,
          },
        });
      }
      if (success) {
        await this.socialActivityService?.recordActivity(
          {
            actorUid: uid,
            type: "pve_cleared",
            title: "通关关卡",
            summary: stage.name,
            metadata: {
              stageId: stage.id,
              stageName: stage.name,
              formationPower,
              enemyPower,
            },
          },
          manager,
        );
      }
      const rewardLookup = await this.buildRewardLookup(manager, [
        stage.rewards,
        ...(rewardSnapshot ? [rewardSnapshot] : []),
      ]);

      return {
        record: this.toRecordView(record, rewardLookup),
        stage: this.toStageView(
          stage,
          formationPower,
          todayCount + 1,
          rewardLookup,
          clearedBefore || success,
        ),
        success,
        rewards: rewardSnapshot
          ? this.decorateRewards(rewardSnapshot, rewardLookup)
          : null,
        formationPower,
        enemyPower,
        pointAfter: user.point,
      };
    });
  }

  async sweep(uid: string, input: PveSweepInput): Promise<PveSweepResult> {
    const stageIds = this.normalizeSweepStageIds(input?.stageIds || []);
    if (stageIds.length === 0) {
      throw new Error("请选择关卡");
    }
    const vip = await this.getSweepVip(uid);
    const vipLevel = this.getVipLevel(vip.levelCode);
    const dailyLimit = this.getVipSweepLimit(vipLevel);

    return this.dataSource.transaction(async (manager) => {
      const recordRepository = manager.getRepository(PveChallengeRecord);
      const stageRepository = manager.getRepository(PveStage);
      const user = await manager.getRepository(User).findOne({
        where: { uid },
        lock: { mode: "pessimistic_write" },
      });
      if (!user) {
        throw new Error("用户不存在");
      }

      const todayRange = this.getTodayRange();
      const usedToday = await recordRepository.count({
        where: {
          uid,
          mode: "sweep",
          createdAt: Between(...todayRange),
        },
      });
      const stages = await stageRepository.find({
        where: {
          id: In(stageIds),
          delete_flag: false,
        },
        order: { sort_order: "ASC", id: "ASC" } as any,
      });
      const stageMap = new Map(stages.map((stage) => [Number(stage.id), stage]));
      const clearedRecords = stageIds.length
        ? await recordRepository.find({
            where: {
              uid,
              stage_id: In(stageIds),
              success: true,
            },
          })
        : [];
      const clearedStageIds = new Set(
        clearedRecords.map((record) => Number(record.stage_id)),
      );
      const todayRecords = stageIds.length
        ? await recordRepository.find({
            where: {
              uid,
              stage_id: In(stageIds),
              createdAt: Between(...todayRange),
            },
          })
        : [];
      const todayCountMap = todayRecords.reduce((map, record) => {
        map.set(record.stage_id, (map.get(record.stage_id) || 0) + 1);
        return map;
      }, new Map<number, number>());

      const list: PveSweepStageResult[] = [];
      const skipped: PveSweepResult["skipped"] = [];
      const rewardSnapshots: RedeemRewards[] = [];
      let usedByRequest = 0;

      for (const stageId of stageIds) {
        const stage = stageMap.get(stageId);
        if (!stage) {
          skipped.push({
            stageId,
            stageName: "",
            reason: "关卡无效",
          });
          continue;
        }
        const skipReason = this.getSweepSkipReason(
          stage,
          clearedStageIds,
          todayCountMap,
          usedToday + usedByRequest,
          dailyLimit,
        );
        if (skipReason) {
          skipped.push({
            stageId: stage.id,
            stageName: stage.name,
            reason: skipReason,
          });
          continue;
        }

        const firstClearRewards = this.rewardService.normalizeRewards(
          stage.rewards,
          "关卡奖励不能为空",
        );
        const rewardSnapshot = this.toRepeatRewards(firstClearRewards);
        if (this.hasGrantableRewards(rewardSnapshot)) {
          await this.assertRewardAvailable(manager, rewardSnapshot);
        }
        const record = await recordRepository.save(
          recordRepository.create({
            uid,
            stage_id: stage.id,
            stage_name: stage.name,
            formation_power: 0,
            enemy_power: this.normalizePower(stage.enemy_power),
            success: true,
            reward_snapshot: rewardSnapshot,
            mode: "sweep",
          }),
        );
        if (this.hasGrantableRewards(rewardSnapshot)) {
          await this.rewardService.grantRewards(manager, user, rewardSnapshot, {
            sourceType: "pve",
            sourceId: stage.id,
            title: `关卡奖励：${stage.name}`,
            metadata: {
              stageId: stage.id,
              stageName: stage.name,
              mode: "sweep",
            },
          });
        }
        todayCountMap.set(stage.id, (todayCountMap.get(stage.id) || 0) + 1);
        usedByRequest += 1;
        rewardSnapshots.push(rewardSnapshot);
        list.push({
          stageId: record.stage_id,
          stageName: record.stage_name,
          success: true,
          rewards: rewardSnapshot,
        });
      }

      const rewardLookup = await this.buildRewardLookup(manager, rewardSnapshots);
      return {
        vipLevel,
        vipLabel: `VIP${vipLevel}`,
        dailyLimit,
        usedToday: usedToday + usedByRequest,
        remaining: Math.max(0, dailyLimit - usedToday - usedByRequest),
        swept: list.length,
        skipped,
        list: list.map((item) => ({
          ...item,
          rewards: item.rewards
            ? this.decorateRewards(item.rewards, rewardLookup)
            : null,
        })),
        pointAfter: user.point || 0,
      };
    });
  }

  private async getSweepVip(uid: string): Promise<FishpiVipView> {
    if (!this.rechargeService) {
      throw new Error("VIP未同步");
    }
    const vip = await this.rechargeService.getFishpiVipStatus(uid);
    if (!vip.checked) {
      throw new Error("VIP未同步");
    }
    if (!vip.active) {
      throw new Error("非VIP");
    }
    return vip;
  }

  private getVipLevel(levelCode: string) {
    const match = String(levelCode || "")
      .trim()
      .toUpperCase()
      .match(/^VIP([1-4])(?:[_-].*)?$/);
    return match ? Number(match[1]) : 0;
  }

  private getVipSweepLimit(level: number) {
    if (level <= 0) {
      throw new Error("VIP等级无效");
    }
    return [0, 5, 10, 20, 50][level] || 0;
  }

  private normalizeSweepStageIds(stageIds: number[]) {
    return [...new Set(stageIds)]
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);
  }

  private getSweepSkipReason(
    stage: PveStage,
    clearedStageIds: Set<number>,
    todayCountMap: Map<number, number>,
    usedToday: number,
    dailyLimit: number,
  ) {
    if (stage.enabled !== true) {
      return "关卡暂未开放";
    }
    if (!this.isStageInVisibleTime(stage)) {
      return "当前不在开放时间";
    }
    if (!clearedStageIds.has(Number(stage.id))) {
      return "未通关";
    }
    if (
      (todayCountMap.get(Number(stage.id)) || 0) >=
      this.normalizeDailyLimit(stage.daily_limit)
    ) {
      return "今日次数已用完";
    }
    if (usedToday >= dailyLimit) {
      return "VIP次数已用完";
    }
    return "";
  }

  async listRecords(uid: string, query: PvePageQuery = {}) {
    const page = this.normalizePage(query.page);
    const pageSize = this.normalizePageSize(query.pageSize);
    const [records, total] = await this.dataSource
      .getRepository(PveChallengeRecord)
      .findAndCount({
        where: { uid },
        order: { createdAt: "DESC", id: "DESC" } as any,
        skip: (page - 1) * pageSize,
        take: pageSize,
      });
    const rewardLookup = await this.buildRewardLookup(
      this.dataSource,
      records.map((record) => record.reward_snapshot || null),
    );
    return {
      list: records.map((record) => this.toRecordView(record, rewardLookup)),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  private async assertRewardAvailable(
    manager: EntityManager,
    rewards: RedeemRewards,
  ) {
    await Promise.all([
      this.rewardService.assertRewardItemsAvailable(
        manager.getRepository(DropItem),
        rewards.items || [],
      ),
      this.rewardService.assertRewardCardsAvailable(
        manager.getRepository(CardItem),
        rewards.cards || [],
      ),
    ]);
  }

  private assertStageCanChallenge(stage: PveStage) {
    if (stage.enabled !== true) {
      throw new Error("关卡暂未开放");
    }
    if (!this.isStageInVisibleTime(stage)) {
      throw new Error("关卡当前不在开放时间");
    }
    if (this.normalizeDailyLimit(stage.daily_limit) <= 0) {
      throw new Error("关卡今日暂不可挑战");
    }
  }

  private toStageView(
    stage: PveStage,
    formationPower: number,
    todayCount: number,
    rewardLookup?: RewardLookup,
    cleared = false,
  ) {
    const dailyLimit = this.normalizeDailyLimit(stage.daily_limit);
    const unavailableReason = this.getUnavailableReason(
      stage,
      formationPower,
      todayCount,
    );
    const firstClearRewards = this.rewardService.normalizeRewards(
      stage.rewards,
      "关卡奖励不能为空",
    );
    const repeatRewards = this.toRepeatRewards(firstClearRewards);
    const decoratedFirstClearRewards = rewardLookup
      ? this.decorateRewards(firstClearRewards, rewardLookup)
      : firstClearRewards;
    const decoratedRepeatRewards = rewardLookup
      ? this.decorateRewards(repeatRewards, rewardLookup)
      : repeatRewards;
    return {
      id: stage.id,
      name: stage.name,
      description: stage.description || "",
      enemyPower: this.normalizePower(stage.enemy_power),
      recommendedPower: this.normalizePower(stage.recommended_power),
      dailyLimit,
      todayCount,
      remainingAttempts: Math.max(0, dailyLimit - todayCount),
      canChallenge: !unavailableReason,
      unavailableReason,
      cleared,
      rewards: cleared ? decoratedRepeatRewards : decoratedFirstClearRewards,
      firstClearRewards: decoratedFirstClearRewards,
      repeatRewards: decoratedRepeatRewards,
      enabled: stage.enabled === true,
      sortOrder: Number(stage.sort_order || 0),
      startsAt: stage.starts_at || null,
      endsAt: stage.ends_at || null,
    };
  }

  private async buildRewardLookup(
    manager: DataSource | EntityManager,
    rewardsList: Array<RedeemRewards | null | undefined>,
  ) {
    const itemIds = [
      ...new Set(
        rewardsList.flatMap((rewards) =>
          (rewards?.items || []).map((item) => Number(item.itemId)),
        ),
      ),
    ].filter((itemId) => Number.isInteger(itemId) && itemId > 0);
    const cardIds = [
      ...new Set(
        rewardsList.flatMap((rewards) =>
          (rewards?.cards || []).map((card) => Number(card.cardId)),
        ),
      ),
    ].filter((cardId) => Number.isInteger(cardId) && cardId > 0);
    const [items, cards] = await Promise.all([
      itemIds.length
        ? manager.getRepository(DropItem).find({ where: { id: In(itemIds) } })
        : Promise.resolve([] as DropItem[]),
      cardIds.length
        ? manager.getRepository(CardItem).find({ where: { id: In(cardIds) } })
        : Promise.resolve([] as CardItem[]),
    ]);
    return {
      itemMap: new Map(items.map((item) => [item.id, item])),
      cardMap: new Map(cards.map((card) => [card.id, card])),
    };
  }

  private decorateRewards(
    rewards: RedeemRewards,
    lookup: RewardLookup,
  ): RedeemRewards {
    return {
      points: Number(rewards.points || 0),
      items: (rewards.items || []).map((item) => ({
        ...item,
        itemName: lookup.itemMap.get(Number(item.itemId))?.drop_name || "",
      })),
      ...(rewards.cards?.length
        ? {
            cards: rewards.cards.map((card) => ({
              ...card,
              cardName:
                lookup.cardMap.get(Number(card.cardId))?.card_name || "",
            })),
          }
        : {}),
    };
  }

  private toRecordView(
    record: PveChallengeRecord,
    rewardLookup?: RewardLookup,
  ) {
    return {
      id: record.id,
      uid: record.uid,
      stageId: record.stage_id,
      stageName: record.stage_name,
      formationPower: record.formation_power,
      enemyPower: record.enemy_power,
      success: record.success === true,
      mode: record.mode || "challenge",
      rewards:
        record.reward_snapshot && rewardLookup
          ? this.decorateRewards(record.reward_snapshot, rewardLookup)
          : record.reward_snapshot || null,
      createdAt: record.createdAt,
    };
  }

  private getUnavailableReason(
    stage: PveStage,
    formationPower: number,
    todayCount: number,
  ) {
    if (stage.enabled !== true) {
      return "关卡暂未开放";
    }
    if (!this.isStageInVisibleTime(stage)) {
      return "当前不在开放时间";
    }
    const dailyLimit = this.normalizeDailyLimit(stage.daily_limit);
    if (dailyLimit <= 0) {
      return "今日暂不可挑战";
    }
    if (todayCount >= dailyLimit) {
      return "今日次数已用完";
    }
    if (formationPower <= 0) {
      return "请先配置阵容";
    }
    return "";
  }

  private toRepeatRewards(rewards: RedeemRewards): RedeemRewards {
    return {
      points: 0,
      items: (rewards.items || []).map((item) => ({ ...item })),
    };
  }

  private hasGrantableRewards(
    rewards?: RedeemRewards | null,
  ): rewards is RedeemRewards {
    return Boolean(
      rewards &&
        (Number(rewards.points || 0) > 0 ||
          (rewards.items || []).length > 0 ||
          (rewards.cards || []).length > 0),
    );
  }

  private isStageInVisibleTime(stage: PveStage) {
    const now = Date.now();
    const startsAt = stage.starts_at ? new Date(stage.starts_at).getTime() : 0;
    const endsAt = stage.ends_at ? new Date(stage.ends_at).getTime() : 0;
    if (startsAt && startsAt > now) {
      return false;
    }
    if (endsAt && endsAt < now) {
      return false;
    }
    return true;
  }

  private getTodayRange(): [Date, Date] {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 1);
    return [start, end];
  }

  private normalizePower(value: unknown) {
    const number = Number(value || 0);
    return Number.isInteger(number) && number >= 0 ? number : 0;
  }

  private normalizeDailyLimit(value: unknown) {
    const number = Number(value || 0);
    return Number.isInteger(number) && number >= 0 ? number : 0;
  }

  private normalizePage(value?: number): number {
    const page = Number(value || 1);
    return Number.isInteger(page) && page > 0 ? page : 1;
  }

  private normalizePageSize(value?: number): number {
    const pageSize = Number(value || 10);
    if (!Number.isInteger(pageSize) || pageSize <= 0) {
      return 10;
    }
    return Math.min(pageSize, 50);
  }
}
