# APIs 模块接口文档

## 概述
登录认证相关接口，使用 OpenID 协议进行第三方登录。

所有接口已统一使用 `ResponseDto<T>` 格式返回。

---

## 统一响应格式

```typescript
{
  code: number;    // 0: 成功, -1: 失败
  msg: string;     // 提示消息
  data: T | null;  // 响应数据
}
```

---

## 接口列表

### 1. 生成登录链接

**接口：** `GET /apis/login-url`

**请求参数（Query）：**
```typescript
{
  returnTo: string;  // 登录成功后的回调地址
  realm: string;     // 信任域（必须是 returnTo 的前缀）
}
```

**请求示例：**
```bash
curl "http://localhost:3000/apis/login-url?returnTo=http://localhost:3000/callback&realm=http://localhost:3000"
```

**成功响应：**
```json
{
  "code": 0,
  "msg": "生成登录链接成功",
  "data": {
    "url": "https://fishpi.cn/openid/login?openid.ns=http://specs.openid.net/auth/2.0&..."
  }
}
```

**失败响应（缺少参数）：**
```json
{
  "code": -1,
  "msg": "缺少必要参数: returnTo 或 realm",
  "data": null
}
```

**失败响应（realm 验证失败）：**
```json
{
  "code": -1,
  "msg": "realm 必须是 return_to 的前缀",
  "data": null
}
```

---

### 2. 处理登录回调

**接口：** `POST /apis/login`

**请求参数（Body）：**
```typescript
{
  "openid.ns": string;
  "openid.mode": string;
  "openid.op_endpoint": string;
  "openid.identity": string;
  "openid.claimed_id": string;
  "openid.return_to": string;
  "openid.response_nonce": string;
  "openid.assoc_handle": string;
  "openid.signed": string;
  "openid.sig": string;
}
```

**请求示例：**
```bash
curl -X POST http://localhost:3000/apis/login \
  -H "Content-Type: application/json" \
  -d '{
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "id_res",
    "openid.op_endpoint": "https://fishpi.cn",
    "openid.identity": "https://fishpi.cn/openid/id/123456",
    "openid.claimed_id": "https://fishpi.cn/openid/id/123456",
    "openid.return_to": "http://localhost:3000/callback",
    "openid.response_nonce": "2024-01-01T12:00:00Zabc123",
    "openid.assoc_handle": "handle123",
    "openid.signed": "...",
    "openid.sig": "..."
  }'
```

**成功响应：**
```json
{
  "code": 0,
  "msg": "登录成功",
  "data": {
    "userId": "123456",
    "userName": "testuser",
    "userNickname": "测试用户",
    "userAvatarURL": "https://example.com/avatar.jpg"
  }
}
```

**失败响应（缺少字段）：**
```json
{
  "code": -1,
  "msg": "缺少必要字段: openid.ns",
  "data": null
}
```

**失败响应（签名验证失败）：**
```json
{
  "code": -1,
  "msg": "签名验证失败",
  "data": null
}
```

**失败响应（nonce 过期）：**
```json
{
  "code": -1,
  "msg": "nonce 已过期",
  "data": null
}
```

---

## 登录流程

```
1. 前端请求登录链接
   GET /apis/login-url?returnTo=xxx&realm=xxx
   ↓
2. 获取第三方登录 URL
   返回: { code: 0, data: { url: "..." } }
   ↓
3. 前端跳转到第三方登录页面
   window.location.href = data.url
   ↓
4. 用户在第三方平台完成登录
   ↓
5. 第三方平台回调到 returnTo
   携带 OpenID 参数
   ↓
6. 前端发送回调数据到后端验证
   POST /apis/login
   ↓
7. 后端验证签名并获取用户信息
   返回: { code: 0, data: { userId, userName, ... } }
   ↓
8. 登录成功，保存用户信息
```

---

## 错误处理

所有接口都会返回统一格式：
- **成功**：`code: 0`，`data` 包含实际数据
- **失败**：`code: -1`，`msg` 包含错误描述，`data: null`

常见错误：
- 缺少必要参数
- realm 验证失败
- 签名验证失败
- nonce 过期
- 网络请求失败

---

## 安全注意事项

1. **Realm 验证**：realm 必须是 return_to 的前缀，防止开放重定向攻击
2. **Nonce 验证**：5分钟有效期，防止重放攻击
3. **签名验证**：通过第三方 OP 验证签名的真实性
4. **HTTPS**：生产环境必须使用 HTTPS

---

## 前端集成示例

```typescript
// 1. 获取登录链接
async function getLoginUrl() {
  const response = await fetch(
    '/apis/login-url?returnTo=http://localhost:3000/callback&realm=http://localhost:3000'
  );
  const result = await response.json();
  
  if (result.code === 0) {
    // 跳转到登录页面
    window.location.href = result.data.url;
  } else {
    console.error(result.msg);
  }
}

// 2. 处理回调（在 callback 页面）
async function handleCallback() {
  // 从 URL 获取 OpenID 参数
  const params = new URLSearchParams(window.location.search);
  const callbackData = {};
  params.forEach((value, key) => {
    callbackData[key] = value;
  });
  
  // 发送到后端验证
  const response = await fetch('/apis/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(callbackData)
  });
  
  const result = await response.json();
  
  if (result.code === 0) {
    // 登录成功
    console.log('用户信息:', result.data);
    localStorage.setItem('userId', result.data.userId);
    localStorage.setItem('userName', result.data.userName);
    // 跳转到主页
    window.location.href = '/';
  } else {
    console.error('登录失败:', result.msg);
  }
}
```

---

## 测试建议

使用 Postman/Apifox 测试时：
1. 先调用 `/apis/login-url` 获取登录链接
2. 在浏览器中打开该链接完成登录
3. 从回调 URL 中复制所有 `openid.*` 参数
4. 使用这些参数调用 `/apis/login` 接口

完整的登录测试需要真实的第三方 OpenID 服务支持。
