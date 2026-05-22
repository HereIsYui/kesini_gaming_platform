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
@Index("IDX_user_achievement_unique", ["uid", "achievement_id"], {
  unique: true,
})
@Index("IDX_user_achievement_uid_achieved", ["uid", "achieved"])
@Index("IDX_user_achievement_notification", ["uid", "achieved", "notification_ack_at"])
export class UserAchievement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  uid: string;

  @Column()
  achievement_id: number;

  @Column({ length: 64 })
  achievement_code: string;

  @Column({ default: 0 })
  progress: number;

  @Column({ default: false })
  achieved: boolean;

  @Column({ type: "datetime", nullable: true })
  achieved_at?: Date | null;

  @Column({ type: "json", nullable: true })
  reward_snapshot?: RedeemRewards | null;

  @Column({ type: "datetime", nullable: true })
  notification_ack_at?: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
