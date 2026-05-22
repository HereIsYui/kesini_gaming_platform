import {
  Activity,
  Boxes,
  Coins,
  Database,
  Download,
  Eye,
  Gauge,
  Gift,
  History,
  Layers,
  LogOut,
  Menu as MenuIcon,
  Moon,
  Package,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Sparkles,
  Store,
  Sun,
  Ticket,
  Trash2,
  Handshake,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Checkbox,
  ConfigProvider,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Grid,
  Input,
  InputNumber,
  Layout,
  List,
  Menu,
  Modal,
  Progress,
  Select,
  Segmented,
  Space,
  Spin,
  Statistic,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  theme as antdTheme,
} from "antd";
import type { MenuProps, TableColumnsType } from "antd";
import zhCN from "antd/locale/zh_CN";
import {
  ReactNode,
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  clearToken,
  getApiBase,
  getToken,
  request,
  setApiBase,
  setToken,
  toQuery,
} from "./api";
import type {
  AdminMeResponse,
  AdminOptions,
  DashboardData,
  ExchangeCostItem,
  ExchangeShopItemRecord,
  FieldConfig,
  GachaConfigData,
  GachaPoolConfig,
  LaunchActivityClaimRecord,
  LaunchActivityConfigRecord,
  LoginResponse,
  PageResult,
  PoolGachaConfigDetail,
  RedeemCodeRecord,
  RedeemRewards,
  RechargeConfigRecord,
  RechargeRecord,
  SelectOption,
  TradeConfigRecord,
} from "./types";

type Theme = "light" | "dark";
type GachaFormState = GachaPoolConfig & {
  poolId: number;
  rarityProbabilities: Record<string, number>;
};
type PageKey =
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
  | "launch-activity-config"
  | "launch-activity-claims"
  | "trade-config"
  | "trade-listings"
  | "trade-records"
  | "recharge-config"
  | "recharge-records"
  | "gacha-config";
type NavGroup =
  | "工作台"
  | "内容配置"
  | "玩家资产"
  | "运营工具"
  | "交易与支付"
  | "系统配置";
type PageDefinition = {
  key: PageKey;
  label: string;
  description: string;
  group: NavGroup;
  icon: LucideIcon;
  render: () => ReactNode;
};

const defaultPageKey: PageKey = "dashboard";
const pageKeys: PageKey[] = [
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
  "launch-activity-config",
  "launch-activity-claims",
  "trade-config",
  "trade-listings",
  "trade-records",
  "recharge-config",
  "recharge-records",
  "gacha-config",
];
const pageKeySet = new Set<string>(pageKeys);
const navGroups: NavGroup[] = [
  "工作台",
  "内容配置",
  "玩家资产",
  "运营工具",
  "交易与支付",
  "系统配置",
];
const routeAliases: Record<string, PageKey> = {
  config: "gacha-config",
  trade: "trade-listings",
  recharge: "recharge-records",
};
const handledOpenidCallbacks = new Set<string>();

const rarityOptions: SelectOption[] = [
  { label: "N", value: "N" },
  { label: "R", value: "R" },
  { label: "SR", value: "SR" },
  { label: "SSR", value: "SSR" },
  { label: "UR", value: "UR" },
];

const booleanOptions: SelectOption[] = [
  { label: "否", value: false },
  { label: "是", value: true },
];

const poolTypeOptions: SelectOption[] = [
  { label: "常驻卡池", value: 0 },
  { label: "活动卡池", value: 1 },
  { label: "限定卡池", value: 2 },
];

const cardTypeOptions: SelectOption[] = [
  { label: "普通卡", value: 0 },
  { label: "限定卡", value: 1 },
  { label: "纪念卡", value: 2 },
  { label: "活动卡", value: 3 },
  { label: "隐藏卡", value: 4 },
];

const dropTypeOptions: SelectOption[] = [
  { label: "卡片碎片", value: 0 },
  { label: "普通道具", value: 2 },
  { label: "虚拟积分", value: 1 },
  { label: "其他", value: 3 },
];

const itemTemplates = [
  {
    label: "通用碎片",
    values: {
      drop_name: "通用碎片",
      drop_type: 0,
      drop_desc: "用于卡片合成和分解产出的通用碎片。",
      drop_item_type: 0,
      drop_item_value: 0,
      default_fragment: false,
    },
  },
  ...rarityOptions
    .filter((option) => option.value !== "UR")
    .map((option) => ({
      label: `${option.label} 碎片`,
      values: {
        drop_name: `${option.label} 碎片`,
        drop_type: 0,
        drop_desc: `用于 ${option.label} 稀有度卡片的合成和分解产出。`,
        drop_item_type: 0,
        drop_item_value: 0,
        default_fragment: false,
      },
    })),
  {
    label: "兑换券",
    values: {
      drop_name: "兑换券",
      drop_type: 2,
      drop_desc: "可放入背包的活动兑换类道具。",
      drop_item_type: 1,
      drop_item_value: 0,
      default_fragment: false,
    },
  },
  {
    label: "活动道具",
    values: {
      drop_name: "活动道具",
      drop_type: 2,
      drop_desc: "可用于活动玩法或兑换码奖励的普通道具。",
      drop_item_type: 2,
      drop_item_value: 0,
      default_fragment: false,
    },
  },
];

const poolFields: FieldConfig[] = [
  { key: "id", label: "ID", readonly: true },
  { key: "pool_name", label: "卡池名称", placeholder: "例如：限定卡池" },
  {
    key: "card_desc",
    label: "描述",
    type: "textarea",
    fullWidth: true,
    placeholder: "填写卡池说明",
  },
  {
    key: "card_type",
    label: "类型",
    type: "select",
    options: poolTypeOptions,
    defaultValue: 0,
  },
  {
    key: "enabled",
    label: "状态",
    type: "boolean",
    options: [
      { label: "上线", value: true },
      { label: "下线", value: false },
    ],
    defaultValue: true,
  },
  { key: "gacha_config_mode", label: "抽卡配置", readonly: true },
];

function createCardFields(options: AdminOptions | null): FieldConfig[] {
  const poolOptions = options?.pools?.length
    ? options.pools
    : [{ label: "默认卡池 #1", value: 1 }];
  const fragmentOptions =
    options?.dropItems
      ?.filter((item) => item.type === 0 && item.disabled !== true)
      .map((item) => ({
        ...item,
        value: String(item.value),
      })) || [];
  const defaultFragmentLabel = options?.defaultFragmentItem?.label
    ? `使用默认碎片（当前：${options.defaultFragmentItem.label}）`
    : "使用默认碎片（未设置）";
  const fragmentSelectOptions = [
    {
      label: defaultFragmentLabel,
      value: "",
      disabled: !options?.defaultFragmentItem,
    },
    ...fragmentOptions,
  ];

  return [
    { key: "id", label: "ID", readonly: true },
    { key: "card_name", label: "卡片名称", placeholder: "例如：星辉少女" },
    {
      key: "card_level",
      label: "可出现稀有度",
      type: "multiSelect",
      options: rarityOptions,
      fullWidth: true,
      helper: "可多选，保存时会按 N/R/SR/SSR/UR 顺序写入配置。",
    },
    { key: "pool", label: "所属卡池", type: "select", options: poolOptions },
    {
      key: "card_type",
      label: "类型",
      type: "select",
      options: cardTypeOptions,
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
      options: fragmentSelectOptions,
      fullWidth: true,
      helper: options?.defaultFragmentItem
        ? "留空时使用全局默认碎片；也可以为这张卡单独指定碎片。消耗规则：N=80、R=160、SR=320、SSR=1000，UR不可合成/分解。"
        : "还没有设置全局默认碎片，请先到物品管理把一个卡片碎片设为默认，或为这张卡单独指定碎片。",
    },
  ];
}

const dropFields: FieldConfig[] = [
  { key: "id", label: "ID", readonly: true },
  { key: "drop_name", label: "物品名称", placeholder: "例如：SSR碎片" },
  { key: "typeLabel", label: "物品类型", readonly: true },
  { key: "usageLabel", label: "用途说明", readonly: true },
  { key: "drop_desc", label: "物品说明", readonly: true },
  { key: "default_fragment", label: "默认碎片", readonly: true },
  { key: "disabled", label: "禁用", readonly: true },
];

const userFields: FieldConfig[] = [
  { key: "id", label: "ID", readonly: true },
  { key: "uid", label: "UID", readonly: true },
  { key: "name", label: "用户名" },
  { key: "nickname", label: "昵称" },
  { key: "point", label: "积分", type: "number" },
  {
    key: "is_admin",
    label: "管理员",
    type: "select",
    options: booleanOptions,
  },
];

const inventoryFields: FieldConfig[] = [
  { key: "id", label: "ID", readonly: true },
  { key: "user.uid", label: "UID", readonly: true },
  { key: "item.drop_name", label: "物品", readonly: true },
  { key: "item.typeLabel", label: "物品类型", readonly: true },
  { key: "item.usageLabel", label: "来源/用途", readonly: true },
  { key: "num", label: "数量", type: "number" },
];

const pityFields: FieldConfig[] = [
  { key: "id", label: "ID", readonly: true },
  { key: "uid", label: "UID", readonly: true },
  { key: "pool_id", label: "卡池ID", readonly: true },
  { key: "draws_since_sr", label: "SR计数", type: "number" },
  { key: "draws_since_ssr", label: "SSR计数", type: "number" },
  { key: "draws_since_ur", label: "UR计数", type: "number" },
];

const historyFields: FieldConfig[] = [
  { key: "id", label: "ID", readonly: true },
  { key: "uid", label: "UID", readonly: true },
  { key: "count", label: "抽数", readonly: true },
  { key: "card_levels", label: "稀有度", readonly: true },
  { key: "createdAt", label: "时间", readonly: true },
];

const redeemUsageFields: FieldConfig[] = [
  { key: "id", label: "ID", readonly: true },
  { key: "code", label: "兑换码", readonly: true },
  { key: "uid", label: "UID", readonly: true },
  { key: "reward_snapshot", label: "奖励", readonly: true },
  { key: "createdAt", label: "领取时间", readonly: true },
];

const redeemCodeFields: FieldConfig[] = [
  { key: "id", label: "ID", readonly: true },
  { key: "code", label: "兑换码", readonly: true },
  { key: "name", label: "名称", readonly: true },
  { key: "enabled", label: "状态", readonly: true },
  { key: "used_count", label: "已兑换", readonly: true },
  { key: "total_limit", label: "总库存", readonly: true },
  { key: "rewards", label: "奖励", readonly: true },
  { key: "starts_at", label: "开始时间", readonly: true },
  { key: "ends_at", label: "结束时间", readonly: true },
];

const exchangeItemFields: FieldConfig[] = [
  { key: "id", label: "ID", readonly: true },
  { key: "name", label: "兑换项", readonly: true },
  { key: "enabled", label: "状态", readonly: true },
  { key: "costs", label: "消耗", readonly: true },
  { key: "rewards", label: "奖励", readonly: true },
  { key: "used_count", label: "已兑换", readonly: true },
  { key: "total_limit", label: "总库存", readonly: true },
  { key: "user_limit", label: "单用户限兑", readonly: true },
  { key: "starts_at", label: "开始时间", readonly: true },
  { key: "ends_at", label: "结束时间", readonly: true },
];

const exchangeUsageFields: FieldConfig[] = [
  { key: "id", label: "ID", readonly: true },
  { key: "shop_item_name", label: "兑换项", readonly: true },
  { key: "uid", label: "UID", readonly: true },
  { key: "count", label: "兑换数量", readonly: true },
  { key: "cost_snapshot", label: "消耗快照", readonly: true },
  { key: "reward_snapshot", label: "奖励快照", readonly: true },
  { key: "createdAt", label: "兑换时间", readonly: true },
];

const launchActivityClaimFields: FieldConfig[] = [
  { key: "id", label: "ID", readonly: true },
  { key: "activity_key", label: "活动批次", readonly: true },
  { key: "activity_name", label: "活动名称", readonly: true },
  { key: "uid", label: "UID", readonly: true },
  { key: "reward_snapshot", label: "奖励快照", readonly: true },
  { key: "createdAt", label: "领取时间", readonly: true },
];

const tradeListingFields: FieldConfig[] = [
  { key: "id", label: "ID", readonly: true },
  { key: "status", label: "状态", readonly: true },
  { key: "cardName", label: "卡片", readonly: true },
  { key: "card_level", label: "稀有度", readonly: true },
  { key: "card_uuid", label: "卡片UUID", readonly: true },
  { key: "seller_uid", label: "卖家UID", readonly: true },
  { key: "buyer_uid", label: "买家UID", readonly: true },
  { key: "price", label: "价格", readonly: true },
  { key: "fee_rate", label: "手续费率", readonly: true },
  { key: "sellerIncome", label: "卖家实收", readonly: true },
  { key: "createdAt", label: "上架时间", readonly: true },
];

const tradeRecordFields: FieldConfig[] = [
  { key: "id", label: "ID", readonly: true },
  { key: "listing_id", label: "挂单ID", readonly: true },
  { key: "cardName", label: "卡片", readonly: true },
  { key: "card_level", label: "稀有度", readonly: true },
  { key: "card_uuid", label: "卡片UUID", readonly: true },
  { key: "seller_uid", label: "卖家UID", readonly: true },
  { key: "buyer_uid", label: "买家UID", readonly: true },
  { key: "price", label: "成交价", readonly: true },
  { key: "fee_amount", label: "手续费", readonly: true },
  { key: "seller_income", label: "卖家实收", readonly: true },
  { key: "createdAt", label: "成交时间", readonly: true },
];

const rechargeRecordFields: FieldConfig[] = [
  { key: "id", label: "ID", readonly: true },
  { key: "statusLabel", label: "状态", readonly: true },
  { key: "uid", label: "UID", readonly: true },
  { key: "fishpi_user_name", label: "鱼排用户名", readonly: true },
  { key: "amount", label: "到账积分", readonly: true },
  { key: "fishpi_cost", label: "扣除鱼排积分", readonly: true },
  { key: "point_before", label: "充值前", readonly: true },
  { key: "point_after", label: "充值后", readonly: true },
  { key: "request_id", label: "请求号", readonly: true },
  { key: "thirdPartyMsg", label: "鱼排响应", readonly: true },
  { key: "failure_reason", label: "失败原因", readonly: true },
  { key: "createdAt", label: "充值时间", readonly: true },
];

