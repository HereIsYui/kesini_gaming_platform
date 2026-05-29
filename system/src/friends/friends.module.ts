import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/auth/auth.module";
import { User } from "src/entity/user.entity";
import { UserFriend } from "src/entity/userFriend.entity";
import { FriendsController } from "./friends.controller";
import { FriendsService } from "./friends.service";

@Module({
  imports: [TypeOrmModule.forFeature([User, UserFriend]), AuthModule],
  controllers: [FriendsController],
  providers: [FriendsService],
  exports: [FriendsService],
})
export class FriendsModule {}
