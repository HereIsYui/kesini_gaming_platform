import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import type { RedeemRewards } from "./redeemCode.entity";

export type ShopCurrencyType = "star_coin" | "fishpi_point";

@Entity()
@Index("IDX_shop_product_visible", ["delete_flag", "enabled"])
export class ShopProduct {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ length: 1024, default: "" })
  description: string;

  @Column({ default: true })
  enabled: boolean;

  @Column({ type: "varchar", length: 24, default: "star_coin" })
  currency_type: ShopCurrencyType;

  @Column({ type: "int", default: 1 })
  price: number;

  @Column({ type: "json" })
  rewards: RedeemRewards;

  @Column({ type: "int", nullable: true })
  total_limit?: number | null;

  @Column({ default: 0 })
  used_count: number;

  @Column({ type: "int", nullable: true })
  user_limit?: number | null;

  @Column({ type: "int", nullable: true })
  daily_limit?: number | null;

  @Column({ type: "int", nullable: true })
  weekly_limit?: number | null;

  @Column({ type: "int", nullable: true })
  monthly_limit?: number | null;

  @Column({ type: "datetime", nullable: true })
  starts_at?: Date | null;

  @Column({ type: "datetime", nullable: true })
  ends_at?: Date | null;

  @Column({ default: 0 })
  sort_order: number;

  @Column({ default: false })
  delete_flag: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
