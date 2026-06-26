-- Kesini 星域远征 200 关导入脚本
-- 20 章，每章 10 关；每章第 10 关为小 Boss；60/120/180 为大 Boss；200 为最终 Boss。
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

UPDATE `pve_stage`
SET `enabled` = 0, `delete_flag` = 1, `updatedAt` = NOW(6)
WHERE `name` LIKE '星域远征 %';

INSERT INTO `pve_stage`
(`name`, `description`, `enemy_power`, `recommended_power`, `daily_limit`, `rewards`,
 `chapter`, `stage_no`, `boss_type`, `boss_name`, `battle_config`, `star_rewards`,
 `enabled`, `sort_order`, `starts_at`, `ends_at`, `delete_flag`, `createdAt`, `updatedAt`)
WITH RECURSIVE seq AS (
  SELECT 1 AS n
  UNION ALL
  SELECT n + 1 FROM seq WHERE n < 200
),
base AS (
  SELECT
    n,
    CEIL(n / 10) AS chapter,
    ((n - 1) % 10) + 1 AS stage_no,
    ROUND(260 + POW((n - 1) / 199, 1.35) * (24000 - 260)) AS base_power
  FROM seq
),
staged AS (
  SELECT
    n,
    chapter,
    stage_no,
    CASE
      WHEN n = 200 THEN 'final'
      WHEN n IN (60, 120, 180) THEN 'major'
      WHEN stage_no = 10 THEN 'minor'
      ELSE 'none'
    END AS boss_type,
    CASE
      WHEN n = 200 THEN 'Yui'
      WHEN n IN (60, 120, 180) OR stage_no = 10 THEN ELT(MOD(n * 7 + 3, 11) + 1, '阿达', '老王', '午安', '勾月', 'Yui', '跳跳', '墨夏', '哀酱', '白猫', 'ipwz', '涛之雨')
      ELSE ''
    END AS boss_name,
    CASE
      WHEN n = 200 THEN 26000
      WHEN n IN (60, 120, 180) THEN ROUND(base_power * 1.35)
      WHEN stage_no = 10 THEN ROUND(base_power * 1.18)
      ELSE base_power
    END AS enemy_power,
    CASE
      WHEN chapter = 1 THEN JSON_ARRAY()
      WHEN chapter = 2 THEN JSON_ARRAY('high_attack')
      WHEN chapter = 3 THEN JSON_ARRAY('thick_hp')
      WHEN chapter = 4 THEN JSON_ARRAY('dodge')
      WHEN chapter = 5 THEN JSON_ARRAY('shield')
      WHEN chapter = 6 THEN JSON_ARRAY('berserk')
      WHEN chapter = 7 THEN JSON_ARRAY('lockdown')
      WHEN chapter = 8 THEN JSON_ARRAY('high_attack', 'thick_hp')
      WHEN chapter = 9 THEN JSON_ARRAY('dodge')
      WHEN chapter = 10 THEN JSON_ARRAY('shield', 'berserk')
      WHEN chapter = 11 THEN JSON_ARRAY('high_attack', 'lockdown')
      WHEN chapter = 12 THEN JSON_ARRAY('thick_hp', 'shield')
      WHEN chapter = 13 THEN JSON_ARRAY('dodge', 'berserk')
      WHEN chapter = 14 THEN JSON_ARRAY('high_attack', 'shield')
      WHEN chapter = 15 THEN JSON_ARRAY('thick_hp', 'lockdown')
      WHEN chapter = 16 THEN JSON_ARRAY('dodge', 'high_attack')
      WHEN chapter = 17 THEN JSON_ARRAY('berserk', 'lockdown')
      WHEN chapter = 18 THEN JSON_ARRAY('thick_hp', 'dodge')
      WHEN chapter = 19 THEN JSON_ARRAY('high_attack', 'berserk', 'shield')
      ELSE JSON_ARRAY('high_attack', 'thick_hp', 'dodge')
    END AS traits
  FROM base
)
SELECT
  CONCAT('星域远征 ', LPAD(n, 3, '0')) AS name,
  CONCAT('第', chapter, '章-', LPAD(stage_no, 2, '0')) AS description,
  enemy_power,
  enemy_power,
  3,
  JSON_OBJECT(
    'points',
    CASE
      WHEN boss_type = 'final' THEN 520
      WHEN boss_type = 'major' THEN 260
      WHEN boss_type = 'minor' THEN 90 + chapter * 5
      ELSE 10 + FLOOR(n / 10) * 5
    END,
    'items',
    JSON_ARRAY(
      JSON_OBJECT(
        'itemId',
        CASE
          WHEN n >= 170 THEN @ssr_fragment_item_id
          WHEN n >= 120 THEN @sr_fragment_item_id
          WHEN n >= 60 THEN @r_fragment_item_id
          ELSE @n_fragment_item_id
        END,
        'num',
        CASE
          WHEN boss_type = 'final' THEN 8
          WHEN boss_type = 'major' THEN 5
          WHEN boss_type = 'minor' THEN 3
          ELSE 1
        END
      ),
      JSON_OBJECT(
        'itemId',
        @default_fragment_item_id,
        'num',
        CASE
          WHEN boss_type = 'final' THEN 80
          WHEN boss_type = 'major' THEN 40
          WHEN boss_type = 'minor' THEN 10
          ELSE 2
        END
      )
    )
  ),
  chapter,
  stage_no,
  boss_type,
  boss_name,
  JSON_OBJECT(
    'traits', traits,
    'enemyHp', ROUND(enemy_power * CASE WHEN boss_type = 'none' THEN 1.7 ELSE 1.95 END),
    'enemyAttack', ROUND(enemy_power * CASE WHEN boss_type = 'none' THEN 0.34 ELSE 0.39 END),
    'roundLimit', 8,
    'boss', boss_type <> 'none'
  ),
  JSON_OBJECT(
    'points', CASE WHEN boss_type = 'none' THEN 5 ELSE 15 END,
    'items', JSON_ARRAY()
  ),
  1,
  1000 + n,
  NULL,
  NULL,
  0,
  NOW(6),
  NOW(6)
FROM staged;

COMMIT;

SELECT COUNT(*) AS imported_pve_stages
FROM `pve_stage`
WHERE `name` LIKE '星域远征 %' AND `delete_flag` = 0;
