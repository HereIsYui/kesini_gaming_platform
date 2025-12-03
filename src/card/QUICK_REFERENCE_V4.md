# 抽卡系统 v4.0 快速参考

## 🎲 核心概念

**纯概率抽卡系统** - 每次抽卡完全基于配置的概率，不含保底机制。

---

## 📋 接口清单

| 接口 | 方法 | 说明 |
|------|------|------|
| `/card/draw/once` | POST | 单次抽卡 |
| `/card/draw/ten` | POST | 十连抽 |
| `/card/draw/multiple` | POST | 自定义次数抽卡 |
| `/card/stats/:uid` | GET | 获取用户统计 |
| `/card/reset/:uid` | POST | 重置用户历史 |
| `/card/pools` | GET | 获取所有卡池 |
| `/card/pool/:poolId` | GET | 获取卡池信息 |
| `/card/pools/type/:type` | GET | 按类型获取卡池 |
| `/card/pool/:poolId/cards` | GET | 获取卡池卡片 |

---

## 🔧 配置示例

### **最简配置（使用默认概率）**
```typescript
const config: GachaConfig = {
    poolId: 1
};
```

### **自定义概率**
```typescript
const config: GachaConfig = {
    poolId: 1,
    rarityProbabilities: {
        'N': 0.50,    // 50%
        'R': 0.30,    // 30%
        'SR': 0.15,   // 15%
        'SSR': 0.045, // 4.5%
        'UR': 0.005,  // 0.5%
    }
};
```

### **含UP卡**
```typescript
const config: GachaConfig = {
    poolId: 2,
    rarityProbabilities: { ... },
    upCards: {
        enabled: true,
        cardIds: [101, 102, 103],  // UP卡ID
        upRate: 0.5                 // 50%概率
    }
};
```

---

## 📡 请求示例

### **单抽**
```bash
curl -X POST http://localhost:3000/card/draw/once \
  -H "Content-Type: application/json" \
  -d '{
    "uid": "user123",
    "poolId": 1
  }'
```

### **十连抽（自定义概率）**
```bash
curl -X POST http://localhost:3000/card/draw/ten \
  -H "Content-Type: application/json" \
  -d '{
    "uid": "user123",
    "config": {
      "poolId": 1,
      "rarityProbabilities": {
        "N": 0.40,
        "R": 0.35,
        "SR": 0.20,
        "SSR": 0.045,
        "UR": 0.005
      }
    }
  }'
```

### **查看统计**
```bash
curl http://localhost:3000/card/stats/user123
```

---

## 📊 响应格式

### **抽卡响应**
```json
{
  "code": 0,
  "msg": "抽卡成功",
  "data": {
    "cardId": 101,
    "cardName": "传说卡片",
    "cardDesc": "稀有卡片",
    "rarity": "SSR",
    "cardType": 1,
    "poolId": 1,
    "isUp": false,
    "userCardUuid": "uuid-xxx"
  }
}
```

### **统计响应**
```json
{
  "code": 0,
  "msg": "获取统计成功",
  "data": {
    "uid": "user123",
    "totalDraws": 100,
    "cardCounts": {
      "N": 50,
      "R": 30,
      "SR": 15,
      "SSR": 4,
      "UR": 1
    },
    "recentDraws": [
      {
        "count": 10,
        "cardIds": ["1", "2", ...],
        "cardLevels": ["N", "R", ...],
        "cardUuids": ["uuid1", ...],
        "createdAt": "2025-12-03T10:00:00Z"
      }
    ]
  }
}
```

---

## 🎯 默认概率

```typescript
{
  'N': 0.50,    // 50%
  'R': 0.30,    // 30%
  'SR': 0.15,   // 15%
  'SSR': 0.045, // 4.5%
  'UR': 0.005,  // 0.5%
}
```

---

## ⚡ 快速测试

```bash
# 1. 单抽
curl -X POST http://localhost:3000/card/draw/once \
  -H "Content-Type: application/json" \
  -d '{"uid":"test001","poolId":1}'

# 2. 查看统计
curl http://localhost:3000/card/stats/test001

# 3. 十连抽
curl -X POST http://localhost:3000/card/draw/ten \
  -H "Content-Type: application/json" \
  -d '{"uid":"test001","poolId":1}'

# 4. 重置历史
curl -X POST http://localhost:3000/card/reset/test001
```

---

## 🔍 常见问题

### **Q: 如何提高SSR概率？**
```typescript
const highSSRConfig: GachaConfig = {
    poolId: 1,
    rarityProbabilities: {
        'N': 0.40,
        'R': 0.30,
        'SR': 0.20,
        'SSR': 0.09,   // 提高到9%
        'UR': 0.01,
    }
};
```

### **Q: 如何设置UP卡？**
```typescript
const upConfig: GachaConfig = {
    poolId: 1,
    upCards: {
        enabled: true,
        cardIds: [101, 102],  // 指定UP卡ID
        upRate: 0.75          // 抽到该稀有度时75%获得UP卡
    }
};
```

### **Q: 如何验证概率准确性？**
```bash
# 抽1000次验证概率分布
curl -X POST http://localhost:3000/card/draw/multiple \
  -H "Content-Type: application/json" \
  -d '{
    "uid":"test_prob",
    "count":1000,
    "config":{"poolId":1}
  }'

# 查看统计
curl http://localhost:3000/card/stats/test_prob
# 期望: N≈500, R≈300, SR≈150, SSR≈45, UR≈5
```

---

## 📚 更多文档

- [详细更新日志](./CHANGELOG_V4.md)
- [配置示例](./gacha.config.example.ts)
- [使用示例](./usage.example.ts)

---

**简洁 · 高效 · 纯粹的概率体验** ✨
