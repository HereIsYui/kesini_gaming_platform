import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { RedeemRewards } from "./redeemCode.entity";

@Entity()
@Index("IDX_player_message_visible", ["enabled", "delete_flag", "id"])
@Index("IDX_player_message_target", ["target_uid", "enabled", "delete_flag"])
export class PlayerMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 40 })
  title: string;

  @Column({ type: "varchar", length: 240, default: "" })
  content: string;

  @Column({ type: "varchar", length: 255, default: "" })
  target_uid: string;

  @Column({ type: "json", nullable: true })
  rewards?: RedeemRewards | null;

  @Column({ default: true })
  enabled: boolean;

  @Column({ default: false })
  delete_flag: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
