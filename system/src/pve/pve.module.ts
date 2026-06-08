import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/auth/auth.module";
import { CardItem } from "src/entity/card.entity";
import { DropItem } from "src/entity/drop.entity";
import { PveChallengeRecord } from "src/entity/pveChallengeRecord.entity";
import { PveStage } from "src/entity/pveStage.entity";
import { User } from "src/entity/user.entity";
import { FormationModule } from "src/formation/formation.module";
import { RechargeModule } from "src/recharge/recharge.module";
import { RewardModule } from "src/reward/reward.module";
import { SocialActivityModule } from "src/social/social-activity.module";
import { PveController } from "./pve.controller";
import { PveService } from "./pve.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PveStage,
      PveChallengeRecord,
      User,
      DropItem,
      CardItem,
    ]),
    AuthModule,
    FormationModule,
    RechargeModule,
    RewardModule,
    SocialActivityModule,
  ],
  controllers: [PveController],
  providers: [PveService],
  exports: [PveService],
})
export class PveModule {}
