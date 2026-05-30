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
import { IsOptional, IsString } from "class-validator";
import { GetUser } from "src/auth/get-user.decorator";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { ResponseDto } from "src/common/dto/response.dto";
import { HttpExceptionFilter } from "src/common/filters/http-exception.filter";
import { TransformInterceptor } from "src/common/interceptors/transform.interceptor";
import { GuildsService } from "./guilds.service";

interface UserInfo {
  uid: string;
}

class CreateGuildDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}

class SendGuildMessageDto {
  @IsString()
  content: string;
}

@Controller("guilds")
@UseGuards(JwtAuthGuard)
@UseInterceptors(TransformInterceptor)
@UseFilters(HttpExceptionFilter)
export class GuildsController {
  constructor(private readonly guildsService: GuildsService) {}

  @Get()
  async listGuilds(@GetUser() user: UserInfo): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.guildsService.listGuilds(user.uid),
        "获取公会成功",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "获取公会失败");
    }
  }

  @Get("me")
  async getMyGuild(@GetUser() user: UserInfo): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.guildsService.getOverview(user.uid),
        "获取公会成功",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "获取公会失败");
    }
  }

  @Get("me/messages")
  async getMessages(
    @GetUser() user: UserInfo,
    @Query("limit") limit?: string,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.guildsService.listMessages(user.uid, Number(limit)),
        "获取消息成功",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "获取消息失败");
    }
  }

  @Post()
  async createGuild(
    @GetUser() user: UserInfo,
    @Body() body: CreateGuildDto,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.guildsService.createGuild(
          user.uid,
          body.name,
          body.description,
        ),
        "已创建",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "创建失败");
    }
  }

  @Post("me/messages")
  async sendMessage(
    @GetUser() user: UserInfo,
    @Body() body: SendGuildMessageDto,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.guildsService.sendMessage(user.uid, body.content),
        "已发送",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "发送失败");
    }
  }

  @Post(":id/join")
  async joinGuild(
    @GetUser() user: UserInfo,
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.guildsService.joinGuild(user.uid, id),
        "已加入",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "加入失败");
    }
  }

  @Delete("me")
  async leaveGuild(@GetUser() user: UserInfo): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.guildsService.leaveGuild(user.uid),
        "已退出",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "退出失败");
    }
  }
}
