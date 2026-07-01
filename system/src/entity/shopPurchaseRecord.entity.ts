import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import type { RedeemRewards } from "./redeemCode.entity";
import type { ShopCurrencyType } from "./shopProduct.entity";

export type ShopPurchaseStatus =
  | "pending"
  | "success"
  | "failed"
  | "local_failed";

@Entity()
@Index("IDX_shop_purchase_request", ["uid", "request_id"], { unique: true })
@Index("IDX_shop_purchase_product_user", ["product_id", "uid"])
@Index("IDX_shop_purchase_uid_status", ["uid", "status"])
@Index("IDX_shop_purchase_daily_limit", [
  "product_id",
  "uid",
  "status",
  "date_key",
])
@Index("IDX_shop_purchase_weekly_limit", [
  "product_id",
  "uid",
  "status",
  "week_key",
])
@Index("IDX_shop_purchase_monthly_limit", [
  "product_id",
  "uid",
  "status",
  "month_key",
])
@Index("IDX_shop_purchase_created", ["createdAt"])
export class ShopPurchaseRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 80 })
  request_id: string;

  @Column()
  product_id: number;

  @Column()
  product_name: string;

  @Column()
  uid: string;

  @Column({ length: 255, nullable: true })
  fishpi_user_name?: string | null;

  @Column({ default: 1 })
  count: number;

  @Column({ type: "varchar", length: 24 })
  currency_type: ShopCurrencyType;

  @Column({ type: "int" })
  unit_price: number;

  @Column({ type: "int" })
  cost_amount: number;

  @Column({ type: "json" })
  reward_snapshot: RedeemRewards;

  @Column({ type: "varchar", default: "pending" })
  status: ShopPurchaseStatus;

  @Column({ default: 0 })
  balance_before: number;

  @Column({ default: 0 })
  balance_after: number;

  @Column({ length: 10, nullable: true })
  date_key?: string | null;

  @Column({ length: 10, nullable: true })
  week_key?: string | null;

  @Column({ length: 7, nullable: true })
  month_key?: string | null;

  @Column({ type: "json", nullable: true })
  third_party_response?: unknown | null;

  @Column({ type: "text", nullable: true })
  failure_reason?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
