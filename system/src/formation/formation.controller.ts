import {
  Body,
  Controller,
  Get,
  Put,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { Type } from "class-transformer";
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { GetUser } from "src/auth/get-user.decorator";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { ResponseDto } from "src/common/dto/response.dto";
import { HttpExceptionFilter } from "src/common/filters/http-exception.filter";
import { TransformInterceptor } from "src/common/interceptors/transform.interceptor";
import { FormationService } from "./formation.service";

interface UserInfo {
  uid: string;
}

class FormationSlotDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  position: number;

  @IsOptional()
  @IsString()
  cardUuid?: string | null;
}

class SaveFormationDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormationSlotDto)
  slots: FormationSlotDto[];
}

@Controller("formation")
@UseGuards(JwtAuthGuard)
@UseInterceptors(TransformInterceptor)
@UseFilters(HttpExceptionFilter)
export class FormationController {
  constructor(private readonly formationService: FormationService) {}

  @Get()
  async getFormation(@GetUser() user: UserInfo): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.formationService.getFormation(user.uid),
        "获取阵容成功",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "获取阵容失败");
    }
  }

  @Put()
  async saveFormation(
    @GetUser() user: UserInfo,
    @Body() body: SaveFormationDto,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.formationService.saveFormation(user.uid, body.slots),
        "阵容已保存",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "保存阵容失败");
    }
  }
}
