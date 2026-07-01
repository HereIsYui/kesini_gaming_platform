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
  `third_party_response` json NULL,
  `failure_reason` text NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_shop_purchase_request` (`uid`, `request_id`),
  KEY `IDX_shop_purchase_product_user` (`product_id`, `uid`),
  KEY `IDX_shop_purchase_uid_status` (`uid`, `status`),
  KEY `IDX_shop_purchase_created` (`createdAt`)
);
