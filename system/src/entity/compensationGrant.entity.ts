import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity()
@Index("IDX_compensation_grant_batch_uid", ["batch_key", "uid"], {
  unique: true,
})
@Index("IDX_compensation_grant_uid_claimed", ["uid", "claimed"])
export class CompensationGrant {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 80 })
  batch_key: string;

  @Column({ type: "varchar", length: 255 })
  uid: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  user_name?: string | null;

  @Column({ type: "int", default: 0 })
  recharge_amount: number;

  @Column({ type: "int", default: 0 })
  monthly_amount: number;

  @Column({ type: "int", default: 0 })
  total_amount: number;

  @Column({ default: false })
  claimed: boolean;

  @Column({ type: "datetime", nullable: true })
  claimed_at?: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
