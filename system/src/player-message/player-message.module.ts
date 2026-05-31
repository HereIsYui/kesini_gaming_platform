import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/auth/auth.module";
import { PlayerMessage } from "src/entity/playerMessage.entity";
import { PlayerMessageRead } from "src/entity/playerMessageRead.entity";
import { User } from "src/entity/user.entity";
import { PlayerMessageController } from "./player-message.controller";
import { PlayerMessageService } from "./player-message.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([PlayerMessage, PlayerMessageRead, User]),
    AuthModule,
  ],
  controllers: [PlayerMessageController],
  providers: [PlayerMessageService],
  exports: [PlayerMessageService],
})
export class PlayerMessageModule {}
