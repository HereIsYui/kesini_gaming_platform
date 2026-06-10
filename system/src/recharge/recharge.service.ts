import { Injectable, Optional } from "@nestjs/common";
import axios from "axios";
import { randomUUID } from "crypto";
import { DataSource, EntityManager, In, Repository } from "typeorm";
import { RechargeConfig } from "src/entity/rechargeConfig.entity";
import {
  RechargeRecord,
  RechargeRecordStatus,
} from "src/entity/rechargeRecord.entity";
import { User } from "src/entity/user.entity";
import { CardItem } from "src/entity/card.entity";
import { DropItem } from "src/entity/drop.entity";
import { MonthlyCardSubscription } from "src/entity/monthlyCardSubscription.entity";
import { SystemConfig } from "src/entity/systemConfig.entity";
import { VipDailyClaim } from "src/entity/vipDailyClaim.entity";
import { RedeemRewards } from "src/entity/redeemCode.entity";
import { monthlyCardVipTier } from "src/monthly-card/monthly-card.config";
import { PointLedgerService } from "src/point-ledger/point-ledger.service";
import { AchievementService } from "src/achievement/achievement.service";
import { RewardService } from "src/reward/reward.service";
import {
  badgeVipTier,
  cloneRewards,
  DEFAULT_GAME_VIP_CONFIG,
  fishpiVipTier,
  GAME_VIP_CONFIG_KEY,
  GAME_VIP_FRAGMENT_DEFAULTS,
  GAME_VIP_TIERS,
  GameVipConfig,
  GameVipSource,
  GameVipSourceStatusView,
  GameVipStatusView,
  GameVipTier,
  GameVipTierKey,
  gameVipLabel,
  getGameVipBenefit,
  legacyVipLabel,
  monthlyVipLabel,
  normalizeGameVipConfig,
} from "src/vip/game-vip";

const FISHPI_POINTS_ENDPOINT = "https://fishpi.cn/user/edit/points";
const FISHPI_USER_ENDPOINT = "https://fishpi.cn/user";
const FISHPI_MEMBERSHIP_ENDPOINT = "https://fishpi.cn/api/membership";
const FISHPI_MEMBERSHIPS_CONFIGS_ENDPOINT =
  "https://fishpi.cn/api/memberships/configs";
const DEFAULT_MEMO_TEMPLATE = "抽卡平台充值，兑换星穹币 {amount}";
const FISHPI_HEADERS = {
  "User-Agent": "Kesini-Gacha-Platform/1.0",
};

export interface RechargeConfigView {
  enabled: boolean;
  minAmount: number;
  maxAmount: number;
  ratio: number;
  hasGoldFingerKey: boolean;
  hasFishpiApiKey: boolean;
}

export interface FishpiPointView {
  userName: string;
  point: number;
  vip: FishpiVipView;
  gameVip: GameVipStatusView;
}

export interface FishpiVipView {
  checked: boolean;
  active: boolean;
  levelCode: string;
  expiresAt: string | null;
}

export interface GameVipBenefitView {
  tier: 1 | 2 | 3 | 4;
  label: string;
  sweepLimit: number;
  tradeFeeDiscount: number;
  dailyRewards: RedeemRewards & {
    items: Array<{ itemId: number; num: number; itemName?: string }>;
  };
}

@Injectable()
export class RechargeService {
  constructor(
    private readonly dataSource: DataSource,
    @Optional()
    private readonly pointLedgerService?: PointLedgerService,
    @Optional()
    private readonly achievementService?: AchievementService,
    @Optional()
    private readonly rewardService?: RewardService,
  ) {}

  async getPublicConfig(): Promise<RechargeConfigView> {
    const config = await this.ensureConfig();
    return {
      enabled: config.enabled === true,
      minAmount: Number(config.min_amount || 1),
      maxAmount: Number(config.max_amount || 9999),
      ratio: this.getRechargeRatio(config),
      hasGoldFingerKey: Boolean(String(config.gold_finger_key || "").trim()),
      hasFishpiApiKey: Boolean(String(config.fishpi_api_key || "").trim()),
    };
  }

  async getFishpiPoint(uid: string): Promise<FishpiPointView> {
    const userRepository = this.dataSource.getRepository(User);
    const user = await userRepository.findOne({ where: { uid } });
    if (!user) {
      throw new Error("用户不存在");
    }

    const fishpiUserName = String(user.name || "").trim();
    if (!fishpiUserName) {
      throw new Error("缺少鱼排用户名");
    }

    const config = await this.ensureConfig();
    const data = await this.callFishpiPoint(fishpiUserName);
    const vip = await this.resolveFishpiVip(user, config);
    return {
      userName: fishpiUserName,
      point: this.extractFishpiPoint(data),
      vip,
      gameVip: await this.resolveGameVip(
        user,
        vip,
        String(config.fishpi_api_key || "").trim(),
      ),
    };
  }

