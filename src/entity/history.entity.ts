// user.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from "typeorm";

@Entity()
@Index("IDX_user_history_uid_created", ["uid", "createdAt"])
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
  @Column({ length: 1024 })
  card_uuids: string;

  // 结构化抽卡明细，保留字符串字段兼容旧接口
  @Column({ type: "json", nullable: true })
  card_details?: Array<{
    cardId: number;
    rarity: string;
    cardUuid: string;
    isUp: boolean;
    isPity: boolean;
  }>;

  @CreateDateColumn()
  createdAt: Date;
}
