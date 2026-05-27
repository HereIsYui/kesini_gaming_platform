import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity()
@Index("IDX_daily_sign_in_uid_date", ["uid", "sign_date"], { unique: true })
@Index("IDX_daily_sign_in_uid_created", ["uid", "createdAt"])
export class DailySignInRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  uid: string;

  @Column({ length: 10 })
  sign_date: string;

  @Column({ type: "int", default: 1 })
  streak_count: number;

  @Column({ type: "int", default: 1 })
  cycle_day: number;

  @Column({ type: "int", default: 10 })
  reward_points: number;

  @CreateDateColumn()
  createdAt: Date;
}
