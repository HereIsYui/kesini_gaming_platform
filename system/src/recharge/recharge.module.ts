import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/auth/auth.module";
import { AchievementModule } from "src/achievement/achievement.module";
import { CardItem } from "src/entity/card.entity";
import { RechargeConfig } from "src/entity/rechargeConfig.entity";
import { RechargeRecord } from "src/entity/rechargeRecord.entity";
import { DropItem } from "src/entity/drop.entity";
import { SystemConfig } from "src/entity/systemConfig.entity";
import { User } from "src/entity/user.entity";
import { VipDailyClaim } from "src/entity/vipDailyClaim.entity";
import { PointLedgerModule } from "src/point-ledger/point-ledger.module";
import { RewardModule } from "src/reward/reward.module";
import { RechargeController } from "./recharge.controller";
import { RechargeService } from "./recharge.service";
import { VipController } from "./vip.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RechargeConfig,
      RechargeRecord,
      User,
      SystemConfig,
      VipDailyClaim,
      DropItem,
      CardItem,
    ]),
    AuthModule,
    PointLedgerModule,
    AchievementModule,
    RewardModule,
  ],
  controllers: [RechargeController, VipController],
  providers: [RechargeService],
  exports: [RechargeService],
})
export class RechargeModule {}
