# 抽卡系统 v3.0 更新日志

## 🎉 版本 3.0 - 数据库持久化升级

**发布日期**: 2025-12-03

---

## 📋 更新概述

将抽卡历史从**内存存储**升级为**数据库持久化**，并新增用户卡片统计功能。

---

## ✨ 新增功能

### 1️⃣ **用户卡片统计 (User 实体扩展)**

在 `User` 实体中新增各稀有度卡片数量统计：

```typescript
@Column()
card_count_n: number;      // N卡数量

@Column()
card_count_r: number;      // R卡数量

@Column()
card_count_sr: number;     // SR卡数量

@Column()
card_count_ssr: number;    // SSR卡数量

@Column()
card_count_ur: number;     // UR卡数量
```

**特性：**
- ✅ 每次抽卡自动更新对应稀有度计数
- ✅ 支持重置统计
- ✅ 可快速查询用户总卡片分布

---

### 2️⃣ **抽卡历史数据库记录 (UserCardHistory 实体)**

新增 `UserCardHistory` 实体记录每次抽卡：

```typescript
@Entity()
export class UserCardHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  uid: string;              // 用户ID

  @Column()
  count: number;            // 本次抽卡次数（1/10/其他）

  @Column()
  card_ids: string;         // 抽到的卡片ID（逗号分隔）

  @Column()
  card_levels: string;      // 抽到的卡片等级（逗号分隔）

  @Column()
  card_uuids: string;       // 用户卡片UUID（逗号分隔）

  @CreateDateColumn()
  createdAt: Date;          // 抽卡时间
}
```

**示例数据：**
```json
{
  "id": 1,
  "uid": "user123",
  "count": 10,
  "card_ids": "101,102,103,104,105,106,107,108,109,110",
  "card_levels": "N,N,R,N,SR,N,R,N,SSR,N",
  "card_uuids": "uuid1,uuid2,uuid3,...",
  "createdAt": "2025-12-03T10:30:00Z"
}
```

---

## 🔧 核心改进

### **抽卡流程优化**

#### **v2.x (内存存储)**
```typescript
// ❌ 旧方式：使用 Map 存储
private userGachaHistoryMap: Map<string, UserGachaHistory> = new Map();

drawMultiple() {
  let history = this.getUserHistory(uid);  // 从内存读取
  // ... 抽卡逻辑
  this.saveUserHistory(uid, history);      // 保存到内存
}
```

**问题：**
- ❌ 服务重启数据丢失
- ❌ 无法查询历史记录
- ❌ 无法跨实例共享

---

#### **v3.0 (数据库持久化)**
```typescript
// ✅ 新方式：使用数据库
@InjectRepository(UserCardHistory) 
private readonly userCardHistoryRepository: Repository<UserCardHistory>;

async drawMultiple() {
  // 从数据库获取历史
  let history = await this.getUserHistoryFromDB(uid);
  
  // 记录本次抽卡信息
  const cardIds = [], cardLevels = [], cardUuids = [];
  
  for (let i = 0; i < count; i++) {
    // ... 抽卡逻辑
    
    // 更新用户卡片统计
    await this.updateUserCardCount(uid, rarity);
    
    // 收集卡片信息
    cardIds.push(card.id);
    cardLevels.push(rarity);
    cardUuids.push(userCard.card_uuid);
  }
  
  // 保存到数据库
  await this.saveUserHistoryToDB(uid, count, cardIds, cardLevels, cardUuids);
}
```

**优势：**
- ✅ 数据持久化，重启不丢失
- ✅ 可查询完整历史记录
- ✅ 支持多实例部署
- ✅ 便于数据分析和统计

---

## 📊 新增/修改的方法

### **新增方法**

| 方法 | 说明 |
|------|------|
| `getUserHistoryFromDB()` | 从数据库获取用户抽卡历史 |
| `getDrawsSinceRarity()` | 计算距离上次获得指定稀有度的抽数 |
| `saveUserHistoryToDB()` | 保存抽卡记录到数据库 |
| `updateUserCardCount()` | 更新用户卡片数量统计 |

### **修改方法**

| 方法 | 变化 |
|------|------|
| `drawMultiple()` | • 自动创建不存在的用户<br>• 调用数据库存储方法<br>• 更新卡片统计 |
| `resetUserHistory()` | • 删除数据库记录<br>• 重置用户统计字段 |
| `getUserGachaStats()` | • 返回扩展统计信息<br>• 包含卡片数量分布<br>• 包含最近10次抽卡记录 |

### **废弃方法**

| 方法 | 状态 | 替代方法 |
|------|------|---------|
| `getUserHistory()` | ⚠️ 已移除 | `getUserHistoryFromDB()` |
| `saveUserHistory()` | ⚠️ 已移除 | `saveUserHistoryToDB()` |
| `userGachaHistoryMap` | ⚠️ 已移除 | 数据库存储 |

---

## 🔌 模块依赖更新

### **card.module.ts**

```diff
@Module({
  imports: [
    TypeOrmModule.forFeature([
      CardItem, 
      PoolInfo, 
      User, 
      UserCard,
+     UserCardHistory  // 新增
    ])
  ],
  // ...
})
```

---

## 📡 API 响应变化

### **获取用户统计 - `/card/stats/:uid`**

