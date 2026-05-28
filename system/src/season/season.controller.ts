import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Min } from "class-validator";
import { GetUser } from "src/auth/get-user.decorator";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { ResponseDto } from "src/common/dto/response.dto";
import { HttpExceptionFilter } from "src/common/filters/http-exception.filter";
import { TransformInterceptor } from "src/common/interceptors/transform.interceptor";
import { SeasonService } from "./season.service";

interface UserInfo {
  uid: string;
}

class SeasonLeaderboardQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

class SeasonShopBuyDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  count?: number;
}

@Controller("season")
@UseGuards(JwtAuthGuard)
@UseInterceptors(TransformInterceptor)
@UseFilters(HttpExceptionFilter)
export class SeasonController {
  constructor(private readonly seasonService: SeasonService) {}

  @Get("overview")
  async overview(@GetUser() user: UserInfo): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.seasonService.getOverview(user.uid),
        "获取赛季信息成功",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "获取赛季信息失败");
    }
  }

  @Get("leaderboard")
  async leaderboard(
    @GetUser() user: UserInfo,
    @Query() query: SeasonLeaderboardQueryDto,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.seasonService.getLeaderboard(user.uid, query.limit),
        "获取赛季排行成功",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "获取赛季排行失败");
    }
  }

  @Post("shop/items/:id/buy")
  async buyShopItem(
    @GetUser() user: UserInfo,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: SeasonShopBuyDto,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.seasonService.buyShopItem(user.uid, id, body.count),
        "赛季商店兑换成功",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "赛季商店兑换失败");
    }
  }
}
