// user.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from "typeorm";

@Entity()
export class UserHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  uid: string;

  // 抽卡次数
  @Column()
  count: number;

  // 抽到的卡片id 用英文,分隔
  @Column()
  card_ids: string;

  // 抽到的卡片等级 用英文,分隔
  @Column()
  card_levels: string;

  // 抽到的卡片uuid 用英文,分隔
  @Column({length: 1024})
  card_uuids: string;

  @CreateDateColumn()
  createdAt: Date;
}
