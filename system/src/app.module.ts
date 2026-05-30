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
import { SystemConfig } from "./entity/systemConfig.entity";
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
import { DailySignInRecord } from "./entity/dailySignInRecord.entity";
import { AchievementConfig } from "./entity/achievementConfig.entity";
import { AchievementEvent } from "./entity/achievementEvent.entity";
import { UserAchievement } from "./entity/userAchievement.entity";
import { UserTaskClaim } from "./entity/userTaskClaim.entity";
import { UserFormationSlot } from "./entity/userFormationSlot.entity";
import { PveStage } from "./entity/pveStage.entity";
import { PveChallengeRecord } from "./entity/pveChallengeRecord.entity";
import { SeasonConfig } from "./entity/seasonConfig.entity";
import { SeasonPointRecord } from "./entity/seasonPointRecord.entity";
import { SeasonShopItem } from "./entity/seasonShopItem.entity";
import { SeasonShopUsage } from "./entity/seasonShopUsage.entity";
import { UserSeasonProgress } from "./entity/userSeasonProgress.entity";
import { UserShowcaseCard } from "./entity/userShowcaseCard.entity";
import { UserFriend } from "./entity/userFriend.entity";
import { UserSocialActivity } from "./entity/userSocialActivity.entity";
import { Guild } from "./entity/guild.entity";
import { GuildMember } from "./entity/guildMember.entity";
import { GuildMessage } from "./entity/guildMessage.entity";
import { Announcement } from "./entity/announcement.entity";
import { ApisModule } from "./apis/apis.module";
import { AchievementModule } from "./achievement/achievement.module";
import { CardModule } from "./card/card.module";
import { ConfigurationModule } from "./config/configuration.module";
import { ConfigurationService } from "./config/configuration.service";
import { SiteConfigModule } from "./config/site-config.module";
import { AdminModule } from "./admin/admin.module";
import { RedeemModule } from "./redeem/redeem.module";
import { ExchangeModule } from "./exchange/exchange.module";
import { TradeModule } from "./trade/trade.module";
import { RechargeModule } from "./recharge/recharge.module";
import { LaunchActivityModule } from "./launch-activity/launch-activity.module";
import { PointLedgerModule } from "./point-ledger/point-ledger.module";
import { DailySignInModule } from "./daily-sign-in/daily-sign-in.module";
import { ShopModule } from "./shop/shop.module";
import { TasksModule } from "./tasks/tasks.module";
import { FormationModule } from "./formation/formation.module";
import { PveModule } from "./pve/pve.module";
import { SeasonModule } from "./season/season.module";
import { ProfileModule } from "./profile/profile.module";
import { FriendsModule } from "./friends/friends.module";
import { SocialActivityModule } from "./social/social-activity.module";
import { GuildsModule } from "./guilds/guilds.module";
import { AnnouncementModule } from "./announcement/announcement.module";

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
      SystemConfig,
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
      DailySignInRecord,
      AchievementConfig,
      AchievementEvent,
      UserAchievement,
      UserTaskClaim,
      UserFormationSlot,
      PveStage,
      PveChallengeRecord,
      SeasonConfig,
      SeasonPointRecord,
      SeasonShopItem,
      SeasonShopUsage,
      UserSeasonProgress,
      UserShowcaseCard,
      UserFriend,
      UserSocialActivity,
      Guild,
      GuildMember,
      GuildMessage,
      Announcement,
    ]),
    ConfigurationModule,
    SiteConfigModule,
    ApisModule,
    CardModule,
    AdminModule,
    RedeemModule,
    ExchangeModule,
    TradeModule,
    RechargeModule,
    LaunchActivityModule,
    PointLedgerModule,
    DailySignInModule,
    AchievementModule,
    ShopModule,
    TasksModule,
    FormationModule,
    PveModule,
    SeasonModule,
    ProfileModule,
    FriendsModule,
    SocialActivityModule,
    GuildsModule,
    AnnouncementModule,
  ],
  controllers: [AppController],
  providers: [AppService, RedisUtil, UserService],
})
export class AppModule {}
