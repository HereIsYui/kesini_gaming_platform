-- PVE 战斗与卡片潜能字段
ALTER TABLE `user_card`
  ADD COLUMN IF NOT EXISTS `potential_bp` int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `potential_grade` varchar(1) NOT NULL DEFAULT 'C';

UPDATE `user_card`
SET
  `potential_bp` = CASE UPPER(COALESCE(`card_level`, ''))
    WHEN 'N' THEN MOD(CRC32(CONCAT(`card_uuid`, ':N')), 601)
    WHEN 'R' THEN MOD(CRC32(CONCAT(`card_uuid`, ':R')), 801)
    WHEN 'SR' THEN 100 + MOD(CRC32(CONCAT(`card_uuid`, ':SR')), 901)
    WHEN 'SSR' THEN 200 + MOD(CRC32(CONCAT(`card_uuid`, ':SSR')), 1001)
    WHEN 'UR' THEN 300 + MOD(CRC32(CONCAT(`card_uuid`, ':UR')), 901)
    ELSE 0
  END
WHERE `potential_bp` = 0;

UPDATE `user_card`
SET `potential_grade` = CASE
  WHEN `potential_bp` >= 1000 THEN 'S'
  WHEN `potential_bp` >= 700 THEN 'A'
  WHEN `potential_bp` >= 400 THEN 'B'
  ELSE 'C'
END;

ALTER TABLE `card_item`
  ADD COLUMN IF NOT EXISTS `battle_role` varchar(16) NOT NULL DEFAULT 'attack';

UPDATE `card_item`
SET `battle_role` = CASE
  WHEN MOD(`id`, 4) = 1 THEN 'attack'
  WHEN MOD(`id`, 4) = 2 THEN 'guard'
  WHEN MOD(`id`, 4) = 3 THEN 'support'
  ELSE 'control'
END
WHERE `battle_role` IS NULL OR `battle_role` = '' OR `battle_role` = 'attack';

ALTER TABLE `pve_stage`
  ADD COLUMN IF NOT EXISTS `chapter` int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS `stage_no` int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS `boss_type` varchar(16) NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS `boss_name` varchar(32) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS `battle_config` json NULL,
  ADD COLUMN IF NOT EXISTS `star_rewards` json NULL;

ALTER TABLE `pve_challenge_record`
  ADD COLUMN IF NOT EXISTS `stars` int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `battle_report` json NULL,
  ADD COLUMN IF NOT EXISTS `formation_snapshot` json NULL;
