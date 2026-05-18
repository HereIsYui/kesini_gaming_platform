import {
  Body,
  Controller,
  Post,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { IsNotEmpty, IsString } from "class-validator";
import { GetUser } from "src/auth/get-user.decorator";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { ResponseDto } from "src/common/dto/response.dto";
import { HttpExceptionFilter } from "src/common/filters/http-exception.filter";
import { TransformInterceptor } from "src/common/interceptors/transform.interceptor";
import { RedeemService } from "./redeem.service";

class ClaimRedeemDto {
  @IsString()
  @IsNotEmpty()
  code: string;
}

interface UserInfo {
  uid: string;
}

@Controller("redeem")
@UseInterceptors(TransformInterceptor)
@UseFilters(HttpExceptionFilter)
export class RedeemController {
  constructor(private readonly redeemService: RedeemService) {}

  @Post("claim")
  @UseGuards(JwtAuthGuard)
  async claim(
    @Body() body: ClaimRedeemDto,
    @GetUser() user: UserInfo,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }

    try {
      const result = await this.redeemService.claim(user.uid, body.code);
      return ResponseDto.success(result, "兑换成功");
    } catch (error) {
      return ResponseDto.error(error.message || "兑换失败");
    }
  }
}
