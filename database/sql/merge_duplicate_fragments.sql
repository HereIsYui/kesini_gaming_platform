-- ============================================================
-- 碎片去重合并脚本
-- ============================================================
-- 问题：数据库中存在两套重复碎片
--   旧套（带空格名称，无 default_fragment）：'通用碎片'/'N 碎片'/'R 碎片'/'SR 碎片'/'SSR 碎片'
--   新套（无空格名称，id 6 为 default_fragment）：'通用碎片'/'N碎片'/'R碎片'/'SR碎片'/'SSR碎片'
-- 目标：把旧套库存合并到新套，禁用旧套，使背包只显示一套碎片
--
-- 保留新套，理由：
--   1. 新套通用碎片是系统默认碎片（default_fragment=1），findFragmentItem 默认返回它
--   2. PVE 关卡奖励引用新套
--   3. 旧套仅存在于老用户历史库存
--
-- 执行前务必备份数据库！
-- ============================================================

-- ============================================================
-- 第一步：诊断查询（只读，先执行确认现状）
-- 取消下面注释单独运行，确认无误后再执行迁移
-- ============================================================

-- 查看所有碎片类物品（drop_type=0）
-- SELECT id, drop_name, drop_desc, disabled, default_fragment, createdAt
-- FROM drop_item WHERE drop_type = 0 ORDER BY id;

-- 查看每种碎片的库存分布
-- SELECT di.id, di.drop_name, di.default_fragment, di.disabled,
--        COUNT(inv.id) AS holder_count, COALESCE(SUM(inv.num), 0) AS total_num
-- FROM drop_item di
-- LEFT JOIN user_inventory inv ON inv.item_id = di.id
-- WHERE di.drop_type = 0
-- GROUP BY di.id ORDER BY di.id;

-- 查看卡片 drop_item 字段是否引用了旧碎片 id（需人工核对返回的 id）
-- SELECT id, card_name, drop_item FROM card_item
-- WHERE drop_item IS NOT NULL AND drop_item <> '';

-- 查看兑换商店是否引用旧碎片 id
-- SELECT id, itemId FROM exchange_shop_item;

-- 查看兑换码是否引用旧碎片 id
-- SELECT id, itemId FROM redeem_code;

-- 查看分解配置（JSON 中的 itemId）
-- SELECT * FROM config WHERE `key` = 'decomposeConfig';


-- ============================================================
-- 第二步：执行合并迁移（事务包裹，可回滚）
-- ============================================================

START TRANSACTION;

-- ------------------------------------------------------------
-- 通用碎片：旧 '通用碎片'(default_fragment=0) → 新 '通用碎片'(default_fragment=1)
-- ------------------------------------------------------------
SET @old_id := (SELECT id FROM drop_item
  WHERE drop_name = '通用碎片' AND default_fragment = 0 AND drop_type = 0
  ORDER BY id ASC LIMIT 1);
SET @new_id := (SELECT id FROM drop_item
  WHERE drop_name = '通用碎片' AND default_fragment = 1 AND drop_type = 0
  ORDER BY id ASC LIMIT 1);

-- 1) 用户同时持有新旧两种：累加旧数量到新
UPDATE user_inventory inv_new
JOIN user_inventory inv_old
  ON inv_new.user_id = inv_old.user_id
SET inv_new.num = inv_new.num + inv_old.num
WHERE inv_new.item_id = @new_id AND inv_old.item_id = @old_id
  AND @old_id IS NOT NULL AND @new_id IS NOT NULL;

-- 2) 删除已被累加的旧记录
DELETE inv_old FROM user_inventory inv_old
JOIN user_inventory inv_new
  ON inv_new.user_id = inv_old.user_id AND inv_new.item_id = @new_id
WHERE inv_old.item_id = @old_id
  AND @old_id IS NOT NULL AND @new_id IS NOT NULL;

-- 3) 仅持有旧的：直接改指向新套
UPDATE user_inventory
SET item_id = @new_id
WHERE item_id = @old_id
  AND @old_id IS NOT NULL AND @new_id IS NOT NULL;

-- ------------------------------------------------------------
-- N 碎片：旧 'N 碎片' → 新 'N碎片'
-- ------------------------------------------------------------
SET @old_id := (SELECT id FROM drop_item
  WHERE drop_name = 'N 碎片' AND drop_type = 0 ORDER BY id ASC LIMIT 1);
SET @new_id := (SELECT id FROM drop_item
  WHERE drop_name = 'N碎片' AND drop_type = 0 ORDER BY id ASC LIMIT 1);

UPDATE user_inventory inv_new
JOIN user_inventory inv_old ON inv_new.user_id = inv_old.user_id
SET inv_new.num = inv_new.num + inv_old.num
WHERE inv_new.item_id = @new_id AND inv_old.item_id = @old_id
  AND @old_id IS NOT NULL AND @new_id IS NOT NULL;

DELETE inv_old FROM user_inventory inv_old
JOIN user_inventory inv_new
  ON inv_new.user_id = inv_old.user_id AND inv_new.item_id = @new_id
WHERE inv_old.item_id = @old_id
  AND @old_id IS NOT NULL AND @new_id IS NOT NULL;

UPDATE user_inventory SET item_id = @new_id
WHERE item_id = @old_id AND @old_id IS NOT NULL AND @new_id IS NOT NULL;

-- ------------------------------------------------------------
-- R 碎片：旧 'R 碎片' → 新 'R碎片'
-- ------------------------------------------------------------
SET @old_id := (SELECT id FROM drop_item
  WHERE drop_name = 'R 碎片' AND drop_type = 0 ORDER BY id ASC LIMIT 1);
