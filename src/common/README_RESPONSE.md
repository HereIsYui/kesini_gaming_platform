# 统一响应格式说明

## 概述

所有API接口都使用统一的响应格式，确保前后端交互的一致性和可预测性。

## 响应结构

```typescript
{
  code: number;    // 状态码
  msg: string;     // 状态描述
  data: any;       // 响应数据
}
```

## 状态码说明

| 状态码 | 含义 | 说明 |
|--------|------|------|
| `0` | 成功 | 请求处理成功 |
| `-1` | 失败 | 请求失败（缺少参数、业务错误等） |

## 使用方式

### 在Controller中使用

#### 方式1: 自动包装（推荐）

使用 `@UseInterceptors(TransformInterceptor)` 装饰器，直接返回数据即可自动包装：

```typescript
import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { TransformInterceptor } from 'src/common/interceptors/transform.interceptor';

@Controller('example')
@UseInterceptors(TransformInterceptor)
export class ExampleController {
  
  @Get('data')
  getData() {
    // 直接返回数据，会自动包装成 ResponseDto
    return { id: 1, name: 'test' };
  }
}

// 实际响应:
// {
//   "code": 0,
//   "msg": "操作成功",
//   "data": { "id": 1, "name": "test" }
// }
```

#### 方式2: 手动包装

使用 `ResponseDto` 类手动控制响应：

```typescript
import { Controller, Get } from '@nestjs/common';
import { ResponseDto } from 'src/common/dto/response.dto';

@Controller('example')
export class ExampleController {
  
  @Get('data')
  getData(): ResponseDto {
    return ResponseDto.success({ id: 1, name: 'test' }, '获取数据成功');
  }
  
  @Get('error')
  getError(): ResponseDto {
    return ResponseDto.error('参数错误');
  }
}
```

### ResponseDto API

#### 成功响应

```typescript
ResponseDto.success<T>(data: T, msg?: string): ResponseDto<T>
```

**参数:**
- `data`: 响应数据
- `msg`: 成功消息（可选，默认："操作成功"）

**示例:**
```typescript
// 默认消息
ResponseDto.success({ id: 1 });
// { code: 0, msg: "操作成功", data: { id: 1 } }

// 自定义消息
ResponseDto.success({ id: 1 }, '创建成功');
// { code: 0, msg: "创建成功", data: { id: 1 } }

// 返回null
ResponseDto.success(null, '删除成功');
// { code: 0, msg: "删除成功", data: null }
```

#### 失败响应

```typescript
ResponseDto.error<T>(msg?: string, data?: T): ResponseDto<T>
```

**参数:**
- `msg`: 错误消息（可选，默认："操作失败"）
- `data`: 错误详情数据（可选，默认：null）

**示例:**
```typescript
// 默认消息
ResponseDto.error();
// { code: -1, msg: "操作失败", data: null }

// 自定义消息
ResponseDto.error('用户名已存在');
// { code: -1, msg: "用户名已存在", data: null }

// 带错误详情
ResponseDto.error('验证失败', { field: 'email', error: '格式错误' });
// { code: -1, msg: "验证失败", data: { field: 'email', error: '格式错误' } }
```

### 异常处理

使用 `@UseFilters(HttpExceptionFilter)` 自动捕获异常并转换为统一格式：

```typescript
import { Controller, Get, UseFilters } from '@nestjs/common';
import { HttpExceptionFilter } from 'src/common/filters/http-exception.filter';

@Controller('example')
@UseFilters(HttpExceptionFilter)
export class ExampleController {
  
  @Get('error')
  throwError() {
    throw new Error('Something went wrong');
    // 自动转换为:
    // {
    //   "code": -1,
    //   "msg": "Something went wrong",
    //   "data": null
    // }
  }
}
```

## 完整示例

### Controller完整示例

