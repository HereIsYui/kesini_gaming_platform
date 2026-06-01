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

登录口令入口只在本地开发默认显示。生产环境默认隐藏；确需启用时，在对应 `dist/config.js` 中设置 `ENABLE_MANUAL_LOGIN: true`，或构建前设置 `VITE_ENABLE_MANUAL_LOGIN=true`、`PUBLIC_ENABLE_MANUAL_LOGIN=true`。

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
- 生产环境玩家前端和运营台不显示“登录口令”
- OAuth 登录跳转到 FishPi 时，URL 中的 `openid.return_to` 是当前前端 HTTPS 域名
- OAuth 回调后前端能调用 `POST /apis/login` 完成登录
- 重复提交同一个 OAuth 回调会返回 `登录已失效`
- 玩家端登录、抽卡、背包、交易、主页等核心页面可访问
- 运营台登录、卡池、卡片、公告、消息等核心页面可访问
- 上传素材可通过 `/file/...` 访问，图片和视频卡面能正常显示
- 需要验证历史功能时，按 [CHANGELOG.md](./CHANGELOG.md) 中对应阶段执行

如果前端提示“暂时无法连接”，通常是 `config.js` 里的 `API_BASE` 为空且静态站点没有把 `/card`、`/apis` 等接口路径反向代理到后端。请优先检查 `dist/config.js` 是否已写入后端 API 域名。

本地调试时，`localhost`、`127.0.0.1`、常见局域网 IP 和 `.local` 域名会默认连接同主机 `3000` 端口；如果后端不在这个端口，请在 `website/public/config.js` 和 `backend/public/config.js` 中显式填写 `API_BASE`。

## 抽卡配置

抽卡配置现在是“全局默认 + 卡池单独配置”：

- 运营台“默认抽卡配置”只维护一套默认概率、UP、保底和单抽/十连价格。
- 运营台“卡池管理”中的“抽卡配置”按钮用于维护某个卡池的单独配置。
- 运营台“卡池管理”可以快速上线/下线卡池；下线后玩家端不展示，也不能继续抽取。
- 运营台“卡片管理”可以单独上架/下架卡片；下架后不进入当期抽卡、卡池详情和图鉴，玩家已拥有卡片不受影响。
- 未启用单独配置的卡池会继承全局默认。
- 数据库仍使用 `gacha_pool_config` 表：`pool_id=0` 表示全局默认，`pool_id>0` 表示单个卡池覆盖。

## 更新记录

功能阶段、历史变更和生产升级 SQL 已移动到 [CHANGELOG.md](./CHANGELOG.md)。

## 运营权限

运营台使用现有 JWT 登录体系，并要求用户具备运营权限：

- 用户表中 `is_admin = true`
- `ADMIN_UIDS` 仅保留为配置展示，不作为运营权限放行依据

## 相关文档

- 更新记录：`CHANGELOG.md`
- 登录接口：`system/src/apis/readme_apis.md`
- 抽卡接口：`system/src/card/README_GACHA.md`
- JWT 使用：`system/src/auth/README_JWT.md`
- 配置说明：`system/src/config/README.md`
