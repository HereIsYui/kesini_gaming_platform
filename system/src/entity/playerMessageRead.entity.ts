import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity()
@Index("IDX_player_message_read_unique", ["uid", "message_id"], {
  unique: true,
})
@Index("IDX_player_message_read_uid", ["uid", "createdAt"])
export class PlayerMessageRead {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  uid: string;

  @Column()
  message_id: number;

  @CreateDateColumn()
  createdAt: Date;
}
