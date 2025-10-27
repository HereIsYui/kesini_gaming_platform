import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RedisUtil } from "./utils/redis";
import { UserService } from "./store/user";

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: "mysql",
      host: "154.13.6.73",
      port: 3306,
      username: "kesini",
      password: "be3smWMRc8fT3m7z",
      database: "kesini",
      entities: [],
      synchronize: true,
    }),
  ],
  controllers: [AppController],
  providers: [AppService, RedisUtil, UserService],
})
export class AppModule {}
