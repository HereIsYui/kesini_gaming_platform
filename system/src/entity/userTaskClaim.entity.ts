import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";
import type { RedeemRewards } from "./redeemCode.entity";

export type TaskScope = "daily" | "weekly";
export type TaskClaimType = "task" | "activity";

@Entity()
@Index(
  "IDX_user_task_claim_unique",
  ["uid", "scope", "period_key", "claim_type", "target_key"],
  { unique: true },
)
@Index("IDX_user_task_claim_period", ["uid", "scope", "period_key"])
export class UserTaskClaim {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  uid: string;

  @Column({ type: "varchar", length: 20 })
  scope: TaskScope;

  @Column({ type: "varchar", length: 20 })
  period_key: string;

  @Column({ type: "varchar", length: 20 })
  claim_type: TaskClaimType;

  @Column({ type: "varchar", length: 80 })
  target_key: string;

  @Column({ type: "int", default: 0 })
  activity_points: number;

  @Column({ type: "json" })
  reward_snapshot: RedeemRewards;

  @CreateDateColumn()
  createdAt: Date;
}
