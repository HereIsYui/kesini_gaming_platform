-- Add star level for card starring.
SET @star_level_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'user_card'
    AND COLUMN_NAME = 'star_level'
);

SET @star_level_sql := IF(
  @star_level_exists = 0,
  'ALTER TABLE `user_card` ADD COLUMN `star_level` int NOT NULL DEFAULT 0',
  'SELECT 1'
);

PREPARE star_level_stmt FROM @star_level_sql;
EXECUTE star_level_stmt;
DEALLOCATE PREPARE star_level_stmt;

UPDATE `user_card`
SET `star_level` = 0
WHERE `star_level` IS NULL;
