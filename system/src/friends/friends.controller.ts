import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { IsString } from "class-validator";
import { GetUser } from "src/auth/get-user.decorator";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { ResponseDto } from "src/common/dto/response.dto";
import { HttpExceptionFilter } from "src/common/filters/http-exception.filter";
import { TransformInterceptor } from "src/common/interceptors/transform.interceptor";
import { FriendsService } from "./friends.service";

interface UserInfo {
  uid: string;
}

class SendFriendRequestDto {
  @IsString()
  uid: string;
}

@Controller("friends")
@UseGuards(JwtAuthGuard)
@UseInterceptors(TransformInterceptor)
@UseFilters(HttpExceptionFilter)
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Get()
  async getFriends(@GetUser() user: UserInfo): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.friendsService.getOverview(user.uid),
        "获取好友成功",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "获取好友失败");
    }
  }

  @Post("requests")
  async sendRequest(
    @GetUser() user: UserInfo,
    @Body() body: SendFriendRequestDto,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.friendsService.sendRequest(user.uid, body.uid),
        "申请已发送",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "申请失败");
    }
  }

  @Post("requests/:id/accept")
  async acceptRequest(
    @GetUser() user: UserInfo,
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.friendsService.acceptRequest(user.uid, id),
        "已通过",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "处理失败");
    }
  }

  @Post("requests/:id/reject")
  async rejectRequest(
    @GetUser() user: UserInfo,
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.friendsService.rejectRequest(user.uid, id),
        "已拒绝",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "处理失败");
    }
  }

  @Delete("requests/:id")
  async cancelRequest(
    @GetUser() user: UserInfo,
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.friendsService.cancelRequest(user.uid, id),
        "已取消",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "取消失败");
    }
  }

  @Delete(":uid")
  async removeFriend(
    @GetUser() user: UserInfo,
    @Param("uid") uid: string,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.friendsService.removeFriend(user.uid, uid),
        "已删除",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "删除失败");
    }
  }
}
