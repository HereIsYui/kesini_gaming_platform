import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

export type GuildContributionSourceType =
  | "check_in"
  | "donate"
  | "boss"
  | "boss_defeat";

@Entity()
@Index("IDX_guild_contribution_guild_date", ["guild_id", "date_key"])
@Index("IDX_guild_contribution_uid_date", ["uid", "date_key"])
export class GuildContributionRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  guild_id: number;

  @Column()
  uid: string;

  @Column({ type: "varchar", length: 10 })
  date_key: string;

  @Column({ type: "varchar", length: 32 })
  source_type: GuildContributionSourceType;

  @Column({ type: "int", default: 0 })
  contribution: number;

  @Column({ type: "int", default: 0 })
  activity: number;

  @Column({ type: "json", nullable: true })
  metadata?: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
