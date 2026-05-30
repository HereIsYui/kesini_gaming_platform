import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity()
@Index("IDX_announcement_visible", ["enabled", "delete_flag", "sort_order"])
export class Announcement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 40 })
  title: string;

  @Column({ type: "varchar", length: 160, default: "" })
  content: string;

  @Column({ default: true })
  enabled: boolean;

  @Column({ default: 0 })
  sort_order: number;

  @Column({ type: "datetime", nullable: true })
  starts_at?: Date | null;

  @Column({ type: "datetime", nullable: true })
  ends_at?: Date | null;

  @Column({ default: false })
  delete_flag: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
