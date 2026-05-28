import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity()
@Index("IDX_season_config_key", ["season_key"], { unique: true })
@Index("IDX_season_config_visible", ["enabled", "delete_flag"])
export class SeasonConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 64 })
  season_key: string;

  @Column({ type: "varchar", length: 80 })
  name: string;

  @Column({ type: "varchar", length: 1024, default: "" })
  description: string;

  @Column({ default: true })
  enabled: boolean;

  @Column({ default: true })
  shop_enabled: boolean;

  @Column({ default: true })
  leaderboard_enabled: boolean;

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