  async getGameVipBenefitOverview(): Promise<GameVipBenefitView[]> {
    const config = await this.readGameVipConfig();
    const itemIds = Array.from(
      new Set(
        GAME_VIP_TIERS.flatMap((tier) =>
          getGameVipBenefit(config, tier).dailyRewards.items.map((item) =>
            Number(item.itemId),
          ),
        ).filter((itemId) => Number.isInteger(itemId) && itemId > 0),
      ),
    );
    const itemNameMap = await this.getDropItemNameMap(itemIds);
    return GAME_VIP_TIERS.map((tier) => {
      const benefit = getGameVipBenefit(config, tier);
      return {
        tier,
        label: gameVipLabel(tier),
        sweepLimit: benefit.sweepLimit,
        tradeFeeDiscount: benefit.tradeFeeDiscount,
        dailyRewards: this.decorateRewardItemNames(
          cloneRewards(benefit.dailyRewards),
          itemNameMap,
        ),
      };
    });
  }

  async getFishpiVipStatus(uid: string): Promise<FishpiVipView> {
    const userRepository = this.dataSource.getRepository(User);
    const user = await userRepository.findOne({ where: { uid } });
    if (!user) {
      throw new Error("用户不存在");
    }
    const config = await this.ensureConfig();
    return this.resolveFishpiVip(user, config);
  }

  async getGameVipStatus(uid: string): Promise<GameVipStatusView> {
    const userRepository = this.dataSource.getRepository(User);
    const user = await userRepository.findOne({ where: { uid } });
    if (!user) {
      throw new Error("用户不存在");
    }
    const config = await this.ensureConfig();
    const vip = await this.resolveFishpiVip(user, config);
    return this.resolveGameVip(
      user,
      vip,
      String(config.fishpi_api_key || "").trim(),
    );
  }

  async claimVipDailyPack(uid: string) {
    const vip = await this.getGameVipStatus(uid);
    if (!vip.checked) {
      throw new Error("VIP未同步");
    }
    if (!vip.active || vip.tier <= 0) {
      throw new Error("非VIP");
    }
    if (!this.rewardService) {
      throw new Error("VIP礼包暂不可用");
    }
    const rewards = this.rewardService.normalizeRewards(
      vip.dailyRewards,
      "VIP礼包未配置",
    );
    const claimDate = this.getDateKey(new Date());

    return this.dataSource.transaction(async (manager) => {
      const claimRepository = manager.getRepository(VipDailyClaim);
      const existing = await claimRepository.findOne({
        where: { uid, claim_date: claimDate },
        lock: { mode: "pessimistic_read" },
      });
      if (existing) {
        throw new Error("今日已领");
      }
      await Promise.all([
        this.rewardService!.assertRewardItemsAvailable(
          manager.getRepository(DropItem),
          rewards.items || [],
        ),
        this.rewardService!.assertRewardCardsAvailable(
          manager.getRepository(CardItem),
          rewards.cards || [],
        ),
      ]);
      const user = await manager.getRepository(User).findOne({
        where: { uid },
        lock: { mode: "pessimistic_write" },
      });
      if (!user) {
        throw new Error("用户不存在");
      }
      const saved = await claimRepository.save(
        claimRepository.create({
          uid,
          claim_date: claimDate,
          vip_level: vip.tier,
          reward_snapshot: cloneRewards(rewards),
        }),
      );
      await this.rewardService!.grantRewards(manager, user, rewards, {
        sourceType: "vip_daily",
        sourceId: claimDate,
        title: "VIP礼包",
        metadata: {
          claimDate,
          vipLevel: vip.tier,
        },
      });
      const itemNameMap = await this.getDropItemNameMap(
        (saved.reward_snapshot.items || []).map((item) => Number(item.itemId)),
        manager.getRepository(DropItem),
      );
      return {
        claimed: true,
        claimDate,
        vipLevel: vip.tier,
        rewards: this.decorateRewardItemNames(
          saved.reward_snapshot,
          itemNameMap,
        ),
        pointAfter: user.point || 0,
      };
    });
  }

