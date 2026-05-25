import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity()
@Index("IDX_system_config_key", ["key"], { unique: true })
export class SystemConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 128 })
  key: string;

  @Column({ type: "text" })
  value: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  description?: string | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
