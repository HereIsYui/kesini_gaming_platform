import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/auth/auth.module";
import { CardItem } from "src/entity/card.entity";
import { User } from "src/entity/user.entity";
import { UserCard } from "src/entity/userCard.entity";
import { UserShowcaseCard } from "src/entity/userShowcaseCard.entity";
import { FormationModule } from "src/formation/formation.module";
import { ProfileController } from "./profile.controller";
import { ProfileService } from "./profile.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserCard, CardItem, UserShowcaseCard]),
    AuthModule,
    FormationModule,
  ],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
