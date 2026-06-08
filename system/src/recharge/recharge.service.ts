import { Injectable, Optional } from "@nestjs/common";
import axios from "axios";
import { randomUUID } from "crypto";
import { DataSource, EntityManager } from "typeorm";
import { RechargeConfig } from "src/entity/rechargeConfig.entity";
import {
  RechargeRecord,
  RechargeRecordStatus,
} from "src/entity/rechargeRecord.entity";
import { User } from "src/entity/user.entity";
import { PointLedgerService } from "src/point-ledger/point-ledger.service";
import { AchievementService } from "src/achievement/achievement.service";

const FISHPI_POINTS_ENDPOINT = "https://fishpi.cn/user/edit/points";
const FISHPI_USER_ENDPOINT = "https://fishpi.cn/user";
const FISHPI_MEMBERSHIP_ENDPOINT = "https://fishpi.cn/api/membership";
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
}

export interface FishpiVipView {
  checked: boolean;
  active: boolean;
  levelCode: string;
  expiresAt: string | null;
}

@Injectable()
export class RechargeService {
  constructor(
    private readonly dataSource: DataSource,
    @Optional()
    private readonly pointLedgerService?: PointLedgerService,
    @Optional()
    private readonly achievementService?: AchievementService,
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
    return {
      userName: fishpiUserName,
      point: this.extractFishpiPoint(data),
      vip: await this.resolveFishpiVip(user.uid, config),
    };
  }

  async getFishpiVipStatus(uid: string): Promise<FishpiVipView> {
    const userRepository = this.dataSource.getRepository(User);
    const user = await userRepository.findOne({ where: { uid } });
    if (!user) {
      throw new Error("用户不存在");
    }
    const config = await this.ensureConfig();
    return this.resolveFishpiVip(user.uid, config);
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
    userId: string,
    config: RechargeConfig,
  ): Promise<FishpiVipView> {
    const apiKey = String(config.fishpi_api_key || "").trim();
    if (!apiKey) {
      return this.uncheckedFishpiVip();
    }
    try {
      const data = await this.callFishpiMembership(userId, apiKey);
      return this.extractFishpiVip(data);
    } catch {
      return this.uncheckedFishpiVip();
    }
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

  private extractFishpiVip(data: any): FishpiVipView {
    const payload = data?.data ?? data ?? {};
    const expiresAt = this.normalizeFishpiVipExpiresAt(payload?.expiresAt);
    const state = Number(payload?.state ?? 0);
    return {
      checked: true,
      active: state !== 0 && this.isFutureFishpiVipExpiry(expiresAt),
      levelCode: String(payload?.lvCode || ""),
      expiresAt,
    };
  }

  private normalizeFishpiVipExpiresAt(value: unknown): string | null {
    const text = String(value || "").trim();
    return text ? text : null;
  }

  private isFutureFishpiVipExpiry(expiresAt: string | null) {
    if (!expiresAt) {
      return false;
    }
    const time = Date.parse(expiresAt);
    return Number.isFinite(time) && time > Date.now();
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
  ) {
    const payload = {
      goldFingerKey: String(config.gold_finger_key || "").trim(),
      userName,
      point: -fishpiCost,
      memo: this.renderMemo(config.memo_template, localAmount, fishpiCost),
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

  private getThirdPartyErrorResponse(error: unknown) {
    if (axios.isAxiosError(error)) {
      return this.sanitizeThirdPartyResponse(error.response?.data || null);
    }
    return { message: this.getErrorMessage(error) };
  }

  private sanitizeThirdPartyResponse(value: unknown) {
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
}
