import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";
import { GetUser } from "src/auth/get-user.decorator";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { ResponseDto } from "src/common/dto/response.dto";
import { HttpExceptionFilter } from "src/common/filters/http-exception.filter";
import { TransformInterceptor } from "src/common/interceptors/transform.interceptor";
import { ExchangeService } from "./exchange.service";

class ClaimExchangeDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  count?: number;
}

interface UserInfo {
  uid: string;
}

@Controller("exchange")
@UseInterceptors(TransformInterceptor)
@UseFilters(HttpExceptionFilter)
export class ExchangeController {
  constructor(private readonly exchangeService: ExchangeService) {}

  @Get("items")
  @UseGuards(JwtAuthGuard)
  async listItems(@GetUser() user: UserInfo): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }

    try {
      return ResponseDto.success(
        await this.exchangeService.listAvailableItems(user.uid),
        "获取兑换商店成功",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "获取兑换商店失败");
    }
  }

  @Post("items/:id/claim")
  @UseGuards(JwtAuthGuard)
  async claim(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: ClaimExchangeDto,
    @GetUser() user: UserInfo,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }

    try {
      return ResponseDto.success(
        await this.exchangeService.claim(user.uid, id, body.count),
        "兑换成功",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "兑换失败");
    }
  }
}
