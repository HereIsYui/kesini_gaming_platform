# 抽卡系统 v4.0 更新日志 - 移除保底机制

**发布日期**: 2025-12-03

---

## 🎯 重大变更

**移除所有保底机制，改为纯概率抽卡系统。**

---

## ❌ 移除的功能

### 1️⃣ **保底机制配置**

**移除：**
```typescript
// ❌ 已移除
pitySystem: {
    enabled: boolean;
    softPity?: {
        count: number;
        guaranteedRarity: string;
    };
    hardPity?: {
        count: number;
        guaranteedRarity: string;
    };
}
```

---

### 2️⃣ **保底相关字段**

**GachaResult 接口变更：**
```diff
export interface GachaResult {
    cardId: number;
    cardName: string;
    cardDesc: string;
    rarity: string;
    cardType: number;
    poolId: number;
-   isPity: boolean;      // ❌ 已移除
    isUp: boolean;
    userCardUuid: string;
}
```

**UserGachaHistory 接口废弃，改为 UserGachaStats：**
```diff
- export interface UserGachaHistory {
-     uid: string;
-     totalDraws: number;
-     drawsSinceLastSR: number;    // ❌ 已移除
-     drawsSinceLastSSR: number;   // ❌ 已移除
-     drawsSinceLastUR: number;    // ❌ 已移除
- }

+ export interface UserGachaStats {
+     uid: string;
+     totalDraws: number;
+     cardCounts: {
+         N: number;
+         R: number;
+         SR: number;
+         SSR: number;
+         UR: number;
+     };
+ }
```

---

### 3️⃣ **保底相关方法**

已删除的私有方法：
- ❌ `determineRarity()` - 确定稀有度（含保底逻辑）
- ❌ `isPityTriggered()` - 判断是否触发保底
- ❌ `updateHistoryAfterDraw()` - 更新保底计数
- ❌ `getUserHistoryFromDB()` - 获取保底历史
- ❌ `getDrawsSinceRarity()` - 计算距离上次获得稀有度的抽数

---

## ✨ 简化的功能

### **1. GachaConfig 配置**

**v3.x (含保底):**
```typescript
const config: GachaConfig = {
    poolId: 1,
    rarityProbabilities: { ... },
    pitySystem: {              // ❌ 已移除
        enabled: true,
        softPity: { ... },
        hardPity: { ... }
    },
    upCards: { ... }
};
```

**v4.0 (纯概率):**
```typescript
const config: GachaConfig = {
    poolId: 1,
    rarityProbabilities: {     // ✅ 可选（有默认值）
        'N': 0.50,
        'R': 0.30,
        'SR': 0.15,
        'SSR': 0.045,
        'UR': 0.005,
    },
    upCards: {                 // ✅ 保留UP机制
        enabled: true,
        cardIds: [101, 102],
        upRate: 0.5
    }
};
```

---

### **2. drawMultiple 方法**

**主要简化：**
- ✅ 移除保底历史追踪
- ✅ 移除保底计数逻辑
- ✅ 直接使用概率抽取稀有度
- ✅ 移除保底相关数据库查询

**v4.0 核心逻辑：**
```typescript
async drawMultiple(uid: string, count: number, config?: GachaConfig) {
    // 获取概率配置（使用默认或自定义）
    const probabilities = config?.rarityProbabilities || this.defaultRarityProbabilities;

    for (let i = 0; i < count; i++) {
        // 纯概率随机抽取稀有度
        const rarity = this.rollRarity(probabilities);
        
        // 根据稀有度抽卡片
        const { card, isUp } = await this.getRandomCard(rarity, config);
        
        // 保存结果
        // ...
    }
}
```

---

### **3. getUserGachaStats 方法**

**v3.x 响应（含保底计数）:**
```json
{
  "uid": "user123",
  "totalDraws": 100,
  "drawsSinceLastSR": 5,     // ❌ 已移除
  "drawsSinceLastSSR": 45,   // ❌ 已移除
  "drawsSinceLastUR": 100,   // ❌ 已移除
  "cardCounts": { ... },
  "recentDraws": [ ... ]
}
```

**v4.0 响应（纯统计）:**
```json
{
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
      "createdAt": "2025-12-03T..."
    }
  ]
}
```

---

## 🔄 API 变更

### **抽卡接口 - 无变化**
```bash
# 单抽 - 兼容
POST /card/draw/once
Body: { "uid": "user123", "poolId": 1 }

# 十连抽 - 兼容
POST /card/draw/ten
Body: { "uid": "user123", "poolId": 1 }
```

### **统计接口 - 响应字段减少**
```bash
GET /card/stats/:uid

# v3.x 响应
{
  "code": 0,
  "data": {
    "totalDraws": 100,
    "drawsSinceLastSR": 5,    // ❌ 已移除
    "drawsSinceLastSSR": 45,  // ❌ 已移除
    "drawsSinceLastUR": 100,  // ❌ 已移除
    "cardCounts": { ... }
  }
}

# v4.0 响应
{
  "code": 0,
  "data": {
    "totalDraws": 100,
    "cardCounts": { ... },    // ✅ 保留
    "recentDraws": [ ... ]    // ✅ 保留
  }
}
```

