-- 关卡星核奖励原地更新脚本
-- 不重建 pve_stage，不改变关卡 id。
-- 仅更新当前启用的星域远征 Boss 关奖励。

DROP TEMPORARY TABLE IF EXISTS `_kesini_pve_star_core_targets`;
CREATE TEMPORARY TABLE `_kesini_pve_star_core_targets` (
  `n` INT NOT NULL PRIMARY KEY,
  `star_core_num` INT NOT NULL
) ENGINE=MEMORY;

INSERT INTO `_kesini_pve_star_core_targets` (`n`, `star_core_num`) VALUES
(60, 80),
(120, 100),
(130, 25),
(140, 30),
(150, 35),
(160, 40),
(170, 45),
(180, 120),
(190, 55),
(200, 150);

START TRANSACTION;

INSERT INTO `drop_item`
(`drop_name`, `drop_desc`, `drop_type`, `drop_item_type`, `drop_item_value`, `disabled`, `default_fragment`, `createdAt`)
SELECT '通用碎片', '全局默认卡片碎片', 0, 0, 0, 0, 1, NOW(6)
WHERE NOT EXISTS (
  SELECT 1 FROM `drop_item`
  WHERE `drop_type` = 0 AND `disabled` = 0 AND `default_fragment` = 1
);

INSERT INTO `drop_item`
(`drop_name`, `drop_desc`, `drop_type`, `drop_item_type`, `drop_item_value`, `disabled`, `default_fragment`, `createdAt`)
SELECT 'N碎片', 'N卡合成碎片', 0, 0, 0, 0, 0, NOW(6)
WHERE NOT EXISTS (
  SELECT 1 FROM `drop_item`
  WHERE REPLACE(`drop_name`, ' ', '') = 'N碎片' AND `drop_type` = 0 AND `disabled` = 0
);

INSERT INTO `drop_item`
(`drop_name`, `drop_desc`, `drop_type`, `drop_item_type`, `drop_item_value`, `disabled`, `default_fragment`, `createdAt`)
SELECT 'R碎片', 'R卡合成碎片', 0, 0, 0, 0, 0, NOW(6)
WHERE NOT EXISTS (
  SELECT 1 FROM `drop_item`
  WHERE REPLACE(`drop_name`, ' ', '') = 'R碎片' AND `drop_type` = 0 AND `disabled` = 0
);

INSERT INTO `drop_item`
(`drop_name`, `drop_desc`, `drop_type`, `drop_item_type`, `drop_item_value`, `disabled`, `default_fragment`, `createdAt`)
SELECT 'SR碎片', 'SR卡合成碎片', 0, 0, 0, 0, 0, NOW(6)
WHERE NOT EXISTS (
  SELECT 1 FROM `drop_item`
  WHERE REPLACE(`drop_name`, ' ', '') = 'SR碎片' AND `drop_type` = 0 AND `disabled` = 0
);

INSERT INTO `drop_item`
(`drop_name`, `drop_desc`, `drop_type`, `drop_item_type`, `drop_item_value`, `disabled`, `default_fragment`, `createdAt`)
SELECT 'SSR碎片', 'SSR卡合成碎片', 0, 0, 0, 0, 0, NOW(6)
WHERE NOT EXISTS (
  SELECT 1 FROM `drop_item`
  WHERE REPLACE(`drop_name`, ' ', '') = 'SSR碎片' AND `drop_type` = 0 AND `disabled` = 0
);

INSERT INTO `drop_item`
(`drop_name`, `drop_desc`, `drop_type`, `drop_item_type`, `drop_item_value`, `disabled`, `default_fragment`, `createdAt`)
SELECT '星核结晶', 'UR卡养成材料', 0, 0, 0, 0, 0, NOW(6)
WHERE NOT EXISTS (
  SELECT 1 FROM `drop_item`
  WHERE REPLACE(`drop_name`, ' ', '') = '星核结晶' AND `drop_type` = 0 AND `disabled` = 0
);

