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

  @CreateDateColumn()
  createdAt: Date;
}
