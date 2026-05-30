import type { AchievementTargetType, FieldConfig, SelectOption } from "./types";

export type PageKey =
  | "dashboard"
  | "users"
  | "pools"
  | "cards"
  | "drop-items"
  | "histories"
  | "inventories"
  | "pity"
  | "redeem-codes"
  | "redeem-usages"
  | "exchange-shop"
  | "exchange-usages"
  | "announcements"
  | "launch-activity-config"
  | "launch-activity-claims"
  | "achievements"
  | "user-achievements"
  | "seasons"
  | "season-shop-items"
  | "season-point-records"
  | "season-shop-usages"
  | "pve-stages"
  | "pve-records"
  | "trade-config"
  | "trade-listings"
  | "trade-records"
  | "recharge-config"
  | "recharge-records"
  | "shop-recycle-config"
  | "decompose-config"
  | "site-config"
  | "gacha-config";

export type NavGroup =
  | "工作台"
  | "内容配置"
  | "玩家资产"
  | "运营工具"
  | "交易与支付"
  | "系统配置";

export const defaultPageKey: PageKey = "dashboard";

export const pageKeys: PageKey[] = [
  "dashboard",
  "users",
  "pools",
  "cards",
  "drop-items",
  "histories",
  "inventories",
  "pity",
  "redeem-codes",
  "redeem-usages",
  "exchange-shop",
  "exchange-usages",
  "announcements",
  "launch-activity-config",
  "launch-activity-claims",
  "achievements",
  "user-achievements",
  "seasons",
  "season-shop-items",
  "season-point-records",
  "season-shop-usages",
  "pve-stages",
  "pve-records",
  "trade-config",
  "trade-listings",
  "trade-records",
  "recharge-config",
  "recharge-records",
  "shop-recycle-config",
  "decompose-config",
  "site-config",
  "gacha-config",
];

export const navGroups: NavGroup[] = [
  "工作台",
  "内容配置",
  "玩家资产",
  "运营工具",
  "交易与支付",
  "系统配置",
];

export const routeAliases: Record<string, PageKey> = {
  config: "gacha-config",
  trade: "trade-listings",
  recharge: "recharge-records",
  pve: "pve-stages",
};

export const rarityOptions: SelectOption[] = [
  { label: "N", value: "N" },
  { label: "R", value: "R" },
  { label: "SR", value: "SR" },
  { label: "SSR", value: "SSR" },
  { label: "UR", value: "UR" },
];

export const booleanOptions: SelectOption[] = [
  { label: "否", value: false },
  { label: "是", value: true },
];

export const enabledOptions: SelectOption[] = [
  { label: "启用", value: true },
  { label: "停用", value: false },
];

export const poolTypeOptions: SelectOption[] = [
  { label: "常驻卡池", value: 0 },
  { label: "活动卡池", value: 1 },
  { label: "限定卡池", value: 2 },
];

export const cardTypeOptions: SelectOption[] = [
  { label: "普通卡", value: 0 },
  { label: "限定卡", value: 1 },
  { label: "纪念卡", value: 2 },
  { label: "活动卡", value: 3 },
  { label: "隐藏卡", value: 4 },
];

export const dropTypeOptions: SelectOption[] = [
  { label: "卡片碎片", value: 0 },
  { label: "星穹币", value: 1 },
  { label: "普通道具", value: 2 },
  { label: "其他", value: 3 },
];

export const achievementTargetOptions: Array<{
  label: string;
  value: AchievementTargetType;
}> = [
  { label: "总抽数", value: "total_draws" },
  { label: "指定稀有度抽取数", value: "rarity_draws" },
  { label: "当前持有卡片数", value: "owned_cards" },
  { label: "指定稀有度持有数", value: "rarity_owned_cards" },
  { label: "集齐卡池数", value: "completed_pools" },
  { label: "累计充值星穹币", value: "recharge_points" },
  { label: "兑换码次数", value: "redeem_count" },
  { label: "兑换商店次数", value: "exchange_count" },
  { label: "买入次数", value: "trade_buy_count" },
  { label: "卖出次数", value: "trade_sell_count" },
  { label: "合成次数", value: "synthesize_count" },
  { label: "分解次数", value: "decompose_count" },
];

