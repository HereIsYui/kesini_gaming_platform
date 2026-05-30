import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApisService } from './apis.service';
import { ApisController } from './apis.controller';
import { User } from 'src/entity/user.entity';
import { AuthModule } from 'src/auth/auth.module';
import { SiteConfigModule } from 'src/config/site-config.module';
import { AnnouncementModule } from 'src/announcement/announcement.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    AuthModule,
    SiteConfigModule,
    AnnouncementModule,
  ],
  controllers: [ApisController],
  providers: [ApisService],
})
export class ApisModule {}
