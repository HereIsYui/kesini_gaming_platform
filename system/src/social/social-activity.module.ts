import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/auth/auth.module";
import { User } from "src/entity/user.entity";
import { UserFriend } from "src/entity/userFriend.entity";
import { UserSocialActivity } from "src/entity/userSocialActivity.entity";
import { SocialActivityController } from "./social-activity.controller";
import { SocialActivityService } from "./social-activity.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([UserSocialActivity, UserFriend, User]),
    AuthModule,
  ],
  controllers: [SocialActivityController],
  providers: [SocialActivityService],
  exports: [SocialActivityService],
})
export class SocialActivityModule {}
