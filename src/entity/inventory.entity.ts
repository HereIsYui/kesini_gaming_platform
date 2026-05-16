import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  Index,
} from "typeorm";
import { User } from "./user.entity";

@Entity()
@Index("IDX_user_inventory_item", ["user_id", "item_id"], { unique: true })
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
