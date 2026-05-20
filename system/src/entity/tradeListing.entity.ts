import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export type TradeListingStatus = "active" | "sold" | "cancelled";

@Entity()
@Index("IDX_trade_listing_status_created", ["status", "createdAt"])
@Index("IDX_trade_listing_card_status", ["card_uuid", "status"])
@Index("IDX_trade_listing_seller_status", ["seller_uid", "status"])
@Index("IDX_trade_listing_filter", ["status", "card_level", "price"])
export class TradeListing {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  seller_uid: string;

  @Column({ type: "varchar", nullable: true })
  buyer_uid?: string | null;

  @Column()
  card_uuid: string;

  @Column()
  card_id: number;

  @Column()
  card_level: string;

  @Column()
  price: number;

  // 创建挂单时锁定的手续费率，成交时按该值结算
  @Column({ type: "float", default: 0 })
  fee_rate: number;

  @Column({ type: "varchar", default: "active" })
  status: TradeListingStatus;

  @Column({ type: "datetime", nullable: true })
  sold_at?: Date | null;

  @Column({ type: "datetime", nullable: true })
  cancelled_at?: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
