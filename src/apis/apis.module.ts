import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApisService } from './apis.service';
import { ApisController } from './apis.controller';
import { User } from 'src/entity/user.entity';
import { CardItem } from 'src/entity/card.entity';
import { DropItem } from 'src/entity/drop.entity';
import { UserInventory } from 'src/entity/inventory.entity';
import { UserCard } from 'src/entity/user-card.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, CardItem, DropItem, UserInventory, UserCard])],
  controllers: [ApisController],
  providers: [ApisService],
})
export class ApisModule {}
