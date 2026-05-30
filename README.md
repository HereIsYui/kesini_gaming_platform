# Kesini Gaming Platform

抽卡游戏平台工作区，包含 NestJS API 服务、玩家前端和运营台。

## 项目结构

- `system/`：NestJS 后端 API，包含登录、抽卡、卡池、资产、交易、充值和运营接口。
- `website/`：Vue 玩家前端，使用 Vite 构建。
- `backend/`：Vue 运营台，使用 Vite + Element Plus 构建。

## 端口和地址

- API 服务默认端口：`3000`，可通过 `system/.env` 的 `PORT` 覆盖。
- 玩家前端本地开发端口：`7002`。
- 运营台本地开发端口：`7003`。
- 前后端分域部署时，只需要给前端配置 API 地址。生产环境推荐改静态资源目录里的 `config.js`，不依赖重新打包：
  - 玩家前端：`website/dist/config.js`
  - 运营台：`backend/dist/config.js`
- OAuth 回跳地址不需要配置环境变量。前端会直接读取当前浏览器域名生成 `returnTo` 和 `realm`。
- 生产环境 OAuth 回跳地址必须是 HTTPS；不要把后端 API 域名当作 OAuth 回跳域名。
- OpenID 回调 nonce 5 分钟内只能使用一次，避免同一登录回调被重复提交。

## 本地开发

```bash
npm install
npm run system:dev
npm run website:dev
npm run backend:dev
```

本地默认访问：

- API：`http://localhost:3000`
- 玩家前端：`http://localhost:7002`
- 运营台：`http://localhost:7003`

生产部署不依赖本地开发端口；线上只需要把 `website/dist` 和 `backend/dist` 分别托管为静态站点。

## 生产环境配置

### 后端 API

在 `system/.env` 中配置：

```bash
NODE_ENV=production
PORT=3000

JWT_SECRET=change-this-to-a-strong-secret
JWT_EXPIRES_IN=7d

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=change-this
DB_DATABASE=kesini
DB_SYNCHRONIZE=false
DB_AUTO_LOAD_ENTITIES=true
DB_RETRY_DELAY=500
DB_RETRY_ATTEMPTS=10

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
```

`DB_SYNCHRONIZE` 生产环境建议设为 `false`。`REDIS_*` 是预留配置，当前应用启动时不会主动连接 Redis。

### 前端 API 地址

推荐在发布到服务器后修改静态资源根目录的 `config.js`。玩家前端和运营台都使用同一种格式：

```js
window.__KESINI_CONFIG__ = {
  API_BASE: "https://api.example.com",
  ENABLE_MANUAL_LOGIN: false,
};
```

对应文件位置：

- 玩家前端：`website/dist/config.js`
- 运营台：`backend/dist/config.js`

也可以在构建前设置环境变量作为兜底。玩家前端使用 `VITE_API_BASE`，运营台使用 `PUBLIC_API_BASE`：

```bash
VITE_API_BASE=https://api.example.com
PUBLIC_API_BASE=https://api.example.com
VITE_ENABLE_MANUAL_LOGIN=false
PUBLIC_ENABLE_MANUAL_LOGIN=false
```

这些前端环境变量是构建时变量。部署后再执行 `export VITE_API_BASE=...` 或 `export PUBLIC_API_BASE=...` 不会改变已经打包出的静态文件；如果要部署后直接生效，请改 `dist/config.js`。

API 地址读取优先级为：`dist/config.js` > 构建时环境变量 > 浏览器本地保存地址 > 本地开发默认地址。生产环境会忽略浏览器里旧的 `http://localhost:3000` 保存值，避免部署后被本机缓存覆盖。

临时凭证入口只在本地开发默认显示。生产环境默认隐藏；确需临时启用时，在对应 `dist/config.js` 中设置 `ENABLE_MANUAL_LOGIN: true`，或构建前设置 `VITE_ENABLE_MANUAL_LOGIN=true`、`PUBLIC_ENABLE_MANUAL_LOGIN=true`。

## 构建

```bash
npm install
npm run build
```

构建产物：

- API：`system/dist/`
- 玩家前端：`website/dist/`
- 运营台：`backend/dist/`

也可以分别构建：

```bash
npm run system:build
npm run website:build
npm run backend:build
```

## 启动 API 服务

