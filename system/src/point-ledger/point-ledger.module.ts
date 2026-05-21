import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/auth/auth.module";
import { PointLedgerRecord } from "src/entity/pointLedgerRecord.entity";
import { User } from "src/entity/user.entity";
import { PointLedgerController } from "./point-ledger.controller";
import { PointLedgerService } from "./point-ledger.service";

@Module({
  imports: [TypeOrmModule.forFeature([PointLedgerRecord, User]), AuthModule],
  controllers: [PointLedgerController],
  providers: [PointLedgerService],
  exports: [PointLedgerService],
})
export class PointLedgerModule {}
