import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export type GuildJoinRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "canceled";

@Entity()
@Index("IDX_guild_join_request_guild_status", ["guild_id", "status"])
@Index("IDX_guild_join_request_uid_status", ["uid", "status"])
@Index("IDX_guild_join_request_guild_uid_status", ["guild_id", "uid", "status"])
@Index("IDX_guild_join_request_pending_unique", ["guild_id", "uid", "pending_key"], {
  unique: true,
})
export class GuildJoinRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  guild_id: number;

  @Column()
  uid: string;

  @Column({ type: "varchar", length: 16, default: "pending" })
  status: GuildJoinRequestStatus;

  @Column({ type: "varchar", length: 16, nullable: true })
  pending_key?: "pending" | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  reviewer_uid?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