export const poolFields: FieldConfig[] = [
  { key: "id", label: "ID", readonly: true },
  { key: "pool_name", label: "卡池名称", placeholder: "例如：鱼排人物" },
  {
    key: "card_desc",
    label: "描述",
    type: "textarea",
    fullWidth: true,
    placeholder: "填写卡池说明",
  },
  {
    key: "card_type",
    label: "卡池类型",
    type: "select",
    options: poolTypeOptions,
    defaultValue: 0,
  },
  {
    key: "enabled",
    label: "状态",
    type: "boolean",
    options: enabledOptions,
    defaultValue: true,
  },
  { key: "sort_order", label: "排序", type: "number", defaultValue: 0 },
  { key: "gacha_config_mode", label: "抽卡配置", readonly: true },
];

export function createCardFields(poolOptions: SelectOption[]): FieldConfig[] {
  return [
    { key: "id", label: "ID", readonly: true },
    { key: "card_name", label: "卡片名称", placeholder: "例如：星辉少女" },
    {
      key: "card_image",
      label: "卡面素材",
      type: "imageUpload",
      uploadEndpoint: "/admin/uploads/card-image",
      minWidth: 120,
      formHidden: true,
    },
    {
      key: "card_level",
      label: "可出现稀有度",
      type: "multiSelect",
      options: rarityOptions,
      fullWidth: true,
      helper: "可多选，保存时会按 N/R/SR/SSR/UR 顺序写入。",
    },
    { key: "pool", label: "所属卡池", type: "select", options: poolOptions },
    {
      key: "card_type",
      label: "类型",
      type: "select",
      options: cardTypeOptions,
      defaultValue: 0,
    },
    {
      key: "card_desc",
      label: "描述",
      type: "textarea",
      fullWidth: true,
      placeholder: "填写卡片说明",
    },
    {
      key: "drop_item",
      label: "分解产出碎片",
      type: "select",
      options: [],
      helper: "留空时使用全局默认碎片。",
    },
  ];
}

export const dropFields: FieldConfig[] = [
  { key: "id", label: "ID", readonly: true },
  { key: "drop_name", label: "物品名称", placeholder: "例如：SSR碎片" },
  { key: "typeLabel", label: "物品类型", readonly: true },
  { key: "usageLabel", label: "用途说明", readonly: true },
  {
    key: "drop_type",
    label: "物品类型",
    type: "select",
    options: dropTypeOptions,
    defaultValue: 0,
  },
  {
    key: "drop_desc",
    label: "物品说明",
    type: "textarea",
    fullWidth: true,
  },
  {
    key: "default_fragment",
    label: "默认碎片",
    type: "boolean",
    options: booleanOptions,
    defaultValue: false,
  },
  {
    key: "disabled",
    label: "禁用",
    type: "boolean",
    options: booleanOptions,
    defaultValue: false,
  },
];

export const userFields: FieldConfig[] = [
  { key: "id", label: "ID", readonly: true },
  { key: "uid", label: "账号", readonly: true },
  { key: "name", label: "用户名" },
  { key: "nickname", label: "昵称" },
  { key: "point", label: "星穹币", type: "number" },
  {
    key: "is_admin",
    label: "管理",
    type: "boolean",
    options: booleanOptions,
    defaultValue: false,
  },
];

export const inventoryFields: FieldConfig[] = [
  { key: "id", label: "ID", readonly: true },
  {
    key: "user.uid",
    label: "玩家",
    readonly: true,
    minWidth: 180,
    identity: { uidKey: "user.uid", nameKey: "userName" },
  },
  { key: "item.drop_name", label: "物品", readonly: true },
  { key: "item.typeLabel", label: "类型", readonly: true },
  { key: "num", label: "数量", type: "number" },
];

