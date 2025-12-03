# 抽卡系统更新日志

## v2.1.0 - 2025-12-03

### 🎉 新增功能 - 统一响应格式

#### 响应格式标准化

所有接口现在返回统一的响应格式：

```json
{
  "code": 0,      // 0-成功, -1-失败
  "msg": "消息",   // 状态描述
  "data": {}      // 响应数据
}
```

#### 新增文件

1. **通用响应DTO**
   - `src/common/dto/response.dto.ts` - 统一响应格式类
   - 提供 `success()` 和 `error()` 静态方法

2. **响应转换拦截器**
   - `src/common/interceptors/transform.interceptor.ts`
   - 自动将Controller返回的数据包装成标准格式

3. **异常过滤器**
   - `src/common/filters/http-exception.filter.ts`
   - 统一处理异常响应格式

4. **响应格式文档**
   - `src/common/README_RESPONSE.md` - 详细的使用说明

#### Controller更新

- ✅ 所有接口添加参数验证
- ✅ 所有接口使用统一响应格式
- ✅ 添加 `@UseInterceptors(TransformInterceptor)` 装饰器
- ✅ 添加 `@UseFilters(HttpExceptionFilter)` 装饰器
- ✅ 错误信息更明确和友好

#### 接口变更

**单抽 (POST /card/draw/once)**
- 新增参数验证：uid必填
- 返回格式：`{ code, msg, data }`
- 成功消息："抽卡成功"

**十连抽 (POST /card/draw/ten)**
- 新增参数验证：uid必填
- 返回格式：`{ code, msg, data }`
- 成功消息："十连抽成功"

**多次抽卡 (POST /card/draw/multiple)**
- 新增参数验证：uid必填，count必填且>0
- 返回格式：`{ code, msg, data }`
- 成功消息："{count}连抽成功"

**获取统计 (GET /card/stats/:uid)**
- 新增参数验证：uid必填
- 返回格式：`{ code, msg, data }`
- 成功消息："获取统计成功"

**重置历史 (POST /card/reset/:uid)**
- 新增参数验证：uid必填
- 返回格式：`{ code, msg, data }`
- 成功消息："抽卡历史已重置"

**获取卡池列表 (GET /card/pools)**
- 返回格式：`{ code, msg, data }`
- 成功消息："获取卡池列表成功"

**获取卡池信息 (GET /card/pool/:poolId)**
- 新增参数验证：poolId必填
- 新增业务验证：卡池存在性检查
- 返回格式：`{ code, msg, data }`
- 成功消息："获取卡池信息成功"

**获取卡池类型列表 (GET /card/pools/type/:type)**
- 新增参数验证：type必填
- 返回格式：`{ code, msg, data }`
- 成功消息："获取卡池列表成功"

**获取卡池卡片 (GET /card/pool/:poolId/cards)**
- 新增参数验证：poolId必填
- 返回格式：`{ code, msg, data }`
- 成功消息："获取卡片列表成功"

#### 文档更新

- ✅ 更新 `README_GACHA.md` - 添加响应格式说明和所有示例
- ✅ 更新 `TEST_INSTRUCTIONS.md` - 更新预期响应格式
- ✅ 新增 `src/common/README_RESPONSE.md` - 响应格式完整文档

#### 响应示例对比

**成功响应:**
```json
// v2.1.0 新格式
{
  "code": 0,
  "msg": "抽卡成功",
  "data": {
    "cardId": 1,
    "cardName": "普通战士"
  }
}

// v2.0.0 旧格式
{
  "cardId": 1,
  "cardName": "普通战士"
}
```

**错误响应:**
```json
// v2.1.0 新格式
{
  "code": -1,
  "msg": "缺少必要参数: uid",
  "data": null
}

// v2.0.0 旧格式
直接抛出异常，无统一格式
```

#### 向后兼容性

⚠️ **破坏性变更**

所有接口的响应格式已更改，前端需要适配新格式。

**迁移指南:**

```javascript
// 旧代码
const result = await fetch('/card/draw/once', {
  method: 'POST',
  body: JSON.stringify({ uid: 'user123' })
});
const card = await result.json();
console.log(card.cardName);  // 直接访问

// 新代码
const result = await fetch('/card/draw/once', {
  method: 'POST',
  body: JSON.stringify({ uid: 'user123' })
});
const response = await result.json();

if (response.code === 0) {
  console.log(response.data.cardName);  // 通过data访问
} else {
  console.error(response.msg);  // 显示错误消息
}
```

#### 优势

1. **统一性**: 所有接口返回格式一致
2. **可预测**: 前端可以统一处理响应
3. **友好性**: 错误消息清晰明确
4. **扩展性**: 便于后续添加更多字段

---

## v2.0.0 - 2025-12-03

### 🎉 重大更新 - 支持卡池系统

#### 新增功能

1. **卡池系统**
   - 新增 `PoolInfo` 实体类，支持多个独立卡池
   - 卡池类型：常驻卡池(0)、活动卡池(1)、限定卡池(2)
   - 支持指定卡池ID进行抽卡
   - 卡池之间数据隔离

2. **实体更新**
   - `CardItem` 新增 `pool` 字段（所属卡池ID）
   - `CardItem.card_type` 类型从 `string` 改为 `number`
   - 支持卡片与卡池的关联关系

3. **抽卡配置优化**
   - `GachaConfig` 新增 `poolId` 配置项
   - 重命名 `limitedPool` 为 `upCards`
   - UP卡配置更灵活

4. **抽卡结果增强**
   - `GachaResult` 新增 `cardDesc` 字段
   - `GachaResult` 新增 `cardType` 字段
   - `GachaResult` 新增 `poolId` 字段
   - `GachaResult` 新增 `isUp` 字段

5. **新增API接口**
   - `GET /card/pools` - 获取所有卡池
   - `GET /card/pool/:poolId` - 获取卡池信息
   - `GET /card/pools/type/:type` - 按类型获取卡池
   - `GET /card/pool/:poolId/cards` - 获取卡池卡片

---

## v1.0.0 - 初始版本

### 基础功能

- 单抽、十连抽、自定义次数抽卡
- 可配置的概率系统
- 软保底和硬保底机制
- 抽卡历史追踪
- 基础的限定卡池支持
