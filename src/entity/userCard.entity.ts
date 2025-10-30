// user.entity.ts
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

  @Column()
  card_uuid: string;

  @CreateDateColumn()
  createdAt: Date;
}
