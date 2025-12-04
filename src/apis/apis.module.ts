import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApisService } from './apis.service';
import { ApisController } from './apis.controller';
import { User } from 'src/entity/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [ApisController],
  providers: [ApisService],
})
export class ApisModule {}
