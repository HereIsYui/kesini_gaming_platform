import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";
import type { PveBattleReport } from "src/pve/pve-battle-simulator";
import type { RedeemRewards } from "./redeemCode.entity";

@Entity()
@Index("IDX_guild_boss_challenge_guild_date", ["guild_id", "date_key"])
@Index("IDX_guild_boss_challenge_uid_date", ["uid", "date_key"])
export class GuildBossChallenge {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  guild_id: number;

  @Column()
  boss_id: number;

  @Column()
  uid: string;

  @Column({ type: "varchar", length: 10 })
  date_key: string;

  @Column({ type: "int", default: 0 })
  damage: number;

  @Column({ type: "json", nullable: true })
  battle_report?: PveBattleReport | null;

  @Column({ type: "json", nullable: true })
  formation_snapshot?: unknown | null;

  @Column({ type: "json", nullable: true })
  reward_snapshot?: RedeemRewards | null;

  @CreateDateColumn()
  createdAt: Date;
}
