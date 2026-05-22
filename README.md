# Kesini Gaming Platform

抽卡游戏平台工作区，包含 NestJS API 服务、玩家前端和后台管理台。

## 项目结构

- `system/`：NestJS 后端 API，包含登录、抽卡、卡池、资产、交易、充值和后台管理接口。
- `website/`：Vue 玩家前端，使用 Vite 构建。
- `backend/`：React 后台管理台，使用 Rsbuild 构建。

## 端口和地址

- API 服务默认端口：`7001`，可通过 `system/.env` 的 `PORT` 覆盖。
- 玩家前端本地开发端口：`7002`。
- 前后端分域部署时，只需要给前端配置 API 地址：
  - 玩家前端：`VITE_API_BASE=https://api.example.com`
  - 后台管理台：`PUBLIC_API_BASE=https://api.example.com`
- OAuth 回跳地址不需要配置环境变量。前端会直接读取当前浏览器域名生成 `returnTo` 和 `realm`。
- 生产环境 OAuth 回跳地址必须是 HTTPS；不要把后端 API 域名当作 OAuth 回跳域名。

## 本地开发

```bash
npm install
npm run system:dev
npm run website:dev
npm run backend:dev
```

本地默认访问：

- API：`http://localhost:7001`
- 玩家前端：`http://localhost:7002`
- 后台管理台：以 `backend/rsbuild.config.ts` 中的 `server.port` 为准

如果同时启动 API 和后台管理台时端口冲突，请先调整 `backend/rsbuild.config.ts` 的开发端口；生产部署不依赖该开发端口。

## 生产环境配置

### 后端 API

在 `system/.env` 中配置：

```bash
NODE_ENV=production
PORT=7001

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

### 玩家前端

在构建 `website` 前设置：

```bash
VITE_API_BASE=https://api.example.com
```

### 后台管理台

在构建 `backend` 前设置：

```bash
PUBLIC_API_BASE=https://api.example.com
```

这些前端变量是构建时变量，部署后修改服务器环境变量不会改变已经打包出的静态文件，需要重新构建前端。

## 构建

```bash
npm install
npm run build
```

构建产物：

- API：`system/dist/`
- 玩家前端：`website/dist/`
- 后台管理台：`backend/dist/`

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
curl http://127.0.0.1:7001/
```

正常会返回：

```text
Hello World!
```

## Nginx 部署示例

推荐使用三个 HTTPS 域名：

- `https://api.example.com`：反向代理到 API 服务 `127.0.0.1:7001`
- `https://web.example.com`：托管 `website/dist`
- `https://admin.example.com`：托管 `backend/dist`

示例配置：

```nginx
server {
    listen 443 ssl http2;
    server_name api.example.com;

    location / {
        proxy_pass http://127.0.0.1:7001;
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

    location / {
        try_files $uri $uri/ /index.html;
    }
}

server {
    listen 443 ssl http2;
    server_name admin.example.com;
    root /var/www/kesini/backend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

请按你的服务器实际情况补充 SSL 证书配置。

## OAuth 部署要点

FishPi OAuth 要求：

- `openid.return_to` 必须是 HTTPS。
- `openid.realm` 必须是 `openid.return_to` 的前缀。

当前实现中：

- 玩家前端会用当前访问地址生成回跳，例如 `https://web.example.com/draw`。
- 后台管理台会用当前访问地址生成回跳，例如 `https://admin.example.com/`。
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

如果只改了前端环境变量，例如 `VITE_API_BASE` 或 `PUBLIC_API_BASE`，也必须重新构建对应前端并重新发布 `dist/`。

## 验证清单

- API：`curl https://api.example.com/` 返回 `Hello World!`
- 玩家前端能访问 `https://web.example.com`
- 后台管理台能访问 `https://admin.example.com`
- 玩家前端发起的 API 请求访问的是 `https://api.example.com`
- OAuth 登录跳转到 FishPi 时，URL 中的 `openid.return_to` 是当前前端 HTTPS 域名
- OAuth 回调后前端能调用 `POST /apis/login` 完成登录

## 抽卡配置

抽卡配置现在是“全局默认 + 卡池单独配置”：

- 后台“默认抽卡配置”只维护一套默认概率、UP、保底和单抽/十连价格。
- 后台“卡池管理”中的“抽卡配置”按钮用于维护某个卡池的单独配置。
- 后台“卡池管理”可以快速上线/下线卡池；下线后玩家端不展示，也不能继续抽取。
- 未启用单独配置的卡池会继承全局默认。
- 数据库仍使用 `gacha_pool_config` 表：`pool_id=0` 表示全局默认，`pool_id>0` 表示单个卡池覆盖。

如果生产环境 `DB_SYNCHRONIZE=false`，升级前需要手动补字段：

```sql
ALTER TABLE pool_info ADD COLUMN enabled tinyint NOT NULL DEFAULT 1;
```

## 管理员权限

后台管理台使用现有 JWT 登录体系，并要求用户具备管理员权限：

- 用户表中 `is_admin = true`
- `ADMIN_UIDS` 仅保留为配置展示，不作为后台管理权限放行依据

## 相关文档

- 登录接口：`system/src/apis/readme_apis.md`
- 抽卡接口：`system/src/card/README_GACHA.md`
- JWT 使用：`system/src/auth/README_JWT.md`
- 配置说明：`system/src/config/README.md`
