import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CardService } from "./card.service";
import { CardController } from "./card.controller";
import { CardItem } from "src/entity/card.entity";
import { PoolInfo } from "src/entity/pool.entity";
import { User } from "src/entity/user.entity";
import { UserCard } from "src/entity/userCard.entity";
import { UserHistory } from "src/entity/history.entity";
import { DropItem } from "src/entity/drop.entity";
import { UserInventory } from "src/entity/inventory.entity";
import { UserGachaPity } from "src/entity/userGachaPity.entity";
import { GachaPoolConfig } from "src/entity/gachaPoolConfig.entity";
import { TradeListing } from "src/entity/tradeListing.entity";
import { SystemConfig } from "src/entity/systemConfig.entity";
import { RechargeRecord } from "src/entity/rechargeRecord.entity";
import { PveChallengeRecord } from "src/entity/pveChallengeRecord.entity";
import { AuthModule } from "src/auth/auth.module";
import { AchievementModule } from "src/achievement/achievement.module";
import { GachaConfigService } from "./gacha-config.service";
import { PointLedgerModule } from "src/point-ledger/point-ledger.module";
import { SocialActivityModule } from "src/social/social-activity.module";
import { RedisUtil } from "src/utils/redis";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CardItem,
      PoolInfo,
      User,
      UserCard,
      UserHistory,
      DropItem,
      UserInventory,
      UserGachaPity,
      GachaPoolConfig,
      TradeListing,
      SystemConfig,
      RechargeRecord,
      PveChallengeRecord,
    ]),
    AuthModule,
    PointLedgerModule,
    AchievementModule,
    SocialActivityModule,
  ],
  controllers: [CardController],
  providers: [CardService, GachaConfigService, RedisUtil],
  exports: [CardService, GachaConfigService],
})
export class CardModule {}
