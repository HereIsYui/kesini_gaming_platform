import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RedisUtil } from "./utils/redis";
import { UserService } from "./store/user";
import { CardItem } from "./entity/card.entity";
import { UserCard } from "./entity/userCard.entity";
import { DropItem } from "./entity/drop.entity";
import { User } from "./entity/user.entity";
import { UserGachaPity } from "./entity/userGachaPity.entity";
import { ApisModule } from "./apis/apis.module";
import { CardModule } from "./card/card.module";
import { ConfigurationModule } from "./config/configuration.module";
import { ConfigurationService } from "./config/configuration.service";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigurationModule],
      useFactory: (configService: ConfigurationService) =>
        configService.databaseConfig,
      inject: [ConfigurationService],
    }),
    TypeOrmModule.forFeature([
      CardItem,
      DropItem,
      UserCard,
      User,
      UserGachaPity,
    ]),
    ConfigurationModule,
    ApisModule,
    CardModule,
  ],
  controllers: [AppController],
  providers: [AppService, RedisUtil, UserService],
})
export class AppModule {}
