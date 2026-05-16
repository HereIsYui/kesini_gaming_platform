import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApisService } from './apis.service';
import { ApisController } from './apis.controller';
import { User } from 'src/entity/user.entity';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), AuthModule],
  controllers: [ApisController],
  providers: [ApisService],
})
export class ApisModule {}
