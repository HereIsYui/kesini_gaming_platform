import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export type RechargeRecordStatus =
  | "pending"
  | "success"
  | "failed"
  | "local_failed";

@Entity()
@Index("IDX_recharge_record_request", ["uid", "request_id"], { unique: true })
@Index("IDX_recharge_record_uid_status", ["uid", "status"])
@Index("IDX_recharge_record_created", ["createdAt"])
export class RechargeRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  uid: string;

  @Column()
  fishpi_user_name: string;

  @Column({ length: 80 })
  request_id: string;

  // 充值到本地的抽卡星穹币
  @Column()
  amount: number;

  // 从鱼排扣除的星穹币，可能与 amount 按充值比例换算
  @Column()
  fishpi_cost: number;

  @Column({ default: 0 })
  point_before: number;

  @Column({ default: 0 })
  point_after: number;

  @Column({ type: "varchar", default: "pending" })
  status: RechargeRecordStatus;

  @Column({ type: "json", nullable: true })
  third_party_response?: unknown | null;

  @Column({ type: "text", nullable: true })
  failure_reason?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
