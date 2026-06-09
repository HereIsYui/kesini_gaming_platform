import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";
import type { RedeemRewards } from "./redeemCode.entity";

@Entity()
@Index("IDX_vip_daily_claim_unique", ["uid", "claim_date"], {
  unique: true,
})
@Index("IDX_vip_daily_claim_uid_created", ["uid", "createdAt"])
export class VipDailyClaim {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  uid: string;

  @Column({ type: "varchar", length: 10 })
  claim_date: string;

  @Column({ type: "int", default: 0 })
  vip_level: number;

  @Column({ type: "json" })
  reward_snapshot: RedeemRewards;

  @CreateDateColumn()
  createdAt: Date;
}
