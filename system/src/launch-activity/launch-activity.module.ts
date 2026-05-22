import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/auth/auth.module";
import { AchievementModule } from "src/achievement/achievement.module";
import { DropItem } from "src/entity/drop.entity";
import { UserInventory } from "src/entity/inventory.entity";
import { LaunchActivityClaim } from "src/entity/launchActivityClaim.entity";
import { LaunchActivityConfig } from "src/entity/launchActivityConfig.entity";
import { User } from "src/entity/user.entity";
import { RewardModule } from "src/reward/reward.module";
import { LaunchActivityController } from "./launch-activity.controller";
import { LaunchActivityService } from "./launch-activity.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LaunchActivityConfig,
      LaunchActivityClaim,
      User,
      UserInventory,
      DropItem,
    ]),
    AuthModule,
    RewardModule,
    AchievementModule,
  ],
  controllers: [LaunchActivityController],
  providers: [LaunchActivityService],
})
export class LaunchActivityModule {}
