import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/auth/auth.module";
import { AchievementModule } from "src/achievement/achievement.module";
import { CardItem } from "src/entity/card.entity";
import { DropItem } from "src/entity/drop.entity";
import { ShopProduct } from "src/entity/shopProduct.entity";
import { ShopPurchaseRecord } from "src/entity/shopPurchaseRecord.entity";
import { PointLedgerRecord } from "src/entity/pointLedgerRecord.entity";
import { SystemConfig } from "src/entity/systemConfig.entity";
import { TradeListing } from "src/entity/tradeListing.entity";
import { User } from "src/entity/user.entity";
import { UserCard } from "src/entity/userCard.entity";
import { PointLedgerModule } from "src/point-ledger/point-ledger.module";
import { RechargeModule } from "src/recharge/recharge.module";
import { RewardModule } from "src/reward/reward.module";
import { ShopController } from "./shop.controller";
import { ShopMallService } from "./shop-mall.service";
import { ShopRecycleService } from "./shop-recycle.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SystemConfig,
      CardItem,
      DropItem,
      User,
      UserCard,
      TradeListing,
      PointLedgerRecord,
      ShopProduct,
      ShopPurchaseRecord,
    ]),
    AuthModule,
    PointLedgerModule,
    RewardModule,
    RechargeModule,
    AchievementModule,
  ],
  controllers: [ShopController],
  providers: [ShopRecycleService, ShopMallService],
  exports: [ShopRecycleService, ShopMallService],
})
export class ShopModule {}
