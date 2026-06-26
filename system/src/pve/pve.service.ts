import { Injectable, Optional } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Between, DataSource, EntityManager, In, Repository } from "typeorm";
import { CardItem } from "src/entity/card.entity";
import { DropItem } from "src/entity/drop.entity";
import { PveChallengeRecord } from "src/entity/pveChallengeRecord.entity";
import { PveStage } from "src/entity/pveStage.entity";
import type { RedeemRewards } from "src/entity/redeemCode.entity";
import { SystemConfig } from "src/entity/systemConfig.entity";
import { User } from "src/entity/user.entity";
import { FormationService } from "src/formation/formation.service";
import { RechargeService } from "src/recharge/recharge.service";
import { RewardService } from "src/reward/reward.service";
import { SocialActivityService } from "src/social/social-activity.service";
import { RedisUtil } from "src/utils/redis";
import type { GameVipStatusView } from "src/vip/game-vip";
import {
  DEFAULT_PVE_RISK_CONFIG,
  normalizePveRiskConfig,
  PVE_RISK_CONFIG_KEY,
  type PveRiskConfig,
} from "./pve-risk-config";
import {
  normalizePveTraits,
  PveBattleSimulator,
  pveTraitLabels,
  type PveBattleReport,
} from "./pve-battle-simulator";

export interface PvePageQuery {
  page?: number;
  pageSize?: number;
  focus?: string;
}

export interface PveSweepInput {
  stageIds?: number[];
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
  unlimited: boolean;
  swept: number;
  skipped: Array<{
    stageId: number;
    stageName: string;
    reason: string;
  }>;
  list: PveSweepStageResult[];
  pointAfter: number;
}

export interface PveAutoBattleStageResult {
  stageId: number;
  stageName: string;
  success: boolean;
  stars: number;
  formationPower: number;
  enemyPower: number;
  rewards: RedeemRewards | null;
  starRewards?: RedeemRewards | null;
}

export interface PveAutoBattleResult {
  attempted: number;
  cleared: number;
  stopReason: string;
  list: PveAutoBattleStageResult[];
  pointAfter: number;
}

type SettleChallengeResult = {
  record: PveChallengeRecord;
  success: boolean;
  stars: number;
  rewardSnapshot: RedeemRewards | null;
  starRewardSnapshot: RedeemRewards | null;
  battleReport: PveBattleReport;
  formationPower: number;
  enemyPower: number;
  clearedBefore: boolean;
  bestStarsBefore: number;
};

type RewardLookup = {
  itemMap: Map<number, DropItem>;
  cardMap: Map<number, CardItem>;
};

@Injectable()
export class PveService {
  private readonly battleSimulator = new PveBattleSimulator();

  constructor(
    private readonly dataSource: DataSource,
    private readonly formationService: FormationService,
    private readonly rewardService: RewardService,
    @Optional()
    private readonly socialActivityService?: SocialActivityService,
    @Optional()
    private readonly rechargeService?: RechargeService,
    @Optional()
    private readonly redis?: RedisUtil,
    @Optional()
    @InjectRepository(SystemConfig)
    private readonly systemConfigRepository?: Repository<SystemConfig>,
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
    const bestStarsMap = this.buildBestStarsMap(allClearedRecords);
    const nextUnclearedIndex = visibleStages.findIndex(
      (stage) => !allClearedStageIds.has(Number(stage.id)),
    );
    const nextUnclearedStageId =
      nextUnclearedIndex >= 0
        ? Number(visibleStages[nextUnclearedIndex].id)
        : null;
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
      pageStages.flatMap((stage) => [stage.rewards, stage.star_rewards]),
    );
    const todayCountMap = todayRecords.reduce((map, record) => {
      map.set(record.stage_id, (map.get(record.stage_id) || 0) + 1);
      return map;
    }, new Map<number, number>());

    // 全局可扫荡关卡数：所有已通关、当前开放、在开放时间内且今日还有次数的关卡
    const sweepableCount = visibleStages.filter(
      (stage) =>
        stage.enabled === true &&
        allClearedStageIds.has(Number(stage.id)) &&
        (todayCountMap.get(stage.id) || 0) <
          this.normalizeDailyLimit(stage.daily_limit),
    ).length;

