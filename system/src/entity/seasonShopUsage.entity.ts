import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";
import type { RedeemRewards } from "./redeemCode.entity";

@Entity()
@Index("IDX_season_shop_usage_uid", ["uid"])
@Index("IDX_season_shop_usage_item_user", ["shop_item_id", "uid"])
@Index("IDX_season_shop_usage_season", ["season_key", "uid"])
export class SeasonShopUsage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  shop_item_id: number;

  @Column()
  shop_item_name: string;

  @Column({ type: "varchar", length: 64 })
  season_key: string;

  @Column()
  uid: string;

  @Column({ default: 1 })
  count: number;

  @Column({ type: "int", default: 0 })
  cost_points: number;

  @Column({ type: "json" })
  reward_snapshot: RedeemRewards;

  @CreateDateColumn()
  createdAt: Date;
}
