-- 登录领取式补偿表

CREATE TABLE IF NOT EXISTS `compensation_grant` (
  `id` int NOT NULL AUTO_INCREMENT,
  `batch_key` varchar(80) NOT NULL,
  `uid` varchar(255) NOT NULL,
  `user_name` varchar(255) NULL,
  `recharge_amount` int NOT NULL DEFAULT 0,
  `monthly_amount` int NOT NULL DEFAULT 0,
  `total_amount` int NOT NULL DEFAULT 0,
  `claimed` tinyint(1) NOT NULL DEFAULT 0,
  `claimed_at` datetime NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_compensation_grant_batch_uid` (`batch_key`, `uid`),
  KEY `IDX_compensation_grant_uid_claimed` (`uid`, `claimed`)
);
