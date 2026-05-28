import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity()
@Index("IDX_user_formation_uid_position", ["uid", "position"], {
  unique: true,
})
@Index("IDX_user_formation_uid_card", ["uid", "card_uuid"], { unique: true })
export class UserFormationSlot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  uid: string;

  @Column({ type: "int" })
  position: number;

  @Column({ type: "varchar", length: 80 })
  card_uuid: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
