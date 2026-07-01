-- 顶部商城商品与购买记录

CREATE TABLE IF NOT EXISTS `shop_product` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` varchar(1024) NOT NULL DEFAULT '',
  `enabled` tinyint(1) NOT NULL DEFAULT 1,
  `currency_type` varchar(24) NOT NULL DEFAULT 'star_coin',
  `price` int NOT NULL DEFAULT 1,
  `rewards` json NOT NULL,
  `total_limit` int NULL,
  `used_count` int NOT NULL DEFAULT 0,
  `user_limit` int NULL,
  `daily_limit` int NULL,
  `weekly_limit` int NULL,
  `monthly_limit` int NULL,
  `starts_at` datetime NULL,
  `ends_at` datetime NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `delete_flag` tinyint(1) NOT NULL DEFAULT 0,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `IDX_shop_product_visible` (`delete_flag`, `enabled`)
);

CREATE TABLE IF NOT EXISTS `shop_purchase_record` (
  `id` int NOT NULL AUTO_INCREMENT,
  `request_id` varchar(80) NOT NULL,
  `product_id` int NOT NULL,
  `product_name` varchar(255) NOT NULL,
  `uid` varchar(255) NOT NULL,
  `fishpi_user_name` varchar(255) NULL,
  `count` int NOT NULL DEFAULT 1,
  `currency_type` varchar(24) NOT NULL,
  `unit_price` int NOT NULL,
  `cost_amount` int NOT NULL,
  `reward_snapshot` json NOT NULL,
  `status` varchar(32) NOT NULL DEFAULT 'pending',
  `balance_before` int NOT NULL DEFAULT 0,
  `balance_after` int NOT NULL DEFAULT 0,
  `date_key` varchar(10) NULL,
  `week_key` varchar(10) NULL,
  `month_key` varchar(7) NULL,
  `third_party_response` json NULL,
  `failure_reason` text NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_shop_purchase_request` (`uid`, `request_id`),
  KEY `IDX_shop_purchase_product_user` (`product_id`, `uid`),
  KEY `IDX_shop_purchase_uid_status` (`uid`, `status`),
  KEY `IDX_shop_purchase_daily_limit` (`product_id`, `uid`, `status`, `date_key`),
  KEY `IDX_shop_purchase_weekly_limit` (`product_id`, `uid`, `status`, `week_key`),
  KEY `IDX_shop_purchase_monthly_limit` (`product_id`, `uid`, `status`, `month_key`),
  KEY `IDX_shop_purchase_created` (`createdAt`)
);

-- 兼容已执行过旧版商城脚本的数据库
SET @schema_name = DATABASE();

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'shop_product' AND COLUMN_NAME = 'daily_limit') = 0,
  'ALTER TABLE `shop_product` ADD COLUMN `daily_limit` int NULL AFTER `user_limit`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'shop_product' AND COLUMN_NAME = 'weekly_limit') = 0,
  'ALTER TABLE `shop_product` ADD COLUMN `weekly_limit` int NULL AFTER `daily_limit`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'shop_product' AND COLUMN_NAME = 'monthly_limit') = 0,
  'ALTER TABLE `shop_product` ADD COLUMN `monthly_limit` int NULL AFTER `weekly_limit`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'shop_purchase_record' AND COLUMN_NAME = 'date_key') = 0,
  'ALTER TABLE `shop_purchase_record` ADD COLUMN `date_key` varchar(10) NULL AFTER `balance_after`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'shop_purchase_record' AND COLUMN_NAME = 'week_key') = 0,
  'ALTER TABLE `shop_purchase_record` ADD COLUMN `week_key` varchar(10) NULL AFTER `date_key`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'shop_purchase_record' AND COLUMN_NAME = 'month_key') = 0,
  'ALTER TABLE `shop_purchase_record` ADD COLUMN `month_key` varchar(7) NULL AFTER `week_key`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'shop_purchase_record' AND INDEX_NAME = 'IDX_shop_purchase_daily_limit') = 0,
  'CREATE INDEX `IDX_shop_purchase_daily_limit` ON `shop_purchase_record` (`product_id`, `uid`, `status`, `date_key`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'shop_purchase_record' AND INDEX_NAME = 'IDX_shop_purchase_weekly_limit') = 0,
  'CREATE INDEX `IDX_shop_purchase_weekly_limit` ON `shop_purchase_record` (`product_id`, `uid`, `status`, `week_key`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'shop_purchase_record' AND INDEX_NAME = 'IDX_shop_purchase_monthly_limit') = 0,
  'CREATE INDEX `IDX_shop_purchase_monthly_limit` ON `shop_purchase_record` (`product_id`, `uid`, `status`, `month_key`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
