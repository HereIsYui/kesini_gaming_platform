import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

export type UserSocialActivityType =
  | "friend_added"
  | "showcase_updated"
  | "card_upgraded"
  | "pve_cleared";

@Entity()
@Index("IDX_user_social_activity_actor_created", ["actor_uid", "createdAt"])
@Index("IDX_user_social_activity_type_created", [
  "activity_type",
  "createdAt",
])
export class UserSocialActivity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  actor_uid: string;

  @Column({ type: "varchar", length: 40 })
  activity_type: UserSocialActivityType;

  @Column({ type: "varchar", length: 80 })
  title: string;

  @Column({ type: "varchar", length: 160, default: "" })
  summary: string;

  @Column({ type: "json", nullable: true })
  metadata?: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
