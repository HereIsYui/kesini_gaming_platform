import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
} from "typeorm";
import { User } from "./user.entity";

@Entity()
export class UserInventory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User)
  user: User;

  @Column()
  user_id: number;

  // 物品id，对应DropItem的id
  @Column()
  item_id: number;

  // 物品数量
  @Column()
  num: number;

  @CreateDateColumn()
  createdAt: Date;
}