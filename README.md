# Kesini Gaming Platform

抽卡游戏平台工作区，包含服务端与后台管理台。

## 目录

- `system/`：NestJS 后端，包含登录、抽卡、卡池、资产和后台管理 API。
- `backend/`：React 后台管理台，使用 Rsbuild 构建。

## 常用命令

```bash
npm install
npm run system:dev
npm run backend:dev
npm run build
npm run test
```

后台管理台默认连接 `http://localhost:3000`，可在登录页修改 API 地址。

## 管理员权限

后台 API 使用现有 JWT 登录体系，并要求用户具备管理员权限：

- 用户表 `is_admin = true`
- 或 `.env` 中配置 `ADMIN_UIDS=uid1,uid2`

## 文档

- 登录接口：`system/src/apis/readme_apis.md`
- 抽卡接口：`system/src/card/README_GACHA.md`
- JWT 使用：`system/src/auth/README_JWT.md`
- 配置说明：`system/src/config/README.md`
