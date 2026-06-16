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
import { IsArray, IsInt, IsOptional, IsString, Min } from "class-validator";
import { GetUser } from "src/auth/get-user.decorator";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { ResponseDto } from "src/common/dto/response.dto";
import { HttpExceptionFilter } from "src/common/filters/http-exception.filter";
import { TransformInterceptor } from "src/common/interceptors/transform.interceptor";
import { PveService } from "./pve.service";

interface UserInfo {
  uid: string;
}

class PvePageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;

  @IsOptional()
  @IsString()
  focus?: string;
}

class PveSweepDto {
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  stageIds?: number[];
}

@Controller("pve")
@UseGuards(JwtAuthGuard)
@UseInterceptors(TransformInterceptor)
@UseFilters(HttpExceptionFilter)
export class PveController {
  constructor(private readonly pveService: PveService) {}

  @Get("stages")
  async listStages(
    @GetUser() user: UserInfo,
    @Query() query: PvePageQueryDto,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.pveService.listStages(user.uid, query),
        "获取关卡列表成功",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "获取关卡列表失败");
    }
  }

  @Post("stages/:id/challenge")
  async challenge(
    @GetUser() user: UserInfo,
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.pveService.challenge(user.uid, id),
        "挑战结算成功",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "挑战失败");
    }
  }

  @Post("sweep")
  async sweep(
    @GetUser() user: UserInfo,
    @Body() body: PveSweepDto,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.pveService.sweep(user.uid, body),
        "扫荡完成",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "扫荡失败");
    }
  }

  @Post("auto-battle")
  async autoBattle(
    @GetUser() user: UserInfo,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.pveService.autoBattle(user.uid),
        "自动战斗完成",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "自动战斗失败");
    }
  }

  @Get("records")
  async listRecords(
    @GetUser() user: UserInfo,
    @Query() query: PvePageQueryDto,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.pveService.listRecords(user.uid, query),
        "获取挑战记录成功",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "获取挑战记录失败");
    }
  }
}
