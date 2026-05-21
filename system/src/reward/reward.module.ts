import { Module } from "@nestjs/common";
import { PointLedgerModule } from "src/point-ledger/point-ledger.module";
import { RewardService } from "./reward.service";

@Module({
  imports: [PointLedgerModule],
  providers: [RewardService],
  exports: [RewardService],
})
export class RewardModule {}
