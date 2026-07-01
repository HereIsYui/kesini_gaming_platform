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
  | "shop-products"
  | "shop-purchases"
  | "announcements"
  | "player-messages"
  | "launch-activity-config"
  | "launch-activity-claims"
  | "achievements"
  | "user-achievements"
  | "pve-stages"
  | "pve-records"
  | "pve-risk-config"
  | "pve-risk-bans"
  | "guild-config"
  | "trade-config"
  | "trade-listings"
  | "trade-records"
  | "vip-config"
  | "monthly-card-config"
  | "monthly-card-records"
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
  "shop-products",
  "shop-purchases",
  "announcements",
  "player-messages",
  "launch-activity-config",
  "launch-activity-claims",
  "achievements",
  "user-achievements",
  "pve-stages",
  "pve-records",
  "pve-risk-config",
  "pve-risk-bans",
  "guild-config",
  "trade-config",
  "trade-listings",
  "trade-records",
  "vip-config",
  "monthly-card-config",
  "monthly-card-records",
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
  shop: "shop-products",
  trade: "trade-listings",
  recharge: "recharge-records",
  monthly: "monthly-card-records",
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

export const shopCurrencyOptions: SelectOption[] = [
  { label: "星穹币", value: "star_coin" },
  { label: "鱼排积分", value: "fishpi_point" },
];

export const shopPurchaseStatusOptions: SelectOption[] = [
  { label: "处理中", value: "pending" },
  { label: "成功", value: "success" },
  { label: "失败", value: "failed" },
  { label: "异常", value: "local_failed" },
];

export const cardPublishOptions: SelectOption[] = [
  { label: "上架", value: true },
  { label: "下架", value: false },
];

export const poolTypeOptions: SelectOption[] = [
  { label: "常驻卡池", value: 0 },
  { label: "活动卡池", value: 1 },
  { label: "限定卡池", value: 2 },
  { label: "轮转卡池", value: 3 },
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
  { key: "id", label: "编号", readonly: true },
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
    activeText: "上线",
    inactiveText: "下线",
  },
  { key: "sort_order", label: "排序", type: "number", defaultValue: 0 },
  { key: "gacha_config_mode", label: "抽卡配置", readonly: true },
];

export function createCardFields(poolOptions: SelectOption[]): FieldConfig[] {
  return [
    { key: "id", label: "编号", readonly: true },
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
    key: "enabled",
    label: "状态",
    type: "boolean",
    options: cardPublishOptions,
    defaultValue: true,
    activeText: "上架",
    inactiveText: "下架",
  },
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
      helper: "留空走分解配置。",
    },
  ];
}

export const dropFields: FieldConfig[] = [
  { key: "id", label: "编号", readonly: true },
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
  { key: "id", label: "编号", readonly: true },
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
  { key: "id", label: "编号", readonly: true },
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
  { key: "id", label: "编号", readonly: true },
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
  { key: "id", label: "编号", readonly: true },
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
  { key: "id", label: "编号", readonly: true },
  { key: "code", label: "兑换码", placeholder: "留空自动生成" },
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
  { key: "id", label: "编号", readonly: true },
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
  { key: "id", label: "编号", readonly: true },
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
  { key: "id", label: "编号", readonly: true },
  { key: "shop_item_name", label: "兑换项", readonly: true },
  {
    key: "uid",
    label: "玩家",
    readonly: true,
    minWidth: 180,
    identity: { uidKey: "uid", nameKey: "userName" },
  },
  { key: "count", label: "数量", readonly: true },
  { key: "cost_snapshot", label: "消耗", readonly: true },
  { key: "reward_snapshot", label: "奖励", readonly: true },
  { key: "createdAt", label: "兑换时间", readonly: true },
];

export const shopProductFields: FieldConfig[] = [
  { key: "id", label: "编号", readonly: true },
  { key: "name", label: "名称" },
  { key: "enabled", label: "状态", type: "boolean", defaultValue: true },
  {
    key: "currency_type",
    label: "支付",
    type: "select",
    options: shopCurrencyOptions,
    defaultValue: "star_coin",
  },
  { key: "price", label: "价格", type: "number", defaultValue: 1 },
  { key: "total_limit", label: "总库存", type: "number" },
  { key: "user_limit", label: "单人限购", type: "number" },
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
  { key: "used_count", label: "已售", readonly: true },
];