推荐用进程管理器托管 API，例如 PM2：

```bash
npm --workspace system run build
pm2 start "npm --workspace system run start:prod" --name kesini-api
pm2 save
```

API 启动后可验证：

```bash
curl http://127.0.0.1:3000/
```

正常会返回：

```text
Hello World!
```

## Nginx 部署示例

推荐使用三个 HTTPS 域名：

- `https://api.example.com`：反向代理到 API 服务 `127.0.0.1:3000`
- `https://web.example.com`：托管 `website/dist`
- `https://admin.example.com`：托管 `backend/dist`

示例配置：

```nginx
server {
    listen 443 ssl http2;
    server_name api.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 443 ssl http2;
    server_name web.example.com;
    root /var/www/kesini/website/dist;
    index index.html;

    location = /config.js {
        add_header Cache-Control "no-store";
        try_files /config.js =404;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}

server {
    listen 443 ssl http2;
    server_name admin.example.com;
    root /var/www/kesini/backend/dist;
    index index.html;

    location = /config.js {
        add_header Cache-Control "no-store";
        try_files /config.js =404;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

请按你的服务器实际情况补充 SSL 证书配置。

宝塔面板的“伪静态”输入框通常已经位于站点的 `server` 块内部，不要把完整的 `server { ... }` 粘进去。前端站点只需要保留 SPA 回退规则：

```nginx
try_files $uri $uri/ /index.html;
```

如果你是在站点主配置文件里手动编辑，则使用上面示例中的 `location / { try_files $uri $uri/ /index.html; }`。

## OAuth 部署要点

FishPi OAuth 要求：

- `openid.return_to` 必须是 HTTPS。
- `openid.realm` 必须是 `openid.return_to` 的前缀。

当前实现中：

- 玩家前端会用当前访问地址生成回跳，例如 `https://web.example.com/draw`。
- 运营台会用当前访问地址生成回跳，例如 `https://admin.example.com/`。
- API 只负责校验并生成 FishPi 登录 URL，不再从环境变量读取 OAuth 前端域名。

因此部署时要确保用户浏览器实际访问的是最终 HTTPS 域名，而不是内网 IP、HTTP 地址或后端 API 域名。

## 更新部署

```bash
git pull
npm install
npm run build
pm2 restart kesini-api
nginx -t
nginx -s reload
```

部署后设置 API 域名：

```bash
cat > /var/www/kesini/website/dist/config.js <<'EOF'
window.__KESINI_CONFIG__ = {
  API_BASE: "https://api.example.com",
  ENABLE_MANUAL_LOGIN: false,
};
EOF

cat > /var/www/kesini/backend/dist/config.js <<'EOF'
window.__KESINI_CONFIG__ = {
  API_BASE: "https://api.example.com",
  ENABLE_MANUAL_LOGIN: false,
};
EOF
```

如果只改 `dist/config.js`，不需要重新构建前端；如果只改构建时环境变量，例如 `VITE_API_BASE` 或 `PUBLIC_API_BASE`，必须重新构建对应前端并重新发布 `dist/`。

注意：以前在打包产物里 `grep http://localhost:3000` 可能会命中本地开发兜底值或输入框占位符，不能单独作为生产 API 地址是否生效的判断依据。现在生产地址优先看 `dist/config.js`，也可以在浏览器开发者工具的 Network 面板确认请求实际发往的域名。

卡面素材支持图片和视频：图片最大 2MB，视频最大 10MB，接口通过 `/file/...` 访问。生产环境建议把上传目录放到发布目录之外，避免代码更新时覆盖已上传素材：

```bash
mkdir -p /data/kesini/public/card-images /data/kesini/public/card-videos
chown -R www:www /data/kesini/public
export FILE_ROOT=/data/kesini/public
```

部署脚本只替换代码和 `dist/`，不要删除 `/data/kesini/public`。如果没有配置 `FILE_ROOT`，素材会保存到 `system/public/card-images` 和 `system/public/card-videos`，此时需要把 `system/public` 作为持久化目录保留。

## 验证清单

