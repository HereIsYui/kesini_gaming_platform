import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";
import type { RedeemRewards } from "./redeemCode.entity";

@Entity()
@Index("IDX_guild_boss_reward_claim_unique", ["guild_id", "uid", "date_key"], {
  unique: true,
})
export class GuildBossRewardClaim {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  guild_id: number;

  @Column()
  uid: string;

  @Column({ type: "varchar", length: 10 })
  date_key: string;

  @Column({ type: "json", nullable: true })
  reward_snapshot?: RedeemRewards | null;

  @CreateDateColumn()
  createdAt: Date;
}
