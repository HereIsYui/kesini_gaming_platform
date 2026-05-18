import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";
import type { RedeemRewards } from "./redeemCode.entity";

@Entity()
@Index("IDX_redeem_code_usage_uid", ["uid"])
@Index("IDX_redeem_code_usage_code_user", ["code_id", "uid"], {
  unique: true,
})
export class RedeemCodeUsage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  code_id: number;

  // 兑换时的码值快照，便于后台审计
  @Column({ length: 64 })
  code: string;

  @Column()
  uid: string;

  @Column({ type: "json" })
  reward_snapshot: RedeemRewards;

  @CreateDateColumn()
  createdAt: Date;
}
