import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/auth/auth.module";
import { AchievementConfig } from "src/entity/achievementConfig.entity";
import { AchievementEvent } from "src/entity/achievementEvent.entity";
import { CardItem } from "src/entity/card.entity";
import { DropItem } from "src/entity/drop.entity";
import { ExchangeShopUsage } from "src/entity/exchangeShopUsage.entity";
import { UserHistory } from "src/entity/history.entity";
import { UserInventory } from "src/entity/inventory.entity";
import { PoolInfo } from "src/entity/pool.entity";
import { RechargeRecord } from "src/entity/rechargeRecord.entity";
import { RedeemCodeUsage } from "src/entity/redeemCodeUsage.entity";
import { TradeRecord } from "src/entity/tradeRecord.entity";
import { User } from "src/entity/user.entity";
import { UserAchievement } from "src/entity/userAchievement.entity";
import { UserCard } from "src/entity/userCard.entity";
import { RewardModule } from "src/reward/reward.module";
import { AchievementController } from "./achievement.controller";
import { AchievementService } from "./achievement.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AchievementConfig,
      UserAchievement,
      AchievementEvent,
      User,
      UserCard,
      UserHistory,
      CardItem,
      PoolInfo,
      RechargeRecord,
      RedeemCodeUsage,
      ExchangeShopUsage,
      TradeRecord,
      DropItem,
      UserInventory,
    ]),
    AuthModule,
    RewardModule,
  ],
  controllers: [AchievementController],
  providers: [AchievementService],
  exports: [AchievementService],
})
export class AchievementModule {}
