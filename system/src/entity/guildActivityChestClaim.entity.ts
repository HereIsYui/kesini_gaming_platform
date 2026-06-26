import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";
import type { RedeemRewards } from "./redeemCode.entity";

@Entity()
@Index(
  "IDX_guild_activity_chest_claim_unique",
  ["guild_id", "uid", "date_key", "threshold"],
  { unique: true },
)
export class GuildActivityChestClaim {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  guild_id: number;

  @Column()
  uid: string;

  @Column({ type: "varchar", length: 10 })
  date_key: string;

  @Column({ type: "int" })
  threshold: number;

  @Column({ type: "json", nullable: true })
  reward_snapshot?: RedeemRewards | null;

  @CreateDateColumn()
  createdAt: Date;
}
