import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export type MonthlyCardType = "ice" | "platinum";

@Entity()
@Index("IDX_monthly_card_subscription_unique", ["uid", "card_type"], {
  unique: true,
})
@Index("IDX_monthly_card_subscription_uid_expires", ["uid", "expires_at"])
export class MonthlyCardSubscription {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  uid: string;

  @Column({ type: "varchar", length: 24 })
  card_type: MonthlyCardType;

  @Column({ type: "int" })
  vip_level: number;

  @Column({ type: "datetime" })
  expires_at: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
