# 更新记录

本文件记录项目功能阶段、历史变更和生产升级 SQL。README 仅保留项目使用、部署和配置说明。

## 玩法规划

- [x] P0 第一阶段：卡片收藏锁定、保底进度展示、抽卡历史详情
- [x] P1 每日/每周任务、活跃度奖励
- [x] P2 卡片养成、阵容编队、轻量关卡玩法
- [x] P3 赛季系统、赛季商店、活动排行
- [x] P4 第一阶段：玩家主页、卡片展示墙
- [x] P5 第一阶段：好友申请与好友列表
- [x] P5 第二阶段：好友动态
- [x] P5 第三阶段：公会基础
- [x] P5 第四阶段：公会聊天
- [x] P5 第五阶段：公会公告
- [x] P6 第一阶段：公告栏
- [x] P6 第二阶段：公告列表、详情和已读状态
- [x] P7 第一阶段：玩家消息中心
- [x] P7 第二阶段：消息奖励领取
- [x] P7 第三阶段：消息有效期
- [x] P8 第一阶段：玩家本机设置
- [x] P8 第二阶段：新卡标记
- [x] P8 第三阶段：新卡已看状态
- [x] P8 第四阶段：背包新卡筛选
- [x] P9 第一阶段：卡片详情统一
- [x] P9 第二阶段：详情操作联动
- [x] P9 第三阶段：关键操作确认弹窗
- [x] P9 第四阶段：详情操作状态回流
- [x] P9 第五阶段：弹窗交互收口
- [x] P9 第六阶段：弹窗焦点管理

## 卡片养成、阵容编队与关卡挑战

P2 已完成第一步：玩家背包卡片支持养成等级、累计投入经验与战力展示。养成消耗该卡片对应碎片，每次提升 1 级；不同稀有度有不同等级上限、碎片消耗和战力成长。锁定、挂售和已达到等级上限的卡片不能继续养成。

P2 已完成第二步：玩家端新增阵容编队，可在 3 个固定位置上阵已拥有卡片并汇总总战力。接口为 `GET /formation` 和 `PUT /formation`；同一张卡不能重复上阵，挂售中的卡片不能上阵，锁定卡允许上阵。

P2 已完成第三步：玩家端新增轻量关卡挑战，使用当前阵容总战力挑战运营台配置的关卡。接口为 `GET /pve/stages`、`POST /pve/stages/:id/challenge` 和 `GET /pve/records`；挑战胜利自动发放关卡奖励并写入星穹币流水，失败记录挑战结果但不发奖励。运营台可在“关卡管理”配置敌方战力、推荐战力、每日次数、开放时间和胜利奖励，并在“挑战记录”审计玩家挑战结果。

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

P5 第五阶段已完成：公会页新增独立“公会公告”，会长可编辑公告，成员只读展示。接口为 `PATCH /guilds/me/announcement`；公告只返回给当前公会成员和公会列表，不包含敏感字段。

## 公告栏

P6 第一阶段已完成：运营台新增“公告栏”，可维护公告标题、内容、启用状态、排序和展示时间。玩家端会在页面顶部展示当前启用且处于展示时间内的公告。

P6 第二阶段已完成：玩家端公告支持列表和详情，可标记已读并关闭顶部公告。关闭状态保存在本地，不影响其他设备；已结束但启用的公告仍可在公告列表中查看。

接口为 `GET /announcements`；运营接口为 `GET /admin/announcements`、`GET /admin/announcements/:id`、`POST /admin/announcements`、`PATCH /admin/announcements/:id` 和 `DELETE /admin/announcements/:id`。

## 玩家消息

P7 第一阶段已完成：运营台新增“玩家消息”，可发送全员或单个玩家消息。玩家端登录卡片新增“消息”入口，可查看消息并标记已读。

P7 第二阶段已完成：玩家消息支持奖励，运营台可配置星穹币、物品和卡片奖励。玩家端消息页可领取奖励，每条消息每名玩家只能领取一次，包含星穹币时写入星穹币流水并刷新资产。

P7 第三阶段已完成：玩家消息支持开始时间和结束时间。未开始和已结束的消息不会进入玩家消息列表，也不能继续标记已读或领取奖励。

接口为 `GET /messages`、`POST /messages/:id/read` 和 `POST /messages/:id/claim`；运营接口为 `GET /admin/player-messages`、`GET /admin/player-messages/:id`、`POST /admin/player-messages`、`PATCH /admin/player-messages/:id` 和 `DELETE /admin/player-messages/:id`。

## 玩家设置

P8 第一阶段已完成：玩家端登录卡片新增“设置”入口，可调整主题、动效和成就提醒。设置保存在当前浏览器，不新增后端接口和数据库字段。

P8 第二阶段已完成：玩家端卡片展示新增 `NEW` 标记。抽卡结果默认显示 `NEW`，背包、展示墙选择、阵容和公开展示中 48 小时内获得的卡片会显示 `NEW`。

