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
  drop_type: number;

  // 掉落道具类型 只有item_type为道具时才有效 
  @Column()
  drop_item_type: number;

  // 掉落物品值 只有item_type不为道具时才有效 
  @Column()
  drop_item_value: number;

  @CreateDateColumn()
  createdAt: Date;
}
