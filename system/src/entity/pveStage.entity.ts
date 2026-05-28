import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import type { RedeemRewards } from "./redeemCode.entity";

@Entity()
@Index("IDX_pve_stage_enabled_sort", ["enabled", "sort_order"])
export class PveStage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 80 })
  name: string;

  @Column({ length: 1024, default: "" })
  description: string;

  @Column({ type: "int", default: 100 })
  enemy_power: number;

  @Column({ type: "int", default: 100 })
  recommended_power: number;

  @Column({ type: "int", default: 3 })
  daily_limit: number;

  @Column({ type: "json" })
  rewards: RedeemRewards;

  @Column({ default: true })
  enabled: boolean;

  @Column({ type: "int", default: 0 })
  sort_order: number;

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
