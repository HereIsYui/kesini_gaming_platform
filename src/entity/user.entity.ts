// user.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from "typeorm";

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  uid: string;

  @Column()
  name: string;

  @Column()
  nickname: string;

  @Column()
  avatar: string;

  @Column()
  point: number;

  @Column()
  card_count_n: number;

  @Column()
  card_count_r: number;

  @Column()
  card_count_sr: number;

  @Column()
  card_count_ssr: number;

  @Column()
  card_count_ur: number;

  @CreateDateColumn()
  createdAt: Date;
}
