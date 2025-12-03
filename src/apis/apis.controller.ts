import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseInterceptors,
  UseFilters,
} from "@nestjs/common";
import { ApisService } from "./apis.service";
import { ResponseDto } from "src/common/dto/response.dto";
import { TransformInterceptor } from "src/common/interceptors/transform.interceptor";
import { HttpExceptionFilter } from "src/common/filters/http-exception.filter";

@Controller("apis")
@UseInterceptors(TransformInterceptor)
@UseFilters(HttpExceptionFilter)
export class ApisController {
  constructor(private readonly apisService: ApisService) {}

  /**
   * 登录接口
   * POST /apis/login
   */
  @Post("/login")
  async login(@Body() body: any): Promise<ResponseDto<any>> {
    try {
      const result = await this.apisService.login(body);
      return ResponseDto.success(result.data, result.msg || "登录成功");
    } catch (error) {
      return ResponseDto.error(error.message || "登录失败");
    }
  }

  /**
   * 生成登录链接
   * GET /apis/login-url
   */
  @Get("/login-url")
  generateLoginUrl(
    @Query() params: { returnTo: string; realm: string }
  ): ResponseDto<any> {
    if (!params.returnTo || !params.realm) {
      return ResponseDto.error("缺少必要参数: returnTo 或 realm");
    }

    try {
      const result = this.apisService.generateLoginUrl(params);
      return ResponseDto.success(result.data, result.msg || "生成登录链接成功");
    } catch (error) {
      return ResponseDto.error(error.message || "生成登录链接失败");
    }
  }

  /**
   * 合成卡片
   * POST /apis/synthesize-card
   */
  @Post("/synthesize-card")
  async synthesizeCard(@Body() body: { user_id: number; card_id: number }): Promise<ResponseDto<any>> {
    try {
      const result = await this.apisService.synthesizeCard(body.user_id, body.card_id);
      return ResponseDto.success(result.data, result.msg || "合成成功");
    } catch (error) {
      return ResponseDto.error(error.message || "合成失败");
    }
  }

  /**
   * 分解卡片
   * POST /apis/decompose-card
   */
  @Post("/decompose-card")
  async decomposeCard(@Body() body: { user_id: number; card_id: number }): Promise<ResponseDto<any>> {
    try {
      const result = await this.apisService.decomposeCard(body.user_id, body.card_id);
      return ResponseDto.success(result.data, result.msg || "分解成功");
    } catch (error) {
      return ResponseDto.error(error.message || "分解失败");
    }
  }
}
