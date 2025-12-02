import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from "@nestjs/common";
import { ApisService } from "./apis.service";
@Controller("apis")
export class ApisController {
  constructor(private readonly apisService: ApisService) {}
  @Post("/login")
  login(@Body() body: any) {
    return this.apisService.login(body);
  }

  @Get("/login-url")
  generateLoginUrl(@Query() params: { returnTo: string; realm: string }) {
    console.log(params);
    if (!params.returnTo || !params.realm) {
      return {
        code: -1,
        msg: "缺少必要参数",
      };
    }
    return this.apisService.generateLoginUrl(params);
  }
}
