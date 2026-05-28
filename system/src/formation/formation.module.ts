import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/auth/auth.module";
import { CardItem } from "src/entity/card.entity";
import { TradeListing } from "src/entity/tradeListing.entity";
import { UserCard } from "src/entity/userCard.entity";
import { UserFormationSlot } from "src/entity/userFormationSlot.entity";
import { FormationController } from "./formation.controller";
import { FormationService } from "./formation.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserFormationSlot,
      UserCard,
      CardItem,
      TradeListing,
    ]),
    AuthModule,
  ],
  controllers: [FormationController],
  providers: [FormationService],
  exports: [FormationService],
})
export class FormationModule {}
