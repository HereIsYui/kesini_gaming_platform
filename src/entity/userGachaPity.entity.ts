import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity()
@Index("IDX_user_gacha_pity_uid_pool", ["uid", "pool_id"], { unique: true })
export class UserGachaPity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  uid: string;

  @Column()
  pool_id: number;

  @Column({ default: 0 })
  draws_since_sr: number;

  @Column({ default: 0 })
  draws_since_ssr: number;

  @Column({ default: 0 })
  draws_since_ur: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
