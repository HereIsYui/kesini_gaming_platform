import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Request, Response } from "express";

/**
 * HTTP异常过滤器
 * 用于统一处理HTTP异常并返回标准格式
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    const exceptionResponse = exception.getResponse();
    const message =
      typeof exceptionResponse === "string"
        ? exceptionResponse
        : (exceptionResponse as any).message || "请求失败";

    response.status(status).json({
      code: -1,
      msg: Array.isArray(message) ? message.join(", ") : message,
      data: null,
      timestamp: new Date().toISOString(),
      path: request.url,
      status,
    });
  }
}

/**
 * 全局异常过滤器
 * 捕获所有未处理的异常
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException ? exception.message : "服务器内部错误";

    response.status(status).json({
      code: -1,
      msg: message,
      data: null,
      timestamp: new Date().toISOString(),
      path: request.url,
      status,
    });
  }
}