- API：`curl https://api.example.com/` 返回 `Hello World!`
- 玩家前端能访问 `https://web.example.com`
- 运营台能访问 `https://admin.example.com`
- `curl https://web.example.com/config.js` 能看到 `API_BASE: "https://api.example.com"`
- `curl https://admin.example.com/config.js` 能看到 `API_BASE: "https://api.example.com"`
- 玩家前端发起的 API 请求访问的是 `https://api.example.com`
- 生产环境玩家前端和运营台不显示“临时凭证”
- OAuth 登录跳转到 FishPi 时，URL 中的 `openid.return_to` 是当前前端 HTTPS 域名
- OAuth 回调后前端能调用 `POST /apis/login` 完成登录
- 重复提交同一个 OAuth 回调会返回 `登录已失效`
- 玩家主页能访问 `https://web.example.com/u/<publicId>`
- 登录玩家能保存 1-6 张展示卡片
- 登录玩家能进入“好友”，处理收到和发出的好友申请
- 登录玩家能进入“公会”，创建、加入和退出公会
- 公会成员能发送和刷新公会消息

如果前端提示“暂时无法连接”，通常是 `config.js` 里的 `API_BASE` 为空且静态站点没有把 `/card`、`/apis` 等接口路径反向代理到后端。请优先检查 `dist/config.js` 是否已写入后端 API 域名。

本地调试时，`localhost`、`127.0.0.1`、常见局域网 IP 和 `.local` 域名会默认连接同主机 `3000` 端口；如果后端不在这个端口，请在 `website/public/config.js` 和 `backend/public/config.js` 中显式填写 `API_BASE`。

## 抽卡配置

抽卡配置现在是“全局默认 + 卡池单独配置”：

- 运营台“默认抽卡配置”只维护一套默认概率、UP、保底和单抽/十连价格。
- 运营台“卡池管理”中的“抽卡配置”按钮用于维护某个卡池的单独配置。
- 运营台“卡池管理”可以快速上线/下线卡池；下线后玩家端不展示，也不能继续抽取。
- 未启用单独配置的卡池会继承全局默认。
- 数据库仍使用 `gacha_pool_config` 表：`pool_id=0` 表示全局默认，`pool_id>0` 表示单个卡池覆盖。

## 玩法规划 TODO

- [x] P0 第一阶段：卡片收藏锁定、保底进度展示、抽卡历史详情
- [x] P1 每日/每周任务、活跃度奖励
- [x] P2 卡片养成、阵容编队、轻量 PVE 玩法
- [x] P3 赛季系统、赛季商店、活动排行
- [x] P4 第一阶段：玩家主页、卡片展示墙
- [x] P5 第一阶段：好友申请与好友列表
- [x] P5 第二阶段：好友动态
- [x] P5 第三阶段：公会基础
- [x] P5 第四阶段：公会聊天
- [x] P6 第一阶段：公告栏

## 卡片养成、阵容编队与 PVE

P2 已完成第一步：玩家背包卡片支持养成等级、累计投入经验与战力展示。养成消耗该卡片对应碎片，每次提升 1 级；不同稀有度有不同等级上限、碎片消耗和战力成长。锁定、挂售和已达到等级上限的卡片不能继续养成。

P2 已完成第二步：玩家端新增阵容编队，可在 3 个固定位置上阵已拥有卡片并汇总总战力。接口为 `GET /formation` 和 `PUT /formation`；同一张卡不能重复上阵，挂售中的卡片不能上阵，锁定卡允许上阵。

P2 已完成第三步：玩家端新增轻量 PVE 关卡，使用当前阵容总战力挑战运营台配置的关卡。接口为 `GET /pve/stages`、`POST /pve/stages/:id/challenge` 和 `GET /pve/records`；挑战胜利自动发放关卡奖励并写入星穹币流水，失败记录挑战结果但不发奖励。运营台可在“PVE 关卡”配置敌方战力、推荐战力、每日次数、开放时间和胜利奖励，并在“PVE 记录”审计玩家挑战结果。

## 赛季系统

P3 已完成：运营台可配置赛季周期、赛季商店和活动排行。玩家领取任务奖励时会同步获得赛季积分，累计获得积分用于活动排行，可用积分用于赛季商店兑换奖励。

玩家端新增“赛季”入口，展示当前赛季、累计积分、可用积分、赛季积分榜、赛季商店和最近积分记录。赛季商店奖励沿用通用奖励格式，支持星穹币、物品和卡片奖励；发放星穹币时会写入来源为“赛季商店”的星穹币流水。

