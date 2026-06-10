import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { DataSource, EntityManager } from "typeorm";
import {
  MonthlyCardPurchaseRecord,
  MonthlyCardPurchaseStatus,
} from "src/entity/monthlyCardPurchaseRecord.entity";
import {
  MonthlyCardSubscription,
  MonthlyCardType,
} from "src/entity/monthlyCardSubscription.entity";
import { SystemConfig } from "src/entity/systemConfig.entity";
import { User } from "src/entity/user.entity";
import { RechargeService } from "src/recharge/recharge.service";
import {
  flattenMonthlyCardConfig,
  isMonthlyCardActive,
  MONTHLY_CARD_CONFIG_KEY,
  MonthlyCardConfig,
  normalizeMonthlyCardConfig,
  normalizeMonthlyCardType,
  toMonthlyCardPlanView,
} from "./monthly-card.config";

export interface PurchaseMonthlyCardInput {
  cardType: MonthlyCardType;
  requestId?: string;
}

@Injectable()
export class MonthlyCardService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly rechargeService: RechargeService,
  ) {}

  async getPublicConfig() {
    const [config, benefitTiers] = await Promise.all([
      this.readConfig(),
      this.rechargeService.getGameVipBenefitOverview(),
    ]);
    return {
      ...flattenMonthlyCardConfig(config),
      cards: toMonthlyCardPlanView(config),
      benefitTiers,
    };
  }

  async getMyStatus(uid: string) {
    const [config, subscriptions, gameVip, benefitTiers] = await Promise.all([
      this.readConfig(),
      this.dataSource.getRepository(MonthlyCardSubscription).find({
        where: { uid },
      }),
      this.rechargeService.getGameVipStatus(uid),
      this.rechargeService.getGameVipBenefitOverview(),
    ]);
    return {
      config: {
        ...flattenMonthlyCardConfig(config),
        cards: toMonthlyCardPlanView(config),
        benefitTiers,
      },
      cards: this.toStatusCards(config, subscriptions, gameVip),
      gameVip,
      benefitTiers,
    };
  }

  async purchase(uid: string, input: PurchaseMonthlyCardInput) {
    const cardType = normalizeMonthlyCardType(input.cardType);
    const requestId = this.normalizeRequestId(input.requestId);
    const recordRepository = this.dataSource.getRepository(
      MonthlyCardPurchaseRecord,
    );
    const existing = await recordRepository.findOne({
      where: { uid, request_id: requestId },
    });
    if (existing) {
      return this.handleExistingRecord(existing);
    }

    const config = await this.readConfig();
    this.assertPurchasable(config, cardType);
    const plan = config.plans[cardType];
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

    const now = new Date();
    const pending = await recordRepository.save(
      recordRepository.create({
        uid,
        fishpi_user_name: fishpiUserName,
        card_type: cardType,
        vip_level: plan.vipLevel,
        request_id: requestId,
        fishpi_cost: plan.price,
        starts_at: now,
        expires_at: this.addDays(now, config.durationDays),
        status: "pending",
        third_party_response: null,
        failure_reason: null,
      }),
    );

    let thirdPartyResponse: unknown;
    try {
      thirdPartyResponse = await this.rechargeService.deductFishpiPoints(
        uid,
        plan.price,
        `${plan.label}购买`,
      );
    } catch (error) {
      await this.markRecord(pending.id, "failed", {
        third_party_response:
          this.rechargeService.getThirdPartyErrorResponse(error),
        failure_reason: this.getErrorMessage(error),
      });
      throw error;
    }

    try {
      const saved = await this.dataSource.transaction((manager) =>
        this.applyMonthlyCard(
          manager,
          pending.id,
          uid,
          config,
          cardType,
          thirdPartyResponse,
        ),
      );
      return this.toPurchaseResult(saved);
    } catch (error) {
      await this.markRecord(pending.id, "local_failed", {
        third_party_response:
          this.rechargeService.sanitizeThirdPartyResponse(thirdPartyResponse),
        failure_reason: this.getErrorMessage(error),
      });
      throw new Error("鱼排积分已扣除，月卡开通失败，请联系运营");
    }
  }

  async readConfig(): Promise<MonthlyCardConfig> {
    const row = await this.dataSource.getRepository(SystemConfig).findOne({
      where: { key: MONTHLY_CARD_CONFIG_KEY },
    });
    if (!row?.value) {
      return normalizeMonthlyCardConfig(null);
    }
    try {
      return normalizeMonthlyCardConfig(JSON.parse(row.value));
    } catch {
      return normalizeMonthlyCardConfig(null);
    }
  }

  private async applyMonthlyCard(
    manager: EntityManager,
    recordId: number,
    uid: string,
    config: MonthlyCardConfig,
    cardType: MonthlyCardType,
    thirdPartyResponse: unknown,
  ) {
    const recordRepository = manager.getRepository(MonthlyCardPurchaseRecord);
    const subscriptionRepository = manager.getRepository(
      MonthlyCardSubscription,
    );
    const record = await recordRepository.findOne({
      where: { id: recordId },
      lock: { mode: "pessimistic_write" },
    });
    if (!record) {
      throw new Error("购买记录不存在");
    }
    if (record.status === "success") {
      return record;
    }
    if (record.status !== "pending") {
      throw new Error("购买记录状态异常");
    }

    const plan = config.plans[cardType];
    const now = new Date();
    const subscription = await subscriptionRepository.findOne({
      where: { uid, card_type: cardType },
      lock: { mode: "pessimistic_write" },
    });
    const startsAt =
      subscription && isMonthlyCardActive(subscription, now)
        ? new Date(subscription.expires_at)
        : now;
    const expiresAt = this.addDays(startsAt, config.durationDays);
    const nextSubscription =
      subscription ||
      subscriptionRepository.create({
        uid,
        card_type: cardType,
      });
    nextSubscription.vip_level = plan.vipLevel;
    nextSubscription.expires_at = expiresAt;
    await subscriptionRepository.save(nextSubscription);

    record.starts_at = startsAt;
    record.expires_at = expiresAt;
    record.status = "success";
    record.third_party_response =
      this.rechargeService.sanitizeThirdPartyResponse(thirdPartyResponse);
    record.failure_reason = null;
    return recordRepository.save(record);
  }

  private toStatusCards(
    config: MonthlyCardConfig,
    subscriptions: MonthlyCardSubscription[],
    gameVip: { sourceTiers?: { badge?: number } },
  ) {
    const subscriptionMap = new Map(
      subscriptions.map((subscription) => [subscription.card_type, subscription]),
    );
    const badgeTier = Number(gameVip.sourceTiers?.badge || 0);
    return toMonthlyCardPlanView(config).map((plan) => {
      const subscription = subscriptionMap.get(plan.cardType);
      const active = isMonthlyCardActive(subscription);
      const permanent =
        (plan.cardType === "ice" && badgeTier === 3) ||
        (plan.cardType === "platinum" && badgeTier >= 4);
      return {
        ...plan,
        active,
        permanent,
        expiresAt: permanent
          ? null
          : subscription?.expires_at
            ? new Date(subscription.expires_at).toISOString()
            : null,
        statusLabel: permanent ? "永久" : active ? "生效中" : "未开通",
        actionLabel: active || permanent ? "续费" : "购买",
      };
    });
  }

  private assertPurchasable(config: MonthlyCardConfig, cardType: MonthlyCardType) {
    if (!config.enabled) {
      throw new Error("月卡暂未开启");
    }
    const plan = config.plans[cardType];
    if (!plan?.enabled) {
      throw new Error("月卡暂不可买");
    }
    if (!Number.isInteger(plan.price) || plan.price <= 0) {
      throw new Error("月卡价格无效");
    }
  }

  private async markRecord(
    id: number,
    status: MonthlyCardPurchaseStatus,
    patch: Partial<MonthlyCardPurchaseRecord>,
  ) {
    const repository = this.dataSource.getRepository(MonthlyCardPurchaseRecord);
    const record = await repository.findOne({ where: { id } });
    if (!record) {
      return;
    }
    await repository.save({
      ...record,
      ...patch,
      status,
    });
  }

  private handleExistingRecord(record: MonthlyCardPurchaseRecord) {
    if (record.status === "success") {
      return this.toPurchaseResult(record);
    }
    if (record.status === "pending") {
      throw new Error("购买处理中");
    }
    if (record.status === "local_failed") {
      throw new Error("鱼排积分已扣除，月卡开通失败，请联系运营");
    }
    throw new Error(record.failure_reason || "购买失败");
  }

  private toPurchaseResult(record: MonthlyCardPurchaseRecord) {
    return {
      requestId: record.request_id,
      cardType: record.card_type,
      vipLevel: record.vip_level,
      fishpiCost: record.fishpi_cost,
      startsAt: new Date(record.starts_at).toISOString(),
      expiresAt: new Date(record.expires_at).toISOString(),
      status: record.status,
    };
  }

  private normalizeRequestId(value?: string) {
    const requestId = String(value || `monthly-${randomUUID()}`).trim();
    if (!requestId) {
      throw new Error("流水号为空");
    }
    if (requestId.length > 80) {
      throw new Error("流水号过长");
    }
    return requestId;
  }

  private addDays(date: Date, days: number) {
    return new Date(date.getTime() + days * 86400_000);
  }

  private getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error || "请求失败");
  }
}
