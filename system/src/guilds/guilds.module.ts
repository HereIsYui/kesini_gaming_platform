import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/auth/auth.module";
import { Guild } from "src/entity/guild.entity";
import { GuildActivityChestClaim } from "src/entity/guildActivityChestClaim.entity";
import { GuildBoss } from "src/entity/guildBoss.entity";
import { GuildBossChallenge } from "src/entity/guildBossChallenge.entity";
import { GuildBossRewardClaim } from "src/entity/guildBossRewardClaim.entity";
import { GuildContributionRecord } from "src/entity/guildContributionRecord.entity";
import { GuildJoinRequest } from "src/entity/guildJoinRequest.entity";
import { GuildMember } from "src/entity/guildMember.entity";
import { GuildMessage } from "src/entity/guildMessage.entity";
import { SystemConfig } from "src/entity/systemConfig.entity";
import { User } from "src/entity/user.entity";
import { FormationModule } from "src/formation/formation.module";
import { PointLedgerModule } from "src/point-ledger/point-ledger.module";
import { RewardModule } from "src/reward/reward.module";
import { GuildsController } from "./guilds.controller";
import { GuildsService } from "./guilds.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Guild,
      GuildActivityChestClaim,
      GuildBoss,
      GuildBossChallenge,
      GuildBossRewardClaim,
      GuildContributionRecord,
      GuildJoinRequest,
      GuildMember,
      GuildMessage,
      SystemConfig,
      User,
    ]),
    AuthModule,
    FormationModule,
    PointLedgerModule,
    RewardModule,
  ],
  controllers: [GuildsController],
  providers: [GuildsService],
  exports: [GuildsService],
})
export class GuildsModule {}