SET @default_fragment_item_id := (
  SELECT `id` FROM `drop_item`
  WHERE `drop_type` = 0 AND `disabled` = 0 AND `default_fragment` = 1
  ORDER BY `id` ASC LIMIT 1
);
SET @n_fragment_item_id := (
  SELECT `id` FROM `drop_item`
  WHERE REPLACE(`drop_name`, ' ', '') = 'N碎片' AND `drop_type` = 0 AND `disabled` = 0
  ORDER BY `id` ASC LIMIT 1
);
SET @r_fragment_item_id := (
  SELECT `id` FROM `drop_item`
  WHERE REPLACE(`drop_name`, ' ', '') = 'R碎片' AND `drop_type` = 0 AND `disabled` = 0
  ORDER BY `id` ASC LIMIT 1
);
SET @sr_fragment_item_id := (
  SELECT `id` FROM `drop_item`
  WHERE REPLACE(`drop_name`, ' ', '') = 'SR碎片' AND `drop_type` = 0 AND `disabled` = 0
  ORDER BY `id` ASC LIMIT 1
);
SET @ssr_fragment_item_id := (
  SELECT `id` FROM `drop_item`
  WHERE REPLACE(`drop_name`, ' ', '') = 'SSR碎片' AND `drop_type` = 0 AND `disabled` = 0
  ORDER BY `id` ASC LIMIT 1
);
SET @star_core_item_id := (
  SELECT `id` FROM `drop_item`
  WHERE REPLACE(`drop_name`, ' ', '') = '星核结晶' AND `drop_type` = 0 AND `disabled` = 0
  ORDER BY `id` ASC LIMIT 1
);

UPDATE `pve_stage` AS s
JOIN `_kesini_pve_star_core_targets` AS t
  ON t.`n` = ((s.`chapter` - 1) * 10 + s.`stage_no`)
SET
  s.`rewards` = JSON_OBJECT(
    'points',
    CASE
      WHEN t.`n` = 200 THEN 520
      WHEN t.`n` IN (60, 120, 180) THEN 260
      WHEN s.`stage_no` = 10 THEN 90 + s.`chapter` * 5
      ELSE 10 + FLOOR(t.`n` / 10) * 5
    END,
    'items',
    JSON_ARRAY(
      JSON_OBJECT(
        'itemId',
        CASE
          WHEN t.`n` >= 170 THEN @ssr_fragment_item_id
          WHEN t.`n` >= 120 THEN @sr_fragment_item_id
          WHEN t.`n` >= 60 THEN @r_fragment_item_id
          ELSE @n_fragment_item_id
        END,
        'num',
        CASE
          WHEN t.`n` = 200 THEN 8
          WHEN t.`n` IN (60, 120, 180) THEN 5
          WHEN s.`stage_no` = 10 THEN 3
          ELSE 1
        END
      ),
      JSON_OBJECT(
        'itemId',
        @default_fragment_item_id,
        'num',
        CASE
          WHEN t.`n` = 200 THEN 80
          WHEN t.`n` IN (60, 120, 180) THEN 40
          WHEN s.`stage_no` = 10 THEN 10
          ELSE 2
        END
      ),
      JSON_OBJECT('itemId', @star_core_item_id, 'num', t.`star_core_num`)
    )
  ),
  s.`updatedAt` = NOW(6)
WHERE s.`name` LIKE '星域远征 %'
  AND s.`delete_flag` = 0
  AND s.`enabled` = 1;

COMMIT;

SELECT
  COUNT(*) AS patched_pve_stage_rewards,
  SUM(t.`star_core_num`) AS total_star_core_rewards
FROM `pve_stage` AS s
JOIN `_kesini_pve_star_core_targets` AS t
  ON t.`n` = ((s.`chapter` - 1) * 10 + s.`stage_no`)
WHERE s.`name` LIKE '星域远征 %'
  AND s.`delete_flag` = 0
  AND s.`enabled` = 1;

DROP TEMPORARY TABLE IF EXISTS `_kesini_pve_star_core_targets`;
