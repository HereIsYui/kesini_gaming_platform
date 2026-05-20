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
import { AuthModule } from "src/auth/auth.module";
import { GachaConfigService } from "./gacha-config.service";

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
    ]),
    AuthModule,
  ],
  controllers: [CardController],
  providers: [CardService, GachaConfigService],
  exports: [CardService, GachaConfigService],
})
export class CardModule {}