  async recharge(uid: string, rawAmount: number, rawRequestId?: string) {
    const fishpiCost = this.normalizeAmount(rawAmount);
    const requestId = this.normalizeRequestId(rawRequestId);
    const recordRepository = this.dataSource.getRepository(RechargeRecord);
    const existing = await recordRepository.findOne({
      where: { uid, request_id: requestId },
    });
    if (existing) {
      return this.handleExistingRecord(existing);
    }

    const config = await this.ensureConfig();
    this.assertRechargeAvailable(config, fishpiCost);
    const localAmount = this.calculateLocalAmount(fishpiCost, config);

    const userRepository = this.dataSource.getRepository(User);
    const user = await userRepository.findOne({ where: { uid } });
    if (!user) {
      throw new Error("用户不存在");
    }
    const fishpiUserName = String(user.name || "").trim();
    if (!fishpiUserName) {
      throw new Error("当前账号缺少鱼排用户名，无法充值");
    }

    const pending = await recordRepository.save(
      recordRepository.create({
        uid,
        fishpi_user_name: fishpiUserName,
        request_id: requestId,
        amount: localAmount,
        fishpi_cost: fishpiCost,
        point_before: user.point || 0,
        point_after: user.point || 0,
        status: "pending",
        third_party_response: null,
        failure_reason: null,
      }),
    );

    let thirdPartyResponse: unknown;
    try {
      const balanceResponse = await this.callFishpiPoint(fishpiUserName);
      const userPoint = this.extractFishpiPoint(balanceResponse);
      this.assertFishpiBalance(userPoint, fishpiCost);
      const deductResponse = await this.callFishpiDeduct(
        config,
        fishpiUserName,
        fishpiCost,
        localAmount,
      );
      thirdPartyResponse = {
        balance: {
          userName: fishpiUserName,
          userPoint,
        },
        deduct: deductResponse,
      };
    } catch (error) {
      await this.markRecord(pending.id, "failed", {
        third_party_response: this.getThirdPartyErrorResponse(error),
        failure_reason: this.getErrorMessage(error),
      });
      throw error;
    }

    try {
      const saved = await this.dataSource.transaction((manager) =>
        this.applyLocalPoints(
          manager,
          pending.id,
          uid,
          localAmount,
          thirdPartyResponse,
        ),
      );
      return this.toRechargeResult(saved);
    } catch (error) {
      await this.markRecord(pending.id, "local_failed", {
        third_party_response:
          this.sanitizeThirdPartyResponse(thirdPartyResponse),
        failure_reason: this.getErrorMessage(error),
      });
      throw new Error("鱼排积分已扣除，星穹币入账失败，请联系运营");
    }
  }

  async deductFishpiPoints(uid: string, rawAmount: number, memo: string) {
    const fishpiCost = this.normalizeAmount(rawAmount);
    const config = await this.ensureConfig();
    if (!String(config.gold_finger_key || "").trim()) {
      throw new Error("购买暂不可用");
    }
    const user = await this.dataSource.getRepository(User).findOne({
      where: { uid },
    });
    if (!user) {
      throw new Error("用户不存在");
    }
    const fishpiUserName = String(user.name || "").trim();
    if (!fishpiUserName) {
      throw new Error("缺少鱼排用户名");
    }
    const balanceResponse = await this.callFishpiPoint(fishpiUserName);
    const userPoint = this.extractFishpiPoint(balanceResponse);
    this.assertFishpiBalance(userPoint, fishpiCost);
    const deductResponse = await this.callFishpiDeduct(
      config,
      fishpiUserName,
      fishpiCost,
      fishpiCost,
      memo,
    );
    return {
      balance: {
        userName: fishpiUserName,
        userPoint,
      },
      deduct: deductResponse,
    };
  }

  async ensureConfig(manager?: EntityManager): Promise<RechargeConfig> {
    const repository = (manager || this.dataSource).getRepository(
      RechargeConfig,
    );
    let config = await repository.findOne({ where: { id: 1 } });
    if (!config) {
      config = repository.create({
        id: 1,
        enabled: false,
        gold_finger_key: "",
        fishpi_api_key: "",
        min_amount: 1,
        max_amount: 9999,
        recharge_ratio: 1,
        memo_template: DEFAULT_MEMO_TEMPLATE,
      });
      config = await repository.save(config);
    }
    config.min_amount = Number(config.min_amount || 1);
    config.max_amount = Number(config.max_amount || 9999);
    config.recharge_ratio = this.getRechargeRatio(config);
    config.memo_template = config.memo_template || DEFAULT_MEMO_TEMPLATE;
    config.fishpi_api_key = config.fishpi_api_key || "";
    return config;
  }

