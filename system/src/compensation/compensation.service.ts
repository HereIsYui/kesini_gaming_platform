import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { CompensationGrant } from "src/entity/compensationGrant.entity";
import { User } from "src/entity/user.entity";
import { PointLedgerService } from "src/point-ledger/point-ledger.service";
import {
  COMPENSATION_BATCH_KEY,
  COMPENSATION_TITLE,
} from "./compensation.constants";

@Injectable()
export class CompensationService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly pointLedgerService: PointLedgerService,
  ) {}

  async getMine(uid: string) {
    const normalizedUid = this.normalizeUid(uid);
    const grant = await this.dataSource
      .getRepository(CompensationGrant)
      .findOne({
        where: {
          uid: normalizedUid,
          batch_key: COMPENSATION_BATCH_KEY,
          claimed: false,
        },
      });
    if (!grant || Number(grant.total_amount || 0) <= 0) {
      return { available: false };
    }
    return this.toAvailableView(grant);
  }

  async claim(uid: string, batchKey: string) {
    const normalizedUid = this.normalizeUid(uid);
    const normalizedBatchKey = this.normalizeBatchKey(batchKey);
    return this.dataSource.transaction(async (manager) => {
      const grantRepository = manager.getRepository(CompensationGrant);
      const userRepository = manager.getRepository(User);
      const grant = await grantRepository.findOne({
        where: {
          uid: normalizedUid,
          batch_key: normalizedBatchKey,
        },
        lock: { mode: "pessimistic_write" },
      });
      if (!grant) {
        throw new Error("补偿不存在");
      }
      if (grant.claimed || grant.claimed_at) {
        throw new Error("已领取");
      }
      const amount = Number(grant.total_amount || 0);
      if (!Number.isInteger(amount) || amount <= 0) {
        throw new Error("补偿不存在");
      }
      const user = await userRepository.findOne({
        where: { uid: normalizedUid },
        lock: { mode: "pessimistic_write" },
      });
      if (!user) {
        throw new Error("用户不存在");
      }
      const ledger = await this.pointLedgerService.applyChange(
        manager,
        user,
        amount,
        {
          sourceType: "admin_adjust",
          sourceId: `compensation:${normalizedBatchKey}:${normalizedUid}`,
          title: COMPENSATION_TITLE,
          metadata: {
            batchKey: normalizedBatchKey,
            rechargeAmount: Number(grant.recharge_amount || 0),
            monthlyAmount: Number(grant.monthly_amount || 0),
          },
        },
      );
      grant.claimed = true;
      grant.claimed_at = new Date();
      await grantRepository.save(grant);
      return {
        ...this.toAvailableView(grant),
        claimed: true,
        available: false,
        pointAfter: ledger.point_after,
      };
    });
  }

  private toAvailableView(grant: CompensationGrant) {
    return {
      available: true,
      batchKey: grant.batch_key,
      title: COMPENSATION_TITLE,
      rechargeAmount: Number(grant.recharge_amount || 0),
      monthlyAmount: Number(grant.monthly_amount || 0),
      totalAmount: Number(grant.total_amount || 0),
      claimed: grant.claimed === true,
    };
  }

  private normalizeUid(uid: string) {
    const value = String(uid || "").trim();
    if (!value) {
      throw new Error("用户不存在");
    }
    return value;
  }

  private normalizeBatchKey(batchKey: string) {
    const value = String(batchKey || "").trim();
    if (value !== COMPENSATION_BATCH_KEY) {
      throw new Error("补偿不存在");
    }
    return value;
  }
}
