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
@Index("IDX_season_shop_visible", ["season_key", "delete_flag", "enabled"])
export class SeasonShopItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 64 })
  season_key: string;

  @Column()
  name: string;

  @Column({ length: 1024, default: "" })
  description: string;

  @Column({ default: true })
  enabled: boolean;

  @Column({ type: "int", default: 1 })
  cost_points: number;

  @Column({ type: "json" })
  rewards: RedeemRewards;

  @Column({ type: "int", nullable: true })
  total_limit?: number | null;

  @Column({ default: 0 })
  used_count: number;

  @Column({ type: "int", nullable: true })
  user_limit?: number | null;

  @Column({ type: "datetime", nullable: true })
  starts_at?: Date | null;

  @Column({ type: "datetime", nullable: true })
  ends_at?: Date | null;

  @Column({ default: 0 })
  sort_order: number;

  @Column({ default: false })
  delete_flag: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