P8 第三阶段已完成：玩家端会在本机记录已查看的新卡。点开背包卡片、选择展示墙卡片或上阵卡片后，对应 `NEW` 标记会在本机消失；同一分组再次获得新卡后会重新显示。

P8 第四阶段已完成：玩家背包新增“新卡”筛选，按最近 48 小时获得的卡片展示；本机已看状态只影响 `NEW` 标记，不影响筛选结果。

## 卡片详情

P9 第一阶段已完成：玩家端统一卡片详情弹窗。背包、展示墙、阵容、交易、图鉴和抽卡结果可查看同一套卡片信息，包含卡面、稀有度、类型、卡池、获得时间、养成、战力、数量、状态和价格等信息。

P9 第二阶段已完成：卡片详情支持按来源显示操作。背包卡片可在详情中锁定、养成、挂售、回收和分享；交易卡可购买；图鉴卡可合成。背包卡片点击后直接打开详情，减少卡片上的操作挤压。

P9 第三阶段已完成：玩家端关键操作改为站内确认弹窗。购买、合成、批量分解、取消挂售和退出公会不再使用浏览器原生确认框，弹窗会跟随深色和白色主题展示。

P9 第四阶段已完成：卡片相关操作改为按需刷新状态。锁定、养成、合成、回收、挂售、撤销挂售和购买成功后，会同步背包、图鉴、阵容、主页、交易列表、流水和余额等相关数据，并保留当前筛选、加载位置和交易页签。

P9 第五阶段已完成：玩家端弹窗交互统一收口。确认、分享、卡片详情、挂售、养成、回收、抽卡结果等弹窗打开时会锁定页面滚动，按 Esc 会关闭当前最上层弹窗。

P9 第六阶段已完成：玩家端弹窗新增焦点管理。弹窗打开后焦点会进入当前弹窗，Tab 会在弹窗内部循环，弹窗关闭后会回到打开前的操作位置。

## 交易购买与关卡扫荡

已修复交易购买时被“保留最后一张卡”二次拦截的问题。挂售创建仍保留最后一张保护，已上架的有效挂单可正常成交。

关卡页新增下一关定位和 VIP 扫荡。进入关卡页或刷新时会定位到首个未通关关卡所在页；VIP 玩家可扫荡当前页已通关关卡，扫荡只发重复奖励并记录为扫荡结算。

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
ALTER TABLE card_item ADD COLUMN enabled tinyint NOT NULL DEFAULT 1;
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
  announcement varchar(160) NOT NULL DEFAULT '',
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

-- 已执行 P5 第三阶段 SQL 的环境补充以下字段
ALTER TABLE guild ADD COLUMN announcement varchar(160) NOT NULL DEFAULT '';

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

CREATE TABLE player_message (
  id int NOT NULL AUTO_INCREMENT,
  title varchar(40) NOT NULL,
  content varchar(240) NOT NULL DEFAULT '',
  target_uid varchar(255) NOT NULL DEFAULT '',
  rewards json NULL,
  starts_at datetime NULL,
  ends_at datetime NULL,
  enabled tinyint NOT NULL DEFAULT 1,
  delete_flag tinyint NOT NULL DEFAULT 0,
  createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY IDX_player_message_visible (enabled, delete_flag, id),
  KEY IDX_player_message_target (target_uid, enabled, delete_flag)
);

CREATE TABLE player_message_read (
  id int NOT NULL AUTO_INCREMENT,
  uid varchar(255) NOT NULL,
  message_id int NOT NULL,
  claimed_at datetime NULL,
  reward_snapshot json NULL,
  createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY IDX_player_message_read_unique (uid, message_id),
  KEY IDX_player_message_read_uid (uid, createdAt)
);

-- 已执行 P7 第一阶段 SQL 的环境补充以下字段
ALTER TABLE player_message ADD COLUMN rewards json NULL;
ALTER TABLE player_message_read ADD COLUMN claimed_at datetime NULL;
ALTER TABLE player_message_read ADD COLUMN reward_snapshot json NULL;

-- 已执行 P7 第二阶段 SQL 的环境补充以下字段
ALTER TABLE player_message ADD COLUMN starts_at datetime NULL;
ALTER TABLE player_message ADD COLUMN ends_at datetime NULL;

-- 已有 pve_challenge_record 表的环境补充以下字段
ALTER TABLE pve_challenge_record
  ADD COLUMN mode varchar(16) NOT NULL DEFAULT 'challenge';

CREATE INDEX IDX_pve_record_uid_mode_created
  ON pve_challenge_record (uid, mode, createdAt);
```

P8 第一阶段到第四阶段不需要生产 SQL。

`point_ledger_record.source_type` 是 `varchar` 字段，新增“赛季商店”和“消息奖励”来源不需要额外 SQL。
