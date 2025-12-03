# 抽卡系统测试说明

## 响应格式说明

所有接口返回统一格式：
```json
{
  "code": 0,      // 0-成功, -1-失败
  "msg": "消息",   // 状态描述
  "data": {}      // 响应数据
}
```

## 快速测试步骤

### 1. 准备测试数据

首先需要在数据库中准备测试数据：

#### 创建卡池数据
```sql
-- 插入测试卡池
INSERT INTO pool_info (pool_name, card_desc, card_type) VALUES
('常驻卡池', '永久开放的标准卡池', 0),
('限定UP池', '限时UP卡池，概率提升', 2),
('新手卡池', '新手专属高概率卡池', 0),
('活动卡池', '限时活动卡池', 1);
```

#### 创建卡片数据
```sql
-- 插入测试卡片（R卡）
INSERT INTO card_item (card_name, card_level, card_desc, card_type, pool, drop_item) VALUES
('话事人午安', 'N', '鱼派话事人,万人之上,六人之下', 0, 1, '');

INSERT INTO card_item (card_name, card_level, card_desc, card_type, pool, drop_item) VALUES
('午安', 'R', '一个吊毛', 0, 1, ''),
('wuang', 'R', '一个脑袋两个大,建设银行力量大!', 0, 1, ''),
('imlinhanchao', 'R', 'Github上最帅的程序员', 0, 1, ''),
('ipwz', 'R', '咕咕咕,咕咕咕,咕咕咕咕咕', 0, 1, ''),
('yui', 'R', '全鱼派最帅的人,没有之一', 0, 1, '')
('csfwff', 'R', 'zzz,zzzzzzz', 0, 1, ''),
('adlered', 'R', '《过年还要女装》', 0, 1, '');

-- 插入测试卡片（SR卡）
INSERT INTO card_item (card_name, card_level, card_desc, card_type, pool, drop_item) VALUES
('吊毛午安', 'SR', '鱼排传说之一,当午安出现时,大家都会说吊毛', 0, 1, ''),
('wuang', 'SR', '一个脑袋两个大,建设银行力量大!', 0, 1, ''),
('imlinhanchao', 'SR', 'Github上最帅的程序员', 0, 1, ''),
('ipwz', 'SR', '咕咕咕,咕咕咕,咕咕咕咕咕', 0, 1, ''),
('yui', 'SR', '全鱼派最帅的人,没有之一', 0, 1, '')
('csfwff', 'SR', 'zzz,zzzzzzz,鼠鼠在睡觉', 0, 1, ''),
('adlered', 'SR', '《过年还要女装》', 0, 1, '');

-- 插入测试卡片（SSR卡）
INSERT INTO card_item (card_name, card_level, card_desc, card_type, pool, drop_item) VALUES
('传说wuang', 'SSR', '总有些惊奇的机遇,比方说当我遇见你', 0, 1, ''),
('传说ipwz', 'SSR', '鸽鸽说了什么?', 0, 1, ''),
('传说yui', 'SSR', '涛涛二代?不,我是涛涛', 0, 1, '')
('传说csfwff', 'SSR', '我是不慎落入世界的一滴水墨', 0, 1, ''),
('传说adlered', 'SSR', '奇怪,我到底是不是男的?', 0, 1, ''),
('传说imlinhanchao', 'SSR', '说出你的需求,我就会满足你', 0, 1, '');

-- 插入测试卡片（UR卡）
INSERT INTO card_item (card_name, card_level, card_desc, card_type, pool, drop_item) VALUES
('闪耀adlered', 'UR', '摸鱼排创始人之一', 0, 1, ''),
('野生imlinhanchao', 'UR', '当你创建好项目并提交到Github后,野生跳佬会随机刷新,优化你的项目并修复你的bug', 0, 1, '');
```

### 2. API测试

使用以下curl命令或Postman进行测试：

#### 测试1: 获取所有卡池
```bash
curl -X GET http://localhost:3000/card/pools
```

#### 测试2: 获取指定卡池信息
```bash
curl -X GET http://localhost:3000/card/pool/1
```

#### 测试3: 获取卡池中的卡片
```bash
curl -X GET http://localhost:3000/card/pool/1/cards
```

#### 测试4: 单抽（使用默认配置）
```bash
curl -X POST http://localhost:3000/card/draw/once \
  -H "Content-Type: application/json" \
  -d '{
    "uid": "test_user_001"
  }'
```

#### 测试5: 从指定卡池单抽
```bash
curl -X POST http://localhost:3000/card/draw/once \
  -H "Content-Type: application/json" \
  -d '{
    "uid": "test_user_001",
    "poolId": 1
  }'
```

#### 测试6: 十连抽
```bash
curl -X POST http://localhost:3000/card/draw/ten \
  -H "Content-Type: application/json" \
  -d '{
    "uid": "test_user_002",
    "poolId": 1
  }'
```

#### 测试7: 自定义次数抽卡
```bash
curl -X POST http://localhost:3000/card/draw/multiple \
  -H "Content-Type: application/json" \
  -d '{
    "uid": "test_user_003",
    "poolId": 1,
    "count": 50
  }'
```

#### 测试8: 使用自定义配置抽卡
```bash
curl -X POST http://localhost:3000/card/draw/ten \
  -H "Content-Type: application/json" \
  -d '{
    "uid": "test_user_004",
    "poolId": 1,
    "config": {
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
      }
    }
  }'
```

