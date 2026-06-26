import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity()
@Index("IDX_guild_boss_guild_date", ["guild_id", "date_key"], {
  unique: true,
})
export class GuildBoss {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  guild_id: number;

  @Column({ type: "varchar", length: 10 })
  date_key: string;

  @Column({ type: "varchar", length: 32, default: "星渊守卫" })
  name: string;

  @Column({ type: "int", default: 1 })
  level: number;

  @Column({ type: "int" })
  max_hp: number;

  @Column({ type: "int" })
  hp: number;

  @Column({ default: false })
  defeated: boolean;

  @Column({ type: "datetime", nullable: true })
  defeated_at?: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
