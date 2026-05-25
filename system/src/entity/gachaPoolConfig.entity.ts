import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import type { CardRarity } from "src/types/api";

@Entity()
@Index("IDX_gacha_pool_config_pool", ["pool_id"], { unique: true })
export class GachaPoolConfig {
  @PrimaryGeneratedColumn()
  id: number;

  // 对应卡池ID
  @Column()
  pool_id: number;

  // 是否启用数据库配置，关闭时回退环境变量默认配置
  @Column({ default: true })
  enabled: boolean;

  // 稀有度概率，如 { N: 0.5025, R: 0.3025, SR: 0.15, SSR: 0.045, UR: 0 }
  @Column({ type: "json" })
  rarity_probabilities: Record<string, number>;

  // UP配置，如 { enabled: true, cardIds: [1, 2], upRate: 0.5 }
  @Column({ type: "json", nullable: true })
  up_cards?: {
    enabled: boolean;
    cardIds: number[];
    upRate: number;
  } | null;

  // 保底配置
  @Column({ type: "json", nullable: true })
  pity_system?: {
    enabled: boolean;
    softPity?: {
      count: number;
      guaranteedRarity: CardRarity;
    };
    hardPity?: {
      count: number;
      guaranteedRarity: CardRarity;
    };
  } | null;

  // 单抽星穹币消耗
  @Column({ type: "int", default: 10 })
  single_draw_cost: number;

  // 十连抽星穹币消耗
  @Column({ type: "int", default: 100 })
  ten_draw_cost: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
