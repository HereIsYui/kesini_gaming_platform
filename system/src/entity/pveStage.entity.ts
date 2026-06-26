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

  @Column({ type: "int", default: 1 })
  chapter: number;

  @Column({ type: "int", default: 1 })
  stage_no: number;

  @Column({ type: "varchar", length: 16, default: "none" })
  boss_type: "none" | "minor" | "major" | "final";

  @Column({ type: "varchar", length: 32, default: "" })
  boss_name: string;

  @Column({ type: "json", nullable: true })
  battle_config?: {
    traits?: string[];
    enemyHp?: number;
    enemyAttack?: number;
    roundLimit?: number;
    boss?: boolean;
  } | null;

  @Column({ type: "json", nullable: true })
  star_rewards?: RedeemRewards | null;

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
