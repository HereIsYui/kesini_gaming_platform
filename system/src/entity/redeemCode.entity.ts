import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export interface RedeemRewardItem {
  itemId: number;
  num: number;
}

export interface RedeemRewards {
  points: number;
  items: RedeemRewardItem[];
}

@Entity()
@Index("IDX_redeem_code_code", ["code"], { unique: true })
export class RedeemCode {
  @PrimaryGeneratedColumn()
  id: number;

  // 兑换码，统一使用大写保存
  @Column({ length: 64 })
  code: string;

  @Column()
  name: string;

  @Column({ length: 1024, default: "" })
  description: string;

  @Column({ default: true })
  enabled: boolean;

  // 空值表示不限总库存
  @Column({ type: "int", nullable: true })
  total_limit?: number | null;

  @Column({ default: 0 })
  used_count: number;

  @Column({ type: "datetime", nullable: true })
  starts_at?: Date | null;

  @Column({ type: "datetime", nullable: true })
  ends_at?: Date | null;

  @Column({ type: "json" })
  rewards: RedeemRewards;

  // 软删除，保留兑换记录审计
  @Column({ default: false })
  delete_flag: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
