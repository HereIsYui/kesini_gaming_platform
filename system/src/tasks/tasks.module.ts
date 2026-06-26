import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/auth/auth.module";
import { AchievementEvent } from "src/entity/achievementEvent.entity";
import { DailySignInRecord } from "src/entity/dailySignInRecord.entity";
import { ExchangeShopUsage } from "src/entity/exchangeShopUsage.entity";
import { UserHistory } from "src/entity/history.entity";
import { TradeRecord } from "src/entity/tradeRecord.entity";
import { User } from "src/entity/user.entity";
import { UserTaskClaim } from "src/entity/userTaskClaim.entity";
import { RewardModule } from "src/reward/reward.module";
import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserTaskClaim,
      User,
      UserHistory,
      DailySignInRecord,
      ExchangeShopUsage,
      TradeRecord,
      AchievementEvent,
    ]),
    AuthModule,
    RewardModule,
  ],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
