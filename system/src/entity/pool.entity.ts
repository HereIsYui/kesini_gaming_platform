// user.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from "typeorm";

@Entity()
export class PoolInfo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  pool_name: string;

  // 卡池描述
  @Column()
  card_desc: string;

  // 卡池类型 0 常驻卡池 1 活动卡池 2 限定卡池
  @Column()
  card_type: number;

  // 是否上线，关闭后玩家端不可抽取
  @Column({ default: true })
  enabled: boolean;

  // 排序值，越小越靠前
  @Column({ default: 0 })
  sort_order: number;

  @CreateDateColumn()
  createdAt: Date;
}