#### **v2.x 响应**
```json
{
  "code": 0,
  "msg": "获取统计成功",
  "data": {
    "uid": "user123",
    "totalDraws": 100,
    "drawsSinceLastSR": 5,
    "drawsSinceLastSSR": 45,
    "drawsSinceLastUR": 100
  }
}
```

#### **v3.0 响应（新增字段）**
```json
{
  "code": 0,
  "msg": "获取统计成功",
  "data": {
    "uid": "user123",
    "totalDraws": 100,
    "drawsSinceLastSR": 5,
    "drawsSinceLastSSR": 45,
    "drawsSinceLastUR": 100,
    "cardCounts": {              // ✨ 新增
      "N": 50,
      "R": 30,
      "SR": 15,
      "SSR": 4,
      "UR": 1
    },
    "recentDraws": [             // ✨ 新增
      {
        "count": 10,
        "cardIds": ["101", "102", "103", ...],
        "cardLevels": ["N", "R", "SR", ...],
        "cardUuids": ["uuid1", "uuid2", ...],
        "createdAt": "2025-12-03T10:30:00Z"
      },
      // ... 最近10条记录
    ]
  }
}
```

---

## 🗄️ 数据库迁移

### **User 表 - 新增字段**
```sql
ALTER TABLE user ADD COLUMN card_count_n INT DEFAULT 0;
ALTER TABLE user ADD COLUMN card_count_r INT DEFAULT 0;
ALTER TABLE user ADD COLUMN card_count_sr INT DEFAULT 0;
ALTER TABLE user ADD COLUMN card_count_ssr INT DEFAULT 0;
ALTER TABLE user ADD COLUMN card_count_ur INT DEFAULT 0;
```

### **UserCardHistory 表 - 新建**
```sql
CREATE TABLE user_card_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  uid VARCHAR(255) NOT NULL,
  count INT NOT NULL,
  card_ids TEXT NOT NULL,
  card_levels TEXT NOT NULL,
  card_uuids TEXT NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_uid (uid),
  INDEX idx_created_at (createdAt)
);
```

---

## 🚀 使用示例

### **自动用户创建**

```typescript
// 新用户第一次抽卡时自动创建
const result = await cardService.drawOnce('newuser123');
// ✅ 如果 newuser123 不存在，会自动创建并初始化统计
```

### **查询完整统计**

```typescript
const stats = await cardService.getUserGachaStats('user123');

console.log(stats);
// {
//   totalDraws: 100,
//   drawsSinceLastSR: 5,
//   cardCounts: { N: 50, R: 30, SR: 15, SSR: 4, UR: 1 },
//   recentDraws: [...]
// }
```

### **重置用户数据**

```typescript
// 完全重置（删除历史记录 + 重置统计）
await cardService.resetUserHistory('user123');
```

---

## 🔍 保底机制计算逻辑

### **从数据库计算保底计数**

```typescript
// 示例：计算距离上次SSR的抽数
async getDrawsSinceRarity(uid: string, rarity: 'SSR'): Promise<number> {
  // 1. 获取所有抽卡历史（倒序）
  const histories = await userCardHistoryRepository.find({
    where: { uid },
    order: { createdAt: 'DESC' }
  });
  
  // 2. 从最新记录开始计数，直到找到SSR或更高稀有度
  let drawsSince = 0;
  for (const history of histories) {
    const levels = history.card_levels.split(',');
    const hasSSR = levels.some(level => ['SSR', 'UR'].includes(level));
    
    if (hasSSR) break;  // 找到了，停止计数
    drawsSince += history.count;
  }
  
  return drawsSince;
}
```

**工作原理：**
1. 按时间倒序获取历史记录
2. 遍历每条记录的 `card_levels` 字段
3. 检查是否包含目标稀有度或更高
4. 累加未触发前的抽卡次数

---

## ⚠️ 注意事项

### **1. 数据迁移**
如果已有旧数据（内存存储），需要：
- ✅ 为现有用户初始化统计字段为 0
- ✅ 旧的内存历史无法迁移（重启后丢失）

### **2. 性能优化建议**
```typescript
// 建议为 UserCardHistory 添加索引
@Index(['uid'])
@Index(['createdAt'])
export class UserCardHistory { ... }
```

### **3. 数据清理策略**
考虑定期清理旧记录：
```typescript
// 可选：保留最近3个月的记录
async cleanOldHistory() {
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  
  await this.userCardHistoryRepository
    .createQueryBuilder()
    .delete()
    .where('createdAt < :date', { date: threeMonthsAgo })
    .execute();
}
```

---

## 🎯 后续规划

- [ ] 添加数据分析接口（出货率统计）
- [ ] 支持分页查询历史记录
- [ ] 导出用户抽卡报告
- [ ] 异常抽卡检测（防作弊）

---

## 🔗 相关文档

- [抽卡系统使用文档](./README_GACHA.md)
- [测试指南](./TEST_INSTRUCTIONS.md)
- [统一响应格式](../common/README_RESPONSE.md)

---

**版本历史：**
- v3.0 (2025-12-03): 数据库持久化 + 用户统计
- v2.1 (2025-12-03): 统一响应格式
- v2.0 (2025-12-03): 卡池系统适配
- v1.0 (2025-12-03): 初始版本