export const pityFields: FieldConfig[] = [
  { key: "id", label: "ID", readonly: true },
  { key: "uid", label: "玩家", readonly: true, minWidth: 180 },
  { key: "poolName", label: "卡池", readonly: true, minWidth: 180 },
  { key: "gacha_config_mode", label: "配置来源", readonly: true },
  {
    key: "pity_overview",
    label: "保底进度",
    readonly: true,
    detailHidden: true,
    minWidth: 340,
  },
  {
    key: "draws_since_sr",
    label: "SR未出计数",
    type: "number",
    tableHidden: true,
    helper: "连续未出 SR 及以上的抽数，抽到 SR/SSR/UR 后会归零。",
  },
  {
    key: "draws_since_ssr",
    label: "SSR未出计数",
    type: "number",
    tableHidden: true,
    helper: "连续未出 SSR 及以上的抽数，抽到 SSR/UR 后会归零。",
  },
  {
    key: "draws_since_ur",
    label: "UR未出计数",
    type: "number",
    tableHidden: true,
    helper: "连续未出 UR 的抽数，只有抽到 UR 后会归零。",
  },
];

export const siteConfigFields: FieldConfig[] = [
  {
    key: "websiteTitle",
    label: "玩家站标题",
    placeholder: "例如：Kesini 抽卡站",
    helper: "用于玩家端浏览器标题和页面品牌标题。",
  },
  {
    key: "adminTitle",
    label: "运营台标题",
    placeholder: "例如：Kesini 运营台",
    helper: "用于运营台标题和品牌标题。",
  },
];

export const historyFields: FieldConfig[] = [
  { key: "id", label: "ID", readonly: true },
  {
    key: "uid",
    label: "玩家",
    readonly: true,
    minWidth: 180,
    identity: { uidKey: "uid", nameKey: "userName" },
  },
  { key: "count", label: "抽数", readonly: true },
  { key: "card_levels", label: "稀有度", readonly: true },
  { key: "createdAt", label: "时间", readonly: true },
];

export const redeemCodeFields: FieldConfig[] = [
  { key: "id", label: "ID", readonly: true },
  { key: "code", label: "兑换码", placeholder: "留空可由后端生成" },
  { key: "name", label: "名称" },
  { key: "enabled", label: "状态", type: "boolean", defaultValue: true },
  { key: "total_limit", label: "总库存", type: "number" },
  { key: "starts_at", label: "开始时间", type: "datetime" },
  { key: "ends_at", label: "结束时间", type: "datetime" },
  { key: "description", label: "描述", type: "textarea", fullWidth: true },
  {
    key: "rewards",
    label: "奖励",
    type: "rewards",
    fullWidth: true,
    allowCardRewards: true,
  },
  { key: "used_count", label: "已兑换", readonly: true },
];

export const redeemUsageFields: FieldConfig[] = [
  { key: "id", label: "ID", readonly: true },
  { key: "code", label: "兑换码", readonly: true },
  {
    key: "uid",
    label: "玩家",
    readonly: true,
    minWidth: 180,
    identity: { uidKey: "uid", nameKey: "userName" },
  },
  { key: "reward_snapshot", label: "奖励", readonly: true },
  { key: "createdAt", label: "领取时间", readonly: true },
];

export const exchangeItemFields: FieldConfig[] = [
  { key: "id", label: "ID", readonly: true },
  { key: "name", label: "兑换项名称" },
  { key: "enabled", label: "状态", type: "boolean", defaultValue: true },
  { key: "total_limit", label: "总库存", type: "number" },
  { key: "user_limit", label: "单用户限兑", type: "number" },
  { key: "starts_at", label: "开始时间", type: "datetime" },
  { key: "ends_at", label: "结束时间", type: "datetime" },
  { key: "sort_order", label: "排序", type: "number", defaultValue: 0 },
  { key: "description", label: "说明", type: "textarea", fullWidth: true },
  { key: "costs", label: "消耗", type: "costs", fullWidth: true },
  { key: "rewards", label: "奖励", type: "rewards", fullWidth: true },
  { key: "used_count", label: "已兑换", readonly: true },
];