运营台新增“赛季配置”“赛季商店”“赛季积分记录”“赛季兑换记录”四个入口，用于管理赛季开关、商店库存/限兑/奖励，以及审计玩家积分和兑换行为。

## 玩家主页与展示墙

P4 第一阶段已完成：玩家端新增“主页”入口，登录后可查看自己的公开主页、复制公开链接，并从背包中手动选择 1-6 张卡片加入展示墙。公开主页地址为 `/u/:publicId`，展示玩家昵称、头像、卡片统计、阵容战力和展示墙卡片，旧 `/u/:uid` 地址保留兼容。

接口为 `GET /profile/me`、`PUT /profile/showcase` 和 `GET /profile/:publicId`。公开主页不返回真实账号标识、星穹币余额、运营权限标记等敏感字段；展示墙只保存玩家已拥有且未删除的卡片，卡面继续支持图片和视频。

## 好友系统

P5 第一阶段已完成：玩家端新增“好友”入口，登录后可查看好友、收到的申请和发出的申请。公开主页可向其他玩家发起好友申请并显示好友状态；好友页支持通过、拒绝、取消申请和删除好友。好友页、排行榜和赛季积分榜可跳转玩家公开主页。

接口为 `GET /friends`、`POST /friends/requests`、`POST /friends/requests/:id/accept`、`POST /friends/requests/:id/reject`、`DELETE /friends/requests/:id` 和 `DELETE /friends/:uid`。好友公开跳转使用公开编号；同一对玩家只保留一条关系记录，避免双向重复申请。

P5 第二阶段已完成：玩家端好友页新增“好友动态”，展示已添加好友的公开动态。当前会记录添加好友、更新展示墙、卡片养成和通关关卡四类事件。接口为 `GET /friends/feed`，只返回已添加好友的动态，不返回动态元数据和敏感字段。

## 公会系统

P5 第三阶段已完成：玩家端新增“公会”入口，登录后可创建公会、查看当前公会成员、加入已有公会和退出公会。每名玩家同一时间只能加入一个公会；会长退出且仍有成员时，会长身份自动转给最早加入的成员；最后一名成员退出时公会解散。

接口为 `GET /guilds/me`、`GET /guilds`、`POST /guilds`、`POST /guilds/:id/join` 和 `DELETE /guilds/me`。公会成员信息只返回公开昵称、头像、角色和加入时间，不返回余额、运营权限标记等敏感字段。

P5 第四阶段已完成：公会页新增“公会消息”，公会成员可发送短消息并刷新最近消息。接口为 `GET /guilds/me/messages` 和 `POST /guilds/me/messages`；消息只对当前公会成员开放，消息列表只返回发送者公开昵称、头像、内容和发送时间。

## 公告栏

P6 第一阶段已完成：运营台新增“公告栏”，可维护公告标题、内容、启用状态、排序和展示时间。玩家端会在页面顶部展示当前启用且处于展示时间内的公告。

接口为 `GET /announcements`；运营接口为 `GET /admin/announcements`、`GET /admin/announcements/:id`、`POST /admin/announcements`、`PATCH /admin/announcements/:id` 和 `DELETE /admin/announcements/:id`。

## 任务与活跃度

玩家端新增任务中心，包含日常与周常两类目标。任务进度会根据签到、抽卡、兑换商店、交易、合成和分解等成功记录动态统计；任务奖励领取后才会累计活跃度，达到对应档位后可领取活跃度奖励。

任务奖励和活跃度奖励会直接发放到玩家背包与星穹币账户，并写入星穹币流水，来源显示为“任务奖励”。

## 每日签到

玩家每日可签到一次。每轮 7 天循环：第 1-6 天每次奖励 10 星穹币，第 7 天奖励 100 星穹币；连续中断后重新从第 1 天开始。

如果生产环境 `DB_SYNCHRONIZE=false`，升级前需要手动补字段。创建 `public_id` 唯一索引前，确认空值统计为 0 且重复查询无结果：

