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
  card_name: string;

  @Column()
  card_level: string;

  @Column()
  card_desc: string;

  @Column()
  card_type: string;

  @CreateDateColumn()
  createdAt: Date;
}
