import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";
import type { RedeemRewards } from "./redeemCode.entity";

@Entity()
@Index("IDX_pve_record_uid_created", ["uid", "createdAt"])
@Index("IDX_pve_record_uid_stage_created", ["uid", "stage_id", "createdAt"])
@Index("IDX_pve_record_uid_mode_created", ["uid", "mode", "createdAt"])
export class PveChallengeRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  uid: string;

  @Column({ type: "int" })
  stage_id: number;

  @Column({ length: 80 })
  stage_name: string;

  @Column({ type: "int", default: 0 })
  formation_power: number;

  @Column({ type: "int", default: 0 })
  enemy_power: number;

  @Column({ default: false })
  success: boolean;

  @Column({ type: "json", nullable: true })
  reward_snapshot?: RedeemRewards | null;

  @Column({ length: 16, default: "challenge" })
  mode: "challenge" | "sweep" | "auto";

  @CreateDateColumn()
  createdAt: Date;
}
