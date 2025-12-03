# 抽卡系统使用说明

## 功能特性

✅ **卡池系统** - 支持多个独立卡池，每个卡池独立配置
✅ **灵活的概率配置** - 支持自定义各稀有度的概率
✅ **保底机制** - 支持软保底和硬保底
✅ **UP卡机制** - 支持指定UP卡片和UP倍率
✅ **抽卡历史追踪** - 自动追踪用户抽卡次数用于保底计算
✅ **多种抽卡方式** - 单抽、十连抽、自定义次数
✅ **统一响应格式** - 所有接口返回统一的code/msg/data格式

## 响应格式说明

所有接口都返回统一的响应格式：

```typescript
{
  "code": 0,           // 状态码：0-成功，-1-失败
  "msg": "操作成功",    // 状态描述
  "data": {}           // 响应数据
}
```

### 状态码说明
- `code: 0` - 请求成功
- `code: -1` - 请求失败（缺少参数或发生错误）

## 数据库实体

### PoolInfo (卡池信息)
```typescript
- id: 卡池ID
- pool_name: 卡池名称
- card_desc: 卡池描述
- card_type: 卡池类型 (0 常驻卡池, 1 活动卡池, 2 限定卡池)
- createdAt: 创建时间
```

### CardItem (卡片信息)
```typescript
- id: 卡片ID
- card_name: 卡片名称
- card_level: 卡片稀有度 (N,R,SR,SSR,UR)
- card_desc: 卡片描述
- card_type: 卡片类型 (0 普通卡, 1 限定卡, 2 纪念卡, 3 活动卡, 4 隐藏卡)
- pool: 所属卡池ID
- drop_item: 分解掉落物品配置
- createdAt: 创建时间
```

## API 接口

### 1. 单抽
```http
POST /card/draw/once
Content-Type: application/json

{
  "uid": "user123",
  "poolId": 1,  // 可选，指定卡池ID，不指定则从所有卡片抽取
  "config": {   // 可选，不传则使用默认配置
    "poolId": 1,  // 也可以在config中指定
    "rarityProbabilities": {
      "N": 0.5,
      "R": 0.3,
      "SR": 0.15,
      "SSR": 0.045,
      "UR": 0.005
    },
    "pitySystem": {
      "enabled": true,
      "softPity": {
        "count": 10,
        "guaranteedRarity": "SR"
      },
      "hardPity": {
        "count": 90,
        "guaranteedRarity": "SSR"
      }
    },
    "upCards": {
      "enabled": true,
      "cardIds": [101, 102],
      "upRate": 0.5
    }
  }
}
```

**成功响应示例:**
```json
{
  "code": 0,
  "msg": "抽卡成功",
  "data": {
    "cardId": 101,
    "cardName": "稀有角色卡",
    "cardDesc": "这是一张稀有角色卡",
    "rarity": "SSR",
    "cardType": 1,
    "poolId": 2,
    "isPity": true,
    "isUp": false,
    "userCardUuid": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**失败响应示例:**
```json
{
  "code": -1,
  "msg": "缺少必要参数: uid",
  "data": null
}
```

### 2. 十连抽
```http
POST /card/draw/ten
Content-Type: application/json

{
  "uid": "user123",
  "poolId": 2
}
```

**响应示例:**
```json
{
  "code": 0,
  "msg": "十连抽成功",
  "data": [
    {
      "cardId": 1,
      "cardName": "普通战士",
      "cardDesc": "一名普通的战士",
      "rarity": "N",
      "cardType": 0,
      "poolId": 1,
      "isPity": false,
      "isUp": false,
      "userCardUuid": "uuid-1"
    }
    // ... 9 more results
  ]
}
```

### 3. 自定义次数抽卡
```http
POST /card/draw/multiple
Content-Type: application/json

