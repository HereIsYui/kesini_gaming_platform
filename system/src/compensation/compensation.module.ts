import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/auth/auth.module";
import { CompensationGrant } from "src/entity/compensationGrant.entity";
import { User } from "src/entity/user.entity";
import { PointLedgerModule } from "src/point-ledger/point-ledger.module";
import { CompensationController } from "./compensation.controller";
import { CompensationService } from "./compensation.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([CompensationGrant, User]),
    AuthModule,
    PointLedgerModule,
  ],
  controllers: [CompensationController],
  providers: [CompensationService],
  exports: [CompensationService],
})
export class CompensationModule {}
