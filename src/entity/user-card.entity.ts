import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
} from "typeorm";
import { User } from "./user.entity";
import { CardItem } from "./card.entity";

@Entity()
export class UserCard {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User)
  user: User;

  @Column()
  user_id: number;

  @ManyToOne(() => CardItem)
  card: CardItem;

  @Column()
  card_id: number;

  // 卡片数量
  @Column()
  quantity: number;

  // 卡片获得时间
  @CreateDateColumn()
  createdAt: Date;
}