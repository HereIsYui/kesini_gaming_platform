-- 充值比例与抽卡价格调整

UPDATE `recharge_config`
SET `recharge_ratio` = 1.0000
WHERE `id` = 1;

UPDATE `gacha_pool_config`
SET `single_draw_cost` = 100,
    `ten_draw_cost` = 998;
