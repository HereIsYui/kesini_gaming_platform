import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

export type PointLedgerSourceType =
  | "draw_once"
  | "draw_ten"
  | "recharge"
  | "redeem_code"
  | "launch_activity"
  | "daily_sign_in"
  | "exchange_shop"
  | "achievement"
  | "task"
  | "pve"
  | "trade_buy"
  | "trade_sell"
  | "shop_recycle"
  | "player_message"
  | "vip_daily"
  | "guild_check_in"
  | "guild_donate"
  | "guild_boss"
  | "guild_chest"
  | "admin_adjust";

@Entity()
@Index("IDX_point_ledger_uid_created", ["uid", "createdAt"])
@Index("IDX_point_ledger_uid_source", ["uid", "source_type"])
export class PointLedgerRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  uid: string;

  @Column({ type: "int" })
  change_amount: number;

  @Column({ default: 0 })
  point_before: number;

  @Column({ default: 0 })
  point_after: number;

  @Column({ type: "varchar", length: 40 })
  source_type: PointLedgerSourceType;

  @Column({ type: "varchar", length: 128, nullable: true })
  source_id?: string | null;

  @Column({ type: "varchar", length: 160 })
  title: string;

  @Column({ type: "json", nullable: true })
  metadata?: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
