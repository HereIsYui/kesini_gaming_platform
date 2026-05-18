import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/auth/auth.module";
import { DropItem } from "src/entity/drop.entity";
import { ExchangeShopItem } from "src/entity/exchangeShopItem.entity";
import { ExchangeShopUsage } from "src/entity/exchangeShopUsage.entity";
import { UserInventory } from "src/entity/inventory.entity";
import { User } from "src/entity/user.entity";
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
  ],
  controllers: [ExchangeController],
  providers: [ExchangeService],
  exports: [ExchangeService],
})
export class ExchangeModule {}
