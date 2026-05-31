import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { GetUser } from "src/auth/get-user.decorator";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { ResponseDto } from "src/common/dto/response.dto";
import { HttpExceptionFilter } from "src/common/filters/http-exception.filter";
import { TransformInterceptor } from "src/common/interceptors/transform.interceptor";
import { PlayerMessageService } from "./player-message.service";

interface UserInfo {
  uid: string;
}

@Controller("messages")
@UseGuards(JwtAuthGuard)
@UseInterceptors(TransformInterceptor)
@UseFilters(HttpExceptionFilter)
export class PlayerMessageController {
  constructor(private readonly playerMessageService: PlayerMessageService) {}

  @Get()
  async listMine(@GetUser() user: UserInfo): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.playerMessageService.listMine(user.uid),
      "获取消息成功",
    );
  }

  @Post(":id/read")
  async markRead(
    @GetUser() user: UserInfo,
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.playerMessageService.markRead(user.uid, id),
      "已读",
    );
  }

  @Post(":id/claim")
  async claimReward(
    @GetUser() user: UserInfo,
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.playerMessageService.claimReward(user.uid, id),
      "已领取",
    );
  }
}