SET @new_id := (SELECT id FROM drop_item
  WHERE drop_name = 'R碎片' AND drop_type = 0 ORDER BY id ASC LIMIT 1);

UPDATE user_inventory inv_new
JOIN user_inventory inv_old ON inv_new.user_id = inv_old.user_id
SET inv_new.num = inv_new.num + inv_old.num
WHERE inv_new.item_id = @new_id AND inv_old.item_id = @old_id
  AND @old_id IS NOT NULL AND @new_id IS NOT NULL;

DELETE inv_old FROM user_inventory inv_old
JOIN user_inventory inv_new
  ON inv_new.user_id = inv_old.user_id AND inv_new.item_id = @new_id
WHERE inv_old.item_id = @old_id
  AND @old_id IS NOT NULL AND @new_id IS NOT NULL;

UPDATE user_inventory SET item_id = @new_id
WHERE item_id = @old_id AND @old_id IS NOT NULL AND @new_id IS NOT NULL;

-- ------------------------------------------------------------
-- SR 碎片：旧 'SR 碎片' → 新 'SR碎片'
-- ------------------------------------------------------------
SET @old_id := (SELECT id FROM drop_item
  WHERE drop_name = 'SR 碎片' AND drop_type = 0 ORDER BY id ASC LIMIT 1);
SET @new_id := (SELECT id FROM drop_item
  WHERE drop_name = 'SR碎片' AND drop_type = 0 ORDER BY id ASC LIMIT 1);

UPDATE user_inventory inv_new
JOIN user_inventory inv_old ON inv_new.user_id = inv_old.user_id
SET inv_new.num = inv_new.num + inv_old.num
WHERE inv_new.item_id = @new_id AND inv_old.item_id = @old_id
  AND @old_id IS NOT NULL AND @new_id IS NOT NULL;

DELETE inv_old FROM user_inventory inv_old
JOIN user_inventory inv_new
  ON inv_new.user_id = inv_old.user_id AND inv_new.item_id = @new_id
WHERE inv_old.item_id = @old_id
  AND @old_id IS NOT NULL AND @new_id IS NOT NULL;

UPDATE user_inventory SET item_id = @new_id
WHERE item_id = @old_id AND @old_id IS NOT NULL AND @new_id IS NOT NULL;

-- ------------------------------------------------------------
-- SSR 碎片：旧 'SSR 碎片' → 新 'SSR碎片'
-- ------------------------------------------------------------
SET @old_id := (SELECT id FROM drop_item
  WHERE drop_name = 'SSR 碎片' AND drop_type = 0 ORDER BY id ASC LIMIT 1);
SET @new_id := (SELECT id FROM drop_item
  WHERE drop_name = 'SSR碎片' AND drop_type = 0 ORDER BY id ASC LIMIT 1);

UPDATE user_inventory inv_new
JOIN user_inventory inv_old ON inv_new.user_id = inv_old.user_id
SET inv_new.num = inv_new.num + inv_old.num
WHERE inv_new.item_id = @new_id AND inv_old.item_id = @old_id
  AND @old_id IS NOT NULL AND @new_id IS NOT NULL;

DELETE inv_old FROM user_inventory inv_old
JOIN user_inventory inv_new
  ON inv_new.user_id = inv_old.user_id AND inv_new.item_id = @new_id
WHERE inv_old.item_id = @old_id
  AND @old_id IS NOT NULL AND @new_id IS NOT NULL;

UPDATE user_inventory SET item_id = @new_id
WHERE item_id = @old_id AND @old_id IS NOT NULL AND @new_id IS NOT NULL;

-- ------------------------------------------------------------
-- 软禁用旧套碎片（保留记录，符合系统"禁用后历史保留"设计）
-- 旧套特征：drop_type=0，名称带空格 或 通用碎片非 default_fragment
-- ------------------------------------------------------------
UPDATE drop_item
SET disabled = 1
WHERE drop_type = 0
  AND disabled = 0
  AND (
    drop_name IN ('N 碎片', 'R 碎片', 'SR 碎片', 'SSR 碎片')
    OR (drop_name = '通用碎片' AND default_fragment = 0)
  );

-- ============================================================
-- 第三步：验证（执行后检查，确认无误再 COMMIT）
-- ============================================================
-- 检查旧套是否还有库存（应为空）
-- SELECT inv.item_id, di.drop_name, SUM(inv.num)
-- FROM user_inventory inv JOIN drop_item di ON di.id = inv.item_id
-- WHERE di.disabled = 1 AND di.drop_type = 0
-- GROUP BY inv.item_id;

-- 检查新套库存
-- SELECT di.id, di.drop_name, COUNT(inv.id) AS holders, SUM(inv.num) AS total
-- FROM drop_item di LEFT JOIN user_inventory inv ON inv.item_id = di.id
-- WHERE di.drop_type = 0 AND di.disabled = 0
-- GROUP BY di.id;

-- 确认无误后提交；如有问题执行 ROLLBACK;
COMMIT;

-- ============================================================
-- 第四步：手动处理引用（需根据诊断结果决定）
-- ============================================================
-- 若卡片 drop_item / 兑换商店 / 兑换码 / 分解配置 引用了旧碎片 id，
-- 需手动替换为对应的新碎片 id。例如（假设旧 N 碎片 id=2，新 N 碎片 id=7）：
--
-- 兑换商店：
--   UPDATE exchange_shop_item SET itemId = 7 WHERE itemId = 2;
-- 兑换码：
--   UPDATE redeem_code SET itemId = 7 WHERE itemId = 2;
-- 卡片 drop_item 字段（格式 'id,概率,数量;...'）需逐个核对替换。
-- 分解配置 decomposeConfig（JSON）若手动配过旧 id，需在管理后台重新配置。
