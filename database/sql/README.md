# 数据库脚本说明

当前 PVE 主线关卡使用 `pve_stages_200.sql`。
线上已有通关记录时，不要重跑 `pve_stages_200.sql`；关卡星核奖励使用 `pve_stage_star_core_reward_patch.sql` 原地更新。
登录领取式补偿先执行 `compensation_grant_schema.sql` 建表，再导入运营生成的补偿名单。
充值比例和抽卡价格调整使用 `recharge_ratio_and_draw_costs.sql`。
星核结晶与分解默认产出调整使用 `star_core_crystal_and_decompose_config.sql`。
`deprecated/` 目录仅保留历史脚本，不用于部署导入。
