// user.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from "typeorm";

@Entity()
@Index("IDX_user_uid", ["uid"], { unique: true })
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

  @Column({ default: 0 })
  point: number;

  @Column({ default: 0 })
  card_count_n: number;

  @Column({ default: 0 })
  card_count_r: number;

  @Column({ default: 0 })
  card_count_sr: number;

  @Column({ default: 0 })
  card_count_ssr: number;

  @Column({ default: 0 })
  card_count_ur: number;

  // 是否为后台管理员
  @Column({ default: false })
  is_admin: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
