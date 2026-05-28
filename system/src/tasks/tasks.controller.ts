import {
  Body,
  Controller,
  Get,
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
import type { TaskScope } from "src/entity/userTaskClaim.entity";
import { TasksService } from "./tasks.service";

interface UserInfo {
  uid: string;
}

interface TaskClaimBody {
  taskId: string;
  periodKey: string;
}

interface ActivityClaimBody {
  scope: TaskScope;
  periodKey: string;
  milestone: number;
}

@Controller("tasks")
@UseGuards(JwtAuthGuard)
@UseInterceptors(TransformInterceptor)
@UseFilters(HttpExceptionFilter)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get("overview")
  async overview(@GetUser() user: UserInfo): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    return ResponseDto.success(await this.tasksService.getOverview(user.uid));
  }

  @Post("claim")
  async claimTask(
    @GetUser() user: UserInfo,
    @Body() body: TaskClaimBody,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.tasksService.claimTask(user.uid, body),
      );
    } catch (error) {
      return ResponseDto.error(error.message || "领取任务奖励失败");
    }
  }

  @Post("activity/claim")
  async claimActivity(
    @GetUser() user: UserInfo,
    @Body() body: ActivityClaimBody,
  ): Promise<ResponseDto<any>> {
    if (!user?.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      return ResponseDto.success(
        await this.tasksService.claimActivity(user.uid, body),
      );
    } catch (error) {
      return ResponseDto.error(error.message || "领取活跃度奖励失败");
    }
  }
}
