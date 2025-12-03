import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ResponseDto } from '../dto/response.dto';

/**
 * 统一响应格式拦截器
 * 自动将Controller返回的数据包装成标准格式
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ResponseDto<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ResponseDto<T>> {
    return next.handle().pipe(
      map((data) => {
        // 如果已经是ResponseDto格式，直接返回
        if (data instanceof ResponseDto) {
          return data;
        }
        
        // 否则包装成成功响应
        return ResponseDto.success(data);
      }),
    );
  }
}
