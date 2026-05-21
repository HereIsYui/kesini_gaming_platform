import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";
import type { RedeemRewards } from "./redeemCode.entity";

@Entity()
@Index("IDX_launch_activity_claim_uid", ["uid"])
@Index("IDX_launch_activity_claim_activity_user", ["activity_key", "uid"], {
  unique: true,
})
export class LaunchActivityClaim {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 64 })
  activity_key: string;

  @Column({ length: 80 })
  activity_name: string;

  @Column()
  uid: string;

  @Column({ type: "json" })
  reward_snapshot: RedeemRewards;

  @CreateDateColumn()
  createdAt: Date;
}