{
  "uid": "user123",
  "poolId": 1,
  "count": 50
}
```

**响应示例:**
```json
{
  "code": 0,
  "msg": "50连抽成功",
  "data": [ /* 抽卡结果数组 */ ]
}
```

### 4. 查询抽卡统计
```http
GET /card/stats/user123
```

**响应示例:**
```json
{
  "code": 0,
  "msg": "获取统计成功",
  "data": {
    "uid": "user123",
    "totalDraws": 150,
    "drawsSinceLastSR": 5,
    "drawsSinceLastSSR": 45,
    "drawsSinceLastUR": 150
  }
}
```

### 5. 重置抽卡历史
```http
POST /card/reset/user123
```

**响应示例:**
```json
{
  "code": 0,
  "msg": "抽卡历史已重置",
  "data": null
}
```

### 6. 获取所有卡池列表
```http
GET /card/pools
```

**响应示例:**
```json
{
  "code": 0,
  "msg": "获取卡池列表成功",
  "data": [
    {
      "id": 1,
      "pool_name": "常驻卡池",
      "card_desc": "永久开放的标准卡池",
      "card_type": 0,
      "createdAt": "2023-01-01T00:00:00.000Z"
    },
    {
      "id": 2,
      "pool_name": "限定UP池",
      "card_desc": "限时UP卡池",
      "card_type": 2,
      "createdAt": "2023-01-01T00:00:00.000Z"
    }
  ]
}
```

### 7. 根据卡池ID获取卡池信息
```http
GET /card/pool/1
```

**响应示例:**
```json
{
  "code": 0,
  "msg": "获取卡池信息成功",
  "data": {
    "id": 1,
    "pool_name": "常驻卡池",
    "card_desc": "永久开放的标准卡池",
    "card_type": 0,
    "createdAt": "2023-01-01T00:00:00.000Z"
  }
}
```

### 8. 根据卡池类型获取卡池列表
```http
GET /card/pools/type/0
```
参数: type (0 常驻卡池, 1 活动卡池, 2 限定卡池)

**响应示例:**
```json
{
  "code": 0,
  "msg": "获取卡池列表成功",
  "data": [ /* 卡池数组 */ ]
}
```

### 9. 根据卡池ID获取该卡池的所有卡片
```http
GET /card/pool/1/cards
```

**响应示例:**
```json
{
  "code": 0,
  "msg": "获取卡片列表成功",
  "data": [ /* 卡片数组 */ ]
}
```

## 配置说明

### 卡池ID配置
```typescript
poolId?: number  // 可选，指定从哪个卡池抽取，不指定则从所有卡片中抽取
```

### 稀有度概率配置
```typescript
rarityProbabilities: {
  'N': 0.50,    // N卡概率 50%
  'R': 0.30,    // R卡概率 30%
  'SR': 0.15,   // SR卡概率 15%
  'SSR': 0.045, // SSR卡概率 4.5%
  'UR': 0.005,  // UR卡概率 0.5%
}
```

> ⚠️ **注意**: 所有概率总和应该等于 1.0

### 保底系统配置

#### 软保底 (Soft Pity)
```typescript
softPity: {
  count: 10,              // 10抽必出
  guaranteedRarity: 'SR', // 保底稀有度
}
```

#### 硬保底 (Hard Pity)
```typescript
hardPity: {
  count: 90,              // 90抽必出
  guaranteedRarity: 'SSR', // 保底稀有度
}
```

### UP卡配置
```typescript
upCards: {
  enabled: true,
  cardIds: [101, 102, 103],  // UP卡片ID列表
  upRate: 0.5,               // 50%概率获得UP卡
}
```

## 抽卡算法逻辑

### 1. 概率计算流程
```
开始抽卡
    ↓
指定卡池? → 验证卡池是否存在
    ↓
检查硬保底 (优先级最高)
    ↓ 未触发
检查软保底
    ↓ 未触发
按配置概率随机抽取
    ↓
确定稀有度
    ↓
从指定卡池中根据稀有度随机选择卡片
    ↓
(如有UP卡) 按UP倍率判断是否为UP卡
    ↓
