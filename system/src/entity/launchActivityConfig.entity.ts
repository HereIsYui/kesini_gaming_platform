import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import type { RedeemRewards } from "./redeemCode.entity";

@Entity()
export class LaunchActivityConfig {
  @PrimaryGeneratedColumn()
  id: number;

  // 是否开启开服福利活动
  @Column({ default: false })
  enabled: boolean;

  // 活动批次，变更后视为新一期活动
  @Column({ length: 64, default: "launch-2026" })
  activity_key: string;

  @Column({ length: 80, default: "开服福利" })
  name: string;

  @Column({ length: 1024, default: "" })
  description: string;

  @Column({ type: "datetime", nullable: true })
  starts_at?: Date | null;

  @Column({ type: "datetime", nullable: true })
  ends_at?: Date | null;

  @Column({ type: "json" })
  rewards: RedeemRewards;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
