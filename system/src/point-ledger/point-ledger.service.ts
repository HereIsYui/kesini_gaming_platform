import { Injectable } from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import {
  PointLedgerRecord,
  PointLedgerSourceType,
} from "src/entity/pointLedgerRecord.entity";
import { User } from "src/entity/user.entity";

export interface PointLedgerContext {
  sourceType: PointLedgerSourceType;
  sourceId?: string | number | null;
  title: string;
  metadata?: Record<string, unknown> | null;
}

export interface PointLedgerQuery {
  page?: number;
  pageSize?: number;
  type?: string;
  sourceType?: string;
}

const SOURCE_LABELS: Record<PointLedgerSourceType, string> = {
  draw_once: "单抽消耗",
  draw_ten: "十连消耗",
  recharge: "星穹币充值",
  redeem_code: "兑换码奖励",
  launch_activity: "开服福利",
  exchange_shop: "兑换商店",
  trade_buy: "交易购买",
  trade_sell: "交易出售",
};

const ALLOWED_SOURCE_TYPES = Object.keys(SOURCE_LABELS);

@Injectable()
export class PointLedgerService {
  constructor(private readonly dataSource: DataSource) {}

  async applyChange(
    manager: EntityManager,
    user: User,
    amount: number,
    context: PointLedgerContext,
  ): Promise<PointLedgerRecord> {
    const changeAmount = Number(amount);
    if (!Number.isInteger(changeAmount) || changeAmount === 0) {
      throw new Error("星穹币变动数量必须为非零整数");
    }

    const userRepository = manager.getRepository(User);
    const ledgerRepository = manager.getRepository(PointLedgerRecord);
    const pointBefore = Number(user.point || 0);
    const pointAfter = pointBefore + changeAmount;
    if (pointAfter < 0) {
      throw new Error(
        `星穹币不足，需要${Math.abs(changeAmount)}，当前${pointBefore}`,
      );
    }

    user.point = pointAfter;
    await userRepository.save(user);

    return ledgerRepository.save(
      ledgerRepository.create({
        uid: user.uid,
        change_amount: changeAmount,
        point_before: pointBefore,
        point_after: pointAfter,
        source_type: context.sourceType,
        source_id:
          context.sourceId === undefined || context.sourceId === null
            ? null
            : String(context.sourceId),
        title: context.title,
        metadata: context.metadata || null,
      }),
    );
  }

  async listUserRecords(uid: string, query: PointLedgerQuery) {
    const page = this.normalizePage(query.page);
    const pageSize = this.normalizePageSize(query.pageSize);
    const type = String(query.type || "").trim();
    const sourceType = String(query.sourceType || "").trim();

    const builder = this.dataSource
      .getRepository(PointLedgerRecord)
      .createQueryBuilder("record")
      .where("record.uid = :uid", { uid });

    if (type === "income") {
      builder.andWhere("record.change_amount > 0");
    } else if (type === "expense") {
      builder.andWhere("record.change_amount < 0");
    } else if (type && type !== "all") {
      throw new Error("收支类型参数无效");
    }

    if (sourceType) {
      if (!ALLOWED_SOURCE_TYPES.includes(sourceType)) {
        throw new Error("星穹币来源类型参数无效");
      }
      builder.andWhere("record.source_type = :sourceType", { sourceType });
    }

    const [records, total] = await builder
      .orderBy("record.createdAt", "DESC")
      .addOrderBy("record.id", "DESC")
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    const user = await this.dataSource.getRepository(User).findOne({
      where: { uid },
    });

    return {
      list: records.map((record) => this.toView(record)),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      currentPoint: user?.point || 0,
    };
  }

  private toView(record: PointLedgerRecord) {
    return {
      id: record.id,
      changeAmount: record.change_amount,
      pointBefore: record.point_before,
      pointAfter: record.point_after,
      sourceType: record.source_type,
      sourceId: record.source_id || null,
      sourceLabel: SOURCE_LABELS[record.source_type] || record.source_type,
      title: record.title,
      metadata: record.metadata || {},
      createdAt: record.createdAt,
    };
  }

  private normalizePage(value?: number): number {
    const page = Number(value || 1);
    return Number.isInteger(page) && page > 0 ? page : 1;
  }

  private normalizePageSize(value?: number): number {
    const pageSize = Number(value || 20);
    if (!Number.isInteger(pageSize) || pageSize <= 0) {
      return 20;
    }
    return Math.min(pageSize, 100);
  }
}
