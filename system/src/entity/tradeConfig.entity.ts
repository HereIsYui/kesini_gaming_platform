import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity()
export class TradeConfig {
  @PrimaryGeneratedColumn()
  id: number;

  // 是否开启玩家交易市场
  @Column({ default: true })
  enabled: boolean;

  // 手续费率，0.05 表示 5%
  @Column({ type: "float", default: 0 })
  fee_rate: number;

  @Column({ default: 1 })
  min_price: number;

  @Column({ default: 999999 })
  max_price: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
