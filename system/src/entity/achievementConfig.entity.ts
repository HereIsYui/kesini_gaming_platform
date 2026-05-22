import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import type { RedeemRewards } from "./redeemCode.entity";

export type AchievementTargetType =
  | "total_draws"
  | "rarity_draws"
  | "owned_cards"
  | "rarity_owned_cards"
  | "completed_pools"
  | "recharge_points"
  | "redeem_count"
  | "exchange_count"
  | "trade_buy_count"
  | "trade_sell_count"
  | "synthesize_count"
  | "decompose_count";

export interface AchievementTargetScope {
  rarity?: string;
  poolId?: number;
}

@Entity()
@Index("IDX_achievement_config_code", ["code"], { unique: true })
@Index("IDX_achievement_config_enabled", ["enabled", "delete_flag"])
export class AchievementConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 64 })
  code: string;

  @Column({ length: 80 })
  name: string;

  @Column({ length: 1024, default: "" })
  description: string;

  @Column({ length: 40, default: "常规" })
  category: string;

  @Column({ type: "varchar", length: 40 })
  target_type: AchievementTargetType;

  @Column({ type: "int" })
  target_value: number;

  @Column({ type: "json", nullable: true })
  target_scope?: AchievementTargetScope | null;

  @Column({ type: "json" })
  rewards: RedeemRewards;

  @Column({ default: 0 })
  sort_order: number;

  @Column({ default: true })
  enabled: boolean;

  @Column({ type: "datetime", nullable: true })
  starts_at?: Date | null;

  @Column({ type: "datetime", nullable: true })
  ends_at?: Date | null;

  @Column({ default: false })
  delete_flag: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
