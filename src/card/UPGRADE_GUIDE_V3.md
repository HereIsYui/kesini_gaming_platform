# 抽卡系统 v3.0 升级指南

## 🎯 升级概述

v3.0 将抽卡历史从内存存储改为数据库持久化，并新增用户卡片统计功能。

---

## ⚡ 快速开始

### 1️⃣ **数据库迁移**

确保数据库中包含新增的字段和表：

```sql
-- 1. User 表新增字段
ALTER TABLE user ADD COLUMN card_count_n INT DEFAULT 0;
ALTER TABLE user ADD COLUMN card_count_r INT DEFAULT 0;
ALTER TABLE user ADD COLUMN card_count_sr INT DEFAULT 0;
ALTER TABLE user ADD COLUMN card_count_ssr INT DEFAULT 0;
ALTER TABLE user ADD COLUMN card_count_ur INT DEFAULT 0;

-- 2. 创建 UserCardHistory 表（如果使用 TypeORM 自动同步则不需要手动创建）
-- TypeORM 会自动创建该表
```

### 2️⃣ **代码已自动更新**

以下代码已自动升级，无需手动修改：

✅ `card.service.ts` - 使用数据库存储  
✅ `card.module.ts` - 注册 UserCardHistory 实体  
✅ `card.controller.ts` - 无需修改（接口保持兼容）

### 3️⃣ **重启服务**

```bash
npm run start:dev
# 或
yarn start:dev
```

---

## 🔄 API 兼容性

### ✅ **完全兼容**

所有现有接口保持**向后兼容**，客户端代码无需修改：

```bash
# 单抽 - 无变化
POST /card/draw/once
Body: { "uid": "user123" }

# 十连抽 - 无变化
POST /card/draw/ten
Body: { "uid": "user123", "poolId": 1 }

# 获取统计 - 响应增强（新增字段）
GET /card/stats/user123
```

### 📈 **响应增强**

`GET /card/stats/:uid` 接口响应增加了新字段：

```diff
{
  "code": 0,
  "msg": "获取统计成功",
  "data": {
    "uid": "user123",
    "totalDraws": 100,
    "drawsSinceLastSR": 5,
    "drawsSinceLastSSR": 45,
    "drawsSinceLastUR": 100,
+   "cardCounts": {           // ✨ 新增：各稀有度卡片统计
+     "N": 50,
+     "R": 30,
+     "SR": 15,
+     "SSR": 4,
+     "UR": 1
+   },
+   "recentDraws": [          // ✨ 新增：最近10次抽卡记录
+     {
+       "count": 10,
+       "cardIds": ["1", "2", ...],
+       "cardLevels": ["N", "R", ...],
+       "cardUuids": ["uuid1", ...],
+       "createdAt": "2025-12-03T10:00:00Z"
+     }
+   ]
  }
}
```

---

## 🆕 新功能

### **1. 自动用户创建**

```typescript
// v2.x: 用户必须预先存在
await cardService.drawOnce('user123');  // ❌ 用户不存在时报错

// v3.0: 自动创建新用户
await cardService.drawOnce('newuser456');  // ✅ 自动创建并初始化
```

**创建的用户初始值：**
```typescript
{
  uid: 'newuser456',
  name: 'newuser456',
  nickname: 'newuser456',
  avatar: '',
  point: 0,
  card_count_n: 0,
  card_count_r: 0,
  card_count_sr: 0,
  card_count_ssr: 0,
  card_count_ur: 0
}
```

---

### **2. 卡片统计查询**

```typescript
// 获取用户各稀有度卡片数量
const stats = await cardService.getUserGachaStats('user123');

console.log(stats.cardCounts);
// {
//   N: 50,
//   R: 30,
//   SR: 15,
//   SSR: 4,
//   UR: 1
// }
```

---

### **3. 抽卡历史查询**

```typescript
// 获取最近10次抽卡记录
const stats = await cardService.getUserGachaStats('user123');

stats.recentDraws.forEach(draw => {
  console.log(`${draw.createdAt}: 抽了${draw.count}次`);
  console.log('稀有度:', draw.cardLevels);
});
```

---

## 🧪 测试升级

### **测试新功能**

```bash
# 1. 测试自动用户创建
curl -X POST http://localhost:3000/card/draw/once \
  -H "Content-Type: application/json" \
  -d '{"uid": "autoCreateUser"}'

# 2. 测试统计查询（新增字段）
curl http://localhost:3000/card/stats/autoCreateUser

# 3. 测试重置功能
curl -X POST http://localhost:3000/card/reset/autoCreateUser
```

