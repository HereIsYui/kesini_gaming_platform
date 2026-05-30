import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Announcement } from "src/entity/announcement.entity";
import { AnnouncementController } from "./announcement.controller";
import { AnnouncementService } from "./announcement.service";

@Module({
  imports: [TypeOrmModule.forFeature([Announcement])],
  controllers: [AnnouncementController],
  providers: [AnnouncementService],
  exports: [AnnouncementService],
})
export class AnnouncementModule {}
