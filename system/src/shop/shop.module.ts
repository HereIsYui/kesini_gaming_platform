import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/auth/auth.module";
import { CardItem } from "src/entity/card.entity";
import { PointLedgerRecord } from "src/entity/pointLedgerRecord.entity";
import { SystemConfig } from "src/entity/systemConfig.entity";
import { TradeListing } from "src/entity/tradeListing.entity";
import { User } from "src/entity/user.entity";
import { UserCard } from "src/entity/userCard.entity";
import { PointLedgerModule } from "src/point-ledger/point-ledger.module";
import { ShopController } from "./shop.controller";
import { ShopRecycleService } from "./shop-recycle.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SystemConfig,
      CardItem,
      User,
      UserCard,
      TradeListing,
      PointLedgerRecord,
    ]),
    AuthModule,
    PointLedgerModule,
  ],
  controllers: [ShopController],
  providers: [ShopRecycleService],
  exports: [ShopRecycleService],
})
export class ShopModule {}