```sql
ALTER TABLE pool_info ADD COLUMN enabled tinyint NOT NULL DEFAULT 1;
ALTER TABLE pool_info ADD COLUMN sort_order int NOT NULL DEFAULT 0;
ALTER TABLE recharge_config ADD COLUMN fishpi_api_key varchar(255) NOT NULL DEFAULT '';
ALTER TABLE `user` ADD COLUMN public_id varchar(32) NULL;
UPDATE `user` SET public_id = LOWER(SUBSTRING(REPLACE(UUID(), '-', ''), 1, 16)) WHERE public_id IS NULL OR public_id = '';
SELECT COUNT(*) AS empty_public_id FROM `user` WHERE public_id IS NULL OR public_id = '';
SELECT public_id, COUNT(*) AS repeat_count FROM `user` GROUP BY public_id HAVING repeat_count > 1;
CREATE UNIQUE INDEX IDX_user_public_id ON `user` (public_id);
ALTER TABLE card_item ADD COLUMN card_image varchar(500) NOT NULL DEFAULT '';
ALTER TABLE user_card ADD COLUMN locked tinyint NOT NULL DEFAULT 0;
ALTER TABLE user_card ADD COLUMN cultivation_level int NOT NULL DEFAULT 1;
ALTER TABLE user_card ADD COLUMN cultivation_exp int NOT NULL DEFAULT 0;

CREATE TABLE user_formation_slot (
  id int NOT NULL AUTO_INCREMENT,
  uid varchar(255) NOT NULL,
  position int NOT NULL,
  card_uuid varchar(80) NOT NULL,
  createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY IDX_user_formation_uid_position (uid, position),
  UNIQUE KEY IDX_user_formation_uid_card (uid, card_uuid)
);

CREATE TABLE open_id_nonce (
  id int NOT NULL AUTO_INCREMENT,
  nonce varchar(255) NOT NULL,
  expires_at datetime NOT NULL,
  createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY IDX_open_id_nonce_nonce (nonce),
  KEY IDX_open_id_nonce_expires_at (expires_at)
);

CREATE TABLE daily_sign_in_record (
  id int NOT NULL AUTO_INCREMENT,
  uid varchar(255) NOT NULL,
  sign_date varchar(10) NOT NULL,
  streak_count int NOT NULL DEFAULT 1,
  cycle_day int NOT NULL DEFAULT 1,
  reward_points int NOT NULL DEFAULT 10,
  createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY IDX_daily_sign_in_uid_date (uid, sign_date),
  KEY IDX_daily_sign_in_uid_created (uid, createdAt)
);

CREATE TABLE achievement_config (
  id int NOT NULL AUTO_INCREMENT,
  code varchar(64) NOT NULL,
  name varchar(80) NOT NULL,
  description varchar(1024) NOT NULL DEFAULT '',
  category varchar(40) NOT NULL DEFAULT '常规',
  target_type varchar(40) NOT NULL,
  target_value int NOT NULL,
  target_scope json NULL,
  rewards json NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  enabled tinyint NOT NULL DEFAULT 1,
  starts_at datetime NULL,
  ends_at datetime NULL,
  delete_flag tinyint NOT NULL DEFAULT 0,
  createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY IDX_achievement_config_code (code),
  KEY IDX_achievement_config_enabled (enabled, delete_flag)
);

CREATE TABLE user_achievement (
  id int NOT NULL AUTO_INCREMENT,
  uid varchar(255) NOT NULL,
  achievement_id int NOT NULL,
  achievement_code varchar(64) NOT NULL,
  progress int NOT NULL DEFAULT 0,
  achieved tinyint NOT NULL DEFAULT 0,
  achieved_at datetime NULL,
  reward_snapshot json NULL,
  notification_ack_at datetime NULL,
  createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY IDX_user_achievement_unique (uid, achievement_id),
  KEY IDX_user_achievement_uid_achieved (uid, achieved),
  KEY IDX_user_achievement_notification (uid, achieved, notification_ack_at)
);

CREATE TABLE achievement_event (
  id int NOT NULL AUTO_INCREMENT,
  uid varchar(255) NOT NULL,
  event_type varchar(40) NOT NULL,
  amount int NOT NULL DEFAULT 1,
  metadata json NULL,
  createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY IDX_achievement_event_uid_type (uid, event_type),
  KEY IDX_achievement_event_created (createdAt)
);

CREATE TABLE user_task_claim (
  id int NOT NULL AUTO_INCREMENT,
  uid varchar(255) NOT NULL,
  scope varchar(20) NOT NULL,
  period_key varchar(20) NOT NULL,
  claim_type varchar(20) NOT NULL,
  target_key varchar(80) NOT NULL,
  activity_points int NOT NULL DEFAULT 0,
  reward_snapshot json NOT NULL,
  createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY IDX_user_task_claim_unique (uid, scope, period_key, claim_type, target_key),
  KEY IDX_user_task_claim_period (uid, scope, period_key)
);

CREATE TABLE pve_stage (
  id int NOT NULL AUTO_INCREMENT,
  name varchar(80) NOT NULL,
  description varchar(1024) NOT NULL DEFAULT '',
  enemy_power int NOT NULL DEFAULT 100,
  recommended_power int NOT NULL DEFAULT 100,
  daily_limit int NOT NULL DEFAULT 3,
  rewards json NOT NULL,
  enabled tinyint NOT NULL DEFAULT 1,
  sort_order int NOT NULL DEFAULT 0,
  starts_at datetime NULL,
  ends_at datetime NULL,
  delete_flag tinyint NOT NULL DEFAULT 0,
  createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY IDX_pve_stage_enabled_sort (enabled, sort_order)
);

CREATE TABLE pve_challenge_record (
  id int NOT NULL AUTO_INCREMENT,
  uid varchar(255) NOT NULL,
  stage_id int NOT NULL,
  stage_name varchar(80) NOT NULL,
  formation_power int NOT NULL DEFAULT 0,
  enemy_power int NOT NULL DEFAULT 0,
  success tinyint NOT NULL DEFAULT 0,
  reward_snapshot json NULL,
  createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY IDX_pve_record_uid_created (uid, createdAt),
  KEY IDX_pve_record_uid_stage_created (uid, stage_id, createdAt)
);

CREATE TABLE season_config (
  id int NOT NULL AUTO_INCREMENT,
  season_key varchar(64) NOT NULL,
  name varchar(80) NOT NULL,
  description varchar(1024) NOT NULL DEFAULT '',
  enabled tinyint NOT NULL DEFAULT 1,
  shop_enabled tinyint NOT NULL DEFAULT 1,
  leaderboard_enabled tinyint NOT NULL DEFAULT 1,
  starts_at datetime NULL,
  ends_at datetime NULL,
  delete_flag tinyint NOT NULL DEFAULT 0,
  createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY IDX_season_config_key (season_key),
  KEY IDX_season_config_visible (enabled, delete_flag)
);

CREATE TABLE user_season_progress (
  id int NOT NULL AUTO_INCREMENT,
  uid varchar(255) NOT NULL,
  season_key varchar(64) NOT NULL,
  earned_points int NOT NULL DEFAULT 0,
  point_balance int NOT NULL DEFAULT 0,
  createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY IDX_user_season_unique (uid, season_key),
  KEY IDX_user_season_rank (season_key, earned_points)
);

CREATE TABLE season_point_record (
  id int NOT NULL AUTO_INCREMENT,
  uid varchar(255) NOT NULL,
  season_key varchar(64) NOT NULL,
  change_amount int NOT NULL,
  point_before int NOT NULL DEFAULT 0,
  point_after int NOT NULL DEFAULT 0,
  source_type varchar(40) NOT NULL,
  source_id varchar(128) NULL,
  title varchar(160) NOT NULL,
  metadata json NULL,
  createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY IDX_season_point_uid_created (uid, createdAt),
  KEY IDX_season_point_season_uid (season_key, uid)
);

CREATE TABLE season_shop_item (
  id int NOT NULL AUTO_INCREMENT,
  season_key varchar(64) NOT NULL,
  name varchar(255) NOT NULL,
  description varchar(1024) NOT NULL DEFAULT '',
  enabled tinyint NOT NULL DEFAULT 1,
  cost_points int NOT NULL DEFAULT 1,
  rewards json NOT NULL,
  total_limit int NULL,
  used_count int NOT NULL DEFAULT 0,
  user_limit int NULL,
  starts_at datetime NULL,
  ends_at datetime NULL,
  sort_order int NOT NULL DEFAULT 0,
  delete_flag tinyint NOT NULL DEFAULT 0,
  createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY IDX_season_shop_visible (season_key, delete_flag, enabled)
);

CREATE TABLE season_shop_usage (
  id int NOT NULL AUTO_INCREMENT,
  shop_item_id int NOT NULL,
  shop_item_name varchar(255) NOT NULL,
  season_key varchar(64) NOT NULL,
  uid varchar(255) NOT NULL,
  count int NOT NULL DEFAULT 1,
  cost_points int NOT NULL DEFAULT 0,
  reward_snapshot json NOT NULL,
  createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY IDX_season_shop_usage_uid (uid),
  KEY IDX_season_shop_usage_item_user (shop_item_id, uid),
  KEY IDX_season_shop_usage_season (season_key, uid)
);

CREATE TABLE user_showcase_card (
  id int NOT NULL AUTO_INCREMENT,
  uid varchar(255) NOT NULL,
  position int NOT NULL,
  card_uuid varchar(80) NOT NULL,
  createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY IDX_user_showcase_uid_position (uid, position),
  UNIQUE KEY IDX_user_showcase_uid_card (uid, card_uuid)
);

CREATE TABLE user_friend (
  id int NOT NULL AUTO_INCREMENT,
  requester_uid varchar(255) NOT NULL,
  receiver_uid varchar(255) NOT NULL,
  relation_key varchar(520) NOT NULL,
  status varchar(255) NOT NULL DEFAULT 'pending',
  responded_at datetime NULL,
  createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY IDX_user_friend_relation_key (relation_key),
  KEY IDX_user_friend_requester_status (requester_uid, status),
  KEY IDX_user_friend_receiver_status (receiver_uid, status)
);

CREATE TABLE user_social_activity (
  id int NOT NULL AUTO_INCREMENT,
  actor_uid varchar(255) NOT NULL,
  activity_type varchar(40) NOT NULL,
  title varchar(80) NOT NULL,
  summary varchar(160) NOT NULL DEFAULT '',
  metadata json NULL,
  createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY IDX_user_social_activity_actor_created (actor_uid, createdAt),
  KEY IDX_user_social_activity_type_created (activity_type, createdAt)
);

CREATE TABLE guild (
  id int NOT NULL AUTO_INCREMENT,
  name varchar(24) NOT NULL,
  description varchar(80) NOT NULL DEFAULT '',
  owner_uid varchar(255) NOT NULL,
  member_count int NOT NULL DEFAULT 1,
  createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY IDX_guild_name (name),
  KEY IDX_guild_owner_uid (owner_uid)
);

CREATE TABLE guild_member (
  id int NOT NULL AUTO_INCREMENT,
  guild_id int NOT NULL,
  uid varchar(255) NOT NULL,
  role varchar(20) NOT NULL DEFAULT 'member',
  joinedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY IDX_guild_member_uid (uid),
  UNIQUE KEY IDX_guild_member_guild_uid (guild_id, uid),
  KEY IDX_guild_member_guild_joined (guild_id, joinedAt)
);

CREATE TABLE guild_message (
  id int NOT NULL AUTO_INCREMENT,
  guild_id int NOT NULL,
  sender_uid varchar(255) NOT NULL,
  content varchar(160) NOT NULL,
  createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY IDX_guild_message_guild_created (guild_id, createdAt),
  KEY IDX_guild_message_sender_created (sender_uid, createdAt)
);

CREATE TABLE announcement (
  id int NOT NULL AUTO_INCREMENT,
  title varchar(40) NOT NULL,
  content varchar(160) NOT NULL DEFAULT '',
  enabled tinyint NOT NULL DEFAULT 1,
  sort_order int NOT NULL DEFAULT 0,
  starts_at datetime NULL,
  ends_at datetime NULL,
  delete_flag tinyint NOT NULL DEFAULT 0,
  createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY IDX_announcement_visible (enabled, delete_flag, sort_order)
);
```

`point_ledger_record.source_type` 是 `varchar` 字段，新增“赛季商店”来源不需要额外 SQL。

## 运营权限

运营台使用现有 JWT 登录体系，并要求用户具备运营权限：

- 用户表中 `is_admin = true`
- `ADMIN_UIDS` 仅保留为配置展示，不作为运营权限放行依据

## 相关文档

- 登录接口：`system/src/apis/readme_apis.md`
- 抽卡接口：`system/src/card/README_GACHA.md`
- JWT 使用：`system/src/auth/README_JWT.md`
- 配置说明：`system/src/config/README.md`
