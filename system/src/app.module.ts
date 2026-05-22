import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RedisUtil } from "./utils/redis";
import { UserService } from "./store/user";
import { CardItem } from "./entity/card.entity";
import { UserCard } from "./entity/userCard.entity";
import { DropItem } from "./entity/drop.entity";
import { User } from "./entity/user.entity";
import { UserGachaPity } from "./entity/userGachaPity.entity";
import { GachaPoolConfig } from "./entity/gachaPoolConfig.entity";
import { RedeemCode } from "./entity/redeemCode.entity";
import { RedeemCodeUsage } from "./entity/redeemCodeUsage.entity";
import { RechargeConfig } from "./entity/rechargeConfig.entity";
import { RechargeRecord } from "./entity/rechargeRecord.entity";
import { ExchangeShopItem } from "./entity/exchangeShopItem.entity";
import { ExchangeShopUsage } from "./entity/exchangeShopUsage.entity";
import { TradeConfig } from "./entity/tradeConfig.entity";
import { TradeListing } from "./entity/tradeListing.entity";
import { TradeRecord } from "./entity/tradeRecord.entity";
import { LaunchActivityConfig } from "./entity/launchActivityConfig.entity";
import { LaunchActivityClaim } from "./entity/launchActivityClaim.entity";
import { PointLedgerRecord } from "./entity/pointLedgerRecord.entity";
import { AchievementConfig } from "./entity/achievementConfig.entity";
import { AchievementEvent } from "./entity/achievementEvent.entity";
import { UserAchievement } from "./entity/userAchievement.entity";
import { ApisModule } from "./apis/apis.module";
import { AchievementModule } from "./achievement/achievement.module";
import { CardModule } from "./card/card.module";
import { ConfigurationModule } from "./config/configuration.module";
import { ConfigurationService } from "./config/configuration.service";
import { AdminModule } from "./admin/admin.module";
import { RedeemModule } from "./redeem/redeem.module";
import { ExchangeModule } from "./exchange/exchange.module";
import { TradeModule } from "./trade/trade.module";
import { RechargeModule } from "./recharge/recharge.module";
import { LaunchActivityModule } from "./launch-activity/launch-activity.module";
import { PointLedgerModule } from "./point-ledger/point-ledger.module";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigurationModule],
      useFactory: (configService: ConfigurationService) =>
        configService.databaseConfig,
      inject: [ConfigurationService],
    }),
    TypeOrmModule.forFeature([
      CardItem,
      DropItem,
      UserCard,
      User,
      UserGachaPity,
      GachaPoolConfig,
      RedeemCode,
      RedeemCodeUsage,
      RechargeConfig,
      RechargeRecord,
      ExchangeShopItem,
      ExchangeShopUsage,
      TradeListing,
      TradeRecord,
      TradeConfig,
      LaunchActivityConfig,
      LaunchActivityClaim,
      PointLedgerRecord,
      AchievementConfig,
      AchievementEvent,
      UserAchievement,
    ]),
    ConfigurationModule,
    ApisModule,
    CardModule,
    AdminModule,
    RedeemModule,
    ExchangeModule,
    TradeModule,
    RechargeModule,
    LaunchActivityModule,
    PointLedgerModule,
    AchievementModule,
  ],
  controllers: [AppController],
  providers: [AppService, RedisUtil, UserService],
})
export class AppModule {}
