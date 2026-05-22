import {
  Body,
  Controller,
  Get,
  Post,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { IsArray, IsInt, Min } from "class-validator";
import { Type } from "class-transformer";
import { GetUser } from "src/auth/get-user.decorator";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { ResponseDto } from "src/common/dto/response.dto";
import { HttpExceptionFilter } from "src/common/filters/http-exception.filter";
import { TransformInterceptor } from "src/common/interceptors/transform.interceptor";
import { AchievementService } from "./achievement.service";

class AckAchievementNotificationsDto {
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  achievementIds: number[];
}

interface UserInfo {
  uid: string;
}

@Controller("achievement")
@UseGuards(JwtAuthGuard)
@UseInterceptors(TransformInterceptor)
@UseFilters(HttpExceptionFilter)
export class AchievementController {
  constructor(private readonly achievementService: AchievementService) {}

  @Get("list")
  async list(@GetUser() user: UserInfo): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.achievementService.listPlayerAchievements(user.uid),
        "获取成就列表成功",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "获取成就列表失败");
    }
  }

  @Get("notifications/unread")
  async unreadNotifications(
    @GetUser() user: UserInfo,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.achievementService.listUnreadNotifications(user.uid),
        "获取成就通知成功",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "获取成就通知失败");
    }
  }

  @Post("notifications/ack")
  async ackNotifications(
    @Body() body: AckAchievementNotificationsDto,
    @GetUser() user: UserInfo,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.achievementService.ackNotifications(
          user.uid,
          body.achievementIds,
        ),
        "确认成就通知成功",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "确认成就通知失败");
    }
  }
}
