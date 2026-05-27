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
import { DailySignInService } from "./daily-sign-in.service";

interface UserInfo {
  uid: string;
}

@Controller("daily-sign-in")
@UseGuards(JwtAuthGuard)
@UseInterceptors(TransformInterceptor)
@UseFilters(HttpExceptionFilter)
export class DailySignInController {
  constructor(private readonly dailySignInService: DailySignInService) {}

  @Get("status")
  async status(@GetUser() user: UserInfo): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    return ResponseDto.success(await this.dailySignInService.getStatus(user.uid));
  }

  @Post("claim")
  async claim(@GetUser() user: UserInfo): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(await this.dailySignInService.claim(user.uid));
    } catch (error) {
      return ResponseDto.error(error.message || "签到失败");
    }
  }
}