function readHashRoute(): { key: PageKey; shouldReplace: boolean } {
  const raw = window.location.hash.replace(/^#/, "").trim();
  if (!raw) {
    return { key: defaultPageKey, shouldReplace: false };
  }

  const mapped = routeAliases[raw] || raw;
  if (pageKeySet.has(mapped)) {
    return {
      key: mapped as PageKey,
      shouldReplace: mapped !== raw,
    };
  }

  return { key: defaultPageKey, shouldReplace: true };
}

function replaceHashRoute(key: PageKey) {
  window.history.replaceState(
    {},
    "",
    `${window.location.pathname}${window.location.search}#${key}`,
  );
}

function useHashRoute() {
  const [active, setActive] = useState<PageKey>(() => readHashRoute().key);

  useEffect(() => {
    function syncFromHash() {
      const next = readHashRoute();
      if (next.shouldReplace) {
        replaceHashRoute(next.key);
      }
      setActive(next.key);
    }

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  const setRoute = useCallback((key: PageKey) => {
    if (!pageKeySet.has(key)) {
      return;
    }
    setActive(key);
    if (window.location.hash.replace(/^#/, "") !== key) {
      window.location.hash = key;
    }
  }, []);

  return [active, setRoute] as const;
}

export function App() {
  const [token, setLocalToken] = useState(getToken());
  const [admin, setAdmin] = useState<AdminMeResponse | null>(null);
  const [adminOptions, setAdminOptions] = useState<AdminOptions | null>(null);
  const [authError, setAuthError] = useState("");
  const [active, setRoute] = useHashRoute();
  const [theme, setTheme] = useState<Theme>(
    (localStorage.getItem("kesini_theme") as Theme) || "light",
  );
  const screens = Grid.useBreakpoint();
  const isNarrowLayout = screens.lg === false;
  const [navOpen, setNavOpen] = useState(false);

  const antTheme = useMemo(
    () => ({
      algorithm:
        theme === "dark" ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      token: {
        borderRadius: 8,
        colorPrimary: "#2563eb",
        controlHeight: 40,
        controlHeightLG: 44,
        controlHeightSM: 32,
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      },
      components: {
        Layout: {
          bodyBg: theme === "dark" ? "#09090b" : "#f6f7f9",
          headerBg: theme === "dark" ? "#111114" : "#ffffff",
          siderBg: theme === "dark" ? "#0f0f12" : "#ffffff",
        },
        Menu: {
          itemBorderRadius: 8,
          itemHeight: 40,
        },
        Table: {
          headerBg: theme === "dark" ? "#1d1d22" : "#f3f4f6",
          rowHoverBg: theme === "dark" ? "#1d1d22" : "#f8fafc",
        },
      },
    }),
    [theme],
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("kesini_theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!isNarrowLayout) {
      setNavOpen(false);
    }
  }, [isNarrowLayout]);

  useEffect(() => {
    if (!token) {
      setAdmin(null);
      return;
    }
    setAuthError("");
    request<AdminMeResponse>("/admin/me")
      .then((data) => {
        if (data.user?.is_admin !== true) {
          throw new Error("当前账号没有后台管理权限");
        }
        setAdmin(data);
      })
      .catch((err) => {
        clearToken();
        setAdmin(null);
        setLocalToken("");
        setAuthError(
          err instanceof Error ? err.message : "当前账号没有后台管理权限",
        );
      });
  }, [token]);

  useEffect(() => {
    if (!admin) {
      setAdminOptions(null);
      return;
    }
    request<AdminOptions>("/admin/options")
      .then(setAdminOptions)
      .catch(() => setAdminOptions(null));
  }, [admin]);

  const cardFields = useMemo(
    () => createCardFields(adminOptions),
    [adminOptions],
  );

  const pageDefinitions = useMemo<PageDefinition[]>(
    () => [
      {
        key: "dashboard",
        label: "总览",
        description: "查看关键运营指标、稀有度分布和最近抽卡动态。",
        group: "工作台",
        icon: Gauge,
        render: () => <Dashboard admin={admin} />,
      },
      {
        key: "pools",
        label: "卡池管理",
        description: "维护卡池基础信息和单独抽卡配置。",
        group: "内容配置",
        icon: Layers,
        render: () => (
          <PoolManagementPanel fields={poolFields} options={adminOptions} />
        ),
      },
      {
        key: "cards",
        label: "卡片管理",
        description: "维护卡片信息、可出现稀有度和分解碎片配置。",
        group: "内容配置",
        icon: Sparkles,
        render: () => (
          <AdminTable
            title="卡片管理"
            endpoint="/admin/cards"
            fields={cardFields}
            editable
            creatable
            deletable
            detailFetchable
            searchPlaceholder="搜索卡片名称"
            enableRarityFilter
            poolFilterOptions={adminOptions?.pools || []}
          />
        ),
      },
      {
        key: "drop-items",
        label: "物品管理",
        description: "维护碎片、普通物品和活动道具，设置默认分解碎片。",
        group: "内容配置",
        icon: Package,
        render: () => (
          <AdminTable
            title="物品管理"
            endpoint="/admin/drop-items"
            fields={dropFields}
            editable
            creatable
            deletable
            detailFetchable
            searchPlaceholder="搜索物品名称或说明"
            renderEditor={({ initial, onCancel, onSubmit }) => (
              <ItemModal
                initial={initial}
                onCancel={onCancel}
                onSubmit={onSubmit}
              />
            )}
          />
        ),
      },
      {
        key: "users",
        label: "用户管理",
        description: "查看用户资料、积分和管理员状态。",
        group: "玩家资产",
        icon: Users,
        render: () => (
          <AdminTable
            title="用户管理"
            endpoint="/admin/users"
            fields={userFields}
            editable
            detailFetchable
            searchPlaceholder="搜索 UID、用户名或昵称"
          />
        ),
      },
      {
        key: "histories",
        label: "抽卡历史",
        description: "按 UID 和稀有度追踪玩家抽卡记录。",
        group: "玩家资产",
        icon: History,
        render: () => (
          <AdminTable
            title="抽卡历史"
            endpoint="/admin/histories"
            fields={historyFields}
            searchPlaceholder="按 UID 查询"
            keywordParam="uid"
            enableRarityFilter
          />
        ),
      },
      {
        key: "inventories",
        label: "背包管理",
        description: "查看和调整玩家背包物品库存。",
        group: "玩家资产",
        icon: Boxes,
        render: () => (
          <AdminTable
            title="背包管理"
            endpoint="/admin/inventories"
            fields={inventoryFields}
            editable
            searchPlaceholder="按 UID 查询"
            keywordParam="uid"
          />
        ),
      },
      {
        key: "pity",
        label: "保底状态",
        description: "维护玩家在各卡池中的保底计数。",
        group: "玩家资产",
        icon: Ticket,
        render: () => (
          <AdminTable
            title="保底状态"
            endpoint="/admin/pity"
            fields={pityFields}
            editable
            searchPlaceholder="按 UID 查询"
            keywordParam="uid"
          />
        ),
      },
      {
        key: "redeem-codes",
        label: "兑换码",
        description: "创建礼包码，维护库存、有效期和奖励发放规则。",
        group: "运营工具",
        icon: Gift,
        render: () => <RedeemCodesPage options={adminOptions} />,
      },
      {
        key: "redeem-usages",
        label: "兑换记录",
        description: "查看玩家兑换码领取记录和奖励快照。",
        group: "运营工具",
        icon: History,
        render: () => <RedeemUsagesPage />,
      },
      {
        key: "exchange-shop",
        label: "兑换商店",
        description: "配置物品消耗、奖励内容、库存和限兑规则。",
        group: "运营工具",
        icon: Store,
        render: () => <ExchangeShopPage options={adminOptions} />,
      },
      {
        key: "exchange-usages",
        label: "兑换商店记录",
        description: "查看兑换商店领取记录、消耗和奖励快照。",
        group: "运营工具",
        icon: History,
        render: () => <ExchangeUsagesPage />,
      },
      {
        key: "launch-activity-config",
        label: "开服活动",
        description: "配置登录可领取的开服福利、活动批次和奖励内容。",
        group: "运营工具",
        icon: Gift,
        render: () => <LaunchActivityConfigPanel options={adminOptions} />,
      },
      {
        key: "launch-activity-claims",
        label: "活动领取记录",
        description: "查看玩家开服福利领取批次、时间和奖励快照。",
        group: "运营工具",
        icon: History,
        render: () => <LaunchActivityClaimsPage />,
      },
      {
        key: "trade-config",
        label: "交易配置",
        description: "配置交易开关、手续费率和价格区间。",
        group: "交易与支付",
        icon: Settings,
        render: () => <TradeConfigPanel />,
      },
      {
        key: "trade-listings",
        label: "交易挂单",
        description: "审计匿名交易挂单状态和卡片流转。",
        group: "交易与支付",
        icon: Handshake,
        render: () => <TradeListingsPage />,
      },
      {
        key: "trade-records",
        label: "交易记录",
        description: "查看交易成交记录、手续费和买卖双方审计信息。",
        group: "交易与支付",
        icon: History,
        render: () => <TradeRecordsPage />,
      },
      {
        key: "recharge-config",
        label: "充值配置",
        description: "配置鱼排扣分充值开关、范围和 goldFingerKey。",
        group: "交易与支付",
        icon: Settings,
        render: () => <RechargeConfigPanel />,
      },
      {
        key: "recharge-records",
        label: "充值记录",
        description: "追踪鱼排扣分充值请求和本地积分入账状态。",
        group: "交易与支付",
        icon: Coins,
        render: () => <RechargeRecordsPage />,
      },
      {
        key: "gacha-config",
        label: "默认抽卡配置",
        description: "维护未设置单独配置卡池继承的默认概率、UP、保底和价格。",
        group: "系统配置",
        icon: Settings,
        render: () => <ConfigPage options={adminOptions} />,
      },
    ],
    [admin, adminOptions, cardFields],
  );
  const pageMap = useMemo(
    () => new Map(pageDefinitions.map((page) => [page.key, page])),
    [pageDefinitions],
  );
  const activePage = pageMap.get(active) || pageDefinitions[0];
  const pagesByGroup = useMemo(
    () =>
      navGroups
        .map((group) => ({
          group,
          pages: pageDefinitions.filter((page) => page.group === group),
        }))
        .filter((item) => item.pages.length > 0),
    [pageDefinitions],
  );
  const menuItems = useMemo<MenuProps["items"]>(
    () =>
      pagesByGroup.map((group) => ({
        key: group.group,
        type: "group" as const,
        label: group.group,
        children: group.pages.map((page) => {
          const Icon = page.icon;
          return {
            key: page.key,
            icon: <Icon size={16} />,
            label: page.label,
            title: page.description,
          };
        }),
      })),
    [pagesByGroup],
  );
  const menuNode = (
    <Menu
      className="admin-menu"
      mode="inline"
      items={menuItems}
      selectedKeys={[activePage.key]}
      onClick={({ key }) => {
        setRoute(key as PageKey);
        setNavOpen(false);
      }}
    />
  );

  function withAntProvider(node: ReactNode) {
    return (
      <ConfigProvider locale={zhCN} theme={antTheme}>
        <AntApp>{node}</AntApp>
      </ConfigProvider>
    );
  }

  const handleLogin = useCallback((nextToken: string) => {
    setAuthError("");
    setLocalToken(nextToken);
  }, []);

  if (!token) {
    return withAntProvider(
      <LoginPage initialError={authError} onLogin={handleLogin} />,
    );
  }

  if (!admin) {
    return withAntProvider(
      <main className="login-screen">
        <section className="login-panel">
          <div className="brand-mark large">
            <Shield size={28} />
          </div>
          <span className="eyebrow">权限校验</span>
          <h1>正在验证后台权限</h1>
          <p>正在确认当前账号是否具备后台管理权限。</p>
        </section>
      </main>,
    );
  }

  return withAntProvider(
    <Layout className="app-shell">
      {!isNarrowLayout && (
        <Layout.Sider className="sidebar" width={260}>
          <SidebarBrand />
          <div className="sidebar-scroll">{menuNode}</div>
        </Layout.Sider>
      )}

      <Layout className="main">
        <Layout.Header className="topbar">
          <div className="topbar-title">
            <Space align="center" size={8}>
              {isNarrowLayout && (
                <Button
                  className="mobile-menu-button"
                  icon={<MenuIcon size={17} />}
                  onClick={() => setNavOpen(true)}
                  aria-label="打开导航菜单"
                />
              )}
              <span className="eyebrow">{activePage.group}</span>
            </Space>
            <Typography.Title level={3}>{activePage.label}</Typography.Title>
            <Typography.Text className="topbar-description">
              {activePage.description}
            </Typography.Text>
          </div>
          <Space className="top-actions" size={8}>
            <Tag className="status-dot" color="success">
              API {getApiBase()}
            </Tag>
            <Button
              icon={theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
              aria-label="切换主题"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            />
            <Button
              icon={<LogOut size={18} />}
              aria-label="退出登录"
              onClick={() => {
                clearToken();
                setLocalToken("");
              }}
            />
          </Space>
        </Layout.Header>

        <Layout.Content className="content" aria-label={activePage.label}>
          {activePage.render()}
        </Layout.Content>
      </Layout>

      <Drawer
        className="nav-drawer"
        title={<SidebarBrand />}
        placement="left"
        open={navOpen}
        width={300}
        onClose={() => setNavOpen(false)}
      >
        {menuNode}
      </Drawer>
    </Layout>,
  );
}

function SidebarBrand() {
  return (
    <div className="sidebar-header">
      <div className="brand">
        <div className="brand-mark">
          <Sparkles size={20} />
        </div>
        <div>
          <strong>Kesini</strong>
          <span>Gacha Admin</span>
        </div>
      </div>
      <span className="sidebar-pill">运营控制台</span>
    </div>
  );
}

function LoginPage({
  initialError,
  onLogin,
}: {
  initialError?: string;
  onLogin: (token: string) => void;
}) {
  const [apiBase, setApiBaseState] = useState(getApiBase());
  const [manualToken, setManualToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError || "");
  const handledCallbackRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("openid.mode")) {
      return;
    }
    const callbackKey = window.location.search;
    if (handledCallbackRef.current || handledOpenidCallbacks.has(callbackKey)) {
      return;
    }
    handledCallbackRef.current = true;
    handledOpenidCallbacks.add(callbackKey);

    const callbackData: Record<string, string> = {};
    params.forEach((value, key) => {
      callbackData[key] = value;
    });
    const clearCallbackUrl = () => {
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}${window.location.hash}`,
      );
    };

    setLoading(true);
    request<LoginResponse>("/apis/login", {
      method: "POST",
      body: JSON.stringify(callbackData),
    })
      .then((data) => {
        if (data.user?.is_admin !== true) {
          clearToken();
          throw new Error("当前账号没有后台管理权限");
        }
        setToken(data.token);
        clearCallbackUrl();
        onLogin(data.token);
      })
      .catch((err) => {
        clearToken();
        clearCallbackUrl();
        setError(err instanceof Error ? err.message : "登录失败");
      })
      .finally(() => setLoading(false));
  }, [onLogin]);

  async function startLogin() {
    setError("");
    setApiBase(apiBase);
    setLoading(true);
    try {
      const oauthOrigin = window.location.origin;
      const returnTo = new URL(window.location.pathname, oauthOrigin).toString();
      const data = await request<{ url: string }>(
        `/apis/login-url${toQuery({ returnTo, realm: oauthOrigin })}`,
      );
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
      setLoading(false);
    }
  }

  function useManualToken() {
    if (!manualToken.trim()) {
      setError("请输入 JWT Token");
      return;
    }
    setToken(manualToken.trim());
    onLogin(manualToken.trim());
  }

  return (
    <main className="login-screen">
      <Card className="login-panel">
        <Space direction="vertical" size={16} className="full-width">
          <div className="brand-mark large">
            <Sparkles size={28} />
          </div>
          <div>
            <span className="eyebrow">Kesini Gacha Admin</span>
            <Typography.Title level={2}>后台管理</Typography.Title>
            <Typography.Paragraph type="secondary">
              使用现有 OpenID/JWT 登录体系进入管理台。
            </Typography.Paragraph>
          </div>

          <Form layout="vertical">
            <Form.Item label="API 地址">
              <Input
                value={apiBase}
                onChange={(event) => setApiBaseState(event.target.value)}
                placeholder="http://localhost:7001"
              />
            </Form.Item>
            <Button
              type="primary"
              block
              size="large"
              icon={<Shield size={18} />}
              onClick={startLogin}
              loading={loading}
            >
              使用 OpenID 登录
            </Button>
          </Form>

          <Form
            className="manual-token"
            layout="vertical"
            onFinish={useManualToken}
          >
            <Form.Item label="本地调试 Token">
              <Input.TextArea
                value={manualToken}
                onChange={(event) => setManualToken(event.target.value)}
                placeholder="粘贴已有 JWT"
                autoSize={{ minRows: 4, maxRows: 6 }}
              />
            </Form.Item>
            <Button block htmlType="submit">
              使用 Token 进入
            </Button>
          </Form>

          {error && <Alert type="error" message={error} showIcon />}
        </Space>
      </Card>
    </main>
  );
}

function Dashboard({ admin }: { admin: AdminMeResponse | null }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    request<DashboardData>("/admin/dashboard")
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <Panel
        title="总览"
        icon={<Gauge size={18} />}
        action={<RefreshButton onClick={load} loading={loading} />}
      >
        <StateBox type="error">{error}</StateBox>
      </Panel>
    );
  }
  if (!data) {
    return (
      <Panel title="总览" icon={<Gauge size={18} />}>
        <StateBox>正在加载总览数据...</StateBox>
      </Panel>
    );
  }

  const stats: Array<{ label: string; value: number; icon: LucideIcon }> = [
    { label: "用户", value: data.counters.userCount, icon: Users },
    { label: "卡片", value: data.counters.cardCount, icon: Sparkles },
    { label: "卡池", value: data.counters.poolCount, icon: Layers },
    { label: "总抽数", value: data.counters.totalDraws, icon: Activity },
  ];
  const rarityEntries = Object.entries(data.rarityTotals);
  const totalRarity = rarityEntries.reduce((sum, [, value]) => sum + value, 0);
  const maxRarity = Math.max(...Object.values(data.rarityTotals), 1);

  return (
    <div className="dashboard-page">
      <div className="metric-grid">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card className="stat-card" key={stat.label}>
              <Statistic
                title={stat.label}
                value={stat.value}
                prefix={
                  <span className="stat-icon">
                    <Icon size={18} />
                  </span>
                }
              />
            </Card>
          );
        })}
      </div>

      <div className="dashboard-section-grid">
        <Panel title="稀有度分布" icon={<Sparkles size={18} />}>
          <div className="rarity-bars">
            {rarityEntries.map(([rarity, value]) => (
              <div className="rarity-row" key={rarity}>
                <Badge>{rarity}</Badge>
                <Progress
                  percent={
                    maxRarity
                      ? Number(((value / maxRarity) * 100).toFixed(1))
                      : 0
                  }
                  showInfo={false}
                />
                <Typography.Text strong>
                  {value}{" "}
                  <Typography.Text type="secondary">
                    {totalRarity
                      ? `${((value / totalRarity) * 100).toFixed(1)}%`
                      : "0%"}
                  </Typography.Text>
                </Typography.Text>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="最近抽卡"
          icon={<History size={18} />}
          action={<RefreshButton onClick={load} loading={loading} />}
        >
          {data.recentHistories.length ? (
            <List
              className="activity-table"
              dataSource={data.recentHistories}
              renderItem={(history, index) => (
                <List.Item key={String(history.id || index)}>
                  <List.Item.Meta
                    title={
                      <Space wrap>
                        <Typography.Text className="mono">
                          UID {String(history.uid || "-")}
                        </Typography.Text>
                        <Tag>{String(history.count || 0)} 抽</Tag>
                      </Space>
                    }
                    description={summarizeRarities(
                      String(history.card_levels || ""),
                    )}
                  />
                  <Typography.Text type="secondary">
                    {formatDate(history.createdAt)}
                  </Typography.Text>
                </List.Item>
              )}
            />
          ) : (
            <StateBox>暂无抽卡记录</StateBox>
          )}
        </Panel>
      </div>

      <Panel title="当前管理员" icon={<Shield size={18} />}>
        <div className="admin-card">
          <div className="admin-avatar">
            {String(admin?.user?.nickname || admin?.user?.name || "管").slice(
              0,
              1,
            )}
          </div>
          <Descriptions
            bordered
            size="small"
            column={1}
            items={[
              { key: "uid", label: "UID", children: admin?.user?.uid || "-" },
              {
                key: "nickname",
                label: "昵称",
                children: String(
                  admin?.user?.nickname || admin?.user?.name || "-",
                ),
              },
              {
                key: "admin",
                label: "管理员状态",
                children: admin?.user?.is_admin ? "已授权" : "未授权",
              },
            ]}
          />
        </div>
      </Panel>
    </div>
  );
}

function PoolManagementPanel({
  fields,
  options,
}: {
  fields: FieldConfig[];
  options: AdminOptions | null;
}) {
  const { message } = AntApp.useApp();
  const [editingGacha, setEditingGacha] = useState<{
    poolId: number;
    poolName: string;
    detail: PoolGachaConfigDetail;
  } | null>(null);
  const [loadingPoolId, setLoadingPoolId] = useState<number | null>(null);
  const [togglingPoolId, setTogglingPoolId] = useState<number | null>(null);

  async function openGachaConfig(row: Record<string, any>) {
    const poolId = Number(row.id);
    if (!Number.isInteger(poolId) || poolId <= 0) {
      message.error("卡池ID无效");
      return;
    }
    setLoadingPoolId(poolId);
    try {
      const pool = await request<Record<string, any>>(`/admin/pools/${poolId}`);
      const detail = pool.gachaConfig as PoolGachaConfigDetail | undefined;
      if (!detail) {
        throw new Error("卡池抽卡配置详情缺失");
      }
      setEditingGacha({
        poolId,
        poolName: String(pool.pool_name || row.pool_name || `卡池 #${poolId}`),
        detail,
      });
    } catch (err) {
      message.error(err instanceof Error ? err.message : "读取抽卡配置失败");
    } finally {
      setLoadingPoolId(null);
    }
  }

  async function togglePoolEnabled(
    row: Record<string, any>,
    enabled: boolean,
    reload: () => void,
  ) {
    const poolId = Number(row.id);
    setTogglingPoolId(poolId);
    try {
      await request(`/admin/pools/${poolId}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      });
      message.success(enabled ? "卡池已上线" : "卡池已下线");
      reload();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "切换卡池状态失败");
    } finally {
      setTogglingPoolId(null);
    }
  }

  function renderPoolCell(
    field: FieldConfig,
    row: Record<string, any>,
    helpers: { reload: () => void },
  ) {
    if (field.key === "enabled") {
      const checked = row.enabled !== false;
      return (
        <Switch
          size="small"
          checked={checked}
          checkedChildren="上线"
          unCheckedChildren="下线"
          loading={togglingPoolId === Number(row.id)}
          onChange={(nextChecked) =>
            togglePoolEnabled(row, nextChecked, helpers.reload)
          }
        />
      );
    }
    if (field.key === "card_type") {
      return renderPoolTypeTag(row.card_type);
    }
    if (field.key === "gacha_config_mode") {
      return renderGachaConfigModeTag(row.gacha_config_mode);
    }
    return null;
  }

  const modalConfig = editingGacha
    ? getPoolGachaModalConfig(editingGacha.poolId, editingGacha.detail)
    : null;

  return (
    <>
      <AdminTable
        title="卡池管理"
        endpoint="/admin/pools"
        fields={fields}
        editable
        creatable
        deletable
        detailFetchable
        searchPlaceholder="搜索卡池名称或描述"
        renderCell={renderPoolCell}
        extraActions={(row) => {
          return (
            <Button
              size="small"
              loading={loadingPoolId === Number(row.id)}
              onClick={() => openGachaConfig(row)}
            >
              抽卡配置
            </Button>
          );
        }}
      />
      {editingGacha && modalConfig && (
        <GachaConfigModal
          mode="pool"
          poolKey={String(editingGacha.poolId)}
          config={modalConfig}
          defaultConfig={editingGacha.detail.defaultConfig}
          poolName={editingGacha.poolName}
          options={options}
          onCancel={() => setEditingGacha(null)}
          onSubmit={async (poolId, values) => {
            const {
              poolId: _poolId,
              source: _source,
              scope: _scope,
              updatedAt: _updatedAt,
              ...payload
            } = values;
            await request(`/admin/config/gacha/${poolId}`, {
              method: "PATCH",
              body: JSON.stringify(payload),
            });
            message.success(
              values.enabled === false ? "已改为继承默认配置" : "已保存单独配置",
            );
            setEditingGacha(null);
          }}
        />
      )}
    </>
  );
}

function AdminTable({
  title,
  endpoint,
  fields,
  editable,
  creatable,
  deletable,
  detailFetchable,
  searchPlaceholder,
  keywordParam = "keyword",
  enableRarityFilter,
  poolFilterOptions,
  renderEditor,
  renderCell,
  extraActions,
}: {
  title: string;
  endpoint: string;
  fields: FieldConfig[];
  editable?: boolean;
  creatable?: boolean;
  deletable?: boolean;
  detailFetchable?: boolean;
  searchPlaceholder?: string;
  keywordParam?: string;
  enableRarityFilter?: boolean;
  poolFilterOptions?: SelectOption[];
  renderEditor?: (props: {
    initial: Record<string, any>;
    onCancel: () => void;
    onSubmit: (values: Record<string, any>) => Promise<void>;
  }) => ReactNode;
  renderCell?: (
    field: FieldConfig,
    row: Record<string, any>,
    helpers: { reload: () => void },
  ) => ReactNode;
  extraActions?: (
    row: Record<string, any>,
    helpers: { reload: () => void },
  ) => ReactNode;
}) {
  const { message, modal } = AntApp.useApp();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [keyword, setKeyword] = useState("");
  const [rarity, setRarity] = useState("");
  const [poolId, setPoolId] = useState("");
  const [data, setData] = useState<PageResult<Record<string, any>> | null>(
    null,
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Record<string, any> | null>(null);
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<Record<string, any> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const filters = useMemo(
    () => ({
      page,
      pageSize,
      [keywordParam]: keyword,
      rarity,
      poolId,
    }),
    [page, pageSize, keyword, keywordParam, rarity, poolId],
  );

  const load = useCallback(() => {
    setError("");
    setLoading(true);
    request<PageResult<Record<string, any>>>(`${endpoint}${toQuery(filters)}`)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [endpoint, filters]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveForm(values: Record<string, any>) {
    const current = editing;
    const method = current ? "PATCH" : "POST";
    const target = current ? `${endpoint}/${current.id}` : endpoint;
    await request(target, {
      method,
      body: JSON.stringify(values),
    });
    setEditing(null);
    setCreating(false);
    message.success(current ? "已保存修改" : "已新增记录");
    load();
  }

  function deleteItem(row: Record<string, any>) {
    modal.confirm({
      title: `确认删除 ${title} #${row.id}？`,
      content: "删除后不可直接恢复，请确认这不是误操作。",
      okText: "确认删除",
      cancelText: "取消",
      okButtonProps: { danger: true },
      async onOk() {
        await request(`${endpoint}/${row.id}`, { method: "DELETE" });
        message.success("已删除");
        load();
      },
    });
  }

  async function openDetail(row: Record<string, any>) {
    setDetail(row);
    if (!detailFetchable) {
      return;
    }
    setDetailLoading(true);
    try {
      const nextDetail = await request<Record<string, any>>(
        `${endpoint}/${row.id}`,
      );
      setDetail(nextDetail);
    } catch {
      setDetail(row);
    } finally {
      setDetailLoading(false);
    }
  }

  function exportCurrentPage() {
    exportRowsToCsv(title, rows, fields);
  }

  const rows = data?.list || [];
  const columns = useMemo<TableColumnsType<Record<string, any>>>(
    () => [
      ...fields.map((field) => ({
        title: field.label,
        key: field.key,
        ellipsis: true,
        render: (_: unknown, row: Record<string, any>) => {
          const customCell = renderCell?.(field, row, { reload: load });
          if (customCell !== undefined && customCell !== null) {
            return customCell;
          }
          const value = formatFieldValue(field, getValue(row, field.key));
          return (
            <Typography.Text ellipsis title={value}>
              {value}
            </Typography.Text>
          );
        },
      })),
      {
        title: "操作",
        key: "actions",
        width: extraActions ? 300 : 210,
        render: (_: unknown, row: Record<string, any>) => (
          <Space size={8} wrap>
            <Button
              size="small"
              icon={<Eye size={14} />}
              onClick={() => openDetail(row)}
            >
              详情
            </Button>
            {extraActions?.(row, { reload: load })}
            {editable && (
              <Button size="small" onClick={() => setEditing(row)}>
                编辑
              </Button>
            )}
            {deletable && (
              <Button
                size="small"
                danger
                icon={<Trash2 size={14} />}
                onClick={() => deleteItem(row)}
              />
            )}
          </Space>
        ),
      },
    ],
    [fields, editable, deletable, extraActions, renderCell, load],
  );

  return (
    <Panel title={title} icon={<Database size={18} />} className="table-panel">
      <Space className="table-toolbar" wrap>
        <Input
          className="toolbar-search"
          prefix={<Search size={16} />}
          allowClear
          style={{ width: 280 }}
          value={keyword}
          onChange={(event) => {
            setPage(1);
            setKeyword(event.target.value);
          }}
          placeholder={searchPlaceholder || "搜索"}
        />
        {poolFilterOptions && (
          <Select
            value={poolId}
            style={{ width: 180 }}
            onChange={(value) => {
              setPage(1);
              setPoolId(value);
            }}
            options={[
              { label: "全部卡池", value: "" },
              ...poolFilterOptions.map((option) => ({
                label: option.label,
                value: String(option.value),
              })),
            ]}
          />
        )}
        {enableRarityFilter && (
          <Select
            value={rarity}
            style={{ width: 150 }}
            onChange={(value) => {
              setPage(1);
              setRarity(value);
            }}
            options={[
              { label: "全部稀有度", value: "" },
              { label: "N", value: "N" },
              { label: "R", value: "R" },
              { label: "SR", value: "SR" },
              { label: "SSR", value: "SSR" },
              { label: "UR", value: "UR" },
            ]}
          />
        )}
        <Space className="toolbar-actions" wrap>
          <Button
            icon={<RefreshCw size={15} />}
            onClick={load}
            disabled={loading}
          >
            刷新
          </Button>
          <Button
            icon={<Download size={15} />}
            onClick={exportCurrentPage}
            disabled={!rows.length}
          >
            导出CSV
          </Button>
          {creatable && (
            <Button type="primary" onClick={() => setCreating(true)}>
              新增
            </Button>
          )}
        </Space>
      </Space>

      {error && <StateBox type="error">{error}</StateBox>}
      <Table
        rowKey={(row) => String(row.id)}
        columns={columns}
        dataSource={rows}
        loading={loading}
        scroll={{ x: "max-content" }}
        pagination={{
          current: page,
          pageSize,
          total: data?.total || 0,
          showSizeChanger: false,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (nextPage) => setPage(nextPage),
        }}
        locale={{
          emptyText: error ? "加载失败" : <Empty description="暂无数据" />,
        }}
      />

      {(editing || creating) &&
        (renderEditor ? (
          renderEditor({
            initial: editing || {},
            onCancel: () => {
              setEditing(null);
              setCreating(false);
            },
            onSubmit: saveForm,
          })
        ) : (
          <EditModal
            title={editing ? "编辑记录" : "新增记录"}
            fields={fields.filter((field) => !field.readonly)}
            initial={editing || {}}
            onCancel={() => {
              setEditing(null);
              setCreating(false);
            }}
            onSubmit={saveForm}
          />
        ))}

      {detail && (
        <DetailModal
          title={`${title}详情`}
          fields={fields}
          data={detail}
          loading={detailLoading}
          onClose={() => setDetail(null)}
        />
      )}
    </Panel>
  );
}

