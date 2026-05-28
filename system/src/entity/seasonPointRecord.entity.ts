import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

export type SeasonPointSourceType =
  | "task_activity"
  | "shop_spend"
  | "admin_adjust";

@Entity()
@Index("IDX_season_point_uid_created", ["uid", "createdAt"])
@Index("IDX_season_point_season_uid", ["season_key", "uid"])
export class SeasonPointRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  uid: string;

  @Column({ type: "varchar", length: 64 })
  season_key: string;

  @Column({ type: "int" })
  change_amount: number;

  @Column({ type: "int", default: 0 })
  point_before: number;

  @Column({ type: "int", default: 0 })
  point_after: number;

  @Column({ type: "varchar", length: 40 })
  source_type: SeasonPointSourceType;

  @Column({ type: "varchar", length: 128, nullable: true })
  source_id?: string | null;

  @Column({ type: "varchar", length: 160 })
  title: string;

  @Column({ type: "json", nullable: true })
  metadata?: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
