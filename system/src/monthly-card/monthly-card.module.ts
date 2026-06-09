import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MonthlyCardPurchaseRecord } from "src/entity/monthlyCardPurchaseRecord.entity";
import { MonthlyCardSubscription } from "src/entity/monthlyCardSubscription.entity";
import { RechargeConfig } from "src/entity/rechargeConfig.entity";
import { SystemConfig } from "src/entity/systemConfig.entity";
import { User } from "src/entity/user.entity";
import { RechargeModule } from "src/recharge/recharge.module";
import { MonthlyCardController } from "./monthly-card.controller";
import { MonthlyCardService } from "./monthly-card.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MonthlyCardSubscription,
      MonthlyCardPurchaseRecord,
      RechargeConfig,
      SystemConfig,
      User,
    ]),
    RechargeModule,
  ],
  controllers: [MonthlyCardController],
  providers: [MonthlyCardService],
  exports: [MonthlyCardService],
})
export class MonthlyCardModule {}