function EditModal({
  title,
  fields,
  initial,
  onCancel,
  onSubmit,
}: {
  title: string;
  fields: FieldConfig[];
  initial: Record<string, any>;
  onCancel: () => void;
  onSubmit: (values: Record<string, any>) => Promise<void>;
}) {
  const [values, setValues] = useState<Record<string, any>>(() =>
    fields.reduce(
      (result, field) => {
        const value = getValue(initial, field.key) ?? field.defaultValue ?? "";
        result[field.key] =
          field.type === "multiSelect"
            ? parseMultiSelectValue(value)
            : field.key === "drop_item"
              ? normalizeDropItemSelectValue(value)
              : value;
        return result;
      },
      {} as Record<string, any>,
    ),
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError("");
    try {
      await onSubmit(serializeFormValues(fields, values));
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
      setLoading(false);
    }
  }

  return (
    <Modal
      title={title}
      open
      onCancel={onCancel}
      onOk={submit}
      okText="保存"
      cancelText="取消"
      confirmLoading={loading}
      width={760}
      destroyOnHidden
    >
      <Space
        direction="vertical"
        size={16}
        className="full-width admin-form-stack"
      >
        <Card
          size="small"
          className="admin-form-card form-section-card"
          title="基础信息"
        >
          <Form layout="vertical" className="admin-form-grid antd-form-grid">
            {fields.map((field) => {
              const fieldOptions = getFieldOptions(field);
              const shouldRenderSelect =
                field.type === "select" ||
                field.type === "boolean" ||
                Boolean(fieldOptions?.length);
              const fieldClass =
                field.fullWidth || field.type === "textarea"
                  ? "form-field full-width"
                  : "form-field";

              if (field.type === "multiSelect") {
                return (
                  <Form.Item
                    className={fieldClass}
                    key={field.key}
                    label={field.label}
                    extra={field.helper}
                  >
                    <Checkbox.Group
                      className="rarity-segment-grid"
                      value={
                        Array.isArray(values[field.key])
                          ? values[field.key].map(String)
                          : []
                      }
                      onChange={(checkedValues) =>
                        setValues({
                          ...values,
                          [field.key]: checkedValues
                            .map(String)
                            .sort((left, right) => {
                              const order = (fieldOptions || []).map((option) =>
                                String(option.value),
                              );
                              return order.indexOf(left) - order.indexOf(right);
                            }),
                        })
                      }
                      options={(fieldOptions || []).map((option) => ({
                        label: option.label,
                        value: String(option.value),
                        disabled: option.disabled,
                      }))}
                    />
                  </Form.Item>
                );
              }

              if (field.type === "boolean") {
                const checkedLabel = getFieldOptionLabel(field, true, "是");
                const uncheckedLabel = getFieldOptionLabel(field, false, "否");
                return (
                  <Form.Item
                    className={fieldClass}
                    key={field.key}
                    label={field.label}
                    extra={field.helper}
                  >
                    <Switch
                      checked={values[field.key] !== false}
                      checkedChildren={checkedLabel}
                      unCheckedChildren={uncheckedLabel}
                      onChange={(checked) =>
                        setValues({
                          ...values,
                          [field.key]: checked,
                        })
                      }
                    />
                  </Form.Item>
                );
              }

              if (field.key === "card_type" && fieldOptions.length > 0) {
                return (
                  <Form.Item
                    className={fieldClass}
                    key={field.key}
                    label={field.label}
                    extra={field.helper}
                  >
                    <Segmented
                      value={coerceFieldValue(field, values[field.key])}
                      onChange={(value) =>
                        setValues({
                          ...values,
                          [field.key]: coerceFieldValue(field, value),
                        })
                      }
                      options={fieldOptions.map((option) => ({
                        label: option.label,
                        value:
                          typeof option.value === "boolean"
                            ? String(option.value)
                            : (option.value as string | number),
                        disabled: option.disabled,
                      }))}
                    />
                  </Form.Item>
                );
              }

              return (
                <Form.Item
                  className={fieldClass}
                  key={field.key}
                  label={field.label}
                  extra={field.helper}
                >
                  {field.type === "textarea" ? (
                    <Input.TextArea
                      value={values[field.key] ?? ""}
                      placeholder={field.placeholder}
                      autoSize={{ minRows: 4, maxRows: 8 }}
                      onChange={(event) =>
                        setValues({
                          ...values,
                          [field.key]: event.target.value,
                        })
                      }
                    />
                  ) : shouldRenderSelect ? (
                    <Select
                      value={String(values[field.key] ?? "")}
                      getPopupContainer={(trigger) =>
                        trigger.parentElement || document.body
                      }
                      onChange={(value) =>
                        setValues({
                          ...values,
                          [field.key]: coerceFieldValue(field, value),
                        })
                      }
                      options={[
                        ...(!(fieldOptions || []).some(
                          (option) => String(option.value) === "",
                        )
                          ? [
                              {
                                label: fieldOptions?.length
                                  ? "请选择"
                                  : "暂无可选项",
                                value: "",
                              },
                            ]
                          : []),
                        ...(fieldOptions || []).map((option) => ({
                          label: option.label,
                          value: String(option.value),
                          disabled: option.disabled,
                        })),
                      ]}
                    />
                  ) : field.type === "number" ? (
                    <InputNumber
                      className="full-width-control"
                      value={
                        values[field.key] === ""
                          ? null
                          : Number(values[field.key])
                      }
                      placeholder={field.placeholder}
                      onChange={(value) =>
                        setValues({
                          ...values,
                          [field.key]: value ?? "",
                        })
                      }
                    />
                  ) : (
                    <Input
                      value={values[field.key] ?? ""}
                      placeholder={field.placeholder}
                      onChange={(event) =>
                        setValues({
                          ...values,
                          [field.key]: event.target.value,
                        })
                      }
                    />
                  )}
                </Form.Item>
              );
            })}
          </Form>
        </Card>
        {error && <Alert type="error" message={error} showIcon />}
      </Space>
    </Modal>
  );
}

