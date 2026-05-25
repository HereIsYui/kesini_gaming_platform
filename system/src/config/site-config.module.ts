import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SystemConfig } from "src/entity/systemConfig.entity";
import { SiteConfigService } from "./site-config.service";

@Module({
  imports: [TypeOrmModule.forFeature([SystemConfig])],
  providers: [SiteConfigService],
  exports: [SiteConfigService],
})
export class SiteConfigModule {}
