import {
  Controller,
  Get,
  Param,
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
import { CompensationService } from "./compensation.service";

interface UserInfo {
  uid: string;
}

@Controller("compensations")
@UseGuards(JwtAuthGuard)
@UseInterceptors(TransformInterceptor)
@UseFilters(HttpExceptionFilter)
export class CompensationController {
  constructor(private readonly compensationService: CompensationService) {}

  @Get("me")
  async getMine(@GetUser() user: UserInfo): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.compensationService.getMine(user.uid),
      "获取补偿成功",
    );
  }

  @Post(":batchKey/claim")
  async claim(
    @GetUser() user: UserInfo,
    @Param("batchKey") batchKey: string,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.compensationService.claim(user.uid, batchKey),
      "已领取",
    );
  }
}
