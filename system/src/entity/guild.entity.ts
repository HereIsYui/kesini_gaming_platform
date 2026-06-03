import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity()
@Index("IDX_guild_name", ["name"], { unique: true })
@Index("IDX_guild_owner_uid", ["owner_uid"])
export class Guild {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 24 })
  name: string;

  @Column({ type: "varchar", length: 80, default: "" })
  description: string;

  @Column({ type: "varchar", length: 160, default: "" })
  announcement: string;

  @Column()
  owner_uid: string;

  @Column({ default: 1 })
  member_count: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
