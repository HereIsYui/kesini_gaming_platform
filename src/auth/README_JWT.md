# JWT 认证系统使用指南

## 概述

本项目已经实现了基于JWT的身份认证系统，替代了之前依赖请求参数uid的不安全方式。

## 认证流程

### 1. 登录获取Token

用户通过OpenID登录后，接口会返回用户信息和JWT token：

```json
// POST /apis/login
// 响应示例
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "user": {
      "uid": "123456",
      "name": "username",
      "nickname": "nickname",
      "avatar": "avatar_url",
      "point": 0
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiIxMjM0NTYiLCJpYXQiOjE2MzQ1Njc4OTJ9.xxxxx"
  }
}
```

### 2. 使用Token访问需要认证的接口

在所有Card模块的接口中，现在都需要在请求头中包含JWT token：

```http
Authorization: Bearer {token}
```

## 接口变更

### 已更新为JWT认证的接口

所有之前需要uid参数的接口都已更新为从JWT token中获取用户信息：

| 原接口 | 新接口 | 说明 |
|--------|--------|------|
| POST `/card/draw/once` (需要uid) | POST `/card/draw/once` (需要Authorization) | 单抽 |
| POST `/card/draw/ten` (需要uid) | POST `/card/draw/ten` (需要Authorization) | 十连抽 |
| POST `/card/draw/multiple` (需要uid) | POST `/card/draw/multiple` (需要Authorization) | 多连抽 |
| GET `/card/stats/:uid` | GET `/card/stats` (需要Authorization) | 获取用户统计 |
| POST `/card/reset/:uid` | POST `/card/reset` (需要Authorization) | 重置用户历史 |
| GET `/card/user/:uid/cards` | GET `/card/user/cards` (需要Authorization) | 获取用户卡片 |
| POST `/card/synthesize` (需要uid) | POST `/card/synthesize` (需要Authorization) | 合成卡片 |
| POST `/card/decompose` (需要uid) | POST `/card/decompose` (需要Authorization) | 分解卡片 |

### 请求体变更

移除了请求体中的uid字段：

**之前：**
```json
{
  "uid": "123456",
  "poolId": 1,
  "config": { ... }
}
```

**现在：**
```json
{
  "poolId": 1,
  "config": { ... }
}
```

## 安全性提升

1. **Token有效期**: JWT token默认7天过期
2. **Bearer Token认证**: 使用标准的HTTP Authorization header
3. **自动验证**: NestJS的Passport中间件自动验证token有效性
4. **用户身份验证**: 所有操作都基于已验证的用户身份

## 错误处理

如果token无效或过期，会返回以下错误：

```json
{
  "code": 401,
  "message": "Unauthorized"
}
```

## 示例代码

### JavaScript/TypeScript客户端示例

```typescript
// 登录获取token
const loginResponse = await fetch('/apis/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(loginData)
});
const { data: { token } } = await loginResponse.json();

// 使用token访问card接口
const drawResponse = await fetch('/card/draw/once', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    poolId: 1
  })
});
```

### cURL示例

```bash
# 登录获取token
curl -X POST http://localhost:3000/apis/login \
  -H "Content-Type: application/json" \
  -d '{"openid.ns":"...", ...}'

# 使用token抽卡
curl -X POST http://localhost:3000/card/draw/once \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"poolId":1}'
```

## 注意事项

1. **Token存储**: 客户端应安全存储JWT token
2. **Token刷新**: Token过期后需要重新登录
3. **环境配置**: 生产环境应使用环境变量设置JWT_SECRET