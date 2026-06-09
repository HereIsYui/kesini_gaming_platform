import {
  Body,
  Controller,
  Get,
  Post,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { IsIn, IsOptional, IsString } from "class-validator";
import { GetUser } from "src/auth/get-user.decorator";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { ResponseDto } from "src/common/dto/response.dto";
import { HttpExceptionFilter } from "src/common/filters/http-exception.filter";
import { TransformInterceptor } from "src/common/interceptors/transform.interceptor";
import { MonthlyCardService } from "./monthly-card.service";

class PurchaseMonthlyCardDto {
  @IsIn(["ice", "platinum"])
  cardType: "ice" | "platinum";

  @IsOptional()
  @IsString()
  requestId?: string;
}

interface UserInfo {
  uid: string;
}

@Controller("monthly-card")
@UseInterceptors(TransformInterceptor)
@UseFilters(HttpExceptionFilter)
export class MonthlyCardController {
  constructor(private readonly monthlyCardService: MonthlyCardService) {}

  @Get("config")
  async getConfig(): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.monthlyCardService.getPublicConfig(),
      "获取成功",
    );
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async getMine(@GetUser() user: UserInfo): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("登录已失效");
    }
    return ResponseDto.success(
      await this.monthlyCardService.getMyStatus(user.uid),
      "获取成功",
    );
  }

  @Post("purchase")
  @UseGuards(JwtAuthGuard)
  async purchase(
    @Body() body: PurchaseMonthlyCardDto,
    @GetUser() user: UserInfo,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("登录已失效");
    }
    try {
      return ResponseDto.success(
        await this.monthlyCardService.purchase(user.uid, body),
        "购买成功",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "购买失败");
    }
  }
}
