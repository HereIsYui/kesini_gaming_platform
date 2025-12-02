// user.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from "typeorm";

@Entity()
export class CardItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  card_name: string;

  // 卡片可出现等级用英文,隔开 如: N,R,SR,SSR,UR
  @Column()
  card_level: string;

  // 卡片分解后掉落物品id 用英文,隔开 如: item_001,item_002
  @Column()
  drop_item: string;

  // 卡片描述
  @Column()
  card_desc: string;

  // 卡片类型 0 普通卡 1 限定卡 2 纪念卡 3 活动卡 4 隐藏卡
  @Column()
  card_type: string;

  @CreateDateColumn()
  createdAt: Date;
}
