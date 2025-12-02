// user.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from "typeorm";

@Entity()
export class DropItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  drop_name: string;

  @Column()
  drop_desc: string;

  // 掉落物品类型 0 卡片碎片 1 积分 2 道具 3 其他
  @Column()
  drop_type: string;

  @CreateDateColumn()
  createdAt: Date;
}
