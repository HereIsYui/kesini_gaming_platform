import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export type UserFriendStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "cancelled";

@Entity()
@Index("IDX_user_friend_relation_key", ["relation_key"], { unique: true })
@Index("IDX_user_friend_requester_status", ["requester_uid", "status"])
@Index("IDX_user_friend_receiver_status", ["receiver_uid", "status"])
export class UserFriend {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  requester_uid: string;

  @Column()
  receiver_uid: string;

  @Column({ length: 520 })
  relation_key: string;

  @Column({ type: "varchar", default: "pending" })
  status: UserFriendStatus;

  @Column({ type: "datetime", nullable: true })
  responded_at?: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
