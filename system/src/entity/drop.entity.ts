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

  // 物品类型：0 卡片碎片 1 虚拟星穹币 2 普通道具 3 其他
  @Column()
  drop_type: number;

  // 普通道具和其他类型的扩展参数类型
  @Column()
  drop_item_type: number;

  // 普通道具和其他类型的扩展参数值
  @Column()
  drop_item_value: number;

  // 禁用后不再作为新奖励或碎片配置使用，历史背包记录仍保留
  @Column({ default: false })
  disabled: boolean;

  // 全局默认卡片碎片，卡片未单独配置分解产出时使用
  @Column({ default: false })
  default_fragment: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
