import {
  Controller,
  Get,
  Post,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { GetUser } from "src/auth/get-user.decorator";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { ResponseDto } from "src/common/dto/response.dto";
import { HttpExceptionFilter } from "src/common/filters/http-exception.filter";
import { TransformInterceptor } from "src/common/interceptors/transform.interceptor";
import { LaunchActivityService } from "./launch-activity.service";

interface UserInfo {
  uid: string;
}

@Controller("launch-activity")
@UseGuards(JwtAuthGuard)
@UseInterceptors(TransformInterceptor)
@UseFilters(HttpExceptionFilter)
export class LaunchActivityController {
  constructor(private readonly launchActivityService: LaunchActivityService) {}

  @Get("current")
  async current(@GetUser() user: UserInfo): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    return ResponseDto.success(
      await this.launchActivityService.getCurrent(user.uid),
      "获取开服福利成功",
    );
  }

  @Post("claim")
  async claim(@GetUser() user: UserInfo): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.launchActivityService.claim(user.uid),
        "领取开服福利成功",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "领取开服福利失败");
    }
  }
}
