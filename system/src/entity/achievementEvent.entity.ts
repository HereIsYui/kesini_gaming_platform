import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";
import type { AchievementTargetType } from "./achievementConfig.entity";

@Entity()
@Index("IDX_achievement_event_uid_type", ["uid", "event_type"])
@Index("IDX_achievement_event_created", ["createdAt"])
export class AchievementEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  uid: string;

  @Column({ type: "varchar", length: 40 })
  event_type: AchievementTargetType;

  @Column({ type: "int", default: 1 })
  amount: number;

  @Column({ type: "json", nullable: true })
  metadata?: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
