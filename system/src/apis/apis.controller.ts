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
   * 公开站点配置
   * GET /apis/site-config
   */
  @Get("/site-config")
  async getSiteConfig(): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.apisService.getPublicSiteConfig(),
      "获取站点配置成功",
    );
  }

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


}
