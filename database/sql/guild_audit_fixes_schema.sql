-- 公会审计问题修复字段与索引

ALTER TABLE `guild_member`
  ADD COLUMN IF NOT EXISTS `weekly_contribution_key` varchar(8) NULL;

SET @guild_current_week := YEARWEEK(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR), 3);

UPDATE `guild_member`
SET `weekly_contribution_key` = CONCAT(
  LEFT(@guild_current_week, 4),
  '-W',
  RIGHT(@guild_current_week, 2)
)
WHERE `weekly_contribution_key` IS NULL;

ALTER TABLE `guild_join_request`
  ADD COLUMN IF NOT EXISTS `pending_key` varchar(16) NULL;

UPDATE `guild_join_request`
SET `pending_key` = CASE WHEN `status` = 'pending' THEN 'pending' ELSE NULL END;

UPDATE `guild_join_request` request
JOIN (
  SELECT `guild_id`, `uid`, MIN(`id`) AS keep_id
  FROM `guild_join_request`
  WHERE `status` = 'pending'
  GROUP BY `guild_id`, `uid`
  HAVING COUNT(*) > 1
) duplicated
  ON duplicated.`guild_id` = request.`guild_id`
  AND duplicated.`uid` = request.`uid`
SET request.`status` = 'canceled',
    request.`pending_key` = NULL
WHERE request.`status` = 'pending'
  AND request.`id` <> duplicated.`keep_id`;

SET @guild_pending_index_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'guild_join_request'
    AND index_name = 'IDX_guild_join_request_pending_unique'
);

SET @guild_pending_index_sql := IF(
  @guild_pending_index_exists = 0,
  'CREATE UNIQUE INDEX `IDX_guild_join_request_pending_unique` ON `guild_join_request` (`guild_id`, `uid`, `pending_key`)',
  'SELECT 1'
);

PREPARE guild_pending_index_stmt FROM @guild_pending_index_sql;
EXECUTE guild_pending_index_stmt;
DEALLOCATE PREPARE guild_pending_index_stmt;