export const exchangeUsageFields: FieldConfig[] = [
  { key: "id", label: "ID", readonly: true },
  { key: "shop_item_name", label: "兑换项", readonly: true },
  {
    key: "uid",
    label: "玩家",
    readonly: true,
    minWidth: 180,
    identity: { uidKey: "uid", nameKey: "userName" },
  },
  { key: "count", label: "数量", readonly: true },
  { key: "cost_snapshot", label: "消耗快照", readonly: true },
  { key: "reward_snapshot", label: "奖励快照", readonly: true },
  { key: "createdAt", label: "兑换时间", readonly: true },
];

export const launchActivityFields: FieldConfig[] = [
  { key: "enabled", label: "活动状态", type: "boolean", defaultValue: false },
  { key: "activity_key", label: "活动批次", defaultValue: "launch-2026" },
  { key: "name", label: "活动名称", defaultValue: "开服福利" },
  { key: "starts_at", label: "开始时间", type: "datetime" },
  { key: "ends_at", label: "结束时间", type: "datetime" },
  { key: "description", label: "活动说明", type: "textarea", fullWidth: true },
  { key: "rewards", label: "奖励", type: "rewards", fullWidth: true },
];

export const announcementFields: FieldConfig[] = [
  { key: "id", label: "ID", readonly: true },
  { key: "title", label: "标题", placeholder: "例如：维护公告" },
  {
    key: "enabled",
    label: "状态",
    type: "boolean",
    defaultValue: true,
  },
  { key: "sort_order", label: "排序", type: "number", defaultValue: 0 },
  { key: "starts_at", label: "开始时间", type: "datetime" },
  { key: "ends_at", label: "结束时间", type: "datetime" },
  {
    key: "content",
    label: "内容",
    type: "textarea",
    fullWidth: true,
    placeholder: "填写公告内容",
  },
];

export const launchActivityClaimFields: FieldConfig[] = [
  { key: "id", label: "ID", readonly: true },
  { key: "activity_key", label: "活动批次", readonly: true },
  { key: "activity_name", label: "活动名称", readonly: true },
  {
    key: "uid",
    label: "玩家",
    readonly: true,
    minWidth: 180,
    identity: { uidKey: "uid", nameKey: "userName" },
  },
  { key: "reward_snapshot", label: "奖励快照", readonly: true },
  { key: "createdAt", label: "领取时间", readonly: true },
];

export const achievementFields: FieldConfig[] = [
  { key: "id", label: "ID", readonly: true },
  { key: "code", label: "成就编码" },
  { key: "name", label: "名称" },
  { key: "category", label: "分类", defaultValue: "常规" },
  {
    key: "target_type",
    label: "目标类型",
    type: "select",
    options: achievementTargetOptions,
    defaultValue: "total_draws",
  },
  { key: "target_value", label: "目标值", type: "number", defaultValue: 1 },
  {
    key: "target_scope",
    label: "目标范围",
    type: "json",
    fullWidth: true,
    helper: '例如 {"rarity":"SSR"} 或 {"poolId":1}',
  },
  { key: "sort_order", label: "排序", type: "number", defaultValue: 0 },
  { key: "enabled", label: "状态", type: "boolean", defaultValue: true },
  { key: "starts_at", label: "开始时间", type: "datetime" },
  { key: "ends_at", label: "结束时间", type: "datetime" },
  { key: "description", label: "说明", type: "textarea", fullWidth: true },
  { key: "rewards", label: "奖励", type: "rewards", fullWidth: true },
];

