import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * 响应数据转换拦截器
 * 用于统一处理响应数据格式
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, any> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(data => {
        // 如果响应数据已经是 ResponseDto 格式，直接返回
        if (data && typeof data === 'object' && 'code' in data && 'message' in data) {
          return data;
        }
        
        // 否则包装成统一格式
        return {
          code: 200,
          message: '操作成功',
          data: data,
        };
      }),
    );
  }
}
