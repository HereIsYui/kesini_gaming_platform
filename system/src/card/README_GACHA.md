# 抽卡系统使用说明

## 功能特性

- 卡池系统：支持常驻、限定、新手、活动等服务端卡池配置。
- 服务端概率：客户端只能选择 `poolId` 和抽数，不能传入概率、UP 或保底配置。
- 星穹币消耗：每个卡池可配置单抽和十连消耗，默认单抽 `10` 星穹币、十连 `100` 星穹币。
- 保底机制：按用户和卡池独立记录保底计数，支持软保底和硬保底。
- UP 机制：限定/活动卡池可配置 UP 卡和 UP 概率。
- 事务一致性：抽卡、合成、分解都会在数据库事务中完成。
- 统一响应：所有接口返回 `{ code, msg, data }`。

## 统一响应格式

```typescript
{
  code: number;    // 0 成功，-1 失败
  msg: string;     // 提示消息
  data: T | null;  // 响应数据
}
```

## 认证方式

需要用户资产的接口必须携带 JWT：

```http
Authorization: Bearer <token>
```

用户身份从 JWT 中读取，接口不再接受请求体里的 `uid`。

## 抽卡接口

### 单抽

```http
POST /card/draw/once
Content-Type: application/json
Authorization: Bearer <token>

{
  "poolId": 1
}
```

`poolId` 可选，不传时使用默认常驻卡池。

### 十连抽

```http
POST /card/draw/ten
Content-Type: application/json
Authorization: Bearer <token>

{
  "poolId": 2
}
```

### 兼容多抽入口

```http
POST /card/draw/multiple
Content-Type: application/json
Authorization: Bearer <token>

{
  "poolId": 2,
  "count": 10
}
```

`count` 仅允许 `1` 或 `10`，分别按当前卡池单抽或十连价格扣除星穹币。其他抽数会被拒绝。

### 抽卡响应示例

```json
{
  "code": 0,
  "msg": "抽卡成功",
  "data": {
    "cardId": 101,
    "cardName": "限定角色卡",
    "cardDesc": "角色描述",
    "rarity": "SSR",
    "cardType": 1,
    "poolId": 2,
    "isUp": true,
    "isPity": false,
    "userCardUuid": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

## 查询接口

```http
GET /card/stats
Authorization: Bearer <token>
```

返回当前星穹币余额、总抽数、各稀有度抽取数量、各卡池保底计数和最近抽卡记录。

```http
GET /card/user/cards?rarity=SSR&poolId=2&page=1&pageSize=10
Authorization: Bearer <token>
```

返回用户持有卡片和背包物品。`rarity` 支持 `N/R/SR/SSR/UR`，匹配为精确匹配，不会让 `SR` 命中 `SSR`。

## 资产接口

### 合成卡片

```http
POST /card/synthesize
Content-Type: application/json
Authorization: Bearer <token>

{
  "card_id": 101
}
```

UR 卡不能合成。碎片不足时不会创建卡片，扣碎片和发卡在同一个事务里完成。

### 分解卡片

```http
POST /card/decompose
Content-Type: application/json
Authorization: Bearer <token>

{
  "card_uuid": "550e8400-e29b-41d4-a716-446655440000"
}
```

UR 卡不能分解。删除用户卡和增加碎片在同一个事务里完成。

## 交易市场接口

交易使用用户星穹币，前台市场匿名展示卖家，后台保留真实 UID 便于审计。卡片成交后仅变更持有人，`card_uuid` 保持不变。

```http
GET /trade/listings?page=1&pageSize=20&rarity=SSR&poolId=1&sort=priceAsc
Authorization: Bearer <token>
```

返回匿名市场挂单，不包含卖家 UID、昵称或头像。支持按稀有度、卡池、价格区间和价格排序筛选。

```http
POST /trade/listings
Content-Type: application/json
Authorization: Bearer <token>

{
  "cardUuid": "550e8400-e29b-41d4-a716-446655440000",
  "price": 100
}
```

挂售后卡片会被锁定，不能分解或重复挂售。价格必须在后台交易配置范围内。

```http
POST /trade/listings/:id/buy
Authorization: Bearer <token>
```

购买会在事务内完成扣买家星穹币、给卖家实收星穹币、转移卡片和写成交记录。不能购买自己的挂单。

```http
DELETE /trade/listings/:id
Authorization: Bearer <token>
```

取消自己的交易中挂单。

```http
GET /trade/my-listings
GET /trade/my-records
Authorization: Bearer <token>
```

分别返回我的挂售和我的成交记录。成交记录只标注买入/卖出，对方仍匿名。

## 服务端配置

概率、UP 和保底都通过环境变量配置：

```bash
STANDARD_POOL_RARITY_PROBABILITIES={"N":0.5,"R":0.3,"SR":0.15,"SSR":0.045,"UR":0.005}
LIMITED_POOL_UP_CONFIG={"enabled":true,"cardIds":[101,102,103],"upRate":0.5}
STANDARD_POOL_PITY_CONFIG={"enabled":true,"softPity":{"count":10,"guaranteedRarity":"SR"},"hardPity":{"count":90,"guaranteedRarity":"SSR"}}
```

概率总和必须为 1，UP 概率必须在 0 到 1 之间。配置无效时会退回默认概率或禁用无效 UP 配置。

## 保底规则

- 保底按 `uid + poolId` 独立计算。
- 硬保底优先于软保底。
- 触发保底时，会在保底稀有度及更高稀有度中按原概率重新归一抽取。
- 抽到 `SR` 及以上会重置 SR 计数，抽到 `SSR` 及以上会重置 SSR 计数，抽到 `UR` 会重置 UR 计数。
