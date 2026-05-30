import { Controller, Get, UseFilters, UseInterceptors } from "@nestjs/common";
import { ResponseDto } from "src/common/dto/response.dto";
import { HttpExceptionFilter } from "src/common/filters/http-exception.filter";
import { TransformInterceptor } from "src/common/interceptors/transform.interceptor";
import { AnnouncementService } from "./announcement.service";

@Controller("announcements")
@UseInterceptors(TransformInterceptor)
@UseFilters(HttpExceptionFilter)
export class AnnouncementController {
  constructor(private readonly announcementService: AnnouncementService) {}

  @Get()
  async listPublic(): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.announcementService.listPublic(),
      "获取公告成功",
    );
  }
}
