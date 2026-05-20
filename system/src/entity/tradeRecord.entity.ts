import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

export interface TradeCardSnapshot {
  cardName: string;
  cardDesc: string;
  cardType: number;
  poolId: number;
  poolName?: string;
}

@Entity()
@Index("IDX_trade_record_listing", ["listing_id"])
@Index("IDX_trade_record_seller", ["seller_uid"])
@Index("IDX_trade_record_buyer", ["buyer_uid"])
export class TradeRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  listing_id: number;

  @Column()
  seller_uid: string;

  @Column()
  buyer_uid: string;

  @Column()
  card_uuid: string;

  @Column()
  card_id: number;

  @Column()
  card_level: string;

  @Column()
  price: number;

  @Column({ type: "float", default: 0 })
  fee_rate: number;

  @Column({ default: 0 })
  fee_amount: number;

  @Column({ default: 0 })
  seller_income: number;

  // 成交时卡片和卡池展示快照，避免后续改名影响审计
  @Column({ type: "json" })
  card_snapshot: TradeCardSnapshot;

  @CreateDateColumn()
  createdAt: Date;
}
