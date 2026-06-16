# 摸鱼派扩展集成文档

## 功能说明

本项目已集成[摸鱼派扩展集市](https://ext.adventext.fun/)，支持加载和运行摸鱼派社区的用户脚本和主题。

**每个用户使用自己在摸鱼派扩展集市安装的扩展**，实现个性化定制。

## 工作原理

1. 用户通过摸鱼派 OpenID 登录游戏平台
2. 系统获取用户的摸鱼派 oId（用户唯一标识）
3. 自动加载 `https://ext.adventext.fun/api/items/<用户oId>/loader.js`
4. loader.js 加载该用户在扩展集市安装的所有扩展
5. 扩展在浏览器中运行，增强用户体验

## 使用步骤

### 1. 登录游戏平台

使用摸鱼派账号登录游戏平台（OpenID 登录）

### 2. 安装扩展

1. 访问 [摸鱼派扩展集市](https://ext.adventext.fun/)
2. 使用同一个摸鱼派账号登录
3. 浏览并安装你喜欢的扩展

### 3. 刷新页面

重新加载游戏平台页面，扩展会自动生效

## 配置选项

编辑 `website/public/config.js`：

```javascript
window.__KESINI_CONFIG__ = {
  API_BASE: "",
  ENABLE_MANUAL_LOGIN: false,
  // 摸鱼派扩展开关
  FISHPI_EXTENSION_OID: true,  // true = 启用，false = 禁用
};
```

### 禁用扩展

如果不想使用扩展功能：

```javascript
FISHPI_EXTENSION_OID: false,
```

## 支持的功能

### GM API

- `GM_xmlhttpRequest` - HTTP 请求（不支持跨域）
- `GM_setValue` / `GM_getValue` / `GM_deleteValue` / `GM_listValues` - 本地存储
- `GM_addStyle` - 动态添加 CSS
- `GM_registerMenuCommand` - 注册菜单命令

### 扩展专属 API

- `fishpi` - 摸鱼派 API 对象（需要适配为游戏 API）
- `cloudStorage` - 云端存储（用户绑定）
- `globalStorage` - 全局存储（扩展绑定）
- `msgbox` - 消息框（alert/confirm/prompt）

## 推荐扩展

由于游戏平台和摸鱼派功能差异，建议优先尝试：

1. **CSS 主题** - 纯样式扩展，兼容性最好
   - 主题类扩展通常不依赖特定 API
   - 可以美化界面、改变配色方案

2. **UI 美化** - 界面增强类扩展
   - 按钮样式优化
   - 布局调整
   - 动画效果

3. **工具类** - 不依赖摸鱼派 API 的功能
   - 数据统计
   - 快捷键支持
   - 界面增强

## 注意事项

### ⚠️ 安全性

- 扩展可以执行任意 JavaScript 代码
- 只安装你信任的扩展
- 审查扩展源码（在扩展集市可查看）
- 如果发现可疑扩展，立即在集市中禁用

### ⚠️ 兼容性

- 摸鱼派扩展是为摸鱼派网站设计的
- 依赖 `fishpi` API 的扩展无法在游戏平台正常工作
- 部分扩展可能与游戏平台样式冲突
- 如果遇到问题，可以在扩展集市禁用相关扩展

### ⚠️ 性能

- 过多扩展会影响页面加载速度
- 建议只安装必需的扩展
- 定期清理不用的扩展

### ⚠️ 隐私

- 扩展可以访问页面上的所有数据
- 云端存储的数据保存在扩展集市服务器
- 谨慎安装需要网络权限的扩展

## 故障排除

### 扩展没有加载

1. 检查浏览器控制台（F12）是否有错误信息
2. 确认已经通过摸鱼派 OpenID 登录
3. 确认配置文件中 `FISHPI_EXTENSION_OID` 不是 `false`
4. 检查网络连接，确保可以访问 `ext.adventext.fun`

### 扩展不工作

1. 检查扩展是否依赖 `fishpi` API（这类扩展无法在游戏平台工作）
2. 在扩展集市查看扩展详情和说明
3. 尝试禁用其他扩展，排查冲突
4. 清除浏览器缓存后重试

### 页面样式错乱

1. 可能是某个 CSS 主题与游戏平台冲突
2. 逐个禁用扩展，找出问题扩展
3. 在扩展集市反馈问题

## 开发扩展

如果你想为游戏平台开发专属扩展：

1. 访问 [扩展开发文档](https://github.com/FishPiOffical/extension)
2. 了解扩展 API 和开发规范
3. 开发时测试兼容性
4. 发布到扩展集市供其他用户使用

### 游戏平台特性

- DOM 结构与摸鱼派不同
- 没有 `fishpi` API，不要依赖它
- 可以使用游戏平台的公开接口（需要研究网络请求）

## 相关链接

- [摸鱼派扩展集市](https://ext.adventext.fun/)
- [摸鱼派官网](https://fishpi.cn/)
- [扩展开发文档](https://github.com/FishPiOffical/extension)

## 技术实现

如果你是开发者，想了解技术细节：

- 扩展加载代码在 `website/src/App.vue` 的 `watch(currentUser.uid)` 中
- 使用用户的摸鱼派 oId 动态加载 loader.js
- 每个用户只加载一次，避免重复
- 加载失败不影响正常使用
