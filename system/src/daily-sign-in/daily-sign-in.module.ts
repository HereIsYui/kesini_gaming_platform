import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/auth/auth.module";
import { DailySignInRecord } from "src/entity/dailySignInRecord.entity";
import { PointLedgerRecord } from "src/entity/pointLedgerRecord.entity";
import { User } from "src/entity/user.entity";
import { PointLedgerModule } from "src/point-ledger/point-ledger.module";
import { DailySignInController } from "./daily-sign-in.controller";
import { DailySignInService } from "./daily-sign-in.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([DailySignInRecord, User, PointLedgerRecord]),
    AuthModule,
    PointLedgerModule,
  ],
  controllers: [DailySignInController],
  providers: [DailySignInService],
  exports: [DailySignInService],
})
export class DailySignInModule {}