export const userAchievementFields: FieldConfig[] = [
  { key: "id", label: "ID", readonly: true },
  {
    key: "uid",
    label: "玩家",
    readonly: true,
    minWidth: 180,
    identity: { uidKey: "uid", nameKey: "userName" },
  },
  { key: "achievementName", label: "成就", readonly: true },
  { key: "category", label: "分类", readonly: true },
  { key: "progress", label: "进度", readonly: true },
  { key: "achieved", label: "状态", readonly: true },
  { key: "rewards", label: "奖励", readonly: true },
  { key: "achievedAt", label: "达成时间", readonly: true },
];

export const seasonFields: FieldConfig[] = [
  { key: "id", label: "ID", readonly: true },
  {
    key: "season_key",
    label: "赛季编码",
    placeholder: "例如：season-2026-s1",
    helper: "只支持字母、数字、下划线和中划线，创建后建议不要频繁修改。",
  },
  { key: "name", label: "赛季名称", placeholder: "例如：星穹远征 S1" },
  { key: "enabled", label: "赛季状态", type: "boolean", defaultValue: true },
  {
    key: "shop_enabled",
    label: "商店状态",
    type: "boolean",
    defaultValue: true,
  },
  {
    key: "leaderboard_enabled",
    label: "排行状态",
    type: "boolean",
    defaultValue: true,
  },
  { key: "starts_at", label: "开始时间", type: "datetime" },
  { key: "ends_at", label: "结束时间", type: "datetime" },
  { key: "description", label: "赛季说明", type: "textarea", fullWidth: true },
];

export function createSeasonShopItemFields(
  seasonOptions: SelectOption[],
): FieldConfig[] {
  return [
    { key: "id", label: "ID", readonly: true },
    {
      key: "season_key",
      label: "所属赛季",
      type: "select",
      options: seasonOptions,
      placeholder: "选择赛季",
    },
    { key: "name", label: "兑换项名称" },
    { key: "enabled", label: "状态", type: "boolean", defaultValue: true },
    {
      key: "cost_points",
      label: "赛季积分价格",
      type: "number",
      defaultValue: 100,
    },
    { key: "total_limit", label: "总库存", type: "number" },
    { key: "user_limit", label: "单用户限兑", type: "number" },
    { key: "starts_at", label: "开始时间", type: "datetime" },
    { key: "ends_at", label: "结束时间", type: "datetime" },
    { key: "sort_order", label: "排序", type: "number", defaultValue: 0 },
    { key: "description", label: "说明", type: "textarea", fullWidth: true },
    {
      key: "rewards",
      label: "奖励",
      type: "rewards",
      fullWidth: true,
      allowCardRewards: true,
    },
    { key: "used_count", label: "已兑换", readonly: true },
  ];
}

export const seasonPointRecordFields: FieldConfig[] = [
  { key: "id", label: "ID", readonly: true },
  { key: "season_key", label: "赛季", readonly: true },
  {
    key: "uid",
    label: "玩家",
    readonly: true,
    minWidth: 180,
    identity: { uidKey: "uid", nameKey: "userName" },
  },
  { key: "change_amount", label: "变动", readonly: true },
  { key: "point_before", label: "变动前", readonly: true },
  { key: "point_after", label: "变动后", readonly: true },
  { key: "source_type", label: "来源", readonly: true },
  { key: "title", label: "标题", readonly: true },
  { key: "metadata", label: "上下文", readonly: true, tableHidden: true },
  { key: "createdAt", label: "时间", readonly: true },
];

export const seasonShopUsageFields: FieldConfig[] = [
  { key: "id", label: "ID", readonly: true },
  { key: "season_key", label: "赛季", readonly: true },
  { key: "shop_item_name", label: "兑换项", readonly: true },
  {
    key: "uid",
    label: "玩家",
    readonly: true,
    minWidth: 180,
    identity: { uidKey: "uid", nameKey: "userName" },
  },
  { key: "count", label: "数量", readonly: true },
  { key: "cost_points", label: "消耗赛季积分", readonly: true },
  { key: "reward_snapshot", label: "奖励快照", readonly: true },
  { key: "createdAt", label: "兑换时间", readonly: true },
];

