# 配置管理说明

## 概述

本项目使用环境变量来管理所有配置，包括JWT、数据库和抽卡概率配置。

## 配置文件

### 环境变量文件

- `.env.example` - 配置模板文件
- `.env` - 默认本地配置文件
- `.env.${NODE_ENV}` / `.env.dev` / `.env.prod` - 可选环境配置文件
- `ENV_FILE` - 可显式指定环境配置文件路径

### 配置服务

- `ConfigurationService` - 核心配置服务，管理所有环境变量
- `GachaConfigService` - 抽卡配置服务，管理抽卡概率和UP卡配置

## 配置项说明

### 应用配置

```bash
NODE_ENV=development          # 运行环境
PORT=3000                   # 应用端口
BASE_URL=http://localhost:3000 # 基础URL
```

### JWT配置

```bash
JWT_SECRET=your-secret-key   # JWT密钥（生产环境必须配置）
JWT_EXPIRES_IN=7d           # JWT过期时间
ADMIN_UIDS=123456,789012    # 保留配置，不作为后台管理权限放行依据
```

后台管理权限以用户表 `is_admin=true` 为准。

### MySQL数据库配置

```bash
DB_HOST=127.0.0.1         # 数据库主机
DB_PORT=3306               # 数据库端口
DB_USERNAME=root            # 数据库用户名
DB_PASSWORD=123456          # 数据库密码
DB_DATABASE=kesini         # 数据库名称
DB_SYNCHRONIZE=true         # 是否同步实体到数据库
DB_AUTO_LOAD_ENTITIES=true  # 是否自动加载实体
DB_RETRY_DELAY=500          # 重试延迟（毫秒）
DB_RETRY_ATTEMPTS=10        # 重试次数
```

### Redis配置

Redis 是预留缓存能力，应用启动时不会主动连接。只有业务代码调用 Redis 工具方法时，才会按需创建客户端并发起连接。

```bash
REDIS_HOST=127.0.0.1       # Redis主机
REDIS_PORT=6379            # Redis端口
REDIS_PASSWORD=            # Redis密码（可选）
```

### 交易配置

玩家卡片交易配置保存在数据库 `trade_config` 表中，可在后台“交易管理”页面维护。

- `enabled`：是否开启交易市场
- `fee_rate`：手续费率，`0.05` 表示 5%
- `min_price` / `max_price`：玩家挂售价格范围，默认 `1-999999`

成交时按挂单创建时保存的手续费率结算，后续修改手续费不会影响已上架挂单的预计实收。

### 抽卡概率配置

所有概率配置都使用JSON格式，且概率总和应该等于1.0（100%）。

#### 标准卡池概率

```bash
STANDARD_POOL_RARITY_PROBABILITIES={"N":0.5,"R":0.3,"SR":0.15,"SSR":0.045,"UR":0.005}
```

#### 限定卡池概率

```bash
LIMITED_POOL_RARITY_PROBABILITIES={"N":0.45,"R":0.3,"SR":0.18,"SSR":0.06,"UR":0.01}
```

#### 新手卡池概率

```bash
BEGINNER_POOL_RARITY_PROBABILITIES={"N":0.3,"R":0.35,"SR":0.25,"SSR":0.08,"UR":0.02}
```

#### 活动卡池概率

```bash
EVENT_POOL_RARITY_PROBABILITIES={"N":0.4,"R":0.35,"SR":0.2,"SSR":0.045,"UR":0.005}
```

### UP卡配置

#### 限定卡池UP配置

```bash
LIMITED_POOL_UP_CONFIG={"enabled":true,"cardIds":[101,102,103],"upRate":0.5}
```

#### 活动卡池UP配置

```bash
EVENT_POOL_UP_CONFIG={"enabled":true,"cardIds":[201,202,203,204],"upRate":0.75}
```

### 保底配置

```bash
STANDARD_POOL_PITY_CONFIG={"enabled":true,"softPity":{"count":10,"guaranteedRarity":"SR"},"hardPity":{"count":90,"guaranteedRarity":"SSR"}}
LIMITED_POOL_PITY_CONFIG={"enabled":true,"softPity":{"count":10,"guaranteedRarity":"SR"},"hardPity":{"count":90,"guaranteedRarity":"SSR"}}
BEGINNER_POOL_PITY_CONFIG={"enabled":true,"softPity":{"count":10,"guaranteedRarity":"SR"},"hardPity":{"count":50,"guaranteedRarity":"SSR"}}
EVENT_POOL_PITY_CONFIG={"enabled":true,"softPity":{"count":10,"guaranteedRarity":"SR"},"hardPity":{"count":90,"guaranteedRarity":"SSR"}}
```

## 卡池类型说明

| 卡池ID | 类型     | 说明               |
| ------ | -------- | ------------------ |
| 0/1    | 常驻卡池 | 标准概率           |
| 2      | 限定卡池 | 包含UP卡           |
| 3      | 新手卡池 | 高概率             |
| 4      | 活动卡池 | 限时活动，包含UP卡 |

## 使用方式

### 在代码中使用配置

```typescript
// 导入配置服务
import { ConfigurationService } from './config/configuration.service';
import { GachaConfigService } from './card/gacha-config.service';

// 在服务中注入
constructor(
  private readonly configService: ConfigurationService,
  private readonly gachaConfigService: GachaConfigService,
) {}

// 使用配置
const jwtSecret = this.configService.jwtSecret;
const dbConfig = this.configService.databaseConfig;
const standardPool = this.gachaConfigService.getStandardPoolConfig();
```

### 获取特定卡池配置

```typescript
// 根据卡池ID获取配置
const poolConfig = this.gachaConfigService.getConfigByPoolId(poolId);

// 获取所有卡池配置
const allConfigs = this.gachaConfigService.getAllPoolConfigs();
```

## 环境变量最佳实践

1. **生产环境安全**:
   - 使用强密码的JWT_SECRET
   - 生产环境缺失JWT_SECRET时应用会拒绝启动
   - 修改默认数据库密码
   - 设置适当的数据库权限

2. **配置验证**:
   - 概率配置总和必须等于1.0
   - UP卡配置的upRate应该在0-1之间
   - 卡片ID必须存在于数据库中

3. **环境隔离**:
   - 本地默认使用 `system/.env`
   - 可通过 `ENV_FILE` 指定配置文件，或按 `NODE_ENV` 自动读取 `.env.${NODE_ENV}`
   - 生产环境使用独立的环境变量或 `.env.prod`
   - 不要将敏感配置提交到版本控制

## 配置热更新

目前配置在应用启动时加载，如需热更新功能，可以：

1. 实现配置变更监听
2. 使用配置管理服务（如Consul、ETCD）
3. 添加配置刷新接口
