import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/auth/auth.module";
import { AchievementModule } from "src/achievement/achievement.module";
import { RechargeConfig } from "src/entity/rechargeConfig.entity";
import { RechargeRecord } from "src/entity/rechargeRecord.entity";
import { User } from "src/entity/user.entity";
import { PointLedgerModule } from "src/point-ledger/point-ledger.module";
import { RechargeController } from "./recharge.controller";
import { RechargeService } from "./recharge.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([RechargeConfig, RechargeRecord, User]),
    AuthModule,
    PointLedgerModule,
    AchievementModule,
  ],
  controllers: [RechargeController],
  providers: [RechargeService],
  exports: [RechargeService],
})
export class RechargeModule {}
