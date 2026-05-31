import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";
import { RedeemRewards } from "./redeemCode.entity";

@Entity()
@Index("IDX_player_message_read_unique", ["uid", "message_id"], {
  unique: true,
})
@Index("IDX_player_message_read_uid", ["uid", "createdAt"])
export class PlayerMessageRead {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  uid: string;

  @Column()
  message_id: number;

  @Column({ type: "datetime", nullable: true })
  claimed_at?: Date | null;

  @Column({ type: "json", nullable: true })
  reward_snapshot?: RedeemRewards | null;

  @CreateDateColumn()
  createdAt: Date;
}
