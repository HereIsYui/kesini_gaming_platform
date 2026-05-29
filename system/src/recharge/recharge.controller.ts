import {
  Body,
  Controller,
  Get,
  Post,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Min } from "class-validator";
import { GetUser } from "src/auth/get-user.decorator";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { ResponseDto } from "src/common/dto/response.dto";
import { HttpExceptionFilter } from "src/common/filters/http-exception.filter";
import { TransformInterceptor } from "src/common/interceptors/transform.interceptor";
import { RechargeService } from "./recharge.service";

class RechargePointsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount: number;

  @IsOptional()
  @IsString()
  requestId?: string;
}

interface UserInfo {
  uid: string;
}

@Controller("recharge")
@UseInterceptors(TransformInterceptor)
@UseFilters(HttpExceptionFilter)
export class RechargeController {
  constructor(private readonly rechargeService: RechargeService) {}

  @Get("config")
  async getConfig(): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.rechargeService.getPublicConfig(),
      "获取充值配置成功",
    );
  }

  @Get("fishpi-point")
  @UseGuards(JwtAuthGuard)
  async getFishpiPoint(@GetUser() user: UserInfo): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }

    try {
      return ResponseDto.success(
        await this.rechargeService.getFishpiPoint(user.uid),
        "查询成功",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "查询失败");
    }
  }

  @Post("points")
  @UseGuards(JwtAuthGuard)
  async rechargePoints(
    @Body() body: RechargePointsDto,
    @GetUser() user: UserInfo,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }

    try {
      return ResponseDto.success(
        await this.rechargeService.recharge(
          user.uid,
          body.amount,
          body.requestId,
        ),
        "充值成功",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "充值失败");
    }
  }
}
