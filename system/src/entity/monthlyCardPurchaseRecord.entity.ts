import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import type { MonthlyCardType } from "./monthlyCardSubscription.entity";

export type MonthlyCardPurchaseStatus =
  | "pending"
  | "success"
  | "failed"
  | "local_failed";

@Entity()
@Index("IDX_monthly_card_purchase_request", ["uid", "request_id"], {
  unique: true,
})
@Index("IDX_monthly_card_purchase_uid_status", ["uid", "status"])
@Index("IDX_monthly_card_purchase_created", ["createdAt"])
export class MonthlyCardPurchaseRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  uid: string;

  @Column()
  fishpi_user_name: string;

  @Column({ type: "varchar", length: 24 })
  card_type: MonthlyCardType;

  @Column({ type: "int" })
  vip_level: number;

  @Column({ type: "varchar", length: 80 })
  request_id: string;

  @Column({ type: "int" })
  fishpi_cost: number;

  @Column({ type: "datetime" })
  starts_at: Date;

  @Column({ type: "datetime" })
  expires_at: Date;

  @Column({ type: "varchar", default: "pending" })
  status: MonthlyCardPurchaseStatus;

  @Column({ type: "json", nullable: true })
  third_party_response?: unknown | null;

  @Column({ type: "text", nullable: true })
  failure_reason?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