export const pveStageFields: FieldConfig[] = [
  { key: "id", label: "ID", readonly: true },
  { key: "name", label: "关卡名称", placeholder: "例如：星港巡逻" },
  { key: "enabled", label: "状态", type: "boolean", defaultValue: true },
  {
    key: "enemy_power",
    label: "敌方战力",
    type: "number",
    defaultValue: 100,
  },
  {
    key: "recommended_power",
    label: "推荐战力",
    type: "number",
    defaultValue: 100,
  },
  {
    key: "daily_limit",
    label: "每日次数",
    type: "number",
    defaultValue: 3,
  },
  { key: "sort_order", label: "排序", type: "number", defaultValue: 0 },
  { key: "starts_at", label: "开始时间", type: "datetime" },
  { key: "ends_at", label: "结束时间", type: "datetime" },
  { key: "description", label: "说明", type: "textarea", fullWidth: true },
  {
    key: "rewards",
    label: "胜利奖励",
    type: "rewards",
    fullWidth: true,
    allowCardRewards: true,
  },
];

export const pveRecordFields: FieldConfig[] = [
  { key: "id", label: "ID", readonly: true },
  {
    key: "uid",
    label: "玩家",
    readonly: true,
    minWidth: 180,
    identity: { uidKey: "uid", nameKey: "userName" },
  },
  { key: "stage_name", label: "关卡", readonly: true },
  { key: "success", label: "结果", readonly: true },
  { key: "formation_power", label: "阵容战力", readonly: true },
  { key: "enemy_power", label: "敌方战力", readonly: true },
  { key: "reward_snapshot", label: "奖励快照", readonly: true },
  { key: "createdAt", label: "挑战时间", readonly: true },
];

export const tradeListingFields: FieldConfig[] = [
  { key: "id", label: "ID", readonly: true },
  { key: "status", label: "状态", readonly: true },
  { key: "cardName", label: "卡片", readonly: true },
  { key: "card_level", label: "稀有度", readonly: true },
  { key: "card_uuid", label: "卡片编号", readonly: true },
  {
    key: "seller_uid",
    label: "卖家",
    readonly: true,
    minWidth: 180,
    identity: { uidKey: "seller_uid", nameKey: "sellerName" },
  },
  {
    key: "buyer_uid",
    label: "买家",
    readonly: true,
    minWidth: 180,
    identity: { uidKey: "buyer_uid", nameKey: "buyerName", fallback: "未成交" },
  },
  { key: "price", label: "价格", readonly: true },
  { key: "fee_rate", label: "手续费率", readonly: true },
  { key: "sellerIncome", label: "卖家实收", readonly: true },
  { key: "createdAt", label: "上架时间", readonly: true },
];

export const tradeRecordFields: FieldConfig[] = [
  { key: "id", label: "ID", readonly: true },
  { key: "listing_id", label: "挂单ID", readonly: true },
  { key: "cardName", label: "卡片", readonly: true },
  { key: "card_level", label: "稀有度", readonly: true },
  { key: "card_uuid", label: "卡片编号", readonly: true },
  {
    key: "seller_uid",
    label: "卖家",
    readonly: true,
    minWidth: 180,
    identity: { uidKey: "seller_uid", nameKey: "sellerName" },
  },
  {
    key: "buyer_uid",
    label: "买家",
    readonly: true,
    minWidth: 180,
    identity: { uidKey: "buyer_uid", nameKey: "buyerName", fallback: "未成交" },
  },
  { key: "price", label: "成交价", readonly: true },
  { key: "fee_amount", label: "手续费", readonly: true },
  { key: "seller_income", label: "卖家实收", readonly: true },
  { key: "createdAt", label: "成交时间", readonly: true },
];

