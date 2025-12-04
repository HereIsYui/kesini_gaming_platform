// userCard.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from "typeorm";

@Entity()
export class UserCard {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  uid: string;

  @Column()
  card_id: string;

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
