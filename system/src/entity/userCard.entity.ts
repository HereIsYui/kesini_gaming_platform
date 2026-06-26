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
@Index("IDX_user_card_leaderboard", ["delete_flag", "card_level", "uid"])
@Index("IDX_user_card_uuid", ["card_uuid"], { unique: true })
export class UserCard {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  uid: string;

  @Column()
  card_id: string;

  // 实际获得时的稀有度，旧数据允许为空
  @Column({ type: "varchar", nullable: true })
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

  // 收藏锁定：锁定后不可分解、回收或挂售
  @Column({ default: false })
  locked: boolean;

  // 养成等级：用于后续阵容与 PVE 战力计算
  @Column({ type: "int", default: 1 })
  cultivation_level: number;

  // 累计投入的养成经验，首版等同于已消耗碎片数量
  @Column({ type: "int", default: 0 })
  cultivation_exp: number;

  @Column({ type: "int", default: 0 })
  star_level: number;

  @Column({ type: "int", default: 0 })
  potential_bp: number;

  @Column({ type: "varchar", length: 1, default: "C" })
  potential_grade: "S" | "A" | "B" | "C";

  @CreateDateColumn()
  createdAt: Date;
}
