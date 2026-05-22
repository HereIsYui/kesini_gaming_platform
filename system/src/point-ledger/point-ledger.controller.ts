import {
  Controller,
  Get,
  Query,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { GetUser } from "src/auth/get-user.decorator";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { ResponseDto } from "src/common/dto/response.dto";
import { HttpExceptionFilter } from "src/common/filters/http-exception.filter";
import { TransformInterceptor } from "src/common/interceptors/transform.interceptor";
import { PointLedgerService } from "./point-ledger.service";

class PointLedgerQueryDto {
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
  type?: string;

  @IsOptional()
  @IsString()
  sourceType?: string;
}

interface UserInfo {
  uid: string;
}

@Controller("points")
@UseGuards(JwtAuthGuard)
@UseInterceptors(TransformInterceptor)
@UseFilters(HttpExceptionFilter)
export class PointLedgerController {
  constructor(private readonly pointLedgerService: PointLedgerService) {}

  @Get("records")
  async listRecords(
    @GetUser() user: UserInfo,
    @Query() query: PointLedgerQueryDto,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }

    try {
      return ResponseDto.success(
        await this.pointLedgerService.listUserRecords(user.uid, query),
        "获取星穹币流水成功",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "获取星穹币流水失败");
    }
  }
}