---

## 📊 性能提升

| 指标 | v3.x (含保底) | v4.0 (纯概率) | 提升 |
|------|---------------|---------------|------|
| 单次抽卡查询 | 3-5次 | 1-2次 | ~60% |
| 代码行数 | ~450行 | ~280行 | -38% |
| 逻辑复杂度 | 高 | 低 | 大幅简化 |

**优势：**
- ✅ 减少数据库查询
- ✅ 降低计算复杂度
- ✅ 提高代码可维护性
- ✅ 更纯粹的概率体验

---

## 🛠️ 迁移指南

### **1. 客户端代码调整**

**移除保底相关字段的引用：**
```typescript
// ❌ 旧代码
results.forEach(result => {
    if (result.isPity) {
        console.log('保底获得:', result.cardName);
    }
});

// ✅ 新代码（移除保底判断）
results.forEach(result => {
    console.log('获得:', result.cardName, result.rarity);
});
```

---

### **2. 配置文件调整**

**移除 pitySystem 配置：**
```typescript
// ❌ 旧配置
const config: GachaConfig = {
    poolId: 1,
    rarityProbabilities: { ... },
    pitySystem: {              // ← 删除此项
        enabled: true,
        softPity: { ... },
        hardPity: { ... }
    }
};

// ✅ 新配置
const config: GachaConfig = {
    poolId: 1,
    rarityProbabilities: { ... }  // 其他配置保持不变
};
```

---

### **3. 统计数据处理**

**移除保底计数字段的处理：**
```typescript
// ❌ 旧代码
const stats = await cardService.getUserGachaStats(uid);
console.log('距离SSR保底:', 90 - stats.drawsSinceLastSSR);

// ✅ 新代码（使用其他统计）
const stats = await cardService.getUserGachaStats(uid);
console.log('已抽SSR数量:', stats.cardCounts.SSR);
console.log('总抽卡次数:', stats.totalDraws);
```

---

## 🧪 测试建议

### **验证纯概率抽卡**

```bash
# 1. 测试大量抽卡，验证概率分布
curl -X POST http://localhost:3000/card/draw/multiple \
  -H "Content-Type: application/json" \
  -d '{
    "uid": "test_user",
    "count": 1000,
    "config": {
      "poolId": 1,
      "rarityProbabilities": {
        "N": 0.50,
        "R": 0.30,
        "SR": 0.15,
        "SSR": 0.045,
        "UR": 0.005
      }
    }
  }'

# 2. 查看统计分布
curl http://localhost:3000/card/stats/test_user

# 3. 验证概率是否符合预期
# 期望: N≈500, R≈300, SR≈150, SSR≈45, UR≈5
```

---

## ⚠️ 注意事项

### **不兼容性**

1. **客户端必须更新**
   - 移除所有 `result.isPity` 的引用
   - 移除所有保底相关的UI显示

2. **统计数据变化**
   - `drawsSinceLastSR/SSR/UR` 不再返回
   - 需要使用 `cardCounts` 替代

3. **配置文件清理**
   - 删除所有 `pitySystem` 配置
   - 否则会导致类型错误

---

## 🎨 示例配置

### **标准卡池（默认概率）**
```typescript
const standardConfig: GachaConfig = {
    poolId: 1
    // 不指定 rarityProbabilities，使用默认概率
};
```

### **活动卡池（自定义概率 + UP卡）**
```typescript
const eventConfig: GachaConfig = {
    poolId: 2,
    rarityProbabilities: {
        'N': 0.40,
        'R': 0.35,
        'SR': 0.20,
        'SSR': 0.045,
        'UR': 0.005,
    },
    upCards: {
        enabled: true,
        cardIds: [201, 202, 203],
        upRate: 0.75
    }
};
```

### **新手卡池（高概率）**
```typescript
const beginnerConfig: GachaConfig = {
    poolId: 3,
    rarityProbabilities: {
        'N': 0.30,
        'R': 0.35,
        'SR': 0.25,
        'SSR': 0.08,
        'UR': 0.02,
    }
};
```

---

## 📝 后续计划

- [ ] 添加概率分析工具
- [ ] 支持概率动态调整（活动加成）
- [ ] 实现幸运值系统（替代保底）
- [ ] 添加抽卡可视化统计

---

## 🔗 相关文档

- [抽卡系统使用文档](./README_GACHA.md)
- [配置示例](./gacha.config.example.ts)
- [使用示例](./usage.example.ts)

---

**版本历史：**
- v4.0 (2025-12-03): **移除保底机制，纯概率抽卡**
- v3.0 (2025-12-03): 数据库持久化 + 用户统计
- v2.1 (2025-12-03): 统一响应格式
- v2.0 (2025-12-03): 卡池系统适配
- v1.0 (2025-12-03): 初始版本（含保底）
