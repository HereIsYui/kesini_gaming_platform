import {
  Controller,
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
import { RechargeService } from "./recharge.service";

interface UserInfo {
  uid: string;
}

@Controller("vip")
@UseGuards(JwtAuthGuard)
@UseInterceptors(TransformInterceptor)
@UseFilters(HttpExceptionFilter)
export class VipController {
  constructor(private readonly rechargeService: RechargeService) {}

  @Post("daily-claim")
  async claimDaily(@GetUser() user: UserInfo): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.rechargeService.claimVipDailyPack(user.uid),
        "领取成功",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "领取失败");
    }
  }
}
