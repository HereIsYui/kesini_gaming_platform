import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/auth/auth.module";
import { AchievementModule } from "src/achievement/achievement.module";
import { CardItem } from "src/entity/card.entity";
import { PoolInfo } from "src/entity/pool.entity";
import { TradeConfig } from "src/entity/tradeConfig.entity";
import { TradeListing } from "src/entity/tradeListing.entity";
import { TradeRecord } from "src/entity/tradeRecord.entity";
import { User } from "src/entity/user.entity";
import { UserCard } from "src/entity/userCard.entity";
import { PointLedgerModule } from "src/point-ledger/point-ledger.module";
import { RechargeModule } from "src/recharge/recharge.module";
import { TradeController } from "./trade.controller";
import { TradeService } from "./trade.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TradeListing,
      TradeRecord,
      TradeConfig,
      UserCard,
      User,
      CardItem,
      PoolInfo,
    ]),
    AuthModule,
    PointLedgerModule,
    AchievementModule,
    RechargeModule,
  ],
  controllers: [TradeController],
  providers: [TradeService],
  exports: [TradeService],
})
export class TradeModule {}
