import {
  Controller,
  Get,
  Query,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { GetUser } from "src/auth/get-user.decorator";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { ResponseDto } from "src/common/dto/response.dto";
import { HttpExceptionFilter } from "src/common/filters/http-exception.filter";
import { TransformInterceptor } from "src/common/interceptors/transform.interceptor";
import { SocialActivityService } from "./social-activity.service";

interface UserInfo {
  uid: string;
}

@Controller("friends")
@UseGuards(JwtAuthGuard)
@UseInterceptors(TransformInterceptor)
@UseFilters(HttpExceptionFilter)
export class SocialActivityController {
  constructor(private readonly socialActivityService: SocialActivityService) {}

  @Get("feed")
  async getFriendFeed(
    @GetUser() user: UserInfo,
    @Query("limit") limit?: string,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.socialActivityService.listFriendFeed(user.uid, Number(limit)),
        "获取动态成功",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "获取动态失败");
    }
  }
}
