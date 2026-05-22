import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/auth/auth.module";
import { AchievementModule } from "src/achievement/achievement.module";
import { DropItem } from "src/entity/drop.entity";
import { ExchangeShopItem } from "src/entity/exchangeShopItem.entity";
import { ExchangeShopUsage } from "src/entity/exchangeShopUsage.entity";
import { UserInventory } from "src/entity/inventory.entity";
import { User } from "src/entity/user.entity";
import { PointLedgerModule } from "src/point-ledger/point-ledger.module";
import { ExchangeController } from "./exchange.controller";
import { ExchangeService } from "./exchange.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExchangeShopItem,
      ExchangeShopUsage,
      User,
      UserInventory,
      DropItem,
    ]),
    AuthModule,
    PointLedgerModule,
    AchievementModule,
  ],
  controllers: [ExchangeController],
  providers: [ExchangeService],
  exports: [ExchangeService],
})
export class ExchangeModule {}
