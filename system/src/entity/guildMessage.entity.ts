import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity()
@Index("IDX_guild_message_guild_created", ["guild_id", "createdAt"])
@Index("IDX_guild_message_sender_created", ["sender_uid", "createdAt"])
export class GuildMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  guild_id: number;

  @Column()
  sender_uid: string;

  @Column({ type: "varchar", length: 160 })
  content: string;

  @CreateDateColumn()
  createdAt: Date;
}