    return {
      formation: {
        slotCount: formation.slotCount,
        filledCount: formation.slots.filter((slot) => Boolean(slot.card))
          .length,
        totalPower: formation.totalPower,
      },
      list: pageStages.map((stage) =>
        this.toStageView(
          stage,
          formation.totalPower,
          todayCountMap.get(stage.id) || 0,
          rewardLookup,
          allClearedStageIds.has(Number(stage.id)),
          bestStarsMap.get(Number(stage.id)) || 0,
        ),
      ),
      total,
      page,
      pageSize,
      totalPages,
      nextUnclearedStageId,
      nextUnclearedPage,
      sweepableCount,
    };
  }

  async challenge(uid: string, stageId: number) {
    if (!Number.isInteger(Number(stageId)) || Number(stageId) <= 0) {
      throw new Error("关卡参数无效");
    }
    await this.assertChallengeRateLimit(uid);

    return this.dataSource.transaction(async (manager) => {
      const stage = await manager.getRepository(PveStage).findOne({
        where: { id: Number(stageId), delete_flag: false },
        lock: { mode: "pessimistic_read" },
      });
      if (!stage) {
        throw new Error("关卡不存在");
      }
      this.assertStageCanChallenge(stage);

      const todayCount = await manager.getRepository(PveChallengeRecord).count({
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

      const settlement = await this.settleChallenge(
        manager,
        uid,
        user,
        stage,
        formation,
        "challenge",
      );

      const rewardLookup = await this.buildRewardLookup(manager, [
        stage.rewards,
        stage.star_rewards,
        ...(settlement.rewardSnapshot ? [settlement.rewardSnapshot] : []),
        ...(settlement.starRewardSnapshot
          ? [settlement.starRewardSnapshot]
          : []),
      ]);

      return {
        record: this.toRecordView(settlement.record, rewardLookup),
        stage: this.toStageView(
          stage,
          settlement.formationPower,
          todayCount + 1,
          rewardLookup,
          settlement.clearedBefore || settlement.success,
          Math.max(settlement.bestStarsBefore, settlement.stars),
        ),
        success: settlement.success,
        stars: settlement.stars,
        bestStars: Math.max(settlement.bestStarsBefore, settlement.stars),
        battleReport: settlement.battleReport,
        rewards: settlement.rewardSnapshot
          ? this.decorateRewards(settlement.rewardSnapshot, rewardLookup)
          : null,
        starRewards: settlement.starRewardSnapshot
          ? this.decorateRewards(settlement.starRewardSnapshot, rewardLookup)
          : null,
        formationPower: settlement.formationPower,
        enemyPower: settlement.enemyPower,
        pointAfter: user.point,
      };
    });
  }

  /**
   * 结算单关挑战：判定胜负、发放奖励、写入记录、记录社交动态。
   * challenge 与 autoBattle 共用，需在事务内调用，并已锁定 user。
   */
  private async settleChallenge(
    manager: EntityManager,
    uid: string,
    user: User,
    stage: PveStage,
    formation: any,
    mode: "challenge" | "auto",
  ): Promise<SettleChallengeResult> {
    const enemyPower = this.normalizePower(stage.enemy_power);
    const formationPower = Number(formation.totalPower || 0);
    const battle = this.battleSimulator.simulate({
      cards: this.getFormationBattleCards(formation),
      enemyPower,
      battleConfig: stage.battle_config || null,
    });
    const success = battle.success;
    const clearedBefore =
      (await manager.getRepository(PveChallengeRecord).count({
        where: {
          uid,
          stage_id: stage.id,
          success: true,
        },
      })) > 0;
    const bestStarsBefore = await this.getBestStars(manager, uid, stage.id);
    const firstClearRewards = success
      ? this.rewardService.normalizeRewards(stage.rewards, "关卡奖励不能为空")
      : null;
    const rewardSnapshot = firstClearRewards
      ? clearedBefore
        ? this.toRepeatRewards(firstClearRewards)
        : firstClearRewards
      : null;
    const starRewardSnapshot =
      success && battle.stars > bestStarsBefore
        ? this.buildStarRewardSnapshot(
            stage.star_rewards,
            battle.stars - bestStarsBefore,
          )
        : null;

    if (this.hasGrantableRewards(rewardSnapshot)) {
      await this.assertRewardAvailable(manager, rewardSnapshot);
    }
    if (this.hasGrantableRewards(starRewardSnapshot)) {
      await this.assertRewardAvailable(manager, starRewardSnapshot);
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
        stars: battle.stars,
        battle_report: battle.report,
        formation_snapshot: battle.formationSnapshot,
        mode,
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
          stars: battle.stars,
          mode,
        },
      });
    }
    if (this.hasGrantableRewards(starRewardSnapshot)) {
      await this.rewardService.grantRewards(manager, user, starRewardSnapshot, {
        sourceType: "pve",
        sourceId: stage.id,
        title: `星级奖励：${stage.name}`,
        metadata: {
          stageId: stage.id,
          stageName: stage.name,
          formationPower,
          enemyPower,
          stars: battle.stars,
          mode,
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
            stars: battle.stars,
          },
        },
        manager,
      );
    }

    return {
      record,
      success,
      stars: battle.stars,
      rewardSnapshot,
      starRewardSnapshot,
      battleReport: battle.report,
      formationPower,
      enemyPower,
      clearedBefore,
      bestStarsBefore,
    };
  }

  /**
   * 自动战斗：按关卡顺序从最近未通关的开始逐关挑战，遇到打不过或次数用完即停止。
   * 整个连续挑战在单个事务内完成，不逐关触发风控。
   */
  async autoBattle(uid: string): Promise<PveAutoBattleResult> {
    await this.assertChallengeRateLimit(uid);

    return this.dataSource.transaction(async (manager) => {
      const stageRepository = manager.getRepository(PveStage);
      const recordRepository = manager.getRepository(PveChallengeRecord);
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

      const stages = await stageRepository.find({
        where: { delete_flag: false, enabled: true },
        order: { sort_order: "ASC", id: "ASC" } as any,
      });
      const openStages = stages.filter((stage) =>
        this.isStageInVisibleTime(stage),
      );
      const stageIds = openStages.map((stage) => Number(stage.id));
      const clearedRecords = stageIds.length
        ? await recordRepository.find({
            where: { uid, stage_id: In(stageIds), success: true },
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
              createdAt: Between(...this.getTodayRange()),
            },
          })
        : [];
      const todayCountMap = todayRecords.reduce((map, record) => {
        map.set(record.stage_id, (map.get(record.stage_id) || 0) + 1);
        return map;
      }, new Map<number, number>());

      const list: PveAutoBattleStageResult[] = [];
      const rewardSnapshots: RedeemRewards[] = [];
      let cleared = 0;
      let stopReason = "已全部通关";

      for (const stage of openStages) {
        if (clearedStageIds.has(Number(stage.id))) {
          continue;
        }
        const dailyLimit = this.normalizeDailyLimit(stage.daily_limit);
        const usedToday = todayCountMap.get(Number(stage.id)) || 0;
        if (dailyLimit <= 0 || usedToday >= dailyLimit) {
          stopReason = `「${stage.name}」今日次数已用完`;
          break;
        }
        if (this.shouldStopAutoBattle(stage)) {
          stopReason = `「${stage.name}」需要手动挑战`;
          break;
        }

        const settlement = await this.settleChallenge(
          manager,
          uid,
          user,
          stage,
          formation,
          "auto",
        );
        if (settlement.rewardSnapshot) {
          rewardSnapshots.push(settlement.rewardSnapshot);
        }
        if (settlement.starRewardSnapshot) {
          rewardSnapshots.push(settlement.starRewardSnapshot);
        }
        list.push({
          stageId: stage.id,
          stageName: stage.name,
          success: settlement.success,
          stars: settlement.stars,
          formationPower: settlement.formationPower,
          enemyPower: settlement.enemyPower,
          rewards: settlement.rewardSnapshot,
          starRewards: settlement.starRewardSnapshot,
        });
        if (!settlement.success) {
          stopReason = `「${stage.name}」战力不足，停止自动`;
          break;
        }
        cleared += 1;
        clearedStageIds.add(Number(stage.id));
      }

      const rewardLookup = await this.buildRewardLookup(
        manager,
        rewardSnapshots,
      );
      return {
        attempted: list.length,
        cleared,
        stopReason,
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

  /**
   * 读取风控配置（来自 SystemConfig 表，key = pve_risk_control）。
   * 无 repo 或读取失败时回退默认配置。
   */
  private async getRiskConfig(): Promise<PveRiskConfig> {
    if (!this.systemConfigRepository) {
      return DEFAULT_PVE_RISK_CONFIG;
    }
    try {
      const row = await this.systemConfigRepository.findOne({
        where: { key: PVE_RISK_CONFIG_KEY },
      });
      if (!row?.value) {
        return DEFAULT_PVE_RISK_CONFIG;
      }
      return normalizePveRiskConfig(JSON.parse(row.value));
    } catch {
      return DEFAULT_PVE_RISK_CONFIG;
    }
  }

  /**
   * 挑战接口风控：窗口内超过阈值则临时封禁该用户挑战/自动战斗接口。
   * 封禁信息写入 ban key 的 value（含原始 uid），供后台展示与解除。
   * 风控关闭或 Redis 不可用时放行，避免误伤正常玩家。
   */
  private async assertChallengeRateLimit(uid: string) {
    if (!this.redis) {
      return;
    }
    const config = await this.getRiskConfig();
    if (!config.enabled) {
      return;
    }
    const banKey = `pve:ban:${uid}`;
    const banned = await this.redis.exists(banKey);
    if (banned) {
      throw new Error("操作过于频繁，请稍后再试");
    }
    const count = await this.redis.incrWithExpire(
      `pve:rate:${uid}`,
      config.windowSeconds,
    );
    if (count > config.limit) {
      await this.redis.set(
        banKey,
        {
          uid,
          reason: `${config.windowSeconds}秒内挑战超过${config.limit}次`,
          count,
          bannedAt: new Date().toISOString(),
        },
        config.banSeconds,
      );
      throw new Error("操作过于频繁，请稍后再试");
    }
  }

  async sweep(uid: string, input: PveSweepInput): Promise<PveSweepResult> {
    const requestedStageIds = this.normalizeSweepStageIds(
      input?.stageIds || [],
    );
    const vip = await this.getSweepVip(uid);
    const vipLevel = vip.tier;

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

      // 未指定关卡时，自动收集该用户所有已通关的关卡
      let stageIds = requestedStageIds;
      if (stageIds.length === 0) {
        const clearedAll = await recordRepository.find({
          where: { uid, success: true },
          select: ["stage_id"],
        });
        stageIds = [
          ...new Set(clearedAll.map((record) => Number(record.stage_id))),
        ];
      }
      if (stageIds.length === 0) {
        throw new Error("暂无可扫荡的已通关关卡");
      }

      const stages = await stageRepository.find({
        where: {
          id: In(stageIds),
          delete_flag: false,
        },
        order: { sort_order: "ASC", id: "ASC" } as any,
      });
      const stageMap = new Map(
        stages.map((stage) => [Number(stage.id), stage]),
      );
      const clearedRecords = await recordRepository.find({
        where: {
          uid,
          stage_id: In(stageIds),
          success: true,
        },
      });
      const clearedStageIds = new Set(
        clearedRecords.map((record) => Number(record.stage_id)),
      );
      const todayRecords = await recordRepository.find({
        where: {
          uid,
          stage_id: In(stageIds),
          createdAt: Between(...this.getTodayRange()),
        },
      });
      const todayCountMap = todayRecords.reduce((map, record) => {
        map.set(record.stage_id, (map.get(record.stage_id) || 0) + 1);
        return map;
      }, new Map<number, number>());

      const list: PveSweepStageResult[] = [];
      const skipped: PveSweepResult["skipped"] = [];
      const rewardSnapshots: RedeemRewards[] = [];

      // 扫荡按关卡顺序处理，不限制单次关卡数量，但仍受单关每日次数限制
      const orderedStageIds = stages
        .map((stage) => Number(stage.id))
        .concat(
          stageIds.filter((id) => !stageMap.has(id)), // 无效关卡也给出反馈
        );

      for (const stageId of orderedStageIds) {
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
            stars: 0,
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
        rewardSnapshots.push(rewardSnapshot);
        list.push({
          stageId: record.stage_id,
          stageName: record.stage_name,
          success: true,
          rewards: rewardSnapshot,
        });
      }

      const rewardLookup = await this.buildRewardLookup(
        manager,
        rewardSnapshots,
      );
      return {
        vipLevel,
        vipLabel: vip.label,
        unlimited: true,
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

  private async getSweepVip(uid: string): Promise<GameVipStatusView> {
    if (!this.rechargeService) {
      throw new Error("VIP未同步");
    }
    const vip = await this.rechargeService.getGameVipStatus(uid);
    if (!vip.checked) {
      throw new Error("VIP未同步");
    }
    if (!vip.active || vip.tier <= 0) {
      throw new Error("非VIP");
    }
    return vip;
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
    const dailyLimit = this.normalizeDailyLimit(stage.daily_limit);
    if (dailyLimit <= 0) {
      return "今日暂不可挑战";
    }
    if ((todayCountMap.get(Number(stage.id)) || 0) >= dailyLimit) {
      return "今日次数已用完";
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

  private getFormationBattleCards(formation: any) {
    return (formation?.slots || [])
      .map((slot) => slot.card)
      .filter(Boolean)
      .map((card) => ({
        uuid: card.uuid,
        cardId: card.cardId,
        cardName: card.cardName,
        cardLevel: card.cardLevel,
        battleRole: card.battleRole,
        power: Number(card.power || 0),
        basePower: Number(card.basePower || 0),
        potentialPower: Number(card.potentialPower || 0),
        potentialGrade: card.potentialGrade || "C",
      }));
  }

  private buildBestStarsMap(records: PveChallengeRecord[]) {
    return records.reduce((map, record) => {
      const stageId = Number(record.stage_id);
      map.set(
        stageId,
        Math.max(map.get(stageId) || 0, Number(record.stars || 0)),
      );
      return map;
    }, new Map<number, number>());
  }

  private async getBestStars(
    manager: EntityManager,
    uid: string,
    stageId: number,
  ) {
    const records = await manager.getRepository(PveChallengeRecord).find({
      where: { uid, stage_id: stageId, success: true },
      select: ["stars"],
    });
    return records.reduce(
      (max, record) => Math.max(max, Number(record.stars || 0)),
      0,
    );
  }

  private buildStarRewardSnapshot(
    rewards: RedeemRewards | null | undefined,
    count: number,
  ): RedeemRewards | null {
    const normalized = this.normalizeOptionalRewards(rewards);
    const multiplier = Math.max(0, Math.min(3, Math.floor(Number(count || 0))));
    if (!normalized || multiplier <= 0) {
      return null;
    }
    return this.scaleRewards(normalized, multiplier);
  }

  private normalizeOptionalRewards(
    rewards: RedeemRewards | null | undefined,
  ): RedeemRewards | null {
    if (!rewards) {
      return null;
    }
    try {
      return this.rewardService.normalizeRewards(rewards, "星级奖励不能为空");
    } catch {
      return null;
    }
  }

  private scaleRewards(rewards: RedeemRewards, count: number): RedeemRewards {
    return {
      points: Number(rewards.points || 0) * count,
      items: (rewards.items || []).map((item) => ({
        ...item,
        num: Number(item.num || 0) * count,
      })),
      ...(rewards.cards?.length
        ? {
            cards: rewards.cards.map((card) => ({
              ...card,
              num: Number(card.num || 0) * count,
            })),
          }
        : {}),
    };
  }

  private shouldStopAutoBattle(stage: PveStage) {
    if ((stage.boss_type || "none") !== "none") {
      return true;
    }
    return normalizePveTraits(stage.battle_config?.traits).length >= 2;
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
    bestStars = 0,
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
    const starRewards = this.normalizeOptionalRewards(stage.star_rewards);
    const decoratedFirstClearRewards = rewardLookup
      ? this.decorateRewards(firstClearRewards, rewardLookup)
      : firstClearRewards;
    const decoratedRepeatRewards = rewardLookup
      ? this.decorateRewards(repeatRewards, rewardLookup)
      : repeatRewards;
    const decoratedStarRewards =
      starRewards && rewardLookup
        ? this.decorateRewards(starRewards, rewardLookup)
        : starRewards;
    const traits = normalizePveTraits(stage.battle_config?.traits);
    return {
      id: stage.id,
      name: stage.name,
      description: stage.description || "",
      chapter: Number(stage.chapter || 1),
      stageNo: Number(stage.stage_no || 1),
      bossType: stage.boss_type || "none",
      bossName: stage.boss_name || "",
      traits,
      traitLabels: pveTraitLabels(traits),
      bestStars,
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
      starRewards: decoratedStarRewards,
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
      stars: Number(record.stars || 0),
      battleReport: record.battle_report || null,
      formationSnapshot: record.formation_snapshot || null,
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