返回抽卡结果
```

### 2. 卡池机制说明

- **指定卡池**: 如果在配置中指定了 `poolId`，则只从该卡池的卡片中抽取
- **不指定卡池**: 如果没有指定 `poolId`，则从所有卡片中抽取
- **卡池类型**: 
  - 0: 常驻卡池 (永久开放)
  - 1: 活动卡池 (限时开放)
  - 2: 限定卡池 (限时UP池)

### 3. 保底机制说明

- **软保底**: 在指定抽数内未获得指定稀有度，则下一抽必出
- **硬保底**: 在指定抽数内未获得指定稀有度，则下一抽必出（优先级高于软保底）
- **保底重置**: 获得高稀有度卡片时，会重置该稀有度及以下的保底计数

示例:
```
用户抽了89次未出SSR
第90次抽卡 → 触发硬保底 → 必出SSR
抽到SSR后 → drawsSinceLastSSR重置为0
           → drawsSinceLastSR也重置为0
```

### 4. UP卡机制

当启用UP卡配置时:
1. 先按正常概率确定稀有度
2. 在该稀有度范围内，按UP倍率判断
3. 如果命中UP倍率，从UP卡片列表中随机选择
4. 否则，从该卡池该稀有度的所有卡片中随机选择
5. 返回结果中 `isUp` 标记是否为UP卡

## 配置示例

### 从指定卡池抽取
```typescript
// 从卡池1抽取
await cardService.drawTen('user123', { poolId: 1 });

// 或者在DTO中指定
const dto = {
  uid: 'user123',
  poolId: 1
};
```

### 使用预设配置
```typescript
import { standardPoolConfig } from './gacha.config.example';

await cardService.drawTen('user123', standardPoolConfig);
```

### 限定UP池
```typescript
import { limitedPoolConfig } from './gacha.config.example';

await cardService.drawTen('user123', limitedPoolConfig);
```

### 新手卡池 (高概率)
```typescript
import { beginnerPoolConfig } from './gacha.config.example';

await cardService.drawTen('user123', beginnerPoolConfig);
```

## 数据库设计建议

### UserGachaHistory (用户抽卡历史表)
当前抽卡历史存储在内存中，生产环境建议创建表:

```sql
CREATE TABLE user_gacha_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  uid VARCHAR(50) NOT NULL UNIQUE,
  total_draws INT DEFAULT 0,
  draws_since_last_sr INT DEFAULT 0,
  draws_since_last_ssr INT DEFAULT 0,
  draws_since_last_ur INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_uid (uid)
);
```

### PoolInfo (卡池信息表)
```sql
CREATE TABLE pool_info (
  id INT PRIMARY KEY AUTO_INCREMENT,
  pool_name VARCHAR(100) NOT NULL,
  card_desc TEXT,
  card_type INT NOT NULL COMMENT '0 常驻卡池, 1 活动卡池, 2 限定卡池',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### CardItem (卡片信息表)
```sql
CREATE TABLE card_item (
  id INT PRIMARY KEY AUTO_INCREMENT,
  card_name VARCHAR(100) NOT NULL,
  card_level VARCHAR(50) NOT NULL COMMENT '稀有度: N,R,SR,SSR,UR',
  card_desc TEXT,
  card_type INT NOT NULL COMMENT '0 普通卡, 1 限定卡, 2 纪念卡, 3 活动卡, 4 隐藏卡',
  pool INT NOT NULL COMMENT '所属卡池ID',
  drop_item TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pool) REFERENCES pool_info(id),
  INDEX idx_pool (pool),
  INDEX idx_card_level (card_level)
);
```

## 使用注意事项

1. **概率配置**: 确保所有稀有度概率总和为1.0
2. **保底计数**: 系统会自动追踪每个用户的抽卡历史
3. **内存存储**: 当前版本使用内存存储历史，重启服务会丢失，建议实现数据库持久化
4. **并发安全**: 如需支持高并发，建议添加锁机制
5. **卡片数据**: 确保数据库中有对应卡池和稀有度的卡片数据
6. **卡池管理**: 需要先创建卡池，再将卡片分配到对应卡池

## 扩展建议

- [ ] 实现抽卡历史数据库持久化
- [ ] 添加抽卡消耗货币检查
- [ ] 实现抽卡动画配置
- [ ] 添加抽卡日志记录
- [ ] 实现概率公示功能
- [ ] 添加抽卡统计分析
- [ ] 实现卡池权重配置
- [ ] 添加抽卡次数限制
- [ ] 实现抽卡券系统
