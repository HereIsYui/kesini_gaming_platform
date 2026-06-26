-- ============================================================
-- 稀有度碎片检查与补齐脚本
-- ============================================================
-- 目标：确保合成与养成可使用 N/R/SR/SSR 对应碎片。
-- 不迁移用户库存，不合并旧碎片，不新增 UR 碎片。
-- ============================================================

-- 执行前可先查看当前启用碎片：
-- SELECT id, drop_name, disabled, default_fragment, createdAt
-- FROM drop_item
-- WHERE drop_type = 0
-- ORDER BY id;

INSERT INTO `drop_item`
(`drop_name`, `drop_desc`, `drop_type`, `drop_item_type`, `drop_item_value`, `disabled`, `default_fragment`, `createdAt`)
SELECT 'N碎片', 'N卡合成与养成碎片', 0, 0, 0, 0, 0, NOW(6)
WHERE NOT EXISTS (
  SELECT 1 FROM `drop_item`
  WHERE REPLACE(`drop_name`, ' ', '') = 'N碎片'
    AND `drop_type` = 0
    AND `disabled` = 0
);

INSERT INTO `drop_item`
(`drop_name`, `drop_desc`, `drop_type`, `drop_item_type`, `drop_item_value`, `disabled`, `default_fragment`, `createdAt`)
SELECT 'R碎片', 'R卡合成与养成碎片', 0, 0, 0, 0, 0, NOW(6)
WHERE NOT EXISTS (
  SELECT 1 FROM `drop_item`
  WHERE REPLACE(`drop_name`, ' ', '') = 'R碎片'
    AND `drop_type` = 0
    AND `disabled` = 0
);

INSERT INTO `drop_item`
(`drop_name`, `drop_desc`, `drop_type`, `drop_item_type`, `drop_item_value`, `disabled`, `default_fragment`, `createdAt`)
SELECT 'SR碎片', 'SR卡合成与养成碎片', 0, 0, 0, 0, 0, NOW(6)
WHERE NOT EXISTS (
  SELECT 1 FROM `drop_item`
  WHERE REPLACE(`drop_name`, ' ', '') = 'SR碎片'
    AND `drop_type` = 0
    AND `disabled` = 0
);

INSERT INTO `drop_item`
(`drop_name`, `drop_desc`, `drop_type`, `drop_item_type`, `drop_item_value`, `disabled`, `default_fragment`, `createdAt`)
SELECT 'SSR碎片', 'SSR卡合成与养成碎片', 0, 0, 0, 0, 0, NOW(6)
WHERE NOT EXISTS (
  SELECT 1 FROM `drop_item`
  WHERE REPLACE(`drop_name`, ' ', '') = 'SSR碎片'
    AND `drop_type` = 0
    AND `disabled` = 0
);

-- 执行后核对：
-- SELECT id, drop_name, disabled, default_fragment, createdAt
-- FROM drop_item
-- WHERE drop_type = 0
--   AND REPLACE(drop_name, ' ', '') IN ('N碎片', 'R碎片', 'SR碎片', 'SSR碎片')
-- ORDER BY drop_name, id;
