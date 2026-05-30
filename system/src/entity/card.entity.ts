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

  // 卡片分解后掉落物品id,掉落概率,最大数量 用英文;隔开 如: item_001,0.3,2;item_002,0.7,1
  @Column()
  drop_item: string;

  // 卡片描述
  @Column()
  card_desc: string;

  // 卡面素材，相对 /file 的访问路径或空字符串
  @Column({ length: 500, default: "" })
  card_image: string;

  // 卡片类型 0 普通卡 1 限定卡 2 纪念卡 3 活动卡 4 隐藏卡
  @Column()
  card_type: number;

  // 卡片所属卡池id
  @Column()
  pool: number;

  @Column({ default: true })
  enabled: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
