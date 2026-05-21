import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/auth/auth.module";
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
  ],
  controllers: [RechargeController],
  providers: [RechargeService],
  exports: [RechargeService],
})
export class RechargeModule {}
