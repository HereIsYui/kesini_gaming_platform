import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/auth/auth.module";
import { CardItem } from "src/entity/card.entity";
import { DropItem } from "src/entity/drop.entity";
import { SeasonConfig } from "src/entity/seasonConfig.entity";
import { SeasonPointRecord } from "src/entity/seasonPointRecord.entity";
import { SeasonShopItem } from "src/entity/seasonShopItem.entity";
import { SeasonShopUsage } from "src/entity/seasonShopUsage.entity";
import { User } from "src/entity/user.entity";
import { UserSeasonProgress } from "src/entity/userSeasonProgress.entity";
import { RewardModule } from "src/reward/reward.module";
import { SeasonController } from "./season.controller";
import { SeasonService } from "./season.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SeasonConfig,
      UserSeasonProgress,
      SeasonPointRecord,
      SeasonShopItem,
      SeasonShopUsage,
      User,
      DropItem,
      CardItem,
    ]),
    AuthModule,
    RewardModule,
  ],
  controllers: [SeasonController],
  providers: [SeasonService],
  exports: [SeasonService],
})
export class SeasonModule {}