#### 测试9: 测试UP卡机制
```bash
curl -X POST http://localhost:3000/card/draw/ten \
  -H "Content-Type: application/json" \
  -d '{
    "uid": "test_user_005",
    "poolId": 2,
    "config": {
      "poolId": 2,
      "rarityProbabilities": {
        "N": 0.45,
        "R": 0.30,
        "SR": 0.18,
        "SSR": 0.06,
        "UR": 0.01
      },
      "pitySystem": {
        "enabled": true,
        "softPity": {
          "count": 10,
          "guaranteedRarity": "SR"
        },
        "hardPity": {
          "count": 80,
          "guaranteedRarity": "SSR"
        }
      },
      "upCards": {
        "enabled": true,
        "cardIds": [11, 12],
        "upRate": 0.5
      }
    }
  }'
```

#### 测试10: 查询用户抽卡统计
```bash
curl -X GET http://localhost:3000/card/stats/test_user_001
```

#### 测试11: 重置用户抽卡历史
```bash
curl -X POST http://localhost:3000/card/reset/test_user_001
```

### 3. 保底机制测试

测试保底机制需要连续抽卡：

```bash
# 连续抽10次测试软保底
for i in {1..10}; do
  curl -X POST http://localhost:3000/card/draw/once \
    -H "Content-Type: application/json" \
    -d '{
      "uid": "pity_test_user",
      "poolId": 1
    }'
  echo ""
done

# 查看统计
curl -X GET http://localhost:3000/card/stats/pity_test_user
```

### 4. 预期结果验证

#### 单抽返回示例
```json
{
  "code": 0,
  "msg": "抽卡成功",
  "data": {
    "cardId": 1,
    "cardName": "普通战士",
    "cardDesc": "一名普通的战士",
    "rarity": "N",
    "cardType": 0,
    "poolId": 1,
    "isPity": false,
    "isUp": false,
    "userCardUuid": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### 十连抽返回示例
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

#### 用户统计返回示例
```json
{
  "code": 0,
  "msg": "获取统计成功",
  "data": {
    "uid": "test_user_001",
    "totalDraws": 150,
    "drawsSinceLastSR": 5,
    "drawsSinceLastSSR": 45,
    "drawsSinceLastUR": 150
  }
}
```

#### 错误响应示例
```json
{
  "code": -1,
  "msg": "缺少必要参数: uid",
  "data": null
}
```

### 5. 验证点

1. **概率验证**: 大量抽卡后，各稀有度实际概率应接近配置概率
2. **保底验证**: 
   - 10抽内必出SR
   - 90抽内必出SSR
3. **UP卡验证**: UP卡出现频率应符合upRate配置
4. **卡池隔离**: 指定poolId后只能抽到该卡池的卡片
5. **历史追踪**: 抽卡统计数据应正确更新

### 6. 常见问题排查

#### 问题1: 抽卡返回"没有找到稀有度为X的卡片"
**原因**: 数据库中该稀有度的卡片数据不足
**解决**: 检查并添加对应稀有度的卡片数据

#### 问题2: UP卡从不出现
**原因**: upCards配置中的cardIds不在指定卡池中
**解决**: 确保UP卡的pool字段与poolId匹配

#### 问题3: 保底不触发
**原因**: 用户历史数据未正确保存或计数错误
**解决**: 重置用户历史后重新测试

#### 问题4: 卡池ID不存在
**原因**: 指定的poolId在数据库中不存在
**解决**: 先调用获取卡池列表接口，确认可用的poolId

### 7. 压力测试

测试高并发抽卡：

```bash
# 使用Apache Bench
ab -n 1000 -c 10 -p request.json -T application/json http://localhost:3000/card/draw/once

# request.json内容
{
  "uid": "stress_test_user",
  "poolId": 1
}
```

### 8. 数据库查询验证

验证用户卡片是否正确保存：

```sql
-- 查询用户获得的所有卡片
SELECT 
    uc.uid,
    uc.card_uuid,
    ci.card_name,
    ci.card_level,
    uc.created_at
FROM user_card uc
JOIN card_item ci ON uc.card_id = ci.id
WHERE uc.uid = 'test_user_001'
ORDER BY uc.created_at DESC;

-- 统计用户各稀有度卡片数量
SELECT 
    ci.card_level,
    COUNT(*) as count
FROM user_card uc
JOIN card_item ci ON uc.card_id = ci.id
WHERE uc.uid = 'test_user_001'
GROUP BY ci.card_level;
```

## 测试检查清单

- [ ] 数据库已创建卡池数据
- [ ] 数据库已创建各稀有度卡片数据
- [ ] 能够成功获取卡池列表
- [ ] 能够从指定卡池抽卡
- [ ] 单抽功能正常
- [ ] 十连抽功能正常
- [ ] 自定义次数抽卡正常
- [ ] 软保底机制生效
- [ ] 硬保底机制生效
- [ ] UP卡机制正常
- [ ] 用户统计正确更新
- [ ] 用户卡片正确保存到数据库
- [ ] 重置历史功能正常

## 下一步优化建议

1. 实现抽卡历史数据库持久化
2. 添加抽卡消耗货币系统
3. 实现抽卡记录日志
4. 添加抽卡动画配置
5. 实现概率公示页面
6. 添加抽卡保护机制（防止刷卡）