function ItemModal({
  initial,
  onCancel,
  onSubmit,
}: {
  initial: Record<string, any>;
  onCancel: () => void;
  onSubmit: (values: Record<string, any>) => Promise<void>;
}) {
  const [values, setValues] = useState(() => createItemFormState(initial));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const currentType = Number(values.drop_type || 0);
  const showUsageParams = currentType === 2 || currentType === 3;

  async function submit() {
    setLoading(true);
    setError("");
    try {
      await onSubmit({
        ...values,
        drop_type: currentType,
        drop_item_type: showUsageParams
          ? Number(values.drop_item_type || 0)
          : 0,
        drop_item_value: showUsageParams
          ? Number(values.drop_item_value || 0)
          : 0,
        default_fragment: currentType === 0 && values.default_fragment === true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
      setLoading(false);
    }
  }

  return (
    <Modal
      title={
        <div>
          <span className="eyebrow">物品管理</span>
          <Typography.Title level={4}>
            {initial.id ? "编辑物品" : "新增物品"}
          </Typography.Title>
        </div>
      }
      open
      width={760}
      onCancel={onCancel}
      onOk={submit}
      okText="保存物品"
      cancelText="取消"
      confirmLoading={loading}
      destroyOnHidden
    >
      <Space
        direction="vertical"
        size={16}
        className="full-width admin-form-stack"
      >
        <Card
          size="small"
          className="admin-form-card form-section-card"
          title="常用模板"
        >
          <Space wrap className="template-row">
            {itemTemplates.map((template) => (
              <Button
                size="small"
                key={template.label}
                onClick={() =>
                  setValues({
                    ...values,
                    ...template.values,
                  })
                }
              >
                {template.label}
              </Button>
            ))}
          </Space>
        </Card>
        <Card
          size="small"
          className="admin-form-card form-section-card"
          title="物品信息"
        >
          <Form layout="vertical" className="admin-form-grid antd-form-grid">
            <Form.Item className="form-field" label="物品名称">
              <Input
                value={values.drop_name}
                placeholder="例如：SSR碎片"
                onChange={(event) =>
                  setValues({ ...values, drop_name: event.target.value })
                }
              />
            </Form.Item>
            <Form.Item className="form-field" label="物品类型">
              <Select
                value={String(values.drop_type)}
                onChange={(value) =>
                  setValues({
                    ...values,
                    drop_type: Number(value),
                    drop_item_type: 0,
                    drop_item_value: 0,
                    default_fragment:
                      Number(value) === 0 ? values.default_fragment : false,
                  })
                }
                options={dropTypeOptions.map((option) => ({
                  label: option.label,
                  value: String(option.value),
                }))}
              />
            </Form.Item>
            <Alert
              className="full-width"
              type="info"
              showIcon
              message={
                <Space wrap>
                  <Badge>{getDropTypeLabel(currentType)}</Badge>
                  <span>{getDropTypeUsage(currentType)}</span>
                </Space>
              }
            />
            {currentType === 0 && (
              <Form.Item className="form-field full-width">
                <div className="switch-field">
                  <span>
                    <strong>默认分解碎片</strong>
                    <small>
                      卡片未单独选择碎片时，合成和分解会使用这个物品。
                    </small>
                  </span>
                  <Switch
                    checked={values.default_fragment === true}
                    onChange={(checked) =>
                      setValues({
                        ...values,
                        default_fragment: checked,
                      })
                    }
                  />
                </div>
              </Form.Item>
            )}
            <Form.Item className="form-field full-width" label="物品说明">
              <Input.TextArea
                value={values.drop_desc}
                placeholder="给运营和玩家都能看懂的说明"
                autoSize={{ minRows: 4, maxRows: 8 }}
                onChange={(event) =>
                  setValues({ ...values, drop_desc: event.target.value })
                }
              />
            </Form.Item>
            {showUsageParams && (
              <>
                <Form.Item
                  className="form-field"
                  label="用途参数类型"
                  extra="普通道具和其他类型可用于后续业务扩展。"
                >
                  <InputNumber
                    className="full-width-control"
                    min={0}
                    value={Number(values.drop_item_type || 0)}
                    onChange={(value) =>
                      setValues({
                        ...values,
                        drop_item_type: Number(value || 0),
                      })
                    }
                  />
                </Form.Item>
                <Form.Item
                  className="form-field"
                  label="用途参数值"
                  extra="没有特殊规则时保持 0。"
                >
                  <InputNumber
                    className="full-width-control"
                    min={0}
                    value={Number(values.drop_item_value || 0)}
                    onChange={(value) =>
                      setValues({
                        ...values,
                        drop_item_value: Number(value || 0),
                      })
                    }
                  />
                </Form.Item>
              </>
            )}
            <Form.Item className="form-field" label="状态">
              <Select
                value={values.disabled ? "true" : "false"}
                onChange={(value) =>
                  setValues({ ...values, disabled: value === "true" })
                }
                options={[
                  { label: "启用", value: "false" },
                  { label: "禁用", value: "true" },
                ]}
              />
            </Form.Item>
          </Form>
        </Card>
        {error && <Alert type="error" message={error} showIcon />}
      </Space>
    </Modal>
  );
}

function RedeemCodesPage({ options }: { options: AdminOptions | null }) {
  const { message, modal } = AntApp.useApp();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [keyword, setKeyword] = useState("");
  const [data, setData] = useState<PageResult<RedeemCodeRecord> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<RedeemCodeRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<RedeemCodeRecord | null>(null);

  const filters = useMemo(
    () => ({ page, pageSize, keyword }),
    [page, pageSize, keyword],
  );
  const load = useCallback(() => {
    setLoading(true);
    setError("");
    request<PageResult<RedeemCodeRecord>>(
      `/admin/redeem-codes${toQuery(filters)}`,
    )
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = data?.list || [];
  const columns: TableColumnsType<RedeemCodeRecord> = [
    {
      title: "兑换码",
      dataIndex: "code",
      render: (value) => (
        <Typography.Text className="mono" copyable>
          {String(value || "-")}
        </Typography.Text>
      ),
    },
    {
      title: "名称",
      dataIndex: "name",
      ellipsis: true,
    },
    {
      title: "状态",
      dataIndex: "enabled",
      width: 96,
      render: (enabled) => (
        <Tag color={enabled ? "success" : "default"}>
          {enabled ? "启用" : "停用"}
        </Tag>
      ),
    },
    {
      title: "库存",
      width: 120,
      render: (_, row) =>
        `${row.used_count || 0} / ${row.total_limit || "不限"}`,
    },
    {
      title: "奖励",
      dataIndex: "rewards",
      ellipsis: true,
      render: (rewards) => formatRewards(rewards),
    },
    {
      title: "有效期",
      width: 260,
      render: (_, row) => formatDateRange(row.starts_at, row.ends_at),
    },
    {
      title: "操作",
      width: 210,
      fixed: "right",
      render: (_, row) => (
        <Space size={8} wrap>
          <Button
            size="small"
            icon={<Eye size={14} />}
            onClick={() => setDetail(row)}
          >
            详情
          </Button>
          <Button size="small" onClick={() => setEditing(row)}>
            编辑
          </Button>
          <Button
            size="small"
            danger
            icon={<Trash2 size={14} />}
            onClick={() => deleteRedeemCode(row)}
            aria-label="删除"
          />
        </Space>
      ),
    },
  ];

  async function saveRedeemCode(values: Partial<RedeemCodeRecord>) {
    const current = editing;
    await request(
      current ? `/admin/redeem-codes/${current.id}` : "/admin/redeem-codes",
      {
        method: current ? "PATCH" : "POST",
        body: JSON.stringify(values),
      },
    );
    setEditing(null);
    setCreating(false);
    load();
  }

  function deleteRedeemCode(row: RedeemCodeRecord) {
    modal.confirm({
      title: `确认停用并删除兑换码 ${row.code}？`,
      content: "已有领取记录会保留用于审计。",
      okText: "确认删除",
      cancelText: "取消",
      okButtonProps: { danger: true },
      async onOk() {
        await request(`/admin/redeem-codes/${row.id}`, { method: "DELETE" });
        message.success("兑换码已删除");
        load();
      },
    });
  }

  return (
    <Panel title="兑换码管理" icon={<Gift size={18} />} className="table-panel">
      <Space className="table-toolbar" wrap>
        <Input
          className="toolbar-search"
          prefix={<Search size={16} />}
          allowClear
          value={keyword}
          onChange={(event) => {
            setPage(1);
            setKeyword(event.target.value);
          }}
          placeholder="搜索兑换码或名称"
        />
        <Space className="toolbar-actions" wrap>
          <Button
            icon={<RefreshCw size={15} />}
            onClick={load}
            disabled={loading}
          >
            刷新
          </Button>
          <Button
            icon={<Download size={15} />}
            onClick={() => exportRowsToCsv("兑换码", rows, redeemCodeFields)}
            disabled={!rows.length}
          >
            导出CSV
          </Button>
          <Button type="primary" onClick={() => setCreating(true)}>
            新增
          </Button>
        </Space>
      </Space>

      {error && <StateBox type="error">{error}</StateBox>}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={loading}
        scroll={{ x: "max-content" }}
        pagination={{
          current: page,
          pageSize,
          total: data?.total || 0,
          showSizeChanger: false,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (nextPage) => setPage(nextPage),
        }}
        locale={{
          emptyText: error ? "加载失败" : <Empty description="暂无兑换码" />,
        }}
      />

      {(creating || editing) && (
        <RedeemCodeModal
          initial={editing || null}
          itemOptions={options?.dropItems || []}
          onCancel={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSubmit={saveRedeemCode}
        />
      )}

      {detail && (
        <DetailModal
          title="兑换码详情"
          fields={redeemCodeFields}
          data={detail}
          loading={false}
          onClose={() => setDetail(null)}
        />
      )}
    </Panel>
  );
}

function RedeemUsagesPage() {
  return (
    <AdminTable
      title="兑换记录"
      endpoint="/admin/redeem-usages"
      fields={redeemUsageFields}
      searchPlaceholder="按 UID 查询"
      keywordParam="uid"
    />
  );
}

function RedeemCodeModal({
  initial,
  itemOptions,
  onCancel,
  onSubmit,
}: {
  initial: RedeemCodeRecord | null;
  itemOptions: SelectOption[];
  onCancel: () => void;
  onSubmit: (values: Partial<RedeemCodeRecord>) => Promise<void>;
}) {
  const [values, setValues] = useState(() => createRedeemFormState(initial));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const groupedItemOptions = groupItemOptions(itemOptions);
  const itemSelectOptions = groupedItemOptions.map((group) => ({
    label: group.label,
    options: group.options.map((option) => ({
      label: option.label,
      value: String(option.value),
      disabled: option.disabled,
    })),
  }));

  async function submit() {
    setLoading(true);
    setError("");
    try {
      await onSubmit({
        ...values,
        starts_at: fromDateTimeLocal(values.starts_at),
        ends_at: fromDateTimeLocal(values.ends_at),
        total_limit:
          values.total_limit === "" ? null : Number(values.total_limit),
      } as Partial<RedeemCodeRecord>);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
      setLoading(false);
    }
  }

  return (
    <Modal
      title={
        <div>
          <span className="eyebrow">兑换码</span>
          <Typography.Title level={4}>
            {initial ? "编辑兑换码" : "新增兑换码"}
          </Typography.Title>
        </div>
      }
      open
      width={860}
      onCancel={onCancel}
      onOk={submit}
      okText="保存兑换码"
      cancelText="取消"
      confirmLoading={loading}
      destroyOnHidden
    >
      <Space
        direction="vertical"
        size={16}
        className="full-width admin-form-stack"
      >
        <Card
          size="small"
          className="admin-form-card form-section-card"
          title="基础信息"
        >
          <Form layout="vertical" className="admin-form-grid antd-form-grid">
            <Form.Item className="form-field" label="兑换码">
              <Input
                value={values.code}
                placeholder="WELCOME2026"
                onChange={(event) =>
                  setValues({
                    ...values,
                    code: event.target.value.toUpperCase(),
                  })
                }
              />
            </Form.Item>
            <Form.Item className="form-field" label="名称">
              <Input
                value={values.name}
                placeholder="欢迎礼包"
                onChange={(event) =>
                  setValues({ ...values, name: event.target.value })
                }
              />
            </Form.Item>
            <Form.Item className="form-field" label="状态">
              <Select
                value={values.enabled ? "true" : "false"}
                onChange={(value) =>
                  setValues({ ...values, enabled: value === "true" })
                }
                options={[
                  { label: "启用", value: "true" },
                  { label: "停用", value: "false" },
                ]}
              />
            </Form.Item>
            <Form.Item className="form-field" label="总库存">
              <InputNumber
                className="full-width-control"
                min={1}
                value={
                  values.total_limit === "" ? null : Number(values.total_limit)
                }
                placeholder="留空表示不限"
                onChange={(value) =>
                  setValues({
                    ...values,
                    total_limit: value === null ? "" : String(value),
                  })
                }
              />
            </Form.Item>
            <Form.Item className="form-field" label="开始时间">
              <Input
                type="datetime-local"
                value={values.starts_at}
                onChange={(event) =>
                  setValues({ ...values, starts_at: event.target.value })
                }
              />
            </Form.Item>
            <Form.Item className="form-field" label="结束时间">
              <Input
                type="datetime-local"
                value={values.ends_at}
                onChange={(event) =>
                  setValues({ ...values, ends_at: event.target.value })
                }
              />
            </Form.Item>
            <Form.Item className="form-field full-width" label="描述">
              <Input.TextArea
                value={values.description}
                placeholder="面向运营和客服的备注"
                autoSize={{ minRows: 3, maxRows: 6 }}
                onChange={(event) =>
                  setValues({ ...values, description: event.target.value })
                }
              />
            </Form.Item>
          </Form>
        </Card>

        <Card
          size="small"
          className="admin-form-card form-section-card"
          title="奖励内容"
          extra={<Tag color="blue">{formatRewards(values.rewards)}</Tag>}
        >
          <Space direction="vertical" size={12} className="full-width">
            <Form layout="vertical">
              <Form.Item label="奖励积分">
                <InputNumber
                  className="full-width-control"
                  min={0}
                  value={values.rewards.points}
                  onChange={(value) =>
                    setValues({
                      ...values,
                      rewards: {
                        ...values.rewards,
                        points: Number(value || 0),
                      },
                    })
                  }
                />
              </Form.Item>
            </Form>
            <Space direction="vertical" size={8} className="full-width">
              {values.rewards.items.map((item, index) => (
                <Space
                  className="reward-item-row antd-reward-row"
                  key={index}
                  wrap
                >
                  <Select
                    className="reward-item-select"
                    value={item.itemId ? String(item.itemId) : undefined}
                    placeholder="选择物品"
                    options={itemSelectOptions}
                    onChange={(value) =>
                      setValues({
                        ...values,
                        rewards: updateRewardItem(values.rewards, index, {
                          itemId: Number(value),
                        }),
                      })
                    }
                  />
                  <InputNumber
                    className="reward-num-input"
                    min={1}
                    value={item.num}
                    onChange={(value) =>
                      setValues({
                        ...values,
                        rewards: updateRewardItem(values.rewards, index, {
                          num: Number(value || 1),
                        }),
                      })
                    }
                  />
                  <Button
                    onClick={() =>
                      setValues({
                        ...values,
                        rewards: {
                          ...values.rewards,
                          items: values.rewards.items.filter(
                            (_, i) => i !== index,
                          ),
                        },
                      })
                    }
                  >
                    移除
                  </Button>
                </Space>
              ))}
            </Space>
            <Typography.Text type="secondary">
              积分请使用“奖励积分”字段；物品奖励主要选择卡片碎片或普通道具。
            </Typography.Text>
            <Button
              onClick={() =>
                setValues({
                  ...values,
                  rewards: {
                    ...values.rewards,
                    items: [...values.rewards.items, { itemId: 0, num: 1 }],
                  },
                })
              }
            >
              添加物品奖励
            </Button>
          </Space>
        </Card>
        {error && <Alert type="error" message={error} showIcon />}
      </Space>
    </Modal>
  );
}

function ExchangeShopPage({ options }: { options: AdminOptions | null }) {
  const { message, modal } = AntApp.useApp();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [keyword, setKeyword] = useState("");
  const [data, setData] = useState<PageResult<ExchangeShopItemRecord> | null>(
    null,
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<ExchangeShopItemRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<ExchangeShopItemRecord | null>(null);

  const filters = useMemo(
    () => ({ page, pageSize, keyword }),
    [page, pageSize, keyword],
  );
  const load = useCallback(() => {
    setLoading(true);
    setError("");
    request<PageResult<ExchangeShopItemRecord>>(
      `/admin/exchange-items${toQuery(filters)}`,
    )
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = data?.list || [];
  const columns: TableColumnsType<ExchangeShopItemRecord> = [
    {
      title: "兑换项",
      dataIndex: "name",
      ellipsis: true,
    },
    {
      title: "状态",
      dataIndex: "enabled",
      width: 96,
      render: (enabled) => (
        <Tag color={enabled ? "success" : "default"}>
          {enabled ? "启用" : "停用"}
        </Tag>
      ),
    },
    {
      title: "消耗",
      dataIndex: "costs",
      ellipsis: true,
      render: (costs) => formatCosts(costs),
    },
    {
      title: "奖励",
      dataIndex: "rewards",
      ellipsis: true,
      render: (rewards) => formatRewards(rewards),
    },
    {
      title: "库存",
      width: 120,
      render: (_, row) =>
        `${row.used_count || 0} / ${row.total_limit || "不限"}`,
    },
    {
      title: "限兑",
      dataIndex: "user_limit",
      width: 96,
      render: (value) => value || "不限",
    },
    {
      title: "有效期",
      width: 260,
      render: (_, row) => formatDateRange(row.starts_at, row.ends_at),
    },
    {
      title: "操作",
      width: 210,
      fixed: "right",
      render: (_, row) => (
        <Space size={8} wrap>
          <Button
            size="small"
            icon={<Eye size={14} />}
            onClick={() => setDetail(row)}
          >
            详情
          </Button>
          <Button size="small" onClick={() => setEditing(row)}>
            编辑
          </Button>
          <Button
            size="small"
            danger
            icon={<Trash2 size={14} />}
            onClick={() => deleteExchangeItem(row)}
            aria-label="删除"
          />
        </Space>
      ),
    },
  ];

  async function saveExchangeItem(values: Partial<ExchangeShopItemRecord>) {
    const current = editing;
    await request(
      current ? `/admin/exchange-items/${current.id}` : "/admin/exchange-items",
      {
        method: current ? "PATCH" : "POST",
        body: JSON.stringify(values),
      },
    );
    setEditing(null);
    setCreating(false);
    load();
  }

  function deleteExchangeItem(row: ExchangeShopItemRecord) {
    modal.confirm({
      title: `确认停用并删除兑换项 ${row.name}？`,
      content: "兑换记录会保留用于审计。",
      okText: "确认删除",
      cancelText: "取消",
      okButtonProps: { danger: true },
      async onOk() {
        await request(`/admin/exchange-items/${row.id}`, { method: "DELETE" });
        message.success("兑换项已删除");
        load();
      },
    });
  }

  return (
    <Panel title="兑换商店" icon={<Store size={18} />} className="table-panel">
      <Space className="table-toolbar" wrap>
        <Input
          className="toolbar-search"
          prefix={<Search size={16} />}
          allowClear
          value={keyword}
          onChange={(event) => {
            setPage(1);
            setKeyword(event.target.value);
          }}
          placeholder="搜索兑换项名称或说明"
        />
        <Space className="toolbar-actions" wrap>
          <Button
            icon={<RefreshCw size={15} />}
            onClick={load}
            disabled={loading}
          >
            刷新
          </Button>
          <Button
            icon={<Download size={15} />}
            onClick={() =>
              exportRowsToCsv("兑换商店", rows, exchangeItemFields)
            }
            disabled={!rows.length}
          >
            导出CSV
          </Button>
          <Button type="primary" onClick={() => setCreating(true)}>
            新增
          </Button>
        </Space>
      </Space>

      {error && <StateBox type="error">{error}</StateBox>}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={loading}
        scroll={{ x: "max-content" }}
        pagination={{
          current: page,
          pageSize,
          total: data?.total || 0,
          showSizeChanger: false,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (nextPage) => setPage(nextPage),
        }}
        locale={{
          emptyText: error ? "加载失败" : <Empty description="暂无兑换项" />,
        }}
      />

      {(creating || editing) && (
        <ExchangeShopModal
          initial={editing || null}
          itemOptions={options?.dropItems || []}
          onCancel={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSubmit={saveExchangeItem}
        />
      )}

      {detail && (
        <DetailModal
          title="兑换项详情"
          fields={exchangeItemFields}
          data={detail}
          loading={false}
          onClose={() => setDetail(null)}
        />
      )}
    </Panel>
  );
}

function ExchangeUsagesPage() {
  return (
    <AdminTable
      title="兑换商店记录"
      endpoint="/admin/exchange-usages"
      fields={exchangeUsageFields}
      searchPlaceholder="按 UID 查询"
      keywordParam="uid"
    />
  );
}

function LaunchActivityConfigPanel({
  options,
}: {
  options: AdminOptions | null;
}) {
  const [config, setConfig] = useState<LaunchActivityConfigRecord | null>(null);
  const [values, setValues] = useState<LaunchActivityConfigRecord>(() =>
    createLaunchActivityFormState(null),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const rewardGroups = groupItemOptions(
    options?.dropItems || [],
    (option) => option.type !== 1,
  );
  const rewardSelectOptions = rewardGroups.map((group) => ({
    label: group.label,
    options: group.options.map((option) => ({
      label: option.label,
      value: String(option.value),
      disabled: option.disabled,
    })),
  }));

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    request<LaunchActivityConfigRecord>("/admin/config/launch-activity")
      .then((data) => {
        setConfig(data);
        setValues(createLaunchActivityFormState(data));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submit() {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const next = await request<LaunchActivityConfigRecord>(
        "/admin/config/launch-activity",
        {
          method: "PATCH",
          body: JSON.stringify({
            enabled: values.enabled,
            activity_key: values.activity_key,
            name: values.name,
            description: values.description || "",
            starts_at: fromDateTimeLocal(String(values.starts_at || "")),
            ends_at: fromDateTimeLocal(String(values.ends_at || "")),
            rewards: values.rewards,
          }),
        },
      );
      setConfig(next);
      setValues(createLaunchActivityFormState(next));
      setNotice("开服活动配置已保存");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel
      title="开服活动配置"
      icon={<Gift size={18} />}
      action={<RefreshButton onClick={load} loading={loading} />}
    >
      <Space
        direction="vertical"
        size={16}
        className="full-width admin-form-stack"
      >
        <Alert
          type="info"
          showIcon
          message="活动批次用于控制是否可重复领取"
          description="修改活动批次会视为新一期活动，已经领取旧批次的玩家可以再次领取新批次。"
        />
        <Card
          size="small"
          className="admin-form-card form-section-card"
          title="活动规则"
        >
          <Form layout="vertical" className="admin-form-grid antd-form-grid">
            <Form.Item className="form-field" label="活动状态">
              <Select
                value={values.enabled ? "true" : "false"}
                onChange={(value) =>
                  setValues({ ...values, enabled: value === "true" })
                }
                options={[
                  { label: "关闭", value: "false" },
                  { label: "开启", value: "true" },
                ]}
              />
            </Form.Item>
            <Form.Item
              className="form-field"
              label="活动批次"
              extra="只允许字母、数字、下划线和中划线。"
            >
              <Input
                value={values.activity_key}
                placeholder="launch-2026"
                onChange={(event) =>
                  setValues({ ...values, activity_key: event.target.value })
                }
              />
            </Form.Item>
            <Form.Item className="form-field" label="活动名称">
              <Input
                value={values.name}
                placeholder="开服福利"
                onChange={(event) =>
                  setValues({ ...values, name: event.target.value })
                }
              />
            </Form.Item>
            <Form.Item className="form-field" label="开始时间">
              <Input
                type="datetime-local"
                value={String(values.starts_at || "")}
                onChange={(event) =>
                  setValues({ ...values, starts_at: event.target.value })
                }
              />
            </Form.Item>
            <Form.Item className="form-field" label="结束时间">
              <Input
                type="datetime-local"
                value={String(values.ends_at || "")}
                onChange={(event) =>
                  setValues({ ...values, ends_at: event.target.value })
                }
              />
            </Form.Item>
            <Form.Item className="form-field full-width" label="活动说明">
              <Input.TextArea
                value={values.description || ""}
                placeholder="展示给玩家看的活动说明"
                autoSize={{ minRows: 3, maxRows: 6 }}
                onChange={(event) =>
                  setValues({ ...values, description: event.target.value })
                }
              />
            </Form.Item>
          </Form>
        </Card>

        <Card
          size="small"
          className="admin-form-card form-section-card"
          title="领取奖励"
          extra={<Tag color="blue">{formatRewards(values.rewards)}</Tag>}
        >
          <Space direction="vertical" size={12} className="full-width">
            <Form layout="vertical" className="single-field-form">
              <Form.Item label="奖励积分">
                <InputNumber
                  className="full-width-control"
                  min={0}
                  step={1}
                  value={values.rewards.points}
                  onChange={(value) =>
                    setValues({
                      ...values,
                      rewards: {
                        ...values.rewards,
                        points: Number(value || 0),
                      },
                    })
                  }
                />
              </Form.Item>
            </Form>
            {values.rewards.items.map((item, index) => (
              <Space
                className="reward-item-row antd-reward-row"
                key={index}
                wrap
              >
                <Select
                  className="reward-item-select"
                  value={item.itemId ? String(item.itemId) : undefined}
                  placeholder="选择奖励物品"
                  options={rewardSelectOptions}
                  onChange={(value) =>
                    setValues({
                      ...values,
                      rewards: updateRewardItem(values.rewards, index, {
                        itemId: Number(value),
                      }),
                    })
                  }
                />
                <InputNumber
                  className="reward-num-input"
                  min={1}
                  value={item.num}
                  onChange={(value) =>
                    setValues({
                      ...values,
                      rewards: updateRewardItem(values.rewards, index, {
                        num: Number(value || 1),
                      }),
                    })
                  }
                />
                <Button
                  onClick={() =>
                    setValues({
                      ...values,
                      rewards: {
                        ...values.rewards,
                        items: values.rewards.items.filter(
                          (_, i) => i !== index,
                        ),
                      },
                    })
                  }
                >
                  移除
                </Button>
              </Space>
            ))}
            <Typography.Text type="secondary">
              奖励支持积分和背包物品，不直接发卡；虚拟积分物品不会出现在物品选择中。
            </Typography.Text>
            <Button
              onClick={() =>
                setValues({
                  ...values,
                  rewards: {
                    ...values.rewards,
                    items: [...values.rewards.items, { itemId: 0, num: 1 }],
                  },
                })
              }
            >
              添加物品奖励
            </Button>
          </Space>
        </Card>

        <Card
          size="small"
          className="admin-form-card form-section-card"
          title="当前生效配置"
        >
          <div className="admin-form-actions config-summary-row">
            <DescriptionList
              items={[
                ["当前状态", config?.enabled ? "开启" : "关闭"],
                ["活动批次", config?.activity_key || "-"],
                ["活动名称", config?.name || "-"],
                ["有效期", formatDateRange(config?.starts_at, config?.ends_at)],
                ["奖励", formatRewards(config?.rewards)],
              ]}
            />
            <Button type="primary" loading={loading} onClick={submit}>
              保存开服活动配置
            </Button>
          </div>
        </Card>
        {error && <Alert type="error" message={error} showIcon />}
        {notice && <Alert type="success" message={notice} showIcon />}
      </Space>
    </Panel>
  );
}

function LaunchActivityClaimsPage() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [uid, setUid] = useState("");
  const [activityKey, setActivityKey] = useState("");
  const [data, setData] =
    useState<PageResult<LaunchActivityClaimRecord> | null>(null);
  const [detail, setDetail] = useState<LaunchActivityClaimRecord | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const filters = useMemo(
    () => ({ page, pageSize, uid, activityKey }),
    [page, pageSize, uid, activityKey],
  );
  const load = useCallback(() => {
    setLoading(true);
    setError("");
    request<PageResult<LaunchActivityClaimRecord>>(
      `/admin/launch-activity-claims${toQuery(filters)}`,
    )
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = data?.list || [];
  const columns: TableColumnsType<LaunchActivityClaimRecord> = [
    {
      title: "活动批次",
      dataIndex: "activity_key",
      ellipsis: true,
      render: (value) => (
        <Typography.Text className="mono">
          {String(value || "-")}
        </Typography.Text>
      ),
    },
    {
      title: "活动名称",
      dataIndex: "activity_name",
      ellipsis: true,
    },
    {
      title: "UID",
      dataIndex: "uid",
      ellipsis: true,
      render: (value) => (
        <Typography.Text className="mono">
          {String(value || "-")}
        </Typography.Text>
      ),
    },
    {
      title: "奖励",
      dataIndex: "reward_snapshot",
      ellipsis: true,
      render: (rewards) => formatRewards(rewards),
    },
    {
      title: "领取时间",
      dataIndex: "createdAt",
      width: 190,
      render: formatDate,
    },
    {
      title: "操作",
      width: 110,
      fixed: "right",
      render: (_, row) => (
        <Button
          size="small"
          icon={<Eye size={14} />}
          onClick={() => setDetail(row)}
        >
          详情
        </Button>
      ),
    },
  ];

  function resetFilters() {
    setPage(1);
    setUid("");
    setActivityKey("");
  }

  return (
    <Panel
      title="活动领取记录"
      icon={<History size={18} />}
      action={<RefreshButton onClick={load} loading={loading} />}
      className="table-panel"
    >
      <Space className="table-toolbar" wrap>
        <Input
          className="toolbar-search compact"
          prefix={<Search size={16} />}
          allowClear
          value={uid}
          onChange={(event) => {
            setPage(1);
            setUid(event.target.value);
          }}
          placeholder="搜索 UID"
        />
        <Input
          className="toolbar-control"
          allowClear
          value={activityKey}
          onChange={(event) => {
            setPage(1);
            setActivityKey(event.target.value);
          }}
          placeholder="活动批次"
        />
        <Space className="toolbar-actions" wrap>
          <Button onClick={resetFilters}>重置</Button>
          <Button
            icon={<Download size={15} />}
            onClick={() =>
              exportRowsToCsv("活动领取记录", rows, launchActivityClaimFields)
            }
            disabled={!rows.length}
          >
            导出CSV
          </Button>
        </Space>
      </Space>
      {error && <StateBox type="error">{error}</StateBox>}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={loading}
        scroll={{ x: "max-content" }}
        pagination={{
          current: page,
          pageSize,
          total: data?.total || 0,
          showSizeChanger: false,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (nextPage) => setPage(nextPage),
        }}
        locale={{
          emptyText: error ? (
            "加载失败"
          ) : (
            <Empty description="暂无活动领取记录" />
          ),
        }}
      />
      {detail && (
        <DetailModal
          title="活动领取详情"
          fields={launchActivityClaimFields}
          data={detail}
          loading={false}
          onClose={() => setDetail(null)}
        />
      )}
    </Panel>
  );
}

function ExchangeShopModal({
  initial,
  itemOptions,
  onCancel,
  onSubmit,
}: {
  initial: ExchangeShopItemRecord | null;
  itemOptions: SelectOption[];
  onCancel: () => void;
  onSubmit: (values: Partial<ExchangeShopItemRecord>) => Promise<void>;
}) {
  const [values, setValues] = useState(() => createExchangeFormState(initial));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const consumableGroups = groupItemOptions(
    itemOptions,
    (option) => option.type !== 1,
  );
  const rewardGroups = groupItemOptions(
    itemOptions,
    (option) => option.type !== 1,
  );
  const consumableSelectOptions = consumableGroups.map((group) => ({
    label: group.label,
    options: group.options.map((option) => ({
      label: option.label,
      value: String(option.value),
      disabled: option.disabled,
    })),
  }));
  const rewardSelectOptions = rewardGroups.map((group) => ({
    label: group.label,
    options: group.options.map((option) => ({
      label: option.label,
      value: String(option.value),
      disabled: option.disabled,
    })),
  }));

  async function submit() {
    setLoading(true);
    setError("");
    try {
      await onSubmit({
        ...values,
        starts_at: fromDateTimeLocal(values.starts_at),
        ends_at: fromDateTimeLocal(values.ends_at),
        total_limit:
          values.total_limit === "" ? null : Number(values.total_limit),
        user_limit: values.user_limit === "" ? null : Number(values.user_limit),
        sort_order: Number(values.sort_order || 0),
      } as Partial<ExchangeShopItemRecord>);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
      setLoading(false);
    }
  }

  return (
    <Modal
      title={
        <div>
          <span className="eyebrow">兑换商店</span>
          <Typography.Title level={4}>
            {initial ? "编辑兑换项" : "新增兑换项"}
          </Typography.Title>
        </div>
      }
      open
      width={900}
      onCancel={onCancel}
      onOk={submit}
      okText="保存兑换项"
      cancelText="取消"
      confirmLoading={loading}
      destroyOnHidden
    >
      <Space
        direction="vertical"
        size={16}
        className="full-width admin-form-stack"
      >
        <Card
          size="small"
          className="admin-form-card form-section-card"
          title="基础信息"
        >
          <Form layout="vertical" className="admin-form-grid antd-form-grid">
            <Form.Item className="form-field" label="兑换项名称">
              <Input
                value={values.name}
                placeholder="例如：活动代币换积分"
                onChange={(event) =>
                  setValues({ ...values, name: event.target.value })
                }
              />
            </Form.Item>
            <Form.Item className="form-field" label="状态">
              <Select
                value={values.enabled ? "true" : "false"}
                onChange={(value) =>
                  setValues({ ...values, enabled: value === "true" })
                }
                options={[
                  { label: "启用", value: "true" },
                  { label: "停用", value: "false" },
                ]}
              />
            </Form.Item>
            <Form.Item className="form-field" label="总库存">
              <InputNumber
                className="full-width-control"
                min={1}
                value={
                  values.total_limit === "" ? null : Number(values.total_limit)
                }
                placeholder="留空表示不限"
                onChange={(value) =>
                  setValues({
                    ...values,
                    total_limit: value === null ? "" : String(value),
                  })
                }
              />
            </Form.Item>
            <Form.Item className="form-field" label="单用户限兑">
              <InputNumber
                className="full-width-control"
                min={1}
                value={
                  values.user_limit === "" ? null : Number(values.user_limit)
                }
                placeholder="留空表示不限"
                onChange={(value) =>
                  setValues({
                    ...values,
                    user_limit: value === null ? "" : String(value),
                  })
                }
              />
            </Form.Item>
            <Form.Item className="form-field" label="开始时间">
              <Input
                type="datetime-local"
                value={values.starts_at}
                onChange={(event) =>
                  setValues({ ...values, starts_at: event.target.value })
                }
              />
            </Form.Item>
            <Form.Item className="form-field" label="结束时间">
              <Input
                type="datetime-local"
                value={values.ends_at}
                onChange={(event) =>
                  setValues({ ...values, ends_at: event.target.value })
                }
              />
            </Form.Item>
            <Form.Item className="form-field" label="排序">
              <InputNumber
                className="full-width-control"
                min={0}
                value={Number(values.sort_order || 0)}
                onChange={(value) =>
                  setValues({ ...values, sort_order: Number(value || 0) })
                }
              />
            </Form.Item>
            <Form.Item className="form-field full-width" label="说明">
              <Input.TextArea
                value={values.description}
                placeholder="给运营和客服看的兑换说明"
                autoSize={{ minRows: 3, maxRows: 6 }}
                onChange={(event) =>
                  setValues({ ...values, description: event.target.value })
                }
              />
            </Form.Item>
          </Form>
        </Card>

        <Card
          size="small"
          className="admin-form-card form-section-card"
          title="消耗物品"
          extra={<Tag color="blue">{formatCosts(values.costs)}</Tag>}
        >
          <Space direction="vertical" size={12} className="full-width">
            {values.costs.map((item, index) => (
              <Space
                className="reward-item-row antd-reward-row"
                key={index}
                wrap
              >
                <Select
                  className="reward-item-select"
                  value={item.itemId ? String(item.itemId) : undefined}
                  placeholder="选择消耗物品"
                  options={consumableSelectOptions}
                  onChange={(value) =>
                    setValues({
                      ...values,
                      costs: updateCostItem(values.costs, index, {
                        itemId: Number(value),
                      }),
                    })
                  }
                />
                <InputNumber
                  className="reward-num-input"
                  min={1}
                  value={item.num}
                  onChange={(value) =>
                    setValues({
                      ...values,
                      costs: updateCostItem(values.costs, index, {
                        num: Number(value || 1),
                      }),
                    })
                  }
                />
                <Button
                  onClick={() =>
                    setValues({
                      ...values,
                      costs: values.costs.filter((_, i) => i !== index),
                    })
                  }
                >
                  移除
                </Button>
              </Space>
            ))}
            <Typography.Text type="secondary">
              消耗项只支持背包物品，不能选择虚拟积分；积分消耗后续单独设计。
            </Typography.Text>
            <Button
              onClick={() =>
                setValues({
                  ...values,
                  costs: [...values.costs, { itemId: 0, num: 1 }],
                })
              }
            >
              添加消耗物品
            </Button>
          </Space>
        </Card>

        <Card
          size="small"
          className="admin-form-card form-section-card"
          title="兑换奖励"
          extra={<Tag color="blue">{formatRewards(values.rewards)}</Tag>}
        >
          <Space direction="vertical" size={12} className="full-width">
            <Form layout="vertical">
              <Form.Item label="奖励积分">
                <InputNumber
                  className="full-width-control"
                  min={0}
                  value={values.rewards.points}
                  onChange={(value) =>
                    setValues({
                      ...values,
                      rewards: {
                        ...values.rewards,
                        points: Number(value || 0),
                      },
                    })
                  }
                />
              </Form.Item>
            </Form>
            {values.rewards.items.map((item, index) => (
              <Space
                className="reward-item-row antd-reward-row"
                key={index}
                wrap
              >
                <Select
                  className="reward-item-select"
                  value={item.itemId ? String(item.itemId) : undefined}
                  placeholder="选择奖励物品"
                  options={rewardSelectOptions}
                  onChange={(value) =>
                    setValues({
                      ...values,
                      rewards: updateRewardItem(values.rewards, index, {
                        itemId: Number(value),
                      }),
                    })
                  }
                />
                <InputNumber
                  className="reward-num-input"
                  min={1}
                  value={item.num}
                  onChange={(value) =>
                    setValues({
                      ...values,
                      rewards: updateRewardItem(values.rewards, index, {
                        num: Number(value || 1),
                      }),
                    })
                  }
                />
                <Button
                  onClick={() =>
                    setValues({
                      ...values,
                      rewards: {
                        ...values.rewards,
                        items: values.rewards.items.filter(
                          (_, i) => i !== index,
                        ),
                      },
                    })
                  }
                >
                  移除
                </Button>
              </Space>
            ))}
            <Typography.Text type="secondary">
              积分请使用“奖励积分”字段；虚拟积分物品不会出现在奖励物品选择里。
            </Typography.Text>
            <Button
              onClick={() =>
                setValues({
                  ...values,
                  rewards: {
                    ...values.rewards,
                    items: [...values.rewards.items, { itemId: 0, num: 1 }],
                  },
                })
              }
            >
              添加奖励物品
            </Button>
          </Space>
        </Card>
        {error && <Alert type="error" message={error} showIcon />}
      </Space>
    </Modal>
  );
}

function TradeListingsPage() {
  return (
    <AdminTable
      title="交易挂单"
      endpoint="/admin/trade-listings"
      fields={tradeListingFields}
      deletable
      detailFetchable
      searchPlaceholder="按卡片 UUID 查询"
    />
  );
}

function TradeRecordsPage() {
  return (
    <AdminTable
      title="交易记录"
      endpoint="/admin/trade-records"
      fields={tradeRecordFields}
      detailFetchable
      searchPlaceholder="按 UID 查询"
      keywordParam="uid"
    />
  );
}

function TradeConfigPanel() {
  const [config, setConfig] = useState<TradeConfigRecord | null>(null);
  const [values, setValues] = useState<TradeConfigRecord>({
    enabled: true,
    fee_rate: 0,
    min_price: 1,
    max_price: 999999,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    request<TradeConfigRecord>("/admin/config/trade")
      .then((data) => {
        setConfig(data);
        setValues({
          ...data,
          fee_rate: Number(data.fee_rate || 0),
          min_price: Number(data.min_price || 1),
          max_price: Number(data.max_price || 999999),
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submit() {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const next = await request<TradeConfigRecord>("/admin/config/trade", {
        method: "PATCH",
        body: JSON.stringify({
          enabled: values.enabled,
          fee_rate: Number(values.fee_rate || 0),
          min_price: Number(values.min_price || 1),
          max_price: Number(values.max_price || 999999),
        }),
      });
      setConfig(next);
      setValues(next);
      setNotice("交易配置已保存");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel
      title="交易配置"
      icon={<Handshake size={18} />}
      action={<RefreshButton onClick={load} loading={loading} />}
    >
      <Space
        direction="vertical"
        size={16}
        className="full-width admin-form-stack"
      >
        <Card
          size="small"
          className="admin-form-card form-section-card"
          title="交易规则"
        >
          <Form layout="vertical" className="admin-form-grid antd-form-grid">
            <Form.Item className="form-field" label="交易状态">
              <Select
                value={String(values.enabled)}
                onChange={(value) =>
                  setValues({ ...values, enabled: value === "true" })
                }
                options={[
                  { label: "开启", value: "true" },
                  { label: "关闭", value: "false" },
                ]}
              />
            </Form.Item>
            <Form.Item
              className="form-field"
              label="手续费率"
              extra="0.05 表示 5%，成交时按挂单创建时的费率结算。"
            >
              <InputNumber
                className="full-width-control"
                min={0}
                max={1}
                step={0.0001}
                value={Number(values.fee_rate || 0)}
                onChange={(value) =>
                  setValues({ ...values, fee_rate: Number(value || 0) })
                }
              />
            </Form.Item>
            <Form.Item className="form-field" label="最低价格">
              <InputNumber
                className="full-width-control"
                min={1}
                step={1}
                value={Number(values.min_price || 1)}
                onChange={(value) =>
                  setValues({ ...values, min_price: Number(value || 1) })
                }
              />
            </Form.Item>
            <Form.Item className="form-field" label="最高价格">
              <InputNumber
                className="full-width-control"
                min={1}
                max={999999}
                step={1}
                value={Number(values.max_price || 999999)}
                onChange={(value) =>
                  setValues({ ...values, max_price: Number(value || 999999) })
                }
              />
            </Form.Item>
          </Form>
        </Card>
        <Card
          size="small"
          className="admin-form-card form-section-card"
          title="当前生效配置"
        >
          <div className="admin-form-actions config-summary-row">
            <DescriptionList
              items={[
                ["当前状态", config?.enabled === false ? "关闭" : "开启"],
                ["当前手续费", `${formatPercent(config?.fee_rate || 0)}`],
                [
                  "当前价格范围",
                  `${config?.min_price || 1} - ${config?.max_price || 999999}`,
                ],
              ]}
            />
            <Button type="primary" loading={loading} onClick={submit}>
              保存交易配置
            </Button>
          </div>
        </Card>
        {error && <Alert type="error" message={error} showIcon />}
        {notice && <Alert type="success" message={notice} showIcon />}
      </Space>
    </Panel>
  );
}

function RechargeRecordsPage() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [uid, setUid] = useState("");
  const [userName, setUserName] = useState("");
  const [status, setStatus] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [data, setData] = useState<PageResult<RechargeRecord> | null>(null);
  const [detail, setDetail] = useState<RechargeRecord | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const filters = useMemo(
    () => ({ page, pageSize, uid, userName, status, start, end }),
    [page, pageSize, uid, userName, status, start, end],
  );
  const load = useCallback(() => {
    setLoading(true);
    setError("");
    request<PageResult<RechargeRecord>>(
      `/admin/recharge-records${toQuery(filters)}`,
    )
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = data?.list || [];
  const columns: TableColumnsType<RechargeRecord> = [
    {
      title: "状态",
      dataIndex: "statusLabel",
      width: 120,
      render: (value, row) => <Tag>{String(value || row.status || "-")}</Tag>,
    },
    {
      title: "UID",
      dataIndex: "uid",
      ellipsis: true,
      render: (value) => (
        <Typography.Text className="mono">
          {String(value || "-")}
        </Typography.Text>
      ),
    },
    {
      title: "鱼排用户名",
      dataIndex: "fishpi_user_name",
      ellipsis: true,
    },
    {
      title: "充值",
      width: 150,
      render: (_, row) => `${row.amount} / 扣鱼排 ${row.fishpi_cost}`,
    },
    {
      title: "积分变化",
      width: 160,
      render: (_, row) => `${row.point_before} → ${row.point_after}`,
    },
    {
      title: "请求号",
      dataIndex: "request_id",
      ellipsis: true,
      render: (value) => (
        <Typography.Text className="mono">
          {String(value || "-")}
        </Typography.Text>
      ),
    },
    {
      title: "时间",
      dataIndex: "createdAt",
      width: 190,
      render: formatDate,
    },
    {
      title: "操作",
      width: 110,
      fixed: "right",
      render: (_, row) => (
        <Button
          size="small"
          icon={<Eye size={14} />}
          onClick={() => setDetail(row)}
        >
          详情
        </Button>
      ),
    },
  ];

  function resetFilters() {
    setPage(1);
    setUid("");
    setUserName("");
    setStatus("");
    setStart("");
    setEnd("");
  }

  return (
    <Panel
      title="充值记录"
      icon={<Coins size={18} />}
      action={<RefreshButton onClick={load} loading={loading} />}
      className="table-panel"
    >
      <Space className="table-toolbar recharge-toolbar" wrap>
        <Input
          className="toolbar-search compact"
          prefix={<Search size={16} />}
          allowClear
          value={uid}
          onChange={(event) => {
            setPage(1);
            setUid(event.target.value);
          }}
          placeholder="搜索 UID"
        />
        <Input
          className="toolbar-control"
          allowClear
          value={userName}
          onChange={(event) => {
            setPage(1);
            setUserName(event.target.value);
          }}
          placeholder="鱼排用户名"
        />
        <Select
          className="toolbar-control"
          value={status}
          onChange={(value) => {
            setPage(1);
            setStatus(value);
          }}
          options={[
            { label: "全部状态", value: "" },
            { label: "处理中", value: "pending" },
            { label: "成功", value: "success" },
            { label: "失败", value: "failed" },
            { label: "本地入账失败", value: "local_failed" },
          ]}
        />
        <Input
          className="toolbar-datetime"
          type="datetime-local"
          value={start}
          onChange={(event) => {
            setPage(1);
            setStart(event.target.value);
          }}
        />
        <Input
          className="toolbar-datetime"
          type="datetime-local"
          value={end}
          onChange={(event) => {
            setPage(1);
            setEnd(event.target.value);
          }}
        />
        <Space className="toolbar-actions" wrap>
          <Button onClick={resetFilters}>重置</Button>
          <Button
            icon={<Download size={15} />}
            onClick={() =>
              exportRowsToCsv("充值记录", rows, rechargeRecordFields)
            }
            disabled={!rows.length}
          >
            导出CSV
          </Button>
        </Space>
      </Space>

      {error && <StateBox type="error">{error}</StateBox>}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={loading}
        scroll={{ x: "max-content" }}
        pagination={{
          current: page,
          pageSize,
          total: data?.total || 0,
          showSizeChanger: false,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (nextPage) => setPage(nextPage),
        }}
        locale={{
          emptyText: error ? "加载失败" : <Empty description="暂无充值记录" />,
        }}
      />

      {detail && (
        <DetailModal
          title="充值记录详情"
          fields={rechargeRecordFields}
          data={detail}
          loading={false}
          onClose={() => setDetail(null)}
        />
      )}
    </Panel>
  );
}

function RechargeConfigPanel() {
  const [config, setConfig] = useState<RechargeConfigRecord | null>(null);
  const [values, setValues] = useState<RechargeConfigRecord>({
    enabled: false,
    min_amount: 1,
    max_amount: 9999,
    recharge_ratio: 1,
    memo_template: "抽卡平台充值，兑换本地积分 {amount}",
    gold_finger_key: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    request<RechargeConfigRecord>("/admin/config/recharge")
      .then((data) => {
        setConfig(data);
        setValues({
          ...data,
          min_amount: Number(data.min_amount || 1),
          max_amount: Number(data.max_amount || 9999),
          recharge_ratio: Number(data.recharge_ratio || 1),
          memo_template:
            data.memo_template || "抽卡平台充值，兑换本地积分 {amount}",
          gold_finger_key: "",
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submit() {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const body: Partial<RechargeConfigRecord> = {
        enabled: values.enabled,
        min_amount: Number(values.min_amount || 1),
        max_amount: Number(values.max_amount || 9999),
        recharge_ratio: Number(values.recharge_ratio || 1),
        memo_template: values.memo_template,
      };
      const nextKey = String(values.gold_finger_key || "").trim();
      if (nextKey) {
        body.gold_finger_key = nextKey;
      }
      const next = await request<RechargeConfigRecord>(
        "/admin/config/recharge",
        {
          method: "PATCH",
          body: JSON.stringify(body),
        },
      );
      setConfig(next);
      setValues({
        ...next,
        gold_finger_key: "",
      });
      setNotice("充值配置已保存");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel
      title="充值配置"
      icon={<Coins size={18} />}
      action={<RefreshButton onClick={load} loading={loading} />}
    >
      <Space
        direction="vertical"
        size={16}
        className="full-width admin-form-stack recharge-config-stack"
      >
        <div className="admin-form-layout recharge-config-layout">
          <Card
            size="small"
            className="admin-form-card form-section-card recharge-rule-card"
            title="充值规则"
          >
            <Form
              layout="vertical"
              className="admin-form-grid recharge-rule-grid"
            >
              <Form.Item label="充值状态">
                <Select
                  value={String(values.enabled)}
                  onChange={(value) =>
                    setValues({ ...values, enabled: value === "true" })
                  }
                  options={[
                    { label: "关闭", value: "false" },
                    { label: "开启", value: "true" },
                  ]}
                />
              </Form.Item>
              <Form.Item label="单次最低扣除">
                <InputNumber
                  className="full-width-control"
                  min={1}
                  step={1}
                  addonAfter="鱼排积分"
                  value={Number(values.min_amount || 1)}
                  onChange={(value) =>
                    setValues({ ...values, min_amount: Number(value || 1) })
                  }
                />
              </Form.Item>
              <Form.Item label="单次最高扣除">
                <InputNumber
                  className="full-width-control"
                  min={1}
                  step={1}
                  addonAfter="鱼排积分"
                  value={Number(values.max_amount || 9999)}
                  onChange={(value) =>
                    setValues({ ...values, max_amount: Number(value || 9999) })
                  }
                />
              </Form.Item>
              <Form.Item
                label="充值比例"
                extra="填写 2 表示扣 1 鱼排积分到账 2 本地抽卡积分。"
              >
                <InputNumber
                  className="full-width-control"
                  min={0.0001}
                  max={100}
                  step={0.1}
                  precision={4}
                  addonBefore="1 鱼排积分 ="
                  addonAfter="本地积分"
                  value={Number(values.recharge_ratio || 1)}
                  onChange={(value) =>
                    setValues({
                      ...values,
                      recharge_ratio: Number(value || 1),
                    })
                  }
                />
              </Form.Item>
            </Form>
          </Card>

          <Card
            size="small"
            className="admin-form-card form-section-card recharge-secret-card"
            title="鱼排接口"
          >
            <Form layout="vertical" className="recharge-secret-grid">
              <Form.Item
                label="goldFingerKey"
                extra="留空保存会保留原密钥，不会明文回显。"
              >
                <Input.Password
                  value={values.gold_finger_key || ""}
                  placeholder={
                    config?.hasGoldFingerKey
                      ? `已配置：${config.maskedGoldFingerKey}`
                      : "请输入鱼排金手指密钥"
                  }
                  onChange={(event) =>
                    setValues({
                      ...values,
                      gold_finger_key: event.target.value,
                    })
                  }
                />
              </Form.Item>
              <Form.Item
                label="扣鱼排积分备注模板"
                extra="可使用 {amount}/{points} 表示本地到账积分，{fishpiCost} 表示扣除鱼排积分。"
              >
                <Input
                  value={values.memo_template}
                  onChange={(event) =>
                    setValues({ ...values, memo_template: event.target.value })
                  }
                />
              </Form.Item>
            </Form>
          </Card>
        </div>

        <Card
          size="small"
          className="admin-form-card form-section-card"
          title="当前生效配置"
        >
          <div className="admin-form-actions config-summary-row">
            <DescriptionList
              items={[
                ["当前状态", config?.enabled ? "开启" : "关闭"],
                ["密钥状态", config?.hasGoldFingerKey ? "已配置" : "未配置"],
                [
                  "扣除范围",
                  `${config?.min_amount || 1} - ${config?.max_amount || 9999} 鱼排积分`,
                ],
                [
                  "兑换比例",
                  `1 鱼排积分 = ${Number(config?.recharge_ratio || 1)} 本地积分`,
                ],
              ]}
            />
            <Button type="primary" loading={loading} onClick={submit}>
              保存充值配置
            </Button>
          </div>
        </Card>
        {error && <Alert type="error" message={error} showIcon />}
        {notice && <Alert type="success" message={notice} showIcon />}
      </Space>
    </Panel>
  );
}

function ConfigPage({ options }: { options: AdminOptions | null }) {
  const [data, setData] = useState<GachaConfigData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    request<GachaConfigData>("/admin/config/gacha")
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const defaultConfig =
    data?.defaultConfig || data?.pools?.["0"];
  const fallbackConfig =
    data?.fallbackConfig || data?.defaults?.["0"];

  return (
    <>
      <Panel
        title="默认抽卡配置"
        icon={<Settings size={18} />}
        action={<RefreshButton onClick={load} loading={loading} />}
        className="table-panel"
      >
        {error && <StateBox type="error">{error}</StateBox>}
        {!data && !error && <StateBox>正在加载配置...</StateBox>}
        {data && !defaultConfig && <StateBox>暂无默认抽卡配置</StateBox>}
        {defaultConfig && (
          <div className="table-wrap config-workbench">
            <table className="config-table">
              <thead>
                <tr>
                  <th>配置</th>
                  <th>配置来源</th>
                  <th>积分消耗</th>
                  <th>概率合计</th>
                  <th>UP 状态</th>
                  <th>保底摘要</th>
                  <th>更新时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td data-label="配置">
                    <div className="config-pool-cell">
                      <strong>全局默认配置</strong>
                      <span>未设置单独配置的卡池会继承这一套配置</span>
                    </div>
                  </td>
                  <td data-label="配置来源">
                    <Badge>{getGachaSourceText(defaultConfig)}</Badge>
                  </td>
                  <td data-label="积分消耗">
                    <span className="cell-text">
                      单抽 {defaultConfig.drawCosts?.once ?? 10} / 十连{" "}
                      {defaultConfig.drawCosts?.ten ?? 100}
                    </span>
                  </td>
                  <td data-label="概率合计">
                    <span
                      className={
                        Math.abs(
                          getProbabilityTotal(defaultConfig.rarityProbabilities) -
                            1,
                        ) < 0.0001
                          ? "config-ok"
                          : "config-warning"
                      }
                    >
                      {(
                        getProbabilityTotal(defaultConfig.rarityProbabilities) *
                        100
                      ).toFixed(2)}
                      %
                    </span>
                  </td>
                  <td data-label="UP 状态">
                    <span
                      className="cell-text"
                      title={summarizeUpConfig(defaultConfig.upCards)}
                    >
                      {summarizeUpConfig(defaultConfig.upCards)}
                    </span>
                  </td>
                  <td data-label="保底摘要">
                    <span
                      className="cell-text"
                      title={summarizePityConfig(defaultConfig.pitySystem)}
                    >
                      {summarizePityConfig(defaultConfig.pitySystem)}
                    </span>
                  </td>
                  <td data-label="更新时间">
                    {defaultConfig.updatedAt
                      ? formatDate(defaultConfig.updatedAt)
                      : "-"}
                  </td>
                  <td data-label="操作">
                    <Button size="small" onClick={() => setEditing(true)}>
                      编辑
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        {data && (
          <div className="config-admin-note">
            <div>
              <span className="eyebrow">保留字段</span>
              <strong>管理员白名单</strong>
              <p>
                当前后台权限以数据库 <code>User.is_admin</code> 为准，环境变量{" "}
                <code>ADMIN_UIDS</code> 仅保留展示。
              </p>
            </div>
            <div className="tag-list">
              {data.adminUids?.length ? (
                data.adminUids.map((uid) => <Badge key={uid}>{uid}</Badge>)
              ) : (
                <span className="muted-text">未配置 ADMIN_UIDS</span>
              )}
            </div>
          </div>
        )}
      </Panel>
      {editing && defaultConfig && (
        <GachaConfigModal
          mode="default"
          poolKey="0"
          config={defaultConfig}
          defaultConfig={fallbackConfig}
          poolName="全局默认配置"
          options={options}
          onCancel={() => setEditing(false)}
          onSubmit={async (poolId, values) => {
            const {
              poolId: _poolId,
              source: _source,
              scope: _scope,
              updatedAt: _updatedAt,
              ...payload
            } = values;
            await request(`/admin/config/gacha/${poolId}`, {
              method: "PATCH",
              body: JSON.stringify(payload),
            });
            setEditing(false);
            load();
          }}
        />
      )}
    </>
  );
}

function GachaConfigModal({
  mode,
  poolKey,
  config,
  defaultConfig,
  poolName,
  options,
  onCancel,
  onSubmit,
}: {
  mode: "default" | "pool";
  poolKey: string;
  config: GachaPoolConfig;
  defaultConfig?: GachaPoolConfig;
  poolName?: string;
  options: AdminOptions | null;
  onCancel: () => void;
  onSubmit: (poolId: number, values: GachaPoolConfig) => Promise<void>;
}) {
  const [values, setValues] = useState<GachaFormState>(() =>
    createGachaFormState(poolKey, config),
  );
  const [activeTab, setActiveTab] = useState("base");
  const [upKeyword, setUpKeyword] = useState("");
  const [upRarity, setUpRarity] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const currentDefault = defaultConfig || config;
  const inheritedPoolConfig = mode === "pool" && values.enabled === false;
  const probabilityTotal = getProbabilityTotal(values.rarityProbabilities);
  const probabilityPercentTotal = probabilityTotal * 100;
  const probabilityIsValid = Math.abs(probabilityTotal - 1) < 0.0001;
  const poolCardOptions = (options?.cards || []).filter(
    (card) => mode === "default" || Number(card.pool) === values.poolId,
  );
  const filteredUpCards = poolCardOptions.filter((card) => {
    const matchesKeyword =
      !upKeyword.trim() ||
      String(card.label || "")
        .toLowerCase()
        .includes(upKeyword.trim().toLowerCase());
    const matchesRarity =
      !upRarity ||
      String(card.rarity || "")
        .split(",")
        .includes(upRarity);
    return matchesKeyword && matchesRarity;
  });
  const selectedUpCards = poolCardOptions.filter((card) =>
    (values.upCards?.cardIds || []).includes(Number(card.value)),
  );
  const selectedKnownUpCardIds = new Set(
    selectedUpCards.map((card) => Number(card.value)),
  );
  const selectedUnknownUpCardIds = (values.upCards?.cardIds || []).filter(
    (cardId) => !selectedKnownUpCardIds.has(cardId),
  );
  const configTabs = [
    { key: "base", label: "基础价格" },
    { key: "probability", label: "稀有度概率" },
    { key: "up", label: "UP 配置" },
    { key: "pity", label: "保底配置" },
    { key: "preview", label: "保存预览" },
  ];

  function setProbabilityFromPercent(rarity: string, percent: number) {
    setValues({
      ...values,
      rarityProbabilities: {
        ...values.rarityProbabilities,
        [rarity]: Number.isFinite(percent) ? percent / 100 : 0,
      },
    });
  }

  function applyProbabilityTemplate(probabilities: Record<string, number>) {
    setValues({
      ...values,
      rarityProbabilities: normalizeRarityProbabilities(probabilities),
    });
  }

  function normalizeCurrentProbabilities() {
    if (probabilityTotal <= 0) {
      setError("当前概率合计为 0，无法自动归一化");
      return;
    }
    setError("");
    applyProbabilityTemplate(
      Object.fromEntries(
        rarityOptions.map((option) => {
          const rarity = String(option.value);
          return [
            rarity,
            Number(values.rarityProbabilities[rarity] || 0) / probabilityTotal,
          ];
        }),
      ),
    );
  }

  function fillFromDefault() {
    setValues({
      ...createGachaFormState(poolKey, currentDefault),
      enabled: true,
    });
    setError("");
    setNotice(
      mode === "default"
        ? "已填入代码兜底默认，保存后将作为全局默认配置生效。"
        : "已填入全局默认配置，保存后将作为当前卡池的单独配置生效。",
    );
  }

  function setConfigEnabled(enabled: boolean) {
    if (mode === "pool") {
      setValues({
        ...createGachaFormState(poolKey, currentDefault),
        enabled,
      });
      return;
    }
    setValues({
      ...values,
      enabled,
    });
  }

  function toggleUpCard(cardId: number, checked: boolean) {
    const selected = new Set(values.upCards?.cardIds || []);
    if (checked) {
      selected.add(cardId);
    } else {
      selected.delete(cardId);
    }
    setValues({
      ...values,
      upCards: {
        enabled: values.upCards?.enabled === true,
        upRate: Number(values.upCards?.upRate || 0),
        cardIds: Array.from(selected).sort((left, right) => left - right),
      },
    });
  }

  function validateForm() {
    if (!probabilityIsValid) {
      return `稀有度概率合计必须为 100%，当前为 ${probabilityPercentTotal.toFixed(2)}%`;
    }
    if (
      rarityOptions.some(
        (option) =>
          Number(values.rarityProbabilities[String(option.value)] || 0) < 0,
      )
    ) {
      return "稀有度概率不能小于 0";
    }
    const once = Number(values.drawCosts?.once);
    const ten = Number(values.drawCosts?.ten);
    if (
      !Number.isInteger(once) ||
      once <= 0 ||
      !Number.isInteger(ten) ||
      ten <= 0
    ) {
      return "单抽和十连消耗必须为正整数";
    }
    const upRate = Number(values.upCards?.upRate || 0);
    if (values.upCards?.enabled && (upRate < 0 || upRate > 1)) {
      return "UP 概率必须在 0% 到 100% 之间";
    }
    if (values.upCards?.enabled && !values.upCards.cardIds?.length) {
      return "开启 UP 时至少选择一张 UP 卡片";
    }
    if (values.pitySystem?.enabled !== false) {
      const softCount = Number(values.pitySystem?.softPity?.count || 0);
      const hardCount = Number(values.pitySystem?.hardPity?.count || 0);
      if (!Number.isInteger(softCount) || softCount <= 0) {
        return "软保底次数必须为正整数";
      }
      if (!Number.isInteger(hardCount) || hardCount <= 0) {
        return "硬保底次数必须为正整数";
      }
    }
    return "";
  }

  async function submit() {
    setError("");
    setNotice("");
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    try {
      await onSubmit(values.poolId, values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
      setLoading(false);
    }
  }

  return (
    <Modal
      title={
        <div>
          <span className="eyebrow">
            {mode === "default" ? "默认抽卡配置" : "卡池抽卡配置"}
          </span>
          <Typography.Title level={4}>
            {mode === "default"
              ? "编辑全局默认配置"
              : `编辑 ${poolName || poolNameById(values.poolId)} 单独配置`}
          </Typography.Title>
        </div>
      }
      open
      width={1040}
      className="gacha-modal"
      onCancel={onCancel}
      destroyOnHidden
      footer={
        <Space>
          <Button onClick={onCancel}>取消</Button>
          <Button type="primary" loading={loading} onClick={submit}>
            保存配置
          </Button>
        </Space>
      }
    >
      <Space
        direction="vertical"
        size={14}
        className="full-width admin-form-stack"
      >
        <Button onClick={fillFromDefault}>
          {mode === "default" ? "从代码默认填充" : "从默认配置填充"}
        </Button>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={configTabs.map((tab) => ({
            key: tab.key,
            label: tab.label,
          }))}
        />
        <div className="config-edit config-edit-workspace">
          {activeTab === "base" && (
            <section>
              <div className="section-title-row">
                <h3>基础价格</h3>
                <Badge>
                  {mode === "pool"
                    ? values.enabled === false
                      ? "继承默认"
                      : "单独配置"
                    : values.enabled === false
                      ? "代码兜底"
                      : "全局默认"}
                </Badge>
              </div>
              <label className="form-field">
                <span>{mode === "pool" ? "配置方式" : "启用全局默认"}</span>
                <select
                  value={String(values.enabled !== false)}
                  onChange={(event) =>
                    setConfigEnabled(event.target.value === "true")
                  }
                >
                  <option value="true">
                    {mode === "pool" ? "启用单独配置" : "启用"}
                  </option>
                  <option value="false">
                    {mode === "pool" ? "继承默认配置" : "关闭并使用代码兜底"}
                  </option>
                </select>
              </label>
              {inheritedPoolConfig ? (
                <StateBox>
                  当前卡池继承默认抽卡配置，启用单独配置后可编辑价格、概率、UP 和保底。
                </StateBox>
              ) : (
                <div className="admin-form-grid no-padding">
                  <label className="form-field">
                    <span>单抽消耗</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={values.drawCosts?.once || 10}
                      onChange={(event) =>
                        setValues({
                          ...values,
                          drawCosts: {
                            once: Number(event.target.value),
                            ten: values.drawCosts?.ten || 100,
                          },
                        })
                      }
                    />
                  </label>
                  <label className="form-field">
                    <span>十连消耗</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={values.drawCosts?.ten || 100}
                      onChange={(event) =>
                        setValues({
                          ...values,
                          drawCosts: {
                            once: values.drawCosts?.once || 10,
                            ten: Number(event.target.value),
                          },
                        })
                      }
                    />
                  </label>
                </div>
              )}
              <DescriptionList
                items={[
                  [
                    mode === "pool" ? "默认单抽" : "代码默认单抽",
                    `${currentDefault.drawCosts?.once ?? 10} 积分`,
                  ],
                  [
                    mode === "pool" ? "默认十连" : "代码默认十连",
                    `${currentDefault.drawCosts?.ten ?? 100} 积分`,
                  ],
                  [
                    "当前配置来源",
                    getGachaSourceText(config),
                  ],
                ]}
              />
            </section>
          )}

          {activeTab !== "base" && inheritedPoolConfig && (
            <section>
              <div className="section-title-row">
                <h3>继承默认配置</h3>
                <Badge>未启用单独配置</Badge>
              </div>
              <StateBox>
                当前卡池继承默认抽卡配置，启用单独配置后可编辑这一页。
              </StateBox>
              <DescriptionList
                items={[
                  [
                    "积分消耗",
                    `单抽 ${currentDefault.drawCosts?.once ?? 10}，十连 ${
                      currentDefault.drawCosts?.ten ?? 100
                    }`,
                  ],
                  [
                    "概率合计",
                    `${(getProbabilityTotal(currentDefault.rarityProbabilities) * 100).toFixed(2)}%`,
                  ],
                  ["UP 配置", summarizeUpConfig(currentDefault.upCards)],
                  ["保底配置", summarizePityConfig(currentDefault.pitySystem)],
                ]}
              />
            </section>
          )}

          {activeTab === "probability" && !inheritedPoolConfig && (
            <section>
              <div className="section-title-row">
                <h3>稀有度概率</h3>
                <Badge>
                  合计 {probabilityPercentTotal.toFixed(2)}%
                  {probabilityIsValid ? "" : "，需调整到 100%"}
                </Badge>
              </div>
              <div className="template-row">
                <button
                  className="secondary-button compact"
                  type="button"
                  onClick={fillFromDefault}
                >
                  {mode === "default" ? "代码默认" : "默认配置"}
                </button>
                {probabilityTemplates.map((template) => (
                  <button
                    className="secondary-button compact"
                    type="button"
                    key={template.label}
                    onClick={() => applyProbabilityTemplate(template.values)}
                  >
                    {template.label}
                  </button>
                ))}
                <button
                  className="secondary-button compact"
                  type="button"
                  onClick={normalizeCurrentProbabilities}
                >
                  自动归一化
                </button>
              </div>
              <div className="probability-edit-grid">
                {rarityOptions.map((option) => {
                  const rarity = String(option.value);
                  const value = Number(values.rarityProbabilities[rarity] || 0);
                  return (
                    <label
                      className="form-field probability-field"
                      key={rarity}
                    >
                      <span>{rarity} 概率</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={Number((value * 100).toFixed(4))}
                        onChange={(event) =>
                          setProbabilityFromPercent(
                            rarity,
                            Number(event.target.value),
                          )
                        }
                      />
                      <small>保存为 {value.toFixed(6)}</small>
                    </label>
                  );
                })}
              </div>
              <div
                className={
                  probabilityIsValid
                    ? "probability-total ok"
                    : "probability-total warning"
                }
              >
                <span>当前合计</span>
                <strong>{probabilityPercentTotal.toFixed(2)}%</strong>
                <small>
                  {probabilityIsValid
                    ? "概率配置有效"
                    : `还差 ${(100 - probabilityPercentTotal).toFixed(2)}%`}
                </small>
              </div>
            </section>
          )}

          {activeTab === "up" && !inheritedPoolConfig && (
            <section>
              <div className="section-title-row">
                <h3>UP 配置</h3>
                <Badge>{values.upCards?.enabled ? "已开启" : "已关闭"}</Badge>
              </div>
              <div className="admin-form-grid no-padding">
                <label className="form-field">
                  <span>UP 状态</span>
                  <select
                    value={String(values.upCards?.enabled === true)}
                    onChange={(event) =>
                      setValues({
                        ...values,
                        upCards: {
                          enabled: event.target.value === "true",
                          cardIds: values.upCards?.cardIds || [],
                          upRate: values.upCards?.upRate || 0,
                        },
                      })
                    }
                  >
                    <option value="false">关闭</option>
                    <option value="true">开启</option>
                  </select>
                </label>
                <label className="form-field">
                  <span>UP 概率（百分比）</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={Number(
                      ((values.upCards?.upRate || 0) * 100).toFixed(4),
                    )}
                    onChange={(event) =>
                      setValues({
                        ...values,
                        upCards: {
                          enabled: values.upCards?.enabled === true,
                          cardIds: values.upCards?.cardIds || [],
                          upRate: Number(event.target.value) / 100,
                        },
                      })
                    }
                  />
                </label>
              </div>
              <div className="up-card-picker">
                <div className="table-toolbar compact-toolbar">
                  <label className="search-box">
                    <Search size={16} />
                    <input
                      value={upKeyword}
                      onChange={(event) => setUpKeyword(event.target.value)}
                      placeholder="搜索当前卡池卡片"
                    />
                  </label>
                  <select
                    value={upRarity}
                    onChange={(event) => setUpRarity(event.target.value)}
                  >
                    <option value="">全部稀有度</option>
                    {rarityOptions.map((option) => (
                      <option
                        key={String(option.value)}
                        value={String(option.value)}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="selected-up-cards">
                  {selectedUpCards.length || selectedUnknownUpCardIds.length ? (
                    <>
                      {selectedUpCards.map((card) => (
                        <Badge key={String(card.value)}>
                          {card.label} · {card.rarity || "-"} · #
                          {String(card.value)}
                        </Badge>
                      ))}
                      {selectedUnknownUpCardIds.map((cardId) => (
                        <Badge key={cardId}>未知卡片 #{cardId}</Badge>
                      ))}
                    </>
                  ) : (
                    <span className="muted-text">暂未选择 UP 卡片</span>
                  )}
                </div>
                <div className="up-card-list">
                  {filteredUpCards.length ? (
                    filteredUpCards.map((card) => {
                      const cardId = Number(card.value);
                      return (
                        <label
                          className="up-card-option"
                          key={String(card.value)}
                        >
                          <input
                            type="checkbox"
                            checked={(values.upCards?.cardIds || []).includes(
                              cardId,
                            )}
                            onChange={(event) =>
                              toggleUpCard(cardId, event.target.checked)
                            }
                          />
                          <span>
                            <strong>{card.label}</strong>
                            <small>
                              {card.rarity || "-"} · ID {String(card.value)}
                            </small>
                          </span>
                        </label>
                      );
                    })
                  ) : (
                    <StateBox>当前筛选下没有可选卡片</StateBox>
                  )}
                </div>
              </div>
            </section>
          )}

          {activeTab === "pity" && !inheritedPoolConfig && (
            <section>
              <div className="section-title-row">
                <h3>保底配置</h3>
                <Badge>
                  {values.pitySystem?.enabled !== false ? "已开启" : "已关闭"}
                </Badge>
              </div>
              <label className="form-field">
                <span>保底状态</span>
                <select
                  value={String(values.pitySystem?.enabled !== false)}
                  onChange={(event) =>
                    setValues({
                      ...values,
                      pitySystem: {
                        ...(values.pitySystem || {}),
                        enabled: event.target.value === "true",
                      },
                    })
                  }
                >
                  <option value="true">开启</option>
                  <option value="false">关闭</option>
                </select>
              </label>
              {values.pitySystem?.enabled === false ? (
                <StateBox>
                  保底已关闭，抽卡时只按基础概率和 UP 配置计算。
                </StateBox>
              ) : (
                <div className="pity-rule-grid">
                  <div className="pity-rule-card">
                    <h4>软保底</h4>
                    <div className="admin-form-grid no-padding">
                      <label className="form-field">
                        <span>触发次数</span>
                        <input
                          type="number"
                          min="1"
                          value={values.pitySystem?.softPity?.count || 10}
                          onChange={(event) =>
                            setPityRule(setValues, values, "softPity", {
                              count: Number(event.target.value),
                            })
                          }
                        />
                      </label>
                      <label className="form-field">
                        <span>保底稀有度</span>
                        <select
                          value={
                            values.pitySystem?.softPity?.guaranteedRarity ||
                            "SR"
                          }
                          onChange={(event) =>
                            setPityRule(setValues, values, "softPity", {
                              guaranteedRarity: event.target.value,
                            })
                          }
                        >
                          {rarityOptions.map((option) => (
                            <option
                              key={String(option.value)}
                              value={String(option.value)}
                            >
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                  <div className="pity-rule-card">
                    <h4>硬保底</h4>
                    <div className="admin-form-grid no-padding">
                      <label className="form-field">
                        <span>触发次数</span>
                        <input
                          type="number"
                          min="1"
                          value={values.pitySystem?.hardPity?.count || 90}
                          onChange={(event) =>
                            setPityRule(setValues, values, "hardPity", {
                              count: Number(event.target.value),
                            })
                          }
                        />
                      </label>
                      <label className="form-field">
                        <span>保底稀有度</span>
                        <select
                          value={
                            values.pitySystem?.hardPity?.guaranteedRarity ||
                            "SSR"
                          }
                          onChange={(event) =>
                            setPityRule(setValues, values, "hardPity", {
                              guaranteedRarity: event.target.value,
                            })
                          }
                        >
                          {rarityOptions.map((option) => (
                            <option
                              key={String(option.value)}
                              value={String(option.value)}
                            >
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {activeTab === "preview" && !inheritedPoolConfig && (
            <section>
              <div className="section-title-row">
                <h3>保存预览</h3>
                <Badge>{probabilityIsValid ? "可保存" : "需修正"}</Badge>
              </div>
              <DescriptionList
                items={[
                  [
                    "保存效果",
                    getGachaSaveEffectText(mode, values.enabled !== false),
                  ],
                  [
                    "积分消耗",
                    `单抽 ${values.drawCosts?.once || 10}，十连 ${
                      values.drawCosts?.ten || 100
                    }`,
                  ],
                  ["概率合计", `${probabilityPercentTotal.toFixed(2)}%`],
                  ["UP 配置", summarizeUpConfig(values.upCards)],
                  ["保底配置", summarizePityConfig(values.pitySystem)],
                ]}
              />
            </section>
          )}
        </div>
        {error && <Alert type="error" message={error} showIcon />}
        {notice && <Alert type="success" message={notice} showIcon />}
      </Space>
    </Modal>
  );
}

function DetailModal({
  title,
  fields,
  data,
  loading,
  onClose,
}: {
  title: string;
  fields: FieldConfig[];
  data: Record<string, any>;
  loading: boolean;
  onClose: () => void;
}) {
  const items = getDetailItems(data, fields);

  return (
    <Modal
      title={
        <div>
          <span className="eyebrow">记录详情</span>
          <Typography.Title level={4}>{title}</Typography.Title>
        </div>
      }
      open
      onCancel={onClose}
      footer={null}
      width={760}
      destroyOnHidden
    >
      {loading ? (
        <Spin tip="正在读取详情..." />
      ) : (
        <Descriptions
          bordered
          size="small"
          column={1}
          items={items.map(([label, value]) => ({
            key: label,
            label,
            children: formatValue(value),
          }))}
        />
      )}
    </Modal>
  );
}

function DescriptionList({ items }: { items: Array<[string, unknown]> }) {
  return (
    <dl className="description-list">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{formatValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return <Tag color="blue">{children}</Tag>;
}

function RefreshButton({
  onClick,
  loading,
}: {
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <Button
      size="small"
      icon={<RefreshCw size={15} />}
      onClick={onClick}
      loading={loading}
    >
      刷新
    </Button>
  );
}

function Panel({
  title,
  icon,
  action,
  children,
  className,
}: {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={["panel", className].filter(Boolean).join(" ")}
      title={
        <Space className="panel-title">
          {icon}
          <span>{title}</span>
        </Space>
      }
      extra={action}
    >
      {children}
    </Card>
  );
}

function StateBox({ children, type }: { children: ReactNode; type?: "error" }) {
  if (type === "error") {
    return (
      <Alert className="state-box" type="error" message={children} showIcon />
    );
  }
  return <Empty className="state-box" description={children} />;
}

function createRedeemFormState(initial: RedeemCodeRecord | null) {
  return {
    code: initial?.code || "",
    name: initial?.name || "",
    description: initial?.description || "",
    enabled: initial?.enabled !== false,
    total_limit:
      initial?.total_limit === null || initial?.total_limit === undefined
        ? ""
        : String(initial.total_limit),
    starts_at: toDateTimeLocal(initial?.starts_at),
    ends_at: toDateTimeLocal(initial?.ends_at),
    rewards: {
      points: Number(initial?.rewards?.points || 0),
      items: Array.isArray(initial?.rewards?.items)
        ? initial!.rewards.items.map((item) => ({
            itemId: Number(item.itemId),
            num: Number(item.num),
          }))
        : [],
    },
  };
}

function createExchangeFormState(initial: ExchangeShopItemRecord | null) {
  return {
    name: initial?.name || "",
    description: initial?.description || "",
    enabled: initial?.enabled !== false,
    total_limit:
      initial?.total_limit === null || initial?.total_limit === undefined
        ? ""
        : String(initial.total_limit),
    user_limit:
      initial?.user_limit === null || initial?.user_limit === undefined
        ? ""
        : String(initial.user_limit),
    starts_at: toDateTimeLocal(initial?.starts_at),
    ends_at: toDateTimeLocal(initial?.ends_at),
    sort_order: Number(initial?.sort_order || 0),
    costs: Array.isArray(initial?.costs)
      ? initial!.costs.map((item) => ({
          itemId: Number(item.itemId),
          num: Number(item.num),
        }))
      : [],
    rewards: {
      points: Number(initial?.rewards?.points || 0),
      items: Array.isArray(initial?.rewards?.items)
        ? initial!.rewards.items.map((item) => ({
            itemId: Number(item.itemId),
            num: Number(item.num),
          }))
        : [],
    },
  };
}

function createLaunchActivityFormState(
  initial: LaunchActivityConfigRecord | null,
): LaunchActivityConfigRecord {
  return {
    id: initial?.id,
    enabled: initial?.enabled === true,
    activity_key: initial?.activity_key || "launch-2026",
    name: initial?.name || "开服福利",
    description: initial?.description || "登录后可领取一次的开服福利。",
    starts_at: toDateTimeLocal(initial?.starts_at),
    ends_at: toDateTimeLocal(initial?.ends_at),
    rewards: {
      points: Number(initial?.rewards?.points || 0),
      items: Array.isArray(initial?.rewards?.items)
        ? initial!.rewards.items.map((item) => ({
            itemId: Number(item.itemId),
            num: Number(item.num),
          }))
        : [],
    },
    createdAt: initial?.createdAt,
    updatedAt: initial?.updatedAt,
  };
}

function createItemFormState(initial: Record<string, any>) {
  return {
    drop_name: String(initial.drop_name || ""),
    drop_desc: String(initial.drop_desc || ""),
    drop_type: Number(initial.drop_type ?? 0),
    drop_item_type: Number(initial.drop_item_type || 0),
    drop_item_value: Number(initial.drop_item_value || 0),
    disabled: initial.disabled === true,
    default_fragment: initial.default_fragment === true,
  };
}

function getDropTypeLabel(type: number) {
  const option = dropTypeOptions.find((item) => Number(item.value) === type);
  return option?.label || "其他";
}

function getDropTypeUsage(type: number) {
  const usages: Record<number, string> = {
    0: "用于卡片合成和分解产出。创建卡片时可选择它作为分解产出碎片。",
    1: "虚拟积分建议直接使用用户积分字段或兑换码奖励积分，不建议放入背包。",
    2: "可放入玩家背包，也可作为兑换码奖励发放。",
    3: "预留给后续玩法，请在说明里写清楚用途。",
  };
  return usages[type] || usages[3];
}

function groupItemOptions(
  itemOptions: SelectOption[],
  predicate?: (option: SelectOption & { type?: number }) => boolean,
) {
  const enabledOptions = itemOptions
    .filter((option) => option.disabled !== true)
    .filter((option) =>
      predicate ? predicate(option as SelectOption & { type?: number }) : true,
    );
  const groups = dropTypeOptions
    .map((type) => ({
      label: String(type.label),
      options: enabledOptions.filter(
        (option: any) => option.type === type.value,
      ),
    }))
    .filter((group) => group.options.length > 0);
  const otherOptions = enabledOptions.filter(
    (option: any) =>
      option.type === undefined ||
      !dropTypeOptions.some((type) => type.value === option.type),
  );
  return otherOptions.length
    ? [...groups, { label: "其他物品", options: otherOptions }]
    : groups;
}

const probabilityTemplates: Array<{
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
  {
    label: "全稀有铺开",
    values: { N: 0.2, R: 0.2, SR: 0.2, SSR: 0.2, UR: 0.2 },
  },
];

function getProbabilityTotal(probabilities?: Record<string, number>) {
  return rarityOptions.reduce(
    (sum, option) => sum + Number(probabilities?.[String(option.value)] || 0),
    0,
  );
}

function normalizeRarityProbabilities(probabilities: Record<string, number>) {
  return Object.fromEntries(
    rarityOptions.map((option) => {
      const rarity = String(option.value);
      return [rarity, Number(probabilities[rarity] || 0)];
    }),
  );
}

function summarizeUpConfig(upCards?: GachaPoolConfig["upCards"]) {
  if (!upCards || upCards.enabled !== true) {
    return "未开启";
  }
  const cardCount = upCards.cardIds?.length || 0;
  return `已开启 · ${formatPercent(upCards.upRate || 0)} · ${
    cardCount ? `${cardCount} 张卡` : "未选卡"
  }`;
}

function summarizePityConfig(pitySystem?: GachaPoolConfig["pitySystem"]) {
  if (!pitySystem || pitySystem.enabled === false) {
    return "未开启";
  }
  const soft = pitySystem.softPity
    ? `软 ${pitySystem.softPity.count || "-"} 抽保 ${
        pitySystem.softPity.guaranteedRarity || "-"
      }`
    : "软保底未配";
  const hard = pitySystem.hardPity
    ? `硬 ${pitySystem.hardPity.count || "-"} 抽保 ${
        pitySystem.hardPity.guaranteedRarity || "-"
      }`
    : "硬保底未配";
  return `${soft} / ${hard}`;
}

function getGachaSourceText(config?: GachaPoolConfig) {
  if (!config) {
    return "-";
  }
  if (config.scope === "pool" && config.enabled !== false) {
    return "单独配置";
  }
  if (config.scope === "global" && config.enabled !== false) {
    return "全局默认";
  }
  if (config.source === "database" && config.enabled !== false) {
    return "数据库配置";
  }
  return "代码兜底";
}

function getGachaSaveEffectText(mode: "default" | "pool", enabled: boolean) {
  if (mode === "default") {
    return enabled
      ? "保存为全局默认配置，未设置单独配置的卡池会继承它"
      : "关闭全局默认配置，未设置单独配置的卡池回退代码兜底";
  }
  return enabled
    ? "保存为当前卡池的单独配置"
    : "关闭当前卡池的单独配置，改为继承默认配置";
}

function getPoolGachaModalConfig(
  poolId: number,
  detail: PoolGachaConfigDetail,
): GachaPoolConfig {
  if (detail.hasIndividualConfig && detail.individualConfig) {
    return {
      ...detail.individualConfig,
      enabled: true,
      poolId,
    };
  }
  return {
    ...detail.effective,
    enabled: false,
    poolId,
  };
}

function normalizeDropItemSelectValue(value: unknown) {
  return String(value || "")
    .split(";")[0]
    .split(",")[0]
    .trim();
}

function parseMultiSelectValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toggleMultiSelectValue(
  current: string[],
  value: string,
  checked: boolean,
  field: FieldConfig,
) {
  const selected = new Set(current);
  if (checked) {
    selected.add(value);
  } else {
    selected.delete(value);
  }
  const orderedOptions = (field.options || []).map((option) =>
    String(option.value),
  );
  return orderedOptions.filter((option) => selected.has(option));
}

function serializeFormValues(
  fields: FieldConfig[],
  values: Record<string, any>,
) {
  return fields.reduce<Record<string, any>>((result, field) => {
    const value = values[field.key];
    if (field.type === "multiSelect") {
      const selected = Array.isArray(value) ? value.map(String) : [];
      if (selected.length === 0) {
        throw new Error(`${field.label}不能为空`);
      }
      result[field.key] = selected.join(",");
    } else {
      result[field.key] = value;
    }
    return result;
  }, {});
}

function updateRewardItem(
  rewards: RedeemRewards,
  index: number,
  patch: Partial<{ itemId: number; num: number }>,
): RedeemRewards {
  return {
    ...rewards,
    items: rewards.items.map((item, currentIndex) =>
      currentIndex === index ? { ...item, ...patch } : item,
    ),
  };
}

function updateCostItem(
  costs: ExchangeCostItem[],
  index: number,
  patch: Partial<{ itemId: number; num: number }>,
): ExchangeCostItem[] {
  return costs.map((item, currentIndex) =>
    currentIndex === index ? { ...item, ...patch } : item,
  );
}

function createGachaFormState(
  poolKey: string,
  config: GachaPoolConfig,
): GachaFormState {
  const poolId = Number(config.poolId || poolKey);
  return {
    poolId,
    enabled: config.enabled !== false,
    rarityProbabilities: {
      N: Number(config.rarityProbabilities?.N ?? 0.5),
      R: Number(config.rarityProbabilities?.R ?? 0.3),
      SR: Number(config.rarityProbabilities?.SR ?? 0.15),
      SSR: Number(config.rarityProbabilities?.SSR ?? 0.045),
      UR: Number(config.rarityProbabilities?.UR ?? 0.005),
    },
    drawCosts: {
      once: Number(config.drawCosts?.once || 10),
      ten: Number(config.drawCosts?.ten || 100),
    },
    upCards: {
      enabled: config.upCards?.enabled === true,
      cardIds: config.upCards?.cardIds || [],
      upRate: Number(config.upCards?.upRate || 0),
    },
    pitySystem: {
      enabled: config.pitySystem?.enabled !== false,
      softPity: {
        count: Number(config.pitySystem?.softPity?.count || 10),
        guaranteedRarity: config.pitySystem?.softPity?.guaranteedRarity || "SR",
      },
      hardPity: {
        count: Number(config.pitySystem?.hardPity?.count || 90),
        guaranteedRarity:
          config.pitySystem?.hardPity?.guaranteedRarity || "SSR",
      },
    },
  };
}

function parseNumberList(value: string) {
  return value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);
}

function setPityRule(
  setValues: Dispatch<SetStateAction<GachaFormState>>,
  values: GachaFormState,
  key: "softPity" | "hardPity",
  patch: Record<string, string | number>,
) {
  const currentRule = values.pitySystem?.[key] || {
    count: key === "softPity" ? 10 : 90,
    guaranteedRarity: key === "softPity" ? "SR" : "SSR",
  };
  setValues({
    ...values,
    pitySystem: {
      ...(values.pitySystem || { enabled: true }),
      [key]: {
        ...currentRule,
        ...patch,
      },
    },
  });
}

function getFieldOptions(field: FieldConfig) {
  return field.type === "boolean"
    ? field.options || booleanOptions
    : field.options || [];
}

function getFieldOptionLabel(
  field: FieldConfig,
  value: unknown,
  fallback: string,
) {
  const matchedOption = getFieldOptions(field).find(
    (option) => String(option.value) === String(value),
  );
  return matchedOption?.label || fallback;
}

function coerceFieldValue(field: FieldConfig, value: unknown) {
  const fieldOptions = getFieldOptions(field);
  const matchedOption = fieldOptions.find(
    (option) => String(option.value) === String(value),
  );
  if (matchedOption) {
    return matchedOption.value;
  }
  if (field.type === "number") {
    return value === "" ? "" : Number(value);
  }
  if (field.type === "boolean") {
    return value === "true";
  }
  return value;
}

function getValue(row: Record<string, any>, path: string) {
  return path.split(".").reduce((value, key) => value?.[key], row);
}

function renderPoolTypeTag(value: unknown) {
  const option = poolTypeOptions.find(
    (item) => String(item.value) === String(value),
  );
  const colorMap: Record<string, string> = {
    "0": "blue",
    "1": "orange",
    "2": "purple",
  };
  return (
    <Tag color={colorMap[String(value)] || "default"}>
      {option?.label || `类型 ${String(value || "-")}`}
    </Tag>
  );
}

function renderGachaConfigModeTag(value: unknown) {
  const mode = String(value || "默认配置");
  return <Tag color={mode === "卡池配置" ? "purple" : "geekblue"}>{mode}</Tag>;
}

function formatFieldValue(field: FieldConfig, value: unknown) {
  const matchedOption = getFieldOptions(field).find(
    (option) => String(option.value) === String(value),
  );
  return matchedOption ? matchedOption.label : formatValue(value);
}

function formatValue(value: unknown) {
  if (value === true) {
    return "是";
  }
  if (value === false) {
    return "否";
  }
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  if (value instanceof Date) {
    return value.toLocaleString();
  }
  if (Array.isArray(value)) {
    return formatCosts(value as ExchangeCostItem[]);
  }
  if (typeof value === "object") {
    if (isRewards(value)) {
      return formatRewards(value);
    }
    const record = value as Record<string, unknown>;
    const name =
      record.name ||
      record.nickname ||
      record.uid ||
      record.card_name ||
      record.pool_name ||
      record.drop_name;
    return name ? String(name) : "已配置";
  }
  if (typeof value === "string" && value.includes("T") && value.endsWith("Z")) {
    return formatDate(value);
  }
  return String(value);
}

function isRewards(value: unknown): value is RedeemRewards {
  const record = value as RedeemRewards | undefined;
  return Boolean(record && ("points" in record || "items" in record));
}

function formatRewards(rewards: RedeemRewards | undefined) {
  if (!rewards) {
    return "-";
  }
  const parts: string[] = [];
  if (Number(rewards.points || 0) > 0) {
    parts.push(`积分 ${rewards.points}`);
  }
  const items = Array.isArray(rewards.items) ? rewards.items : [];
  if (items.length) {
    parts.push(`物品 ${items.length} 项`);
  }
  return parts.join("，") || "未配置";
}

function formatCosts(costs: ExchangeCostItem[] | undefined) {
  const items = Array.isArray(costs) ? costs : [];
  if (items.length === 0) {
    return "未配置";
  }
  return items
    .map((item) => `${item.itemName || `物品#${item.itemId}`} x${item.num}`)
    .join("，");
}

function formatDateRange(start?: unknown, end?: unknown) {
  if (!start && !end) {
    return "不限时间";
  }
  return `${formatDate(start) || "-"} 至 ${formatDate(end) || "-"}`;
}

function formatDate(value: unknown) {
  if (!value) {
    return "-";
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString();
}

function toDateTimeLocal(value: unknown) {
  if (!value) {
    return "";
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

function fromDateTimeLocal(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function formatPercent(value: unknown) {
  const number = Number(value || 0);
  return `${(number * 100).toFixed(number < 0.01 && number > 0 ? 2 : 1)}%`;
}

function summarizeRarities(raw: string) {
  const counts = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce<Record<string, number>>((result, rarity) => {
      result[rarity] = (result[rarity] || 0) + 1;
      return result;
    }, {});
  const summary = Object.entries(counts)
    .map(([rarity, count]) => `${rarity}x${count}`)
    .join(" / ");
  return summary || "-";
}

function poolNameById(poolId: number) {
  const names: Record<number, string> = {
    1: "常驻卡池",
    2: "限定卡池",
    3: "新手卡池",
    4: "活动卡池",
  };
  return names[poolId] || `卡池 ${poolId}`;
}

function getDetailItems(data: Record<string, any>, fields: FieldConfig[]) {
  const seen = new Set(fields.map((field) => field.key.split(".")[0]));
  const fieldItems: Array<[string, unknown]> = fields.map((field) => [
    field.label,
    formatFieldValue(field, getValue(data, field.key)),
  ]);
  const extraItems: Array<[string, unknown]> = Object.entries(data)
    .filter(([key, value]) => !seen.has(key) && isDetailValue(value))
    .map(([key, value]) => [fieldLabel(key), value]);
  return [...fieldItems, ...extraItems];
}

function isDetailValue(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    ["string", "number", "boolean"].includes(typeof value)
  );
}

function fieldLabel(key: string) {
  const labels: Record<string, string> = {
    createdAt: "创建时间",
    updatedAt: "更新时间",
    card_ids: "卡片ID",
    card_levels: "稀有度",
    card_uuids: "卡片UUID",
    delete_flag: "删除状态",
  };
  return labels[key] || key;
}

function exportRowsToCsv(
  title: string,
  rows: Record<string, any>[],
  fields: FieldConfig[],
) {
  const headers = fields.map((field) => field.label);
  const lines = rows.map((row) =>
    fields
      .map((field) => escapeCsv(formatValue(getValue(row, field.key))))
      .join(","),
  );
  const csv = [headers.map(escapeCsv).join(","), ...lines].join("\n");
  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}
