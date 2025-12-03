# 用户卡片列表接口文档

## 接口说明

获取用户拥有的所有卡片，支持按卡片等级和卡池ID进行筛选，支持分页查询。

## 接口详情

- **接口路径**: `GET /card/user/:uid/cards`
- **请求方式**: GET

## 请求参数

### 路径参数

| 参数名 | 类型   | 必填 | 说明    |
|--------|--------|------|---------|
| uid    | string | 是   | 用户ID  |

### 查询参数 (Query Parameters)

| 参数名   | 类型   | 必填 | 默认值 | 说明                                       |
|----------|--------|------|--------|-------------------------------------------|
| rarity   | string | 否   | -      | 卡片等级筛选，支持: N, R, SR, SSR, UR      |
| poolId   | number | 否   | -      | 卡池ID筛选                                 |
| page     | number | 否   | 1      | 页码（从1开始）                            |
| pageSize | number | 否   | 10     | 每页数量（最小1，最大100）                 |

## 返回数据

### 成功响应示例

```json
{
  "code": 200,
  "message": "获取用户卡片列表成功",
  "data": {
    "list": [
      {
        "userCardId": 1,
        "userCardUuid": "550e8400-e29b-41d4-a716-446655440000",
        "cardId": 101,
        "cardName": "龙之怒吼",
        "cardDesc": "传说中的龙族卡片",
        "cardLevel": "SSR,UR",
        "cardType": 0,
        "poolId": 1,
        "canSell": true,
        "canLottery": true,
        "obtainedAt": "2025-12-03T08:30:00.000Z"
      },
      {
        "userCardId": 2,
        "userCardUuid": "660e8400-e29b-41d4-a716-446655440001",
        "cardId": 102,
        "cardName": "火焰精灵",
        "cardDesc": "火属性卡片",
        "cardLevel": "SR",
        "cardType": 0,
        "poolId": 1,
        "canSell": true,
        "canLottery": true,
        "obtainedAt": "2025-12-03T08:31:00.000Z"
      }
    ],
    "total": 25,
    "page": 1,
    "pageSize": 10,
    "totalPages": 3
  }
}
```

### 失败响应示例

```json
{
  "code": 500,
  "message": "获取用户卡片列表失败",
  "data": null
}
```

## 返回字段说明

### 顶层字段

| 字段名     | 类型   | 说明                  |
|-----------|--------|----------------------|
| list      | array  | 卡片列表              |
| total     | number | 总记录数              |
| page      | number | 当前页码              |
| pageSize  | number | 每页数量              |
| totalPages| number | 总页数                |

### list 数组中的对象字段

| 字段名        | 类型    | 说明                                      |
|---------------|---------|-------------------------------------------|
| userCardId    | number  | 用户卡片记录ID                            |
| userCardUuid  | string  | 用户卡片唯一标识UUID                      |
| cardId        | number  | 卡片ID                                    |
| cardName      | string  | 卡片名称                                  |
| cardDesc      | string  | 卡片描述                                  |
| cardLevel     | string  | 卡片可出现等级（逗号分隔）                |
| cardType      | number  | 卡片类型 (0-普通 1-限定 2-纪念 3-活动 4-隐藏) |
| poolId        | number  | 卡片所属卡池ID                            |
| canSell       | boolean | 是否可出售                                |
| canLottery    | boolean | 是否可抽奖                                |
| obtainedAt    | string  | 获得时间 (ISO 8601格式)                   |

## 使用示例

### 1. 获取用户所有卡片（第1页，每页10条）

```bash
GET http://localhost:3000/card/user/user123/cards
```

### 2. 获取用户所有SSR级别的卡片（第1页）

```bash
GET http://localhost:3000/card/user/user123/cards?rarity=SSR
```

### 3. 获取用户在1号卡池抽到的所有卡片（第2页，每页20条）

```bash
GET http://localhost:3000/card/user/user123/cards?poolId=1&page=2&pageSize=20
```

### 4. 获取用户在2号卡池抽到的所有UR级别卡片（第1页）

```bash
GET http://localhost:3000/card/user/user123/cards?rarity=UR&poolId=2
```

### 5. 分页查询示例

```bash
# 第1页，每页5条
GET http://localhost:3000/card/user/user123/cards?page=1&pageSize=5

# 第3页，每页20条
GET http://localhost:3000/card/user/user123/cards?page=3&pageSize=20

# 组合筛选：SSR卡片，第2页，每页15条
GET http://localhost:3000/card/user/user123/cards?rarity=SSR&page=2&pageSize=15
```

## 注意事项

1. **卡片唯一性**：
   - 每个用户卡片都有唯一的 `userCardUuid`
   - **即使是同一张卡片（相同cardId），如果UUID不同，也会作为独立的记录返回**
   - 例如：用户抽到3张相同的SSR卡片，会返回3条记录，每条记录有不同的 `userCardUuid`

2. **分页参数**：
   - `page` 从1开始，小于1时自动设为1
   - `pageSize` 默认10，最小1，最大100
   - 如果用户不存在或没有任何卡片，返回空列表 `{ list: [], total: 0, page: 1, pageSize: 10, totalPages: 0 }`

3. **筛选逻辑**：
   - `cardLevel` 字段可能包含多个等级（如 "SSR,UR"），表示该卡片可以在多个等级出现
   - 筛选时，`rarity` 参数会匹配 `cardLevel` 中包含该等级的所有卡片
   - 可以同时使用 `rarity` 和 `poolId` 参数进行组合筛选
   - **筛选和分页是在用户卡片级别进行的，每个UUID都会被单独计算**

4. **排序规则**：
   - 返回结果按用户获得卡片的时间倒序排列（最新获得的在前）

5. **性能建议**：
   - 建议使用合理的 `pageSize`（如10-50）以获得最佳性能
   - 避免一次性查询过多数据

## 错误码说明

| 错误码 | 说明                  |
|--------|----------------------|
| 200    | 成功                  |
| 500    | 服务器内部错误        |

## 重要说明：卡片唯一性

此接口返回的是**用户拥有的每一张独立卡片**，而不是去重后的卡片列表。

### 示例场景

假设用户抽卡获得了以下卡片：
- 第1次：抽到卡片ID=101的SSR卡"龙之怒吼"
- 第2次：又抽到卡片ID=101的SSR卡"龙之怒吼"
- 第3次：抽到卡片ID=102的SSR卡"火焰精灵"

那么接口会返回**3条记录**：

```json
{
  "data": {
    "list": [
      {
        "userCardId": 3,
        "userCardUuid": "uuid-003",
        "cardId": 102,
        "cardName": "火焰精灵",
        ...
      },
      {
        "userCardId": 2,
        "userCardUuid": "uuid-002",
        "cardId": 101,
        "cardName": "龙之怒吼",
        ...
      },
      {
        "userCardId": 1,
        "userCardUuid": "uuid-001",
        "cardId": 101,
        "cardName": "龙之怒吼",
        ...
      }
    ],
    "total": 3
  }
}
```

注意：
- 即使 `cardId` 相同（都是101），但 `userCardUuid` 不同
- 每个UUID代表用户仓库中的一张独立卡片
- `total` 统计的是用户拥有的卡片总数，不是去重后的卡片种类数

