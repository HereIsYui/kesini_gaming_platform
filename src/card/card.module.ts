import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CardService } from './card.service';
import { CardController } from './card.controller';
import { CardItem } from 'src/entity/card.entity';
import { PoolInfo } from 'src/entity/pool.entity';
import { User } from 'src/entity/user.entity';
import { UserCard } from 'src/entity/userCard.entity';
import { UserHistory } from 'src/entity/history.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CardItem, PoolInfo, User, UserCard, UserHistory])],
  controllers: [CardController],
  providers: [CardService],
  exports: [CardService],
})
export class CardModule {}
