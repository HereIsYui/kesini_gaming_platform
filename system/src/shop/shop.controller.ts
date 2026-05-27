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
import { IsInt, IsString, Min } from "class-validator";
import { GetUser } from "src/auth/get-user.decorator";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { ResponseDto } from "src/common/dto/response.dto";
import { HttpExceptionFilter } from "src/common/filters/http-exception.filter";
import { TransformInterceptor } from "src/common/interceptors/transform.interceptor";
import { ShopRecycleService } from "./shop-recycle.service";

class RecycleCardsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cardId: number;

  @IsString()
  rarity: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  poolId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  count: number;
}

interface UserInfo {
  uid: string;
}

@Controller("shop")
@UseGuards(JwtAuthGuard)
@UseInterceptors(TransformInterceptor)
@UseFilters(HttpExceptionFilter)
export class ShopController {
  constructor(private readonly shopRecycleService: ShopRecycleService) {}

  @Get("recycle/config")
  async getRecycleConfig(): Promise<ResponseDto<any>> {
    try {
      return ResponseDto.success(
        await this.shopRecycleService.getConfig(),
        "获取回收配置成功",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "获取回收配置失败");
    }
  }

  @Post("recycle/cards")
  async recycleCards(
    @GetUser() user: UserInfo,
    @Body() body: RecycleCardsDto,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.shopRecycleService.recycleCards(user.uid, body),
        "回收成功",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "回收失败");
    }
  }
}