export const tradeConfigFields: FieldConfig[] = [
  { key: "enabled", label: "交易状态", type: "boolean", defaultValue: false },
  { key: "fee_rate", label: "手续费率", type: "number", defaultValue: 0 },
  { key: "min_price", label: "最低价格", type: "number", defaultValue: 1 },
  { key: "max_price", label: "最高价格", type: "number", defaultValue: 999999 },
];

export const shopRecycleConfigFields: FieldConfig[] = [
  { key: "enabled", label: "回收状态", type: "boolean", defaultValue: true },
  { key: "priceN", label: "N 回收价", type: "number", defaultValue: 1 },
  { key: "priceR", label: "R 回收价", type: "number", defaultValue: 2 },
  { key: "priceSR", label: "SR 回收价", type: "number", defaultValue: 5 },
  { key: "priceSSR", label: "SSR 回收价", type: "number", defaultValue: 15 },
  { key: "priceUR", label: "UR 回收价", type: "number", defaultValue: 50 },
];

export const decomposeConfigFields: FieldConfig[] = [
  {
    key: "rules",
    label: "默认分解产出",
    type: "decomposeConfig",
    fullWidth: true,
    defaultValue: {
      N: { drops: [{ itemId: 0, min: 1, max: 10 }] },
      R: { drops: [{ itemId: 0, min: 10, max: 20 }] },
      SR: { drops: [{ itemId: 0, min: 20, max: 40 }] },
      SSR: { drops: [{ itemId: 0, min: 40, max: 80 }] },
    },
  },
];

export const rechargeRecordFields: FieldConfig[] = [
  { key: "id", label: "ID", readonly: true },
  { key: "statusLabel", label: "状态", readonly: true },
  {
    key: "uid",
    label: "玩家",
    readonly: true,
    minWidth: 180,
    identity: { uidKey: "uid", nameKey: "userName" },
  },
  { key: "fishpi_user_name", label: "鱼排用户名", readonly: true },
  { key: "amount", label: "到账星穹币", readonly: true },
  { key: "fishpi_cost", label: "扣除鱼排积分", readonly: true },
  { key: "point_before", label: "充值前", readonly: true },
  { key: "point_after", label: "充值后", readonly: true },
  { key: "request_id", label: "请求号", readonly: true },
  { key: "thirdPartyMsg", label: "鱼排响应", readonly: true },
  { key: "failure_reason", label: "失败原因", readonly: true },
  { key: "createdAt", label: "充值时间", readonly: true },
];

export const rechargeConfigFields: FieldConfig[] = [
  { key: "enabled", label: "充值状态", type: "boolean", defaultValue: false },
  { key: "min_amount", label: "单次最低扣除", type: "number", defaultValue: 1 },
  {
    key: "max_amount",
    label: "单次最高扣除",
    type: "number",
    defaultValue: 10000,
  },
  { key: "recharge_ratio", label: "兑换比例", type: "number", defaultValue: 1 },
  {
    key: "memo_template",
    label: "备注模板",
    type: "textarea",
    fullWidth: true,
  },
  {
    key: "gold_finger_key",
    label: "鱼排金手指密钥",
    placeholder: "留空则不修改已有密钥",
  },
];

export const probabilityTemplates: Array<{
  label: string;
  values: Record<string, number>;
}> = [
  {
    label: "均衡模板",
    values: { N: 0.4, R: 0.3, SR: 0.2, SSR: 0.08, UR: 0.02 },
  },
  {
    label: "保守高稀有",
    values: { N: 0.52, R: 0.3, SR: 0.14, SSR: 0.035, UR: 0.005 },
  },
  {
    label: "活动高稀有",
    values: { N: 0.36, R: 0.32, SR: 0.22, SSR: 0.08, UR: 0.02 },
  },
];
