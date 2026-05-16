// userCard.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from "typeorm";

@Entity()
@Index("IDX_user_card_owner", ["uid", "delete_flag", "card_id"])
@Index("IDX_user_card_uuid", ["card_uuid"], { unique: true })
export class UserCard {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  uid: string;

  @Column()
  card_id: string;

  // 实际获得时的稀有度，旧数据允许为空
  @Column({ nullable: true })
  card_level?: string;

  // 是否可以出售
  @Column()
  can_sell: boolean;

  // 是否可以抽奖
  @Column()
  can_lottery: boolean;

  @Column()
  card_uuid: string;

  // 删除标记：false-正常，true-已删除
  @Column({ default: false })
  delete_flag: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