**预期结果：**
```json
// 第一次抽卡后查询统计
{
  "code": 0,
  "msg": "获取统计成功",
  "data": {
    "uid": "autoCreateUser",
    "totalDraws": 1,
    "drawsSinceLastSR": 1,
    "drawsSinceLastSSR": 1,
    "drawsSinceLastUR": 1,
    "cardCounts": {
      "N": 1,  // 假设抽到N卡
      "R": 0,
      "SR": 0,
      "SSR": 0,
      "UR": 0
    },
    "recentDraws": [
      {
        "count": 1,
        "cardIds": ["101"],
        "cardLevels": ["N"],
        "cardUuids": ["uuid-xxx"],
        "createdAt": "2025-12-03T..."
      }
    ]
  }
}
```

---

## 📊 数据验证

### **检查数据库**

```sql
-- 1. 检查用户统计是否正确
SELECT uid, card_count_n, card_count_r, card_count_sr, card_count_ssr, card_count_ur
FROM user
WHERE uid = 'user123';

-- 2. 检查抽卡历史记录
SELECT * FROM user_card_history
WHERE uid = 'user123'
ORDER BY createdAt DESC
LIMIT 10;

-- 3. 验证保底计数逻辑
-- 查看距离上次SSR的抽数
SELECT 
  uid,
  count,
  card_levels,
  createdAt
FROM user_card_history
WHERE uid = 'user123'
ORDER BY createdAt DESC;
```

---

## ⚠️ 常见问题

### **Q1: 旧的内存数据会丢失吗？**
**A:** 是的。v3.0 移除了内存存储，服务重启后旧数据无法恢复。  
**建议：** 在升级前通知用户可能需要重新开始计数。

---

### **Q2: 保底计数是否准确？**
**A:** 是的。v3.0 从数据库精确计算保底：
- 按时间倒序遍历历史记录
- 累加未触发保底前的所有抽卡次数
- 遇到目标稀有度或更高时停止

---

### **Q3: 如何处理大量历史数据？**
**A:** 建议策略：
1. 为 `user_card_history` 表添加索引
2. 定期清理旧数据（保留最近3-6个月）
3. 使用数据归档策略

```typescript
// 示例：清理6个月前的记录
const sixMonthsAgo = new Date();
sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

await userCardHistoryRepository
  .createQueryBuilder()
  .delete()
  .where('createdAt < :date', { date: sixMonthsAgo })
  .execute();
```

---

### **Q4: 性能会受影响吗？**
**A:** 可能略有影响，但可优化：
- ✅ 添加数据库索引（uid, createdAt）
- ✅ 使用连接池
- ✅ 考虑缓存常用查询（如用户统计）

---

## 🚀 性能优化建议

### **1. 添加索引**

```typescript
// user_card_history.entity.ts
import { Index } from 'typeorm';

@Entity()
@Index(['uid'])
@Index(['createdAt'])
@Index(['uid', 'createdAt'])
export class UserCardHistory {
  // ...
}
```

### **2. 批量查询优化**

```typescript
// 如果需要查询多个用户的统计
async batchGetUserStats(uids: string[]) {
  const results = await Promise.all(
    uids.map(uid => this.getUserGachaStats(uid))
  );
  return results;
}
```

### **3. 缓存热点数据**

```typescript
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';

// 缓存用户统计（5分钟）
const cacheKey = `user_stats:${uid}`;
const cached = await this.cacheManager.get(cacheKey);
if (cached) return cached;

const stats = await this.getUserGachaStats(uid);
await this.cacheManager.set(cacheKey, stats, 300);
return stats;
```

---

## 📝 回滚方案

如果需要回滚到 v2.x：

```bash
# 1. 恢复代码
git checkout <v2.x-commit-hash>

# 2. 数据库回滚（可选）
ALTER TABLE user DROP COLUMN card_count_n;
ALTER TABLE user DROP COLUMN card_count_r;
ALTER TABLE user DROP COLUMN card_count_sr;
ALTER TABLE user DROP COLUMN card_count_ssr;
ALTER TABLE user DROP COLUMN card_count_ur;
DROP TABLE user_card_history;

# 3. 重启服务
npm run start:dev
```

⚠️ **注意：** 回滚会丢失所有统计数据和历史记录！

---

## 🎉 升级完成检查清单

- [ ] 数据库字段已添加（user 表）
- [ ] user_card_history 表已创建
- [ ] 服务成功启动，无错误
- [ ] 测试单抽接口正常
- [ ] 测试十连抽接口正常
- [ ] 统计接口返回新增字段
- [ ] 重置功能清除数据库记录
- [ ] 自动用户创建功能正常

---

## 📞 支持

遇到问题？查看：
- [详细更新日志](./CHANGELOG_V3.md)
- [抽卡系统文档](./README_GACHA.md)
- [API 测试指南](./TEST_INSTRUCTIONS.md)

升级成功！享受更可靠的抽卡系统！🎊