```typescript
import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param,
  UseInterceptors,
  UseFilters 
} from '@nestjs/common';
import { ResponseDto } from 'src/common/dto/response.dto';
import { TransformInterceptor } from 'src/common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from 'src/common/filters/http-exception.filter';

@Controller('user')
@UseInterceptors(TransformInterceptor)
@UseFilters(HttpExceptionFilter)
export class UserController {
  
  // 示例1: 自动包装（推荐用于简单场景）
  @Get('list')
  async getUsers() {
    const users = [{ id: 1, name: 'Alice' }];
    return users;  // 自动包装成功响应
  }
  
  // 示例2: 手动包装（推荐用于需要自定义消息的场景）
  @Post('create')
  async createUser(@Body() dto: any): Promise<ResponseDto> {
    if (!dto.name) {
      return ResponseDto.error('缺少必要参数: name');
    }
    
    try {
      const user = { id: 1, name: dto.name };
      return ResponseDto.success(user, '用户创建成功');
    } catch (error) {
      return ResponseDto.error(error.message || '创建失败');
    }
  }
  
  // 示例3: 带参数验证
  @Get(':id')
  async getUserById(@Param('id') id: string): Promise<ResponseDto> {
    if (!id) {
      return ResponseDto.error('缺少必要参数: id');
    }
    
    const user = { id, name: 'Bob' };
    if (!user) {
      return ResponseDto.error('用户不存在');
    }
    
    return ResponseDto.success(user, '获取用户成功');
  }
}
```

## 前端使用示例

### TypeScript/JavaScript

```typescript
// 定义响应类型
interface ApiResponse<T = any> {
  code: number;
  msg: string;
  data: T;
}

// 封装请求方法
async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const result: ApiResponse<T> = await response.json();
  
  if (result.code === 0) {
    return result.data;
  } else {
    throw new Error(result.msg);
  }
}

// 使用示例
try {
  const users = await apiRequest<User[]>('/api/user/list');
  console.log('用户列表:', users);
} catch (error) {
  console.error('请求失败:', error.message);
}
```

### Axios示例

```typescript
import axios from 'axios';

// 创建axios实例
const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    const { code, msg, data } = response.data;
    
    if (code === 0) {
      return data;  // 成功时返回data
    } else {
      return Promise.reject(new Error(msg));
    }
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 使用示例
api.get('/user/list')
  .then(users => {
    console.log('用户列表:', users);
  })
  .catch(error => {
    console.error('请求失败:', error.message);
  });
```

## 最佳实践

### 1. Controller层统一使用装饰器

```typescript
@Controller('example')
@UseInterceptors(TransformInterceptor)
@UseFilters(HttpExceptionFilter)
export class ExampleController {
  // ...
}
```

### 2. 参数验证

```typescript
@Post('create')
async create(@Body() dto: CreateDto): Promise<ResponseDto> {
  // 验证必填参数
  if (!dto.name) {
    return ResponseDto.error('缺少必要参数: name');
  }
  
  // 验证参数格式
  if (dto.age < 0) {
    return ResponseDto.error('参数错误: age必须大于0');
  }
  
  // ...
}
```

### 3. 异常处理

```typescript
@Get('data')
async getData(): Promise<ResponseDto> {
  try {
    const data = await this.service.getData();
    return ResponseDto.success(data, '获取数据成功');
  } catch (error) {
    return ResponseDto.error(error.message || '获取数据失败');
  }
}
```

### 4. 自定义消息

```typescript
// 成功消息应该明确描述操作结果
ResponseDto.success(data, '用户创建成功');
ResponseDto.success(data, '数据更新成功');
ResponseDto.success(null, '删除成功');

// 错误消息应该清晰说明错误原因
ResponseDto.error('用户名已存在');
ResponseDto.error('缺少必要参数: email');
ResponseDto.error('权限不足');
```

## 注意事项

1. **code字段**: 只使用 `0` 和 `-1` 两个值，保持简单
2. **msg字段**: 应该是人类可读的描述，方便前端直接展示给用户
3. **data字段**: 可以是任何类型（对象、数组、null等）
4. **一致性**: 所有接口都应该使用相同的响应格式
5. **异常处理**: 使用HttpExceptionFilter自动捕获异常，无需在每个方法中手动try-catch

## 扩展

如果需要更多状态码，可以扩展ResponseDto：

```typescript
export class ResponseDto<T = any> {
  code: number;
  msg: string;
  data: T;

  // 自定义状态码常量
  static readonly CODE_SUCCESS = 0;
  static readonly CODE_ERROR = -1;
  static readonly CODE_UNAUTHORIZED = -2;  // 未授权
  static readonly CODE_FORBIDDEN = -3;     // 禁止访问
  
  // 添加新的静态方法
  static unauthorized(msg: string = '未授权'): ResponseDto {
    return new ResponseDto(-2, msg, null);
  }
  
  static forbidden(msg: string = '禁止访问'): ResponseDto {
    return new ResponseDto(-3, msg, null);
  }
}
```
