import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { ArrayMaxSize, IsArray, IsString } from "class-validator";
import { GetUser } from "src/auth/get-user.decorator";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { ResponseDto } from "src/common/dto/response.dto";
import { HttpExceptionFilter } from "src/common/filters/http-exception.filter";
import { TransformInterceptor } from "src/common/interceptors/transform.interceptor";
import { ProfileService } from "./profile.service";

interface UserInfo {
  uid: string;
}

class SaveShowcaseDto {
  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  cardUuids: string[];
}

@Controller("profile")
@UseInterceptors(TransformInterceptor)
@UseFilters(HttpExceptionFilter)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async getMyProfile(@GetUser() user: UserInfo): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.profileService.getProfile(user.uid),
        "获取主页成功",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "获取主页失败");
    }
  }

  @Put("showcase")
  @UseGuards(JwtAuthGuard)
  async saveShowcase(
    @GetUser() user: UserInfo,
    @Body() body: SaveShowcaseDto,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.profileService.saveShowcase(user.uid, body.cardUuids),
        "展示已保存",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "保存展示失败");
    }
  }

  @Get(":id")
  async getPublicProfile(@Param("id") id: string): Promise<ResponseDto<any>> {
    try {
      return ResponseDto.success(
        await this.profileService.getPublicProfile(id),
        "获取主页成功",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "获取主页失败");
    }
  }
}