  private async applyLocalPoints(
    manager: EntityManager,
    recordId: number,
    uid: string,
    amount: number,
    thirdPartyResponse: unknown,
  ): Promise<RechargeRecord> {
    const userRepository = manager.getRepository(User);
    const recordRepository = manager.getRepository(RechargeRecord);
    const record = await recordRepository.findOne({
      where: { id: recordId },
      lock: { mode: "pessimistic_write" },
    });
    if (!record) {
      throw new Error("充值记录不存在");
    }
    if (record.status === "success") {
      return record;
    }
    if (record.status !== "pending") {
      throw new Error("充值记录状态异常");
    }

    const user = await userRepository.findOne({
      where: { uid },
      lock: { mode: "pessimistic_write" },
    });
    if (!user) {
      throw new Error("用户不存在");
    }

    let pointBefore = Number(user.point || 0);
    let pointAfter = pointBefore + amount;
    if (this.pointLedgerService) {
      const ledger = await this.pointLedgerService.applyChange(
        manager,
        user,
        amount,
        {
          sourceType: "recharge",
          sourceId: record.request_id,
          title: "星穹币充值",
          metadata: {
            requestId: record.request_id,
            fishpiUserName: record.fishpi_user_name,
            fishpiCost: record.fishpi_cost,
            amount,
          },
        },
      );
      pointBefore = ledger.point_before;
      pointAfter = ledger.point_after;
    } else {
      user.point = pointAfter;
      await userRepository.save(user);
    }

    record.point_before = pointBefore;
    record.point_after = pointAfter;
    record.status = "success";
    record.third_party_response =
      this.sanitizeThirdPartyResponse(thirdPartyResponse);
    record.failure_reason = null;
    const saved = await recordRepository.save(record);
    await this.achievementService?.evaluateAndUnlock(manager, uid);
    return saved;
  }

