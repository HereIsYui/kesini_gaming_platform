import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity("open_id_nonce")
@Index("IDX_open_id_nonce_nonce", ["nonce"], { unique: true })
@Index("IDX_open_id_nonce_expires_at", ["expires_at"])
export class OpenIdNonce {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 255 })
  nonce: string;

  @Column({ type: "datetime" })
  expires_at: Date;

  @CreateDateColumn()
  createdAt: Date;
}
