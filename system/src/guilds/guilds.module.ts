import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/auth/auth.module";
import { Guild } from "src/entity/guild.entity";
import { GuildMember } from "src/entity/guildMember.entity";
import { GuildMessage } from "src/entity/guildMessage.entity";
import { User } from "src/entity/user.entity";
import { GuildsController } from "./guilds.controller";
import { GuildsService } from "./guilds.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Guild, GuildMember, GuildMessage, User]),
    AuthModule,
  ],
  controllers: [GuildsController],
  providers: [GuildsService],
  exports: [GuildsService],
})
export class GuildsModule {}
