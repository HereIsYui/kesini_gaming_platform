import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

export type GuildMemberRole = "leader" | "officer" | "member";

@Entity()
@Index("IDX_guild_member_uid", ["uid"], { unique: true })
@Index("IDX_guild_member_guild_uid", ["guild_id", "uid"], { unique: true })
@Index("IDX_guild_member_guild_joined", ["guild_id", "joinedAt"])
export class GuildMember {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  guild_id: number;

  @Column()
  uid: string;

  @Column({ type: "varchar", length: 20, default: "member" })
  role: GuildMemberRole;

  @Column({ type: "int", default: 0 })
  total_contribution: number;

  @Column({ type: "int", default: 0 })
  weekly_contribution: number;

  @Column({ type: "varchar", length: 8, nullable: true })
  weekly_contribution_key?: string | null;

  @Column({ type: "varchar", length: 10, nullable: true })
  last_check_in_date?: string | null;

  @Column({ type: "varchar", length: 10, nullable: true })
  last_donate_date?: string | null;

  @Column({ type: "int", default: 0 })
  daily_donate_count: number;

  @CreateDateColumn()
  joinedAt: Date;
}
