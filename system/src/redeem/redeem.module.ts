import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/auth/auth.module";
import { DropItem } from "src/entity/drop.entity";
import { UserInventory } from "src/entity/inventory.entity";
import { RedeemCode } from "src/entity/redeemCode.entity";
import { RedeemCodeUsage } from "src/entity/redeemCodeUsage.entity";
import { User } from "src/entity/user.entity";
import { RedeemController } from "./redeem.controller";
import { RedeemService } from "./redeem.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RedeemCode,
      RedeemCodeUsage,
      User,
      UserInventory,
      DropItem,
    ]),
    AuthModule,
  ],
  controllers: [RedeemController],
  providers: [RedeemService],
  exports: [RedeemService],
})
export class RedeemModule {}