export const shopPurchaseFields: FieldConfig[] = [
  { key: "id", label: "编号", readonly: true },
  { key: "product_name", label: "商品", readonly: true },
  {
    key: "uid",
    label: "玩家",
    readonly: true,
    minWidth: 180,
    identity: { uidKey: "uid", nameKey: "userName" },
  },
  { key: "count", label: "数量", readonly: true },
  {
    key: "currency_type",
    label: "支付",
    type: "select",
    options: shopCurrencyOptions,
    readonly: true,
  },
  { key: "cost_amount", label: "消耗", readonly: true },
  { key: "reward_snapshot", label: "奖励", readonly: true },
  {
    key: "status",
    label: "状态",
    type: "select",
    options: shopPurchaseStatusOptions,
    readonly: true,
  },
  { key: "failure_reason", label: "失败原因", readonly: true },
  { key: "createdAt", label: "时间", readonly: true },
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
  { key: "id", label: "编号", readonly: true },
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

export const playerMessageFields: FieldConfig[] = [
  { key: "id", label: "编号", readonly: true },
  { key: "title", label: "标题", placeholder: "例如：奖励提醒" },
  {
    key: "target_uid",
    label: "收件玩家",
    placeholder: "留空为全员",
    helper: "可填写公开编号",
    detailHidden: true,
    identity: { uidKey: "target_uid", nameKey: "targetName", fallback: "全体玩家" },
  },
  {
    key: "targetName",
    label: "收件玩家",
    readonly: true,
    tableHidden: true,
    formHidden: true,
  },
  {
    key: "enabled",
    label: "状态",
    type: "boolean",
    defaultValue: true,
  },
  { key: "starts_at", label: "开始时间", type: "datetime" },
  { key: "ends_at", label: "结束时间", type: "datetime" },
  {
    key: "content",
    label: "内容",
    type: "textarea",
    fullWidth: true,
    placeholder: "填写消息内容",
  },
  {
    key: "rewards",
    label: "奖励",
    type: "rewards",
    fullWidth: true,
    allowCardRewards: true,
  },
  { key: "createdAt", label: "创建时间", readonly: true },
];

export const launchActivityClaimFields: FieldConfig[] = [
  { key: "id", label: "编号", readonly: true },
  { key: "activity_key", label: "活动批次", readonly: true },
  { key: "activity_name", label: "活动名称", readonly: true },
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

export const achievementFields: FieldConfig[] = [
  { key: "id", label: "编号", readonly: true },
  { key: "code", label: "成就编号" },
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
  { key: "id", label: "编号", readonly: true },
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

export const pveStageFields: FieldConfig[] = [
  { key: "id", label: "编号", readonly: true },
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
  { key: "id", label: "编号", readonly: true },
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
  { key: "reward_snapshot", label: "奖励", readonly: true },
  { key: "createdAt", label: "挑战时间", readonly: true },
];

export const pveRiskConfigFields: FieldConfig[] = [
  {
    key: "enabled",
    label: "风控开关",
    type: "boolean",
    defaultValue: true,
    activeText: "开启",
    inactiveText: "关闭",
    helper: "关闭后挑战/自动战斗接口不再限流。",
  },
  {
    key: "windowSeconds",
    label: "计数窗口(秒)",
    type: "number",
    defaultValue: 60,
    helper: "统计调用次数的时间窗口长度，最小 1。",
  },
  {
    key: "limit",
    label: "窗口内上限",
    type: "number",
    defaultValue: 50,
    helper: "窗口内允许的最大挑战次数，超过即封禁，最小 1。",
  },
  {
    key: "banSeconds",
    label: "封禁时长(秒)",
    type: "number",
    defaultValue: 300,
    helper: "触发风控后封禁该用户的时长，最小 1。",
  },
];

export const pveRiskBanFields: FieldConfig[] = [
  {
    key: "uid",
    label: "玩家",
    readonly: true,
    minWidth: 180,
    identity: { uidKey: "uid", nameKey: "userName" },
  },
  { key: "reason", label: "触发原因", readonly: true, minWidth: 200 },
  { key: "triggerCount", label: "触发次数", readonly: true },
  { key: "bannedAt", label: "封禁时间", readonly: true, minWidth: 180 },
  { key: "remainSeconds", label: "剩余封禁", readonly: true },
];

export const guildConfigFields: FieldConfig[] = [
  { key: "enabled", label: "公会状态", type: "boolean", defaultValue: true },
  { key: "maxLevel", label: "最高等级", type: "number", defaultValue: 10 },
  {
    key: "baseMemberLimit",
    label: "初始人数",
    type: "number",
    defaultValue: 20,
  },
  {
    key: "memberLimitPerLevel",
    label: "升级扩容",
    type: "number",
    defaultValue: 2,
  },
  {
    key: "checkInReward",
    label: "签到奖励",
    type: "json",
    fullWidth: true,
    defaultValue: { points: 10 },
  },
  {
    key: "dailyDonateLimit",
    label: "每日捐献",
    type: "number",
    defaultValue: 3,
  },
  {
    key: "bossAttempts",
    label: "首领次数",
    type: "number",
    defaultValue: 3,
  },
  {
    key: "bossHpBase",
    label: "首领基础",
    type: "number",
    defaultValue: 50000,
  },
  {
    key: "bossHpPerLevel",
    label: "首领成长",
    type: "number",
    defaultValue: 20000,
  },
  {
    key: "activeChestThresholds",
    label: "宝箱门槛",
    type: "json",
    fullWidth: true,
    defaultValue: [100, 300, 600],
  },
];

export const tradeListingFields: FieldConfig[] = [
  { key: "id", label: "编号", readonly: true },
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
  { key: "id", label: "编号", readonly: true },
  { key: "listing_id", label: "挂单编号", readonly: true },
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

export const vipConfigFields: FieldConfig[] = [
  { key: "vip1_sweepLimit", label: "VIP1扫荡", type: "number", defaultValue: 5 },
  {
    key: "vip1_tradeFeeDiscount",
    label: "VIP1减免",
    type: "number",
    defaultValue: 0.02,
    helper: "0.02 表示减免 2%。",
  },
  {
    key: "vip1_dailyRewards",
    label: "VIP1礼包",
    type: "rewards",
    fullWidth: true,
  },
  { key: "vip2_sweepLimit", label: "VIP2扫荡", type: "number", defaultValue: 10 },
  {
    key: "vip2_tradeFeeDiscount",
    label: "VIP2减免",
    type: "number",
    defaultValue: 0.04,
    helper: "0.04 表示减免 4%。",
  },
  {
    key: "vip2_dailyRewards",
    label: "VIP2礼包",
    type: "rewards",
    fullWidth: true,
  },
  { key: "vip3_sweepLimit", label: "VIP3扫荡", type: "number", defaultValue: 20 },
  {
    key: "vip3_tradeFeeDiscount",
    label: "VIP3减免",
    type: "number",
    defaultValue: 0.06,
    helper: "0.06 表示减免 6%。",
  },
  {
    key: "vip3_dailyRewards",
    label: "VIP3礼包",
    type: "rewards",
    fullWidth: true,
  },
  { key: "vip4_sweepLimit", label: "VIP4扫荡", type: "number", defaultValue: 50 },
  {
    key: "vip4_tradeFeeDiscount",
    label: "VIP4减免",
    type: "number",
    defaultValue: 0.08,
    helper: "0.08 表示减免 8%。",
  },
  {
    key: "vip4_dailyRewards",
    label: "VIP4礼包",
    type: "rewards",
    fullWidth: true,
  },
];

export const monthlyCardConfigFields: FieldConfig[] = [
  { key: "enabled", label: "月卡状态", type: "boolean", defaultValue: false },
  {
    key: "durationDays",
    label: "有效天数",
    type: "number",
    defaultValue: 30,
  },
  {
    key: "ice_enabled",
    label: "星穹开关",
    type: "boolean",
    defaultValue: false,
  },
  { key: "ice_price", label: "星穹价格", type: "number", defaultValue: 0 },
  {
    key: "platinum_enabled",
    label: "星耀开关",
    type: "boolean",
    defaultValue: false,
  },
  {
    key: "platinum_price",
    label: "星耀价格",
    type: "number",
    defaultValue: 0,
  },
];

export const monthlyCardRecordFields: FieldConfig[] = [
  { key: "id", label: "编号", readonly: true },
  { key: "statusLabel", label: "状态", readonly: true },
  {
    key: "uid",
    label: "玩家",
    readonly: true,
    minWidth: 180,
    identity: { uidKey: "uid", nameKey: "userName" },
  },
  { key: "fishpi_user_name", label: "鱼排名", readonly: true },
  { key: "cardTypeLabel", label: "月卡", readonly: true },
  { key: "vip_level", label: "VIP", readonly: true },
  { key: "fishpi_cost", label: "鱼排积分", readonly: true },
  { key: "starts_at", label: "生效时间", readonly: true },
  { key: "expires_at", label: "到期时间", readonly: true },
  { key: "request_id", label: "流水号", readonly: true },
  { key: "thirdPartyMsg", label: "鱼排结果", readonly: true },
  { key: "failure_reason", label: "失败原因", readonly: true },
  { key: "createdAt", label: "购买时间", readonly: true },
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
  { key: "id", label: "编号", readonly: true },
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
  { key: "request_id", label: "流水号", readonly: true },
  { key: "thirdPartyMsg", label: "鱼排结果", readonly: true },
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
  {
    key: "fishpi_api_key",
    label: "鱼排接口密钥",
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
