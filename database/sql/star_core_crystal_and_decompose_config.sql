-- 星核结晶与分解产出配置
-- 执行后：UR 养成材料可用，后台默认分解产出改为同稀有碎片 + 通用碎片 + 星核结晶。

START TRANSACTION;

INSERT INTO `drop_item`
(`drop_name`, `drop_desc`, `drop_type`, `drop_item_type`, `drop_item_value`, `disabled`, `default_fragment`, `createdAt`)
SELECT '星核结晶', 'UR卡养成材料', 0, 0, 0, 0, 0, NOW(6)
WHERE NOT EXISTS (
  SELECT 1 FROM `drop_item`
  WHERE REPLACE(`drop_name`, ' ', '') = '星核结晶' AND `drop_type` = 0 AND `disabled` = 0
);

INSERT INTO `drop_item`
(`drop_name`, `drop_desc`, `drop_type`, `drop_item_type`, `drop_item_value`, `disabled`, `default_fragment`, `createdAt`)
SELECT '通用碎片', '全局默认卡片碎片', 0, 0, 0, 0, 1, NOW(6)
WHERE NOT EXISTS (
  SELECT 1 FROM `drop_item`
  WHERE `drop_type` = 0 AND `disabled` = 0 AND `default_fragment` = 1
);

INSERT INTO `drop_item`
(`drop_name`, `drop_desc`, `drop_type`, `drop_item_type`, `drop_item_value`, `disabled`, `default_fragment`, `createdAt`)
SELECT 'N碎片', 'N卡合成与养成碎片', 0, 0, 0, 0, 0, NOW(6)
WHERE NOT EXISTS (
  SELECT 1 FROM `drop_item`
  WHERE REPLACE(`drop_name`, ' ', '') = 'N碎片' AND `drop_type` = 0 AND `disabled` = 0
);

INSERT INTO `drop_item`
(`drop_name`, `drop_desc`, `drop_type`, `drop_item_type`, `drop_item_value`, `disabled`, `default_fragment`, `createdAt`)
SELECT 'R碎片', 'R卡合成与养成碎片', 0, 0, 0, 0, 0, NOW(6)
WHERE NOT EXISTS (
  SELECT 1 FROM `drop_item`
  WHERE REPLACE(`drop_name`, ' ', '') = 'R碎片' AND `drop_type` = 0 AND `disabled` = 0
);

INSERT INTO `drop_item`
(`drop_name`, `drop_desc`, `drop_type`, `drop_item_type`, `drop_item_value`, `disabled`, `default_fragment`, `createdAt`)
SELECT 'SR碎片', 'SR卡合成与养成碎片', 0, 0, 0, 0, 0, NOW(6)
WHERE NOT EXISTS (
  SELECT 1 FROM `drop_item`
  WHERE REPLACE(`drop_name`, ' ', '') = 'SR碎片' AND `drop_type` = 0 AND `disabled` = 0
);

INSERT INTO `drop_item`
(`drop_name`, `drop_desc`, `drop_type`, `drop_item_type`, `drop_item_value`, `disabled`, `default_fragment`, `createdAt`)
SELECT 'SSR碎片', 'SSR卡合成与养成碎片', 0, 0, 0, 0, 0, NOW(6)
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
SET @star_core_item_id := (
  SELECT `id` FROM `drop_item`
  WHERE REPLACE(`drop_name`, ' ', '') = '星核结晶' AND `drop_type` = 0 AND `disabled` = 0
  ORDER BY `id` ASC LIMIT 1
);

INSERT INTO `system_config` (`key`, `value`, `description`)
VALUES (
  'decomposeConfig',
  JSON_OBJECT(
    'rules',
    JSON_OBJECT(
      'N',
      JSON_OBJECT(
        'drops',
        JSON_ARRAY(
          JSON_OBJECT('itemId', @n_fragment_item_id, 'min', 8, 'max', 12),
          JSON_OBJECT('itemId', @default_fragment_item_id, 'min', 1, 'max', 2)
        )
      ),
      'R',
      JSON_OBJECT(
        'drops',
        JSON_ARRAY(
          JSON_OBJECT('itemId', @r_fragment_item_id, 'min', 12, 'max', 20),
          JSON_OBJECT('itemId', @default_fragment_item_id, 'min', 3, 'max', 5)
        )
      ),
      'SR',
      JSON_OBJECT(
        'drops',
        JSON_ARRAY(
          JSON_OBJECT('itemId', @sr_fragment_item_id, 'min', 24, 'max', 40),
          JSON_OBJECT('itemId', @default_fragment_item_id, 'min', 6, 'max', 10),
          JSON_OBJECT('itemId', @star_core_item_id, 'min', 1, 'max', 2)
        )
      ),
      'SSR',
      JSON_OBJECT(
        'drops',
        JSON_ARRAY(
          JSON_OBJECT('itemId', @ssr_fragment_item_id, 'min', 70, 'max', 110),
          JSON_OBJECT('itemId', @default_fragment_item_id, 'min', 12, 'max', 20),
          JSON_OBJECT('itemId', @star_core_item_id, 'min', 8, 'max', 12)
        )
      )
    )
  ),
  '卡片分解默认产出配置'
)
ON DUPLICATE KEY UPDATE
  `value` = VALUES(`value`),
  `description` = VALUES(`description`),
  `updatedAt` = NOW(6);

COMMIT;
