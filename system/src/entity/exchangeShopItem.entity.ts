import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import type { RedeemRewards } from "./redeemCode.entity";

export interface ExchangeCostItem {
  itemId: number;
  num: number;
}

@Entity()
@Index("IDX_exchange_shop_item_visible", ["delete_flag", "enabled"])
export class ExchangeShopItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ length: 1024, default: "" })
  description: string;

  @Column({ default: true })
  enabled: boolean;

  // 消耗背包物品配置
  @Column({ type: "json" })
  costs: ExchangeCostItem[];

  // 兑换后发放的积分和背包物品
  @Column({ type: "json" })
  rewards: RedeemRewards;

  // 空值表示不限总库存
  @Column({ type: "int", nullable: true })
  total_limit?: number | null;

  @Column({ default: 0 })
  used_count: number;

  // 空值表示不限制单用户兑换次数
  @Column({ type: "int", nullable: true })
  user_limit?: number | null;

  @Column({ type: "datetime", nullable: true })
  starts_at?: Date | null;

  @Column({ type: "datetime", nullable: true })
  ends_at?: Date | null;

  @Column({ default: 0 })
  sort_order: number;

  // 软删除，保留兑换记录审计
  @Column({ default: false })
  delete_flag: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
