import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/auth/auth.module";
import { GachaConfigService } from "src/card/gacha-config.service";
import { CardItem } from "src/entity/card.entity";
import { DropItem } from "src/entity/drop.entity";
import { GachaPoolConfig } from "src/entity/gachaPoolConfig.entity";
import { UserHistory } from "src/entity/history.entity";
import { UserInventory } from "src/entity/inventory.entity";
import { PoolInfo } from "src/entity/pool.entity";
import { RedeemCode } from "src/entity/redeemCode.entity";
import { RedeemCodeUsage } from "src/entity/redeemCodeUsage.entity";
import { User } from "src/entity/user.entity";
import { UserGachaPity } from "src/entity/userGachaPity.entity";
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
    ]),
    AuthModule,
  ],
  controllers: [AdminController],
  providers: [AdminGuard, AdminService, GachaConfigService],
})
export class AdminModule {}