  private async callFishpiPoint(userName: string) {
    const endpoint = `${FISHPI_USER_ENDPOINT}/${encodeURIComponent(
      userName,
    )}/point`;
    try {
      const response = await axios.get(endpoint, {
        timeout: 10000,
        headers: FISHPI_HEADERS,
      });
      if (
        response.data?.code !== undefined &&
        !this.isFishpiSuccess(response.data)
      ) {
        throw new Error(
          this.getFishpiErrorMessage(response.data, "鱼排积分查询失败"),
        );
      }
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = this.getFishpiErrorMessage(
          error.response?.data,
          "鱼排积分查询失败",
        );
        throw new Error(message || error.message || "鱼排积分查询失败");
      }
      throw error;
    }
  }

  private async resolveFishpiVip(
    user: User,
    config: RechargeConfig,
  ): Promise<FishpiVipView> {
    const apiKey = String(config.fishpi_api_key || "").trim();
    if (!apiKey) {
      return this.uncheckedFishpiVip();
    }
    const userId = String(user.uid || "").trim();
    if (!userId) {
      return this.uncheckedFishpiVip();
    }
    let directResult: FishpiVipView | null = null;
    try {
      const data = await this.callFishpiMembership(userId, apiKey);
      directResult = this.extractFishpiVip(data);
      if (directResult.active) {
        return directResult;
      }
    } catch {
      directResult = null;
    }
    const configResult = await this.resolveFishpiVipFromConfigs(user, apiKey);
    return configResult || directResult || this.uncheckedFishpiVip();
  }

  private async resolveGameVip(
    user: User,
    fishpiVip?: FishpiVipView,
    fishpiApiKey = "",
  ): Promise<GameVipStatusView> {
    const vip = fishpiVip || (await this.getFishpiVipStatus(user.uid));
    const fishpiTier = fishpiVipTier(vip.levelCode, vip.active);
    const badge = await this.resolveBadgeVip(user, fishpiApiKey);
    const monthlyCardTier = await this.resolveMonthlyCardVip(user.uid);
    const tier = Math.max(fishpiTier, badge.tier, monthlyCardTier) as GameVipTier;
    const sources: GameVipSource[] = [];
    if (fishpiTier === tier && tier > 0) {
      sources.push("fishpi");
    }
    if (badge.tier === tier && tier > 0) {
      sources.push("badge");
    }
    if (monthlyCardTier === tier && tier > 0) {
      sources.push("monthly_card");
    }
    const sourceTiers: Partial<Record<GameVipSource, GameVipTier>> = {
      fishpi: fishpiTier,
      badge: badge.tier,
      monthly_card: monthlyCardTier,
    };
    const checked = vip.checked || badge.tier > 0 || monthlyCardTier > 0;
    const fishpiVipStatus = this.toGameVipSourceStatus(
      vip.checked,
      fishpiTier,
      fishpiTier > 0 ? gameVipLabel(fishpiTier) : vip.checked ? "非VIP" : "未同步",
    );
    const monthlyVipStatus = this.toGameVipSourceStatus(
      true,
      monthlyCardTier,
      monthlyCardTier > 0 ? monthlyVipLabel(monthlyCardTier) : "未开通",
    );
    const legacyVipStatus = this.toGameVipSourceStatus(
      badge.checked,
      badge.tier,
      badge.checked ? legacyVipLabel(badge.tier) : "未同步",
    );
    const effectiveVip = this.toGameVipSourceStatus(
      checked,
      tier,
      this.effectiveVipLabel(tier, {
        fishpiTier,
        monthlyCardTier,
        legacyTier: badge.tier,
      }),
    );
    const config = await this.readGameVipConfig();
    const benefit = getGameVipBenefit(config, tier);
    const dailyRewards = cloneRewards(benefit.dailyRewards);
    const itemNameMap = await this.getDropItemNameMap(
      (dailyRewards.items || []).map((item) => Number(item.itemId)),
    );
    const claimDate = this.getDateKey(new Date());
    const dailyClaimed =
      tier > 0
        ? Boolean(
            await this.dataSource.getRepository(VipDailyClaim).findOne({
              where: { uid: user.uid, claim_date: claimDate },
            }),
          )
        : false;
    return {
      checked,
      active: tier > 0,
      tier,
      label: checked ? gameVipLabel(tier) : "未同步",
      effectiveVip,
      fishpiVip: fishpiVipStatus,
      monthlyVip: monthlyVipStatus,
      legacyVip: legacyVipStatus,
      sources,
      sourceLabels: this.toGameVipSourceLabels(sources),
      sourceTiers,
      sweepLimit: benefit.sweepLimit,
      tradeFeeDiscount: benefit.tradeFeeDiscount,
      dailyRewards: this.decorateRewardItemNames(dailyRewards, itemNameMap),
      dailyClaimed,
      dailyClaimDate: claimDate,
    };
  }

  private async resolveBadgeVip(
    user: User,
    apiKey: string,
  ): Promise<{ checked: boolean; tier: GameVipTier }> {
    try {
      const fishpiApiKey = String(apiKey || "").trim();
      if (!fishpiApiKey) {
        return { checked: false, tier: 0 };
      }
      const fishpiUserName = String(user.name || "").trim();
      if (!fishpiUserName) {
        return { checked: false, tier: 0 };
      }
      const data = await this.callFishpiUserProfile(
        fishpiUserName,
        fishpiApiKey,
      );
      return { checked: true, tier: badgeVipTier(data) };
    } catch {
      return { checked: false, tier: 0 };
    }
  }

  private toGameVipSourceStatus(
    checked: boolean,
    tier: GameVipTier,
    label: string,
  ): GameVipSourceStatusView {
    return {
      checked,
      active: tier > 0,
      tier,
      label,
    };
  }

  private effectiveVipLabel(
    tier: GameVipTier,
    sources: {
      fishpiTier: GameVipTier;
      monthlyCardTier: GameVipTier;
      legacyTier: GameVipTier;
    },
  ) {
    if (tier <= 0) {
      return "非VIP";
    }
    const sourceLabel =
      sources.legacyTier === tier
        ? legacyVipLabel(sources.legacyTier)
        : sources.monthlyCardTier === tier
          ? monthlyVipLabel(sources.monthlyCardTier)
          : sources.fishpiTier === tier
            ? "鱼排VIP"
            : "";
    return sourceLabel ? `${gameVipLabel(tier)} · ${sourceLabel}` : gameVipLabel(tier);
  }

  private async resolveMonthlyCardVip(uid: string): Promise<GameVipTier> {
    const subscriptions = await this.dataSource
      .getRepository(MonthlyCardSubscription)
      .find({ where: { uid } });
    return monthlyCardVipTier(subscriptions);
  }

  private async callFishpiUserProfile(userName: string, apiKey: string) {
    const endpoint = `${FISHPI_USER_ENDPOINT}/${encodeURIComponent(
      userName,
    )}?apiKey=${encodeURIComponent(apiKey)}`;
    const response = await axios.get(endpoint, {
      timeout: 10000,
      headers: FISHPI_HEADERS,
    });
    if (
      response.data?.code !== undefined &&
      !this.isFishpiSuccess(response.data)
    ) {
      throw new Error(
        this.getFishpiErrorMessage(response.data, "鱼排资料查询失败"),
      );
    }
    return response.data?.data ?? response.data;
  }

  private async readGameVipConfig(): Promise<GameVipConfig> {
    const repository = this.dataSource.getRepository(SystemConfig);
    const row = await repository.findOne({
      where: { key: GAME_VIP_CONFIG_KEY },
    });
    if (!row?.value) {
      return this.withDefaultVipFragments(DEFAULT_GAME_VIP_CONFIG);
    }
    try {
      return normalizeGameVipConfig(JSON.parse(row.value));
    } catch {
      return normalizeGameVipConfig(null);
    }
  }

  private async withDefaultVipFragments(
    config: GameVipConfig,
  ): Promise<GameVipConfig> {
    const normalized = normalizeGameVipConfig(config);
    const items = await this.dataSource.getRepository(DropItem).find({
      where: { drop_type: 0, disabled: false } as any,
    });
    const itemMap = new Map(
      items.map((item) => [String(item.drop_name || "").trim(), item]),
    );
    GAME_VIP_TIERS.forEach((tier) => {
      const key = String(tier) as GameVipTierKey;
      const defaults = GAME_VIP_FRAGMENT_DEFAULTS[key];
      normalized.tiers[key].dailyRewards.items = defaults
        .map((item) => {
          const dropItem = itemMap.get(item.name);
          return dropItem
            ? {
                itemId: Number(dropItem.id),
                num: item.num,
              }
            : null;
        })
        .filter(
          (item): item is { itemId: number; num: number } => item !== null,
        );
    });
    return normalized;
  }

  private async getDropItemNameMap(
    itemIds: number[],
    repository: Repository<DropItem> = this.dataSource.getRepository(DropItem),
  ) {
    if (itemIds.length === 0) {
      return new Map<number, string>();
    }
    const items = await repository.find({
      where: { id: In(itemIds) },
    });
    return new Map(items.map((item) => [Number(item.id), item.drop_name]));
  }

  private decorateRewardItemNames(
    rewards: RedeemRewards,
    itemNameMap: Map<number, string>,
  ): GameVipBenefitView["dailyRewards"] {
    return {
      ...rewards,
      items: rewards.items.map((item) => ({
        ...item,
        itemName: itemNameMap.get(Number(item.itemId)) || "",
      })),
    };
  }

  private toGameVipSourceLabels(sources: GameVipSource[]) {
    const labels: Record<GameVipSource, string> = {
      fishpi: "鱼排",
      badge: "小冰",
      monthly_card: "月卡",
    };
    return sources.map((source) => labels[source] || source);
  }

  private async callFishpiMembership(userId: string, apiKey: string) {
    const endpoint = `${FISHPI_MEMBERSHIP_ENDPOINT}/${encodeURIComponent(
      userId,
    )}?apiKey=${encodeURIComponent(apiKey)}`;
    const response = await axios.get(endpoint, {
      timeout: 10000,
      headers: FISHPI_HEADERS,
    });
    if (
      response.data?.code !== undefined &&
      !this.isFishpiSuccess(response.data)
    ) {
      throw new Error(
        this.getFishpiErrorMessage(response.data, "鱼排会员查询失败"),
      );
    }
    return response.data;
  }

  private async resolveFishpiVipFromConfigs(
    user: User,
    apiKey: string,
  ): Promise<FishpiVipView | null> {
    try {
      const data = await this.callFishpiMembershipConfigs(apiKey);
      const entry = this.findFishpiVipConfig(data, user);
      return entry
        ? this.extractFishpiVip({ data: { state: 1, ...entry } })
        : null;
    } catch {
      return null;
    }
  }

  private async callFishpiMembershipConfigs(apiKey: string) {
    const endpoint = `${FISHPI_MEMBERSHIPS_CONFIGS_ENDPOINT}?apiKey=${encodeURIComponent(
      apiKey,
    )}`;
    const response = await axios.get(endpoint, {
      timeout: 10000,
      headers: FISHPI_HEADERS,
    });
    if (
      response.data?.code !== undefined &&
      !this.isFishpiSuccess(response.data)
    ) {
      throw new Error(
        this.getFishpiErrorMessage(response.data, "鱼排会员查询失败"),
      );
    }
    return response.data;
  }

  private findFishpiVipConfig(data: any, user: User) {
    const identifiers = new Set(
      [user.uid, user.name]
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean),
    );
    if (identifiers.size === 0) {
      return null;
    }
    return (
      this.toFishpiArray(data?.data ?? data).find((entry) =>
        this.collectFishpiUserIdentifiers(entry).some((value) =>
          identifiers.has(value),
        ),
      ) || null
    );
  }

  private toFishpiArray(value: any): any[] {
    if (Array.isArray(value)) {
      return value;
    }
    const nested =
      value?.list ?? value?.records ?? value?.items ?? value?.configs ?? [];
    return Array.isArray(nested) ? nested : [];
  }

  private collectFishpiUserIdentifiers(entry: any): string[] {
    const sources = [entry, entry?.user, entry?.userInfo].filter(Boolean);
    const keys = [
      "oId",
      "oid",
      "userId",
      "userID",
      "uid",
      "userName",
      "username",
      "name",
      "userOId",
      "userOid",
      "user_oId",
      "user_oid",
    ];
    return sources
      .flatMap((source) => keys.map((key) => source?.[key]))
      .map((value) => String(value || "").trim().toLowerCase())
      .filter(Boolean);
  }

  private extractFishpiVip(data: any): FishpiVipView {
    const payload = data?.data ?? data ?? {};
    const levelCode = String(
      payload?.lvCode ??
        payload?.levelCode ??
        payload?.level_code ??
        payload?.vipLevel ??
        payload?.vip_level ??
        "",
    );
    const expiresAt = this.normalizeFishpiVipExpiresAt(
      payload?.expiresAt ??
        payload?.expireAt ??
        payload?.expiredAt ??
        payload?.expires_at ??
        payload?.expire_at ??
        payload?.expired_at ??
        payload?.expirationTime ??
        payload?.expireTime ??
        payload?.expiredTime ??
        payload?.endTime ??
        payload?.endAt ??
        payload?.validUntil,
    );
    const stateActive = this.isFishpiVipStateActive(payload?.state, levelCode);
    return {
      checked: true,
      active: stateActive && !this.isFishpiVipExpired(expiresAt),
      levelCode,
      expiresAt,
    };
  }

  private normalizeFishpiVipExpiresAt(value: unknown): string | null {
    if (value instanceof Date) {
      return Number.isFinite(value.getTime()) ? value.toISOString() : null;
    }
    if (typeof value === "number") {
      return this.normalizeFishpiVipTimestamp(value);
    }
    const text = String(value || "").trim();
    if (!text) {
      return null;
    }
    const timestamp = Number(text);
    if (Number.isFinite(timestamp)) {
      return this.normalizeFishpiVipTimestamp(timestamp);
    }
    const parsed = Date.parse(text);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : text;
  }

  private normalizeFishpiVipTimestamp(value: number): string | null {
    const timestamp = value < 10_000_000_000 ? value * 1000 : value;
    const date = new Date(timestamp);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }

  private isFishpiVipStateActive(state: unknown, levelCode: string) {
    if (state === undefined || state === null || state === "") {
      return Boolean(levelCode);
    }
    if (typeof state === "boolean") {
      return state;
    }
    if (typeof state === "number") {
      return state !== 0;
    }
    const text = String(state).trim().toLowerCase();
    if (!text) {
      return Boolean(levelCode);
    }
    if (
      ["0", "false", "inactive", "expired", "none", "normal"].includes(text)
    ) {
      return false;
    }
    return true;
  }

  private isFishpiVipExpired(expiresAt: string | null) {
    if (!expiresAt) {
      return false;
    }
    const time = Date.parse(expiresAt);
    return Number.isFinite(time) && time <= Date.now();
  }

  private uncheckedFishpiVip(): FishpiVipView {
    return {
      checked: false,
      active: false,
      levelCode: "",
      expiresAt: null,
    };
  }

  private async callFishpiDeduct(
    config: RechargeConfig,
    userName: string,
    fishpiCost: number,
    localAmount: number,
    memoOverride?: string,
  ) {
    const payload = {
      goldFingerKey: String(config.gold_finger_key || "").trim(),
      userName,
      point: -fishpiCost,
      memo: memoOverride || this.renderMemo(config.memo_template, localAmount, fishpiCost),
    };
    try {
      const response = await axios.post(FISHPI_POINTS_ENDPOINT, payload, {
        timeout: 10000,
        headers: {
          "Content-Type": "application/json",
          ...FISHPI_HEADERS,
        },
      });
      if (!this.isFishpiSuccess(response.data)) {
        throw new Error(this.getFishpiErrorMessage(response.data));
      }
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = this.getFishpiErrorMessage(error.response?.data);
        throw new Error(message || error.message || "鱼排积分扣除失败");
      }
      throw error;
    }
  }

  private assertRechargeAvailable(config: RechargeConfig, amount: number) {
    if (config.enabled !== true) {
      throw new Error("充值功能暂未开启");
    }
    if (!String(config.gold_finger_key || "").trim()) {
      throw new Error("充值暂不可用");
    }
    if (amount < Number(config.min_amount || 1)) {
      throw new Error(`充值金额不能小于${config.min_amount}`);
    }
    if (amount > Number(config.max_amount || 9999)) {
      throw new Error(`充值金额不能大于${config.max_amount}`);
    }
    if (!Number.isFinite(this.getRechargeRatio(config))) {
      throw new Error("充值暂不可用");
    }
  }

  private handleExistingRecord(record: RechargeRecord) {
    if (record.status === "success") {
      return this.toRechargeResult(record);
    }
    if (record.status === "pending") {
      throw new Error("该充值请求正在处理中，请稍后查看星穹币余额");
    }
    if (record.status === "local_failed") {
      throw new Error("该充值请求已扣除鱼排积分，星穹币入账失败，请联系运营");
    }
    throw new Error(
      record.failure_reason || "该充值已失败，请更换流水号后重试",
    );
  }

  private normalizeAmount(value: number): number {
    const amount = Number(value);
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error("充值金额必须为正整数");
    }
    return amount;
  }

  private normalizeRequestId(value?: string): string {
    const requestId = String(value || randomUUID()).trim();
    if (!requestId) {
      throw new Error("充值流水号不能为空");
    }
    if (requestId.length > 80) {
      throw new Error("充值流水号不能超过80个字符");
    }
    return requestId;
  }

  private calculateLocalAmount(fishpiCost: number, config: RechargeConfig) {
    const localAmount = Math.floor(fishpiCost * this.getRechargeRatio(config));
    if (!Number.isInteger(localAmount) || localAmount < 1) {
      throw new Error("当前充值比例下到账星穹币不能小于1");
    }
    return localAmount;
  }

  private getRechargeRatio(config: RechargeConfig) {
    const ratio = Number(config.recharge_ratio || 1);
    return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  }

  private renderMemo(
    template: string,
    localAmount: number,
    fishpiCost: number,
  ): string {
    return String(template || DEFAULT_MEMO_TEMPLATE)
      .replace(/\{amount\}/g, String(localAmount))
      .replace(/\{points\}/g, String(localAmount))
      .replace(/\{fishpiCost\}/g, String(fishpiCost));
  }

  private extractFishpiPoint(data: any): number {
    const payload = data?.data ?? data;
    const rawPoint =
      typeof payload === "number"
        ? payload
        : (payload?.userPoint ??
          payload?.point ??
          data?.userPoint ??
          data?.point);
    const point = Number(rawPoint);
    if (!Number.isFinite(point)) {
      throw new Error("鱼排积分查询结果异常");
    }
    return point;
  }

  private assertFishpiBalance(userPoint: number, fishpiCost: number) {
    if (userPoint < 0) {
      throw new Error("鱼排积分为负数，无法充值");
    }
    if (userPoint < fishpiCost) {
      throw new Error(
        `鱼排积分不足，需要${fishpiCost}，当前${Math.floor(userPoint)}`,
      );
    }
  }

  private isFishpiSuccess(data: any): boolean {
    return data?.code === 0 || data?.code === "0";
  }

  private getFishpiErrorMessage(
    data: any,
    fallback = "鱼排积分扣除失败",
  ): string {
    if (data?.msg) {
      return String(data.msg);
    }
    if (data?.message) {
      return String(data.message);
    }
    return fallback;
  }

  getThirdPartyErrorResponse(error: unknown) {
    if (axios.isAxiosError(error)) {
      return this.sanitizeThirdPartyResponse(error.response?.data || null);
    }
    return { message: this.getErrorMessage(error) };
  }

  sanitizeThirdPartyResponse(value: unknown) {
    if (value === undefined) {
      return null;
    }
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return { raw: String(value) };
    }
  }

  private async markRecord(
    recordId: number,
    status: RechargeRecordStatus,
    patch: Partial<RechargeRecord>,
  ) {
    const repository = this.dataSource.getRepository(RechargeRecord);
    const record = await repository.findOne({ where: { id: recordId } });
    if (!record) {
      return;
    }
    await repository.save({
      ...record,
      ...patch,
      status,
    });
  }

  private toRechargeResult(record: RechargeRecord) {
    return {
      requestId: record.request_id,
      amount: record.amount,
      fishpiCost: record.fishpi_cost,
      pointBefore: record.point_before,
      pointAfter: record.point_after,
    };
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "操作失败";
  }

  private getDateKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}
