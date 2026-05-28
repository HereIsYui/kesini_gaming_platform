import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity()
@Index("IDX_user_season_unique", ["uid", "season_key"], { unique: true })
@Index("IDX_user_season_rank", ["season_key", "earned_points"])
export class UserSeasonProgress {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  uid: string;

  @Column({ type: "varchar", length: 64 })
  season_key: string;

  @Column({ type: "int", default: 0 })
  earned_points: number;

  @Column({ type: "int", default: 0 })
  point_balance: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
