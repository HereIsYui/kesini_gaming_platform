import { Injectable, Optional } from "@nestjs/common";
import { Between, DataSource, EntityManager, In } from "typeorm";
import { CardItem } from "src/entity/card.entity";
import { DropItem } from "src/entity/drop.entity";
import { PveChallengeRecord } from "src/entity/pveChallengeRecord.entity";
import { PveStage } from "src/entity/pveStage.entity";
import type { RedeemRewards } from "src/entity/redeemCode.entity";
import { User } from "src/entity/user.entity";
import { FormationService } from "src/formation/formation.service";
import { RewardService } from "src/reward/reward.service";
import { SocialActivityService } from "src/social/social-activity.service";

export interface PvePageQuery {
  page?: number;
  pageSize?: number;
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
  ) {}

  async listStages(uid: string, query: PvePageQuery = {}) {
    const requestedPage = this.normalizePage(query.page);
    const pageSize = this.normalizePageSize(query.pageSize);
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
    const page = Math.min(requestedPage, totalPages);
    const pageStages = visibleStages.slice(
      (page - 1) * pageSize,
      page * pageSize,
    );
    const pageStageIds = pageStages.map((stage) => Number(stage.id));
    const rewardLookup = await this.buildRewardLookup(
      this.dataSource,
      pageStages.map((stage) => stage.rewards),
    );
    const clearedRecords = pageStageIds.length
      ? await recordRepository.find({
          where: {
            uid,
            stage_id: In(pageStageIds),
            success: true,
          },
        })
      : [];
    const clearedStageIds = new Set(
      clearedRecords.map((record) => Number(record.stage_id)),
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
          clearedStageIds.has(Number(stage.id)),
        ),
      ),
      total,
      page,
      pageSize,
      totalPages,
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
