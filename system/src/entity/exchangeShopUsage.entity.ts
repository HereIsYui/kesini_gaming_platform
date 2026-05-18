import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";
import type { ExchangeCostItem } from "./exchangeShopItem.entity";
import type { RedeemRewards } from "./redeemCode.entity";

@Entity()
@Index("IDX_exchange_shop_usage_uid", ["uid"])
@Index("IDX_exchange_shop_usage_item_user", ["shop_item_id", "uid"])
export class ExchangeShopUsage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  shop_item_id: number;

  @Column()
  shop_item_name: string;

  @Column()
  uid: string;

  @Column({ default: 1 })
  count: number;

  // 兑换时的消耗快照，避免后续配置变更影响审计
  @Column({ type: "json" })
  cost_snapshot: ExchangeCostItem[];

  // 兑换时的奖励快照，避免后续配置变更影响审计
  @Column({ type: "json" })
  reward_snapshot: RedeemRewards;

  @CreateDateColumn()
  createdAt: Date;
}
