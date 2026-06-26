import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/auth/auth.module";
import { AchievementModule } from "src/achievement/achievement.module";
import { GachaConfigService } from "src/card/gacha-config.service";
import { RedisUtil } from "src/utils/redis";
import { SiteConfigModule } from "src/config/site-config.module";
import { ShopModule } from "src/shop/shop.module";
import { AnnouncementModule } from "src/announcement/announcement.module";
import { Announcement } from "src/entity/announcement.entity";
import { PlayerMessageModule } from "src/player-message/player-message.module";
import { PointLedgerModule } from "src/point-ledger/point-ledger.module";
import { CardItem } from "src/entity/card.entity";
import { DropItem } from "src/entity/drop.entity";
import { ExchangeShopItem } from "src/entity/exchangeShopItem.entity";
import { ExchangeShopUsage } from "src/entity/exchangeShopUsage.entity";
import { GachaPoolConfig } from "src/entity/gachaPoolConfig.entity";
import { UserHistory } from "src/entity/history.entity";
import { UserInventory } from "src/entity/inventory.entity";
import { PoolInfo } from "src/entity/pool.entity";
import { RedeemCode } from "src/entity/redeemCode.entity";
import { RedeemCodeUsage } from "src/entity/redeemCodeUsage.entity";
import { RechargeConfig } from "src/entity/rechargeConfig.entity";
import { RechargeRecord } from "src/entity/rechargeRecord.entity";
import { LaunchActivityClaim } from "src/entity/launchActivityClaim.entity";
import { LaunchActivityConfig } from "src/entity/launchActivityConfig.entity";
import { MonthlyCardPurchaseRecord } from "src/entity/monthlyCardPurchaseRecord.entity";
import { SystemConfig } from "src/entity/systemConfig.entity";
import { TradeConfig } from "src/entity/tradeConfig.entity";
import { TradeListing } from "src/entity/tradeListing.entity";
import { TradeRecord } from "src/entity/tradeRecord.entity";
import { User } from "src/entity/user.entity";
import { UserCard } from "src/entity/userCard.entity";
import { UserFormationSlot } from "src/entity/userFormationSlot.entity";
import { UserGachaPity } from "src/entity/userGachaPity.entity";
import { UserShowcaseCard } from "src/entity/userShowcaseCard.entity";
import { PveChallengeRecord } from "src/entity/pveChallengeRecord.entity";
import { PveStage } from "src/entity/pveStage.entity";
import { AdminController } from "./admin.controller";
import { AdminGuard } from "./admin.guard";
import { AdminService } from "./admin.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      CardItem,
      PoolInfo,
      DropItem,
      UserHistory,
      UserInventory,
      UserGachaPity,
      GachaPoolConfig,
      RedeemCode,
      RedeemCodeUsage,
      RechargeConfig,
      RechargeRecord,
      LaunchActivityConfig,
      LaunchActivityClaim,
      MonthlyCardPurchaseRecord,
      ExchangeShopItem,
      ExchangeShopUsage,
      TradeListing,
      TradeRecord,
      TradeConfig,
      SystemConfig,
      UserCard,
      UserFormationSlot,
      UserShowcaseCard,
      PveStage,
      PveChallengeRecord,
      Announcement,
    ]),
    AuthModule,
    AchievementModule,
    SiteConfigModule,
    ShopModule,
    AnnouncementModule,
    PlayerMessageModule,
    PointLedgerModule,
  ],
  controllers: [AdminController],
  providers: [AdminGuard, AdminService, GachaConfigService, RedisUtil],
})
export class AdminModule {}
