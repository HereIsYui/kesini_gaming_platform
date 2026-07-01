import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { IsOptional, IsString } from "class-validator";
import { Type } from "class-transformer";
import { IsIn, IsInt } from "class-validator";
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

class UpdateGuildAnnouncementDto {
  @IsOptional()
  @IsString()
  announcement?: string;
}

class DonateGuildDto {
  @Type(() => Number)
  @IsInt()
  amount: number;
}

class UpdateGuildSettingsDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  announcement?: string;

  @IsOptional()
  @IsIn(["open", "approval"])
  joinMode?: "open" | "approval";
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

  @Get("leaderboard")
  async getLeaderboard(
    @GetUser() user: UserInfo,
    @Query("limit") limit?: string,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.guildsService.getPowerLeaderboard(user.uid, Number(limit)),
        "获取排行成功",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "获取排行失败");
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

  @Patch("me/announcement")
  async updateAnnouncement(
    @GetUser() user: UserInfo,
    @Body() body: UpdateGuildAnnouncementDto,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.guildsService.updateAnnouncement(
          user.uid,
          body.announcement,
        ),
        "已保存",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "保存失败");
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

  @Delete("requests/:id")
  async cancelJoinRequest(
    @GetUser() user: UserInfo,
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.guildsService.cancelJoinRequest(user.uid, id),
        "已取消",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "取消失败");
    }
  }

  @Post("requests/:id/approve")
  async approveJoinRequest(
    @GetUser() user: UserInfo,
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.guildsService.approveJoinRequest(user.uid, id),
        "已批准",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "批准失败");
    }
  }

  @Post("requests/:id/reject")
  async rejectJoinRequest(
    @GetUser() user: UserInfo,
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.guildsService.rejectJoinRequest(user.uid, id),
        "已拒绝",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "拒绝失败");
    }
  }

  @Post("me/check-in")
  async checkIn(@GetUser() user: UserInfo): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.guildsService.checkIn(user.uid),
        "已签到",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "签到失败");
    }
  }

  @Post("me/donate")
  async donate(
    @GetUser() user: UserInfo,
    @Body() body: DonateGuildDto,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.guildsService.donate(user.uid, body.amount),
        "已捐献",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "捐献失败");
    }
  }

  @Patch("me/settings")
  async updateSettings(
    @GetUser() user: UserInfo,
    @Body() body: UpdateGuildSettingsDto,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.guildsService.updateSettings(user.uid, body),
        "已保存",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "保存失败");
    }
  }

  @Post("members/:uid/promote")
  async promoteMember(
    @GetUser() user: UserInfo,
    @Param("uid") targetUid: string,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.guildsService.promoteMember(user.uid, targetUid),
        "已任命",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "任命失败");
    }
  }

  @Post("members/:uid/demote")
  async demoteMember(
    @GetUser() user: UserInfo,
    @Param("uid") targetUid: string,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.guildsService.demoteMember(user.uid, targetUid),
        "已降职",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "降职失败");
    }
  }

  @Post("members/:uid/kick")
  async kickMember(
    @GetUser() user: UserInfo,
    @Param("uid") targetUid: string,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.guildsService.kickMember(user.uid, targetUid),
        "已移出",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "移出失败");
    }
  }

  @Post("members/:uid/transfer")
  async transferLeader(
    @GetUser() user: UserInfo,
    @Param("uid") targetUid: string,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.guildsService.transferLeader(user.uid, targetUid),
        "已转让",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "转让失败");
    }
  }

  @Post("me/boss/challenge")
  async challengeBoss(@GetUser() user: UserInfo): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.guildsService.challengeBoss(user.uid),
        "挑战完成",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "挑战失败");
    }
  }

  @Post("me/boss/claim")
  async claimBossReward(
    @GetUser() user: UserInfo,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.guildsService.claimBossReward(user.uid),
        "已领取",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "领取失败");
    }
  }

  @Post("me/chests/:threshold/claim")
  async claimActivityChest(
    @GetUser() user: UserInfo,
    @Param("threshold", ParseIntPipe) threshold: number,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.guildsService.claimActivityChest(user.uid, threshold),
        "已领取",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "领取失败");
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
