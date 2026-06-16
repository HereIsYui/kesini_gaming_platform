import {
  Body,
  Controller,
  Delete,
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
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { GetUser } from "src/auth/get-user.decorator";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { ResponseDto } from "src/common/dto/response.dto";
import { HttpExceptionFilter } from "src/common/filters/http-exception.filter";
import { TransformInterceptor } from "src/common/interceptors/transform.interceptor";
import { TradeService } from "./trade.service";

class TradeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsString()
  rarity?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  poolId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  cardName?: string;
}

class CreateTradeListingDto {
  @IsString()
  cardUuid: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999999)
  price: number;
}

class CreateRandomTradeListingDto {
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
  @Max(999999)
  price: number;
}

interface UserInfo {
  uid: string;
}

@Controller("trade")
@UseGuards(JwtAuthGuard)
@UseInterceptors(TransformInterceptor)
@UseFilters(HttpExceptionFilter)
export class TradeController {
  constructor(private readonly tradeService: TradeService) {}

  @Get("listings")
  async listListings(
    @GetUser() user: UserInfo,
    @Query() query: TradeQueryDto,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.tradeService.listListings(user.uid, query),
        "获取交易市场成功",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "获取交易市场失败");
    }
  }

  @Post("listings")
  async createListing(
    @GetUser() user: UserInfo,
    @Body() body: CreateTradeListingDto,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.tradeService.createListing(user.uid, body.cardUuid, body.price),
        "挂售成功",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "挂售失败");
    }
  }

  @Post("listings/random")
  async createRandomListing(
    @GetUser() user: UserInfo,
    @Body() body: CreateRandomTradeListingDto,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.tradeService.createRandomListing(user.uid, body),
        "挂售成功",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "挂售失败");
    }
  }

  @Delete("listings/:id")
  async cancelListing(
    @GetUser() user: UserInfo,
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.tradeService.cancelListing(user.uid, id),
        "取消挂单成功",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "取消挂单失败");
    }
  }

  @Post("listings/:id/buy")
  async buyListing(
    @GetUser() user: UserInfo,
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.tradeService.buyListing(user.uid, id),
        "购买成功",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "购买失败");
    }
  }

  @Get("my-listings")
  async listMyListings(
    @GetUser() user: UserInfo,
    @Query() query: TradeQueryDto,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.tradeService.listMyListings(user.uid, query),
        "获取我的挂售成功",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "获取我的挂售失败");
    }
  }

  @Get("my-records")
  async listMyRecords(
    @GetUser() user: UserInfo,
    @Query() query: TradeQueryDto,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.tradeService.listMyRecords(user.uid, query),
        "获取交易记录成功",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "获取交易记录失败");
    }
  }
}
