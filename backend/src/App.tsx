import {
  Activity,
  Boxes,
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  Eye,
  Gauge,
  Gift,
  History,
  Layers,
  LogOut,
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
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  FormEvent,
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
  LoginResponse,
  PageResult,
  RedeemCodeRecord,
  RedeemRewards,
  SelectOption,
} from "./types";

type Theme = "light" | "dark";
type GachaFormState = GachaPoolConfig & {
  poolId: number;
  rarityProbabilities: Record<string, number>;
};
const handledOpenidCallbacks = new Set<string>();

const navItems = [
  { key: "dashboard", label: "总览", icon: Gauge },
  { key: "users", label: "用户", icon: Users },
  { key: "pools", label: "卡池", icon: Layers },
  { key: "cards", label: "卡片", icon: Sparkles },
  { key: "drop-items", label: "物品管理", icon: Package },
  { key: "histories", label: "历史", icon: History },
  { key: "inventories", label: "背包", icon: Boxes },
  { key: "pity", label: "保底", icon: Ticket },
  { key: "redeem-codes", label: "兑换码", icon: Gift },
  { key: "exchange-shop", label: "兑换商店", icon: Store },
  { key: "config", label: "配置", icon: Settings },
];

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
  },
];

function createCardFields(options: AdminOptions | null): FieldConfig[] {
  const poolOptions =
    options?.pools?.length
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
      helper:
        options?.defaultFragmentItem
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

export function App() {
  const [token, setLocalToken] = useState(getToken());
  const [admin, setAdmin] = useState<AdminMeResponse | null>(null);
  const [adminOptions, setAdminOptions] = useState<AdminOptions | null>(null);
  const [authError, setAuthError] = useState("");
  const [active, setActive] = useState(
    window.location.hash.replace("#", "") || "dashboard",
  );
  const [theme, setTheme] = useState<Theme>(
    (localStorage.getItem("kesini_theme") as Theme) || "light",
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("kesini_theme", theme);
  }, [theme]);

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

  const handleLogin = useCallback((nextToken: string) => {
    setAuthError("");
    setLocalToken(nextToken);
  }, []);

  function switchPage(key: string) {
    setActive(key);
    window.location.hash = key;
  }

  if (!token) {
    return <LoginPage initialError={authError} onLogin={handleLogin} />;
  }

  if (!admin) {
    return (
      <main className="login-screen">
        <section className="login-panel">
          <div className="brand-mark large">
            <Shield size={28} />
          </div>
          <span className="eyebrow">权限校验</span>
          <h1>正在验证后台权限</h1>
          <p>正在确认当前账号是否具备后台管理权限。</p>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Sparkles size={20} />
          </div>
          <div>
            <strong>Kesini</strong>
            <span>Gacha Admin</span>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                className={active === item.key ? "active" : ""}
                onClick={() => switchPage(item.key)}
                aria-current={active === item.key ? "page" : undefined}
                type="button"
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-title">
            <span className="eyebrow">后台管理</span>
            <h1>{navItems.find((item) => item.key === active)?.label}</h1>
          </div>
          <div className="top-actions">
            <span className="status-dot">API {getApiBase()}</span>
            <button
              className="icon-button"
              type="button"
              aria-label="切换主题"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            >
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button
              className="icon-button"
              type="button"
              aria-label="退出登录"
              onClick={() => {
                clearToken();
                setLocalToken("");
              }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <section className="content">
          {active === "dashboard" && <Dashboard admin={admin} />}
          {active === "users" && (
            <AdminTable
              title="用户管理"
              endpoint="/admin/users"
              fields={userFields}
              editable
              detailFetchable
              searchPlaceholder="搜索 UID、用户名或昵称"
            />
          )}
          {active === "pools" && (
            <AdminTable
              title="卡池管理"
              endpoint="/admin/pools"
              fields={poolFields}
              editable
              creatable
              deletable
              detailFetchable
              searchPlaceholder="搜索卡池名称或描述"
            />
          )}
          {active === "cards" && (
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
          )}
          {active === "drop-items" && (
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
          )}
          {active === "histories" && (
            <AdminTable
              title="抽卡历史"
              endpoint="/admin/histories"
              fields={historyFields}
              searchPlaceholder="按 UID 查询"
              keywordParam="uid"
              enableRarityFilter
            />
          )}
          {active === "inventories" && (
            <AdminTable
              title="背包管理"
              endpoint="/admin/inventories"
              fields={inventoryFields}
              editable
              searchPlaceholder="按 UID 查询"
              keywordParam="uid"
            />
          )}
          {active === "pity" && (
            <AdminTable
              title="保底状态"
              endpoint="/admin/pity"
              fields={pityFields}
              editable
              searchPlaceholder="按 UID 查询"
              keywordParam="uid"
            />
          )}
          {active === "redeem-codes" && (
            <RedeemCodesPage options={adminOptions} />
          )}
          {active === "exchange-shop" && (
            <ExchangeShopPage options={adminOptions} />
          )}
          {active === "config" && <ConfigPage options={adminOptions} />}
        </section>
      </main>
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
      const returnTo = `${window.location.origin}${window.location.pathname}`;
      const data = await request<{ url: string }>(
        `/apis/login-url${toQuery({ returnTo, realm: window.location.origin })}`,
      );
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
      setLoading(false);
    }
  }

  function useManualToken(event: FormEvent) {
    event.preventDefault();
    if (!manualToken.trim()) {
      setError("请输入 JWT Token");
      return;
    }
    setToken(manualToken.trim());
    onLogin(manualToken.trim());
  }

  return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="brand-mark large">
          <Sparkles size={28} />
        </div>
        <span className="eyebrow">Kesini Gacha Admin</span>
        <h1>后台管理</h1>
        <p>使用现有 OpenID/JWT 登录体系进入管理台。</p>

        <label>
          API 地址
          <input
            value={apiBase}
            onChange={(event) => setApiBaseState(event.target.value)}
            placeholder="http://localhost:3000"
          />
        </label>

        <button
          className="primary-button"
          onClick={startLogin}
          disabled={loading}
          type="button"
        >
          <Shield size={18} />
          {loading ? "处理中..." : "使用 OpenID 登录"}
        </button>

        <form className="manual-token" onSubmit={useManualToken}>
          <label>
            本地调试 Token
            <textarea
              value={manualToken}
              onChange={(event) => setManualToken(event.target.value)}
              placeholder="粘贴已有 JWT"
            />
          </label>
          <button className="secondary-button" type="submit">
            使用 Token 进入
          </button>
        </form>

        {error && <div className="error-box">{error}</div>}
      </section>
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
    <div className="page-stack">
      <div className="stat-grid">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <article className="stat-card" key={stat.label}>
              <div className="stat-icon">
                <Icon size={20} />
              </div>
              <div>
                <span>{stat.label}</span>
                <strong>{String(stat.value)}</strong>
              </div>
            </article>
          );
        })}
      </div>

      <div className="dashboard-grid">
        <Panel title="稀有度分布" icon={<Sparkles size={18} />}>
          <div className="rarity-bars">
            {rarityEntries.map(([rarity, value]) => (
              <div className="rarity-row" key={rarity}>
                <span>
                  <Badge>{rarity}</Badge>
                </span>
                <div>
                  <i
                    style={{
                      width: `${Math.max(4, (value / maxRarity) * 100)}%`,
                    }}
                  />
                </div>
                <strong>
                  {value}
                  <small>
                    {totalRarity
                      ? `${((value / totalRarity) * 100).toFixed(1)}%`
                      : "0%"}
                  </small>
                </strong>
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
            <div className="activity-table">
              {data.recentHistories.map((history, index) => (
                <div key={String(history.id || index)}>
                  <span className="mono">UID {String(history.uid || "-")}</span>
                  <strong>{String(history.count || 0)} 抽</strong>
                  <span>{summarizeRarities(String(history.card_levels || ""))}</span>
                  <time>{formatDate(history.createdAt)}</time>
                </div>
              ))}
            </div>
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
          <DescriptionList
            items={[
              ["UID", admin?.user?.uid || "-"],
              ["昵称", admin?.user?.nickname || admin?.user?.name || "-"],
              ["管理员状态", admin?.user?.is_admin ? "已授权" : "未授权"],
            ]}
          />
        </div>
      </Panel>
    </div>
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
}) {
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
    load();
  }

  async function deleteItem(row: Record<string, any>) {
    if (!window.confirm(`确认删除 ${title} #${row.id}？`)) {
      return;
    }
    await request(`${endpoint}/${row.id}`, { method: "DELETE" });
    load();
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
  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 1;

  return (
    <Panel
      title={title}
      icon={<Database size={18} />}
    >
      <div className="table-toolbar">
        <label className="search-box">
          <Search size={16} />
          <input
            value={keyword}
            onChange={(event) => {
              setPage(1);
              setKeyword(event.target.value);
            }}
            placeholder={searchPlaceholder || "搜索"}
          />
        </label>
        {poolFilterOptions && (
          <select
            value={poolId}
            onChange={(event) => {
              setPage(1);
              setPoolId(event.target.value);
            }}
          >
            <option value="">全部卡池</option>
            {poolFilterOptions.map((option) => (
              <option key={String(option.value)} value={String(option.value)}>
                {option.label}
              </option>
            ))}
          </select>
        )}
        {enableRarityFilter && (
          <select
            value={rarity}
            onChange={(event) => {
              setPage(1);
              setRarity(event.target.value);
            }}
          >
            <option value="">全部稀有度</option>
            <option value="N">N</option>
            <option value="R">R</option>
            <option value="SR">SR</option>
            <option value="SSR">SSR</option>
            <option value="UR">UR</option>
          </select>
        )}
        <div className="toolbar-actions">
          <button
            className="secondary-button compact"
            type="button"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw size={15} />
            刷新
          </button>
          <button
            className="secondary-button compact"
            type="button"
            onClick={exportCurrentPage}
            disabled={!rows.length}
          >
            <Download size={15} />
            导出CSV
          </button>
          {creatable && (
            <button
              className="primary-button compact"
              type="button"
              onClick={() => setCreating(true)}
            >
              新增
            </button>
          )}
        </div>
      </div>

      {error && <StateBox type="error">{error}</StateBox>}
      {loading && !data && !error && <StateBox>正在加载数据...</StateBox>}
      {data && rows.length === 0 && <StateBox>暂无数据</StateBox>}

      {rows.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {fields.map((field) => (
                  <th key={field.key}>{field.label}</th>
                ))}
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={String(row.id)}>
                  {fields.map((field) => (
                    <td key={field.key} data-label={field.label}>
                      <span
                        className="cell-text"
                        title={formatValue(getValue(row, field.key))}
                      >
                        {formatValue(getValue(row, field.key))}
                      </span>
                    </td>
                  ))}
                  <td data-label="操作">
                    <div className="row-actions">
                      <button
                        className="secondary-button compact icon-text"
                        type="button"
                        onClick={() => openDetail(row)}
                      >
                        <Eye size={14} />
                        详情
                      </button>
                      {editable && (
                        <button
                          className="secondary-button compact"
                          type="button"
                          onClick={() => setEditing(row)}
                        >
                          编辑
                        </button>
                      )}
                      {deletable && (
                        <button
                          className="danger"
                          type="button"
                          aria-label="删除"
                          onClick={() => deleteItem(row)}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="pagination">
        <button
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
          type="button"
        >
          <ChevronLeft size={16} />
        </button>
        <span>
          第 {page} / {totalPages} 页，共 {data?.total || 0} 条
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => setPage(page + 1)}
          type="button"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {(editing || creating) && (
        renderEditor ? (
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
        )
      )}

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
        const value = getValue(initial, field.key) ?? "";
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

  async function submit(event: FormEvent) {
    event.preventDefault();
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
    <div className="modal-backdrop">
      <form className="modal" onSubmit={submit}>
        <header>
          <h2>{title}</h2>
          <button type="button" onClick={onCancel}>
            关闭
          </button>
        </header>
        <div className="form-grid">
          {fields.map((field) => {
            const fieldOptions =
              field.type === "boolean" ? booleanOptions : field.options;
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
                <div className={fieldClass} key={field.key}>
                  <span>{field.label}</span>
                  <div
                    className="rarity-segment-grid"
                    role="group"
                    aria-label={field.label}
                  >
                    {(fieldOptions || []).map((option) => {
                      const selected = Array.isArray(values[field.key])
                        ? values[field.key].map(String)
                        : [];
                      const optionValue = String(option.value);
                      const isSelected = selected.includes(optionValue);
                      return (
                        <button
                          className={`rarity-segment rarity-${optionValue.toLowerCase()}${isSelected ? " selected" : ""}`}
                          type="button"
                          key={optionValue}
                          aria-pressed={isSelected}
                          disabled={option.disabled}
                          onClick={() =>
                            setValues({
                              ...values,
                              [field.key]: toggleMultiSelectValue(
                                selected,
                                optionValue,
                                !isSelected,
                                field,
                              ),
                            })
                          }
                        >
                          <span className="rarity-check" aria-hidden="true">
                            {isSelected ? "✓" : ""}
                          </span>
                          <span>{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  {field.helper && <small>{field.helper}</small>}
                </div>
              );
            }

            return (
              <label className={fieldClass} key={field.key}>
                <span>{field.label}</span>
                {field.type === "textarea" ? (
                  <textarea
                    value={values[field.key] ?? ""}
                    placeholder={field.placeholder}
                    onChange={(event) =>
                      setValues({
                        ...values,
                        [field.key]: event.target.value,
                      })
                    }
                  />
                ) : shouldRenderSelect ? (
                  <select
                    value={String(values[field.key] ?? "")}
                    onChange={(event) =>
                      setValues({
                        ...values,
                        [field.key]: coerceFieldValue(
                          field,
                          event.target.value,
                        ),
                      })
                    }
                  >
                    {!(fieldOptions || []).some((option) => String(option.value) === "") && (
                      <option value="">
                        {fieldOptions?.length ? "请选择" : "暂无可选项"}
                      </option>
                    )}
                    {(fieldOptions || []).map((option) => (
                      <option
                        key={String(option.value)}
                        value={String(option.value)}
                        disabled={option.disabled}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === "number" ? (
                  <input
                    type="number"
                    value={values[field.key] ?? ""}
                    placeholder={field.placeholder}
                    onChange={(event) =>
                      setValues({
                        ...values,
                        [field.key]: Number(event.target.value),
                      })
                    }
                  />
                ) : (
                  <input
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
                {field.helper && <small>{field.helper}</small>}
              </label>
            );
          })}
        </div>
        {error && <div className="error-box">{error}</div>}
        <footer>
          <button className="secondary-button" type="button" onClick={onCancel}>
            取消
          </button>
          <button
            className="primary-button compact"
            type="submit"
            disabled={loading}
          >
            {loading ? "保存中..." : "保存"}
          </button>
        </footer>
      </form>
    </div>
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

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await onSubmit({
        ...values,
        drop_type: currentType,
        drop_item_type: showUsageParams ? Number(values.drop_item_type || 0) : 0,
        drop_item_value: showUsageParams ? Number(values.drop_item_value || 0) : 0,
        default_fragment: currentType === 0 && values.default_fragment === true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <form className="modal" onSubmit={submit}>
        <header>
          <div>
            <span className="eyebrow">物品管理</span>
            <h2>{initial.id ? "编辑物品" : "新增物品"}</h2>
          </div>
          <button type="button" onClick={onCancel}>
            关闭
          </button>
        </header>
        <div className="item-template-row">
          {itemTemplates.map((template) => (
            <button
              className="secondary-button compact"
              type="button"
              key={template.label}
              onClick={() =>
                setValues({
                  ...values,
                  ...template.values,
                })
              }
            >
              {template.label}
            </button>
          ))}
        </div>
        <div className="form-grid">
          <label className="form-field">
            <span>物品名称</span>
            <input
              value={values.drop_name}
              placeholder="例如：SSR碎片"
              onChange={(event) =>
                setValues({ ...values, drop_name: event.target.value })
              }
            />
          </label>
          <label className="form-field">
            <span>物品类型</span>
            <select
              value={String(values.drop_type)}
              onChange={(event) =>
                setValues({
                  ...values,
                  drop_type: Number(event.target.value),
                  drop_item_type: 0,
                  drop_item_value: 0,
                  default_fragment:
                    Number(event.target.value) === 0
                      ? values.default_fragment
                      : false,
                })
              }
            >
              {dropTypeOptions.map((option) => (
                <option key={String(option.value)} value={String(option.value)}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="item-hint full-width">
            <Badge>{getDropTypeLabel(currentType)}</Badge>
            <span>{getDropTypeUsage(currentType)}</span>
          </div>
          {currentType === 0 && (
            <label className="form-field full-width switch-field">
              <span>
                <strong>默认分解碎片</strong>
                <small>卡片未单独选择碎片时，合成和分解会使用这个物品。</small>
              </span>
              <input
                type="checkbox"
                checked={values.default_fragment === true}
                onChange={(event) =>
                  setValues({
                    ...values,
                    default_fragment: event.target.checked,
                  })
                }
              />
            </label>
          )}
          <label className="form-field full-width">
            <span>物品说明</span>
            <textarea
              value={values.drop_desc}
              placeholder="给运营和玩家都能看懂的说明"
              onChange={(event) =>
                setValues({ ...values, drop_desc: event.target.value })
              }
            />
          </label>
          {showUsageParams && (
            <>
              <label className="form-field">
                <span>用途参数类型</span>
                <input
                  type="number"
                  min="0"
                  value={values.drop_item_type}
                  onChange={(event) =>
                    setValues({
                      ...values,
                      drop_item_type: Number(event.target.value),
                    })
                  }
                />
                <small>普通道具和其他类型可用于后续业务扩展。</small>
              </label>
              <label className="form-field">
                <span>用途参数值</span>
                <input
                  type="number"
                  min="0"
                  value={values.drop_item_value}
                  onChange={(event) =>
                    setValues({
                      ...values,
                      drop_item_value: Number(event.target.value),
                    })
                  }
                />
                <small>没有特殊规则时保持 0。</small>
              </label>
            </>
          )}
          <label className="form-field">
            <span>状态</span>
            <select
              value={values.disabled ? "true" : "false"}
              onChange={(event) =>
                setValues({ ...values, disabled: event.target.value === "true" })
              }
            >
              <option value="false">启用</option>
              <option value="true">禁用</option>
            </select>
          </label>
        </div>
        {error && <div className="error-box">{error}</div>}
        <footer>
          <button className="secondary-button" type="button" onClick={onCancel}>
            取消
          </button>
          <button
            className="primary-button compact"
            type="submit"
            disabled={loading}
          >
            {loading ? "保存中..." : "保存物品"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function RedeemCodesPage({ options }: { options: AdminOptions | null }) {
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
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

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

  async function deleteRedeemCode(row: RedeemCodeRecord) {
    if (!window.confirm(`确认停用并删除兑换码 ${row.code}？`)) {
      return;
    }
    await request(`/admin/redeem-codes/${row.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="page-stack">
      <Panel title="兑换码管理" icon={<Gift size={18} />}>
        <div className="table-toolbar">
          <label className="search-box">
            <Search size={16} />
            <input
              value={keyword}
              onChange={(event) => {
                setPage(1);
                setKeyword(event.target.value);
              }}
              placeholder="搜索兑换码或名称"
            />
          </label>
          <div className="toolbar-actions">
            <button
              className="secondary-button compact"
              type="button"
              onClick={load}
              disabled={loading}
            >
              <RefreshCw size={15} />
              刷新
            </button>
            <button
              className="secondary-button compact"
              type="button"
              onClick={() => exportRowsToCsv("兑换码", rows, redeemCodeFields)}
              disabled={!rows.length}
            >
              <Download size={15} />
              导出CSV
            </button>
            <button
              className="primary-button compact"
              type="button"
              onClick={() => setCreating(true)}
            >
              新增
            </button>
          </div>
        </div>

        {error && <StateBox type="error">{error}</StateBox>}
        {loading && !data && !error && <StateBox>正在加载兑换码...</StateBox>}
        {data && rows.length === 0 && <StateBox>暂无兑换码</StateBox>}

        {rows.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>兑换码</th>
                  <th>名称</th>
                  <th>状态</th>
                  <th>库存</th>
                  <th>奖励</th>
                  <th>有效期</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="兑换码">
                      <span className="cell-text mono">{row.code}</span>
                    </td>
                    <td data-label="名称">
                      <span className="cell-text">{row.name}</span>
                    </td>
                    <td data-label="状态">
                      <Badge>{row.enabled ? "启用" : "停用"}</Badge>
                    </td>
                    <td data-label="库存">
                      {row.used_count || 0} / {row.total_limit || "不限"}
                    </td>
                    <td data-label="奖励">
                      <span className="cell-text">{formatRewards(row.rewards)}</span>
                    </td>
                    <td data-label="有效期">
                      <span className="cell-text">
                        {formatDateRange(row.starts_at, row.ends_at)}
                      </span>
                    </td>
                    <td data-label="操作">
                      <div className="row-actions">
                        <button
                          className="secondary-button compact icon-text"
                          type="button"
                          onClick={() => setDetail(row)}
                        >
                          <Eye size={14} />
                          详情
                        </button>
                        <button
                          className="secondary-button compact"
                          type="button"
                          onClick={() => setEditing(row)}
                        >
                          编辑
                        </button>
                        <button
                          className="danger"
                          type="button"
                          aria-label="删除"
                          onClick={() => deleteRedeemCode(row)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="pagination">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            type="button"
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            第 {page} / {totalPages} 页，共 {data?.total || 0} 条
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            type="button"
          >
            <ChevronRight size={16} />
          </button>
        </div>

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

      <AdminTable
        title="兑换记录"
        endpoint="/admin/redeem-usages"
        fields={redeemUsageFields}
        searchPlaceholder="按 UID 查询"
        keywordParam="uid"
      />
    </div>
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

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await onSubmit({
        ...values,
        starts_at: fromDateTimeLocal(values.starts_at),
        ends_at: fromDateTimeLocal(values.ends_at),
        total_limit: values.total_limit === "" ? null : Number(values.total_limit),
      } as Partial<RedeemCodeRecord>);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <form className="modal wide" onSubmit={submit}>
        <header>
          <div>
            <span className="eyebrow">兑换码</span>
            <h2>{initial ? "编辑兑换码" : "新增兑换码"}</h2>
          </div>
          <button type="button" onClick={onCancel}>
            关闭
          </button>
        </header>
        <div className="form-grid">
          <label className="form-field">
            <span>兑换码</span>
            <input
              value={values.code}
              placeholder="WELCOME2026"
              onChange={(event) =>
                setValues({ ...values, code: event.target.value.toUpperCase() })
              }
            />
          </label>
          <label className="form-field">
            <span>名称</span>
            <input
              value={values.name}
              placeholder="欢迎礼包"
              onChange={(event) =>
                setValues({ ...values, name: event.target.value })
              }
            />
          </label>
          <label className="form-field">
            <span>状态</span>
            <select
              value={String(values.enabled)}
              onChange={(event) =>
                setValues({ ...values, enabled: event.target.value === "true" })
              }
            >
              <option value="true">启用</option>
              <option value="false">停用</option>
            </select>
          </label>
          <label className="form-field">
            <span>总库存</span>
            <input
              type="number"
              min="1"
              value={values.total_limit}
              placeholder="留空表示不限"
              onChange={(event) =>
                setValues({ ...values, total_limit: event.target.value })
              }
            />
          </label>
          <label className="form-field">
            <span>开始时间</span>
            <input
              type="datetime-local"
              value={values.starts_at}
              onChange={(event) =>
                setValues({ ...values, starts_at: event.target.value })
              }
            />
          </label>
          <label className="form-field">
            <span>结束时间</span>
            <input
              type="datetime-local"
              value={values.ends_at}
              onChange={(event) =>
                setValues({ ...values, ends_at: event.target.value })
              }
            />
          </label>
          <label className="form-field full-width">
            <span>描述</span>
            <textarea
              value={values.description}
              placeholder="面向运营和客服的备注"
              onChange={(event) =>
                setValues({ ...values, description: event.target.value })
              }
            />
          </label>
        </div>
        <div className="reward-editor">
          <div className="section-title-row">
            <h3>奖励内容</h3>
            <Badge>{formatRewards(values.rewards)}</Badge>
          </div>
          <label className="form-field">
            <span>奖励积分</span>
            <input
              type="number"
              min="0"
              value={values.rewards.points}
              onChange={(event) =>
                setValues({
                  ...values,
                  rewards: {
                    ...values.rewards,
                    points: Number(event.target.value),
                  },
                })
              }
            />
          </label>
          <div className="reward-items">
            {values.rewards.items.map((item, index) => (
              <div className="reward-item-row" key={index}>
                <select
                  value={item.itemId || ""}
                  onChange={(event) =>
                    setValues({
                      ...values,
                      rewards: updateRewardItem(values.rewards, index, {
                        itemId: Number(event.target.value),
                      }),
                    })
                  }
                >
                  <option value="">选择物品</option>
                  {groupedItemOptions.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.options.map((option) => (
                        <option
                          key={String(option.value)}
                          value={String(option.value)}
                          disabled={option.disabled}
                        >
                          {option.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  value={item.num}
                  onChange={(event) =>
                    setValues({
                      ...values,
                      rewards: updateRewardItem(values.rewards, index, {
                        num: Number(event.target.value),
                      }),
                    })
                  }
                />
                <button
                  className="secondary-button compact"
                  type="button"
                  onClick={() =>
                    setValues({
                      ...values,
                      rewards: {
                        ...values.rewards,
                        items: values.rewards.items.filter((_, i) => i !== index),
                      },
                    })
                  }
                >
                  移除
                </button>
              </div>
            ))}
          </div>
          <p className="form-note">
            积分请使用“奖励积分”字段；物品奖励主要选择卡片碎片或普通道具。
          </p>
          <button
            className="secondary-button compact"
            type="button"
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
          </button>
        </div>
        {error && <div className="error-box">{error}</div>}
        <footer>
          <button className="secondary-button" type="button" onClick={onCancel}>
            取消
          </button>
          <button
            className="primary-button compact"
            type="submit"
            disabled={loading}
          >
            {loading ? "保存中..." : "保存兑换码"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function ExchangeShopPage({ options }: { options: AdminOptions | null }) {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [keyword, setKeyword] = useState("");
  const [data, setData] =
    useState<PageResult<ExchangeShopItemRecord> | null>(null);
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
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

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

  async function deleteExchangeItem(row: ExchangeShopItemRecord) {
    if (!window.confirm(`确认停用并删除兑换项 ${row.name}？`)) {
      return;
    }
    await request(`/admin/exchange-items/${row.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="page-stack">
      <Panel title="兑换商店" icon={<Store size={18} />}>
        <div className="table-toolbar">
          <label className="search-box">
            <Search size={16} />
            <input
              value={keyword}
              onChange={(event) => {
                setPage(1);
                setKeyword(event.target.value);
              }}
              placeholder="搜索兑换项名称或说明"
            />
          </label>
          <div className="toolbar-actions">
            <button
              className="secondary-button compact"
              type="button"
              onClick={load}
              disabled={loading}
            >
              <RefreshCw size={15} />
              刷新
            </button>
            <button
              className="secondary-button compact"
              type="button"
              onClick={() => exportRowsToCsv("兑换商店", rows, exchangeItemFields)}
              disabled={!rows.length}
            >
              <Download size={15} />
              导出CSV
            </button>
            <button
              className="primary-button compact"
              type="button"
              onClick={() => setCreating(true)}
            >
              新增
            </button>
          </div>
        </div>

        {error && <StateBox type="error">{error}</StateBox>}
        {loading && !data && !error && <StateBox>正在加载兑换项...</StateBox>}
        {data && rows.length === 0 && <StateBox>暂无兑换项</StateBox>}

        {rows.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>兑换项</th>
                  <th>状态</th>
                  <th>消耗</th>
                  <th>奖励</th>
                  <th>库存</th>
                  <th>限兑</th>
                  <th>有效期</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="兑换项">
                      <span className="cell-text">{row.name}</span>
                    </td>
                    <td data-label="状态">
                      <Badge>{row.enabled ? "启用" : "停用"}</Badge>
                    </td>
                    <td data-label="消耗">
                      <span className="cell-text">{formatCosts(row.costs)}</span>
                    </td>
                    <td data-label="奖励">
                      <span className="cell-text">{formatRewards(row.rewards)}</span>
                    </td>
                    <td data-label="库存">
                      {row.used_count || 0} / {row.total_limit || "不限"}
                    </td>
                    <td data-label="限兑">{row.user_limit || "不限"}</td>
                    <td data-label="有效期">
                      <span className="cell-text">
                        {formatDateRange(row.starts_at, row.ends_at)}
                      </span>
                    </td>
                    <td data-label="操作">
                      <div className="row-actions">
                        <button
                          className="secondary-button compact icon-text"
                          type="button"
                          onClick={() => setDetail(row)}
                        >
                          <Eye size={14} />
                          详情
                        </button>
                        <button
                          className="secondary-button compact"
                          type="button"
                          onClick={() => setEditing(row)}
                        >
                          编辑
                        </button>
                        <button
                          className="danger"
                          type="button"
                          aria-label="删除"
                          onClick={() => deleteExchangeItem(row)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="pagination">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            type="button"
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            第 {page} / {totalPages} 页，共 {data?.total || 0} 条
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            type="button"
          >
            <ChevronRight size={16} />
          </button>
        </div>

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

      <AdminTable
        title="兑换商店记录"
        endpoint="/admin/exchange-usages"
        fields={exchangeUsageFields}
        searchPlaceholder="按 UID 查询"
        keywordParam="uid"
      />
    </div>
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

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await onSubmit({
        ...values,
        starts_at: fromDateTimeLocal(values.starts_at),
        ends_at: fromDateTimeLocal(values.ends_at),
        total_limit: values.total_limit === "" ? null : Number(values.total_limit),
        user_limit: values.user_limit === "" ? null : Number(values.user_limit),
        sort_order: Number(values.sort_order || 0),
      } as Partial<ExchangeShopItemRecord>);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <form className="modal wide" onSubmit={submit}>
        <header>
          <div>
            <span className="eyebrow">兑换商店</span>
            <h2>{initial ? "编辑兑换项" : "新增兑换项"}</h2>
          </div>
          <button type="button" onClick={onCancel}>
            关闭
          </button>
        </header>
        <div className="form-grid">
          <label className="form-field">
            <span>兑换项名称</span>
            <input
              value={values.name}
              placeholder="例如：活动代币换积分"
              onChange={(event) =>
                setValues({ ...values, name: event.target.value })
              }
            />
          </label>
          <label className="form-field">
            <span>状态</span>
            <select
              value={String(values.enabled)}
              onChange={(event) =>
                setValues({ ...values, enabled: event.target.value === "true" })
              }
            >
              <option value="true">启用</option>
              <option value="false">停用</option>
            </select>
          </label>
          <label className="form-field">
            <span>总库存</span>
            <input
              type="number"
              min="1"
              value={values.total_limit}
              placeholder="留空表示不限"
              onChange={(event) =>
                setValues({ ...values, total_limit: event.target.value })
              }
            />
          </label>
          <label className="form-field">
            <span>单用户限兑</span>
            <input
              type="number"
              min="1"
              value={values.user_limit}
              placeholder="留空表示不限"
              onChange={(event) =>
                setValues({ ...values, user_limit: event.target.value })
              }
            />
          </label>
          <label className="form-field">
            <span>开始时间</span>
            <input
              type="datetime-local"
              value={values.starts_at}
              onChange={(event) =>
                setValues({ ...values, starts_at: event.target.value })
              }
            />
          </label>
          <label className="form-field">
            <span>结束时间</span>
            <input
              type="datetime-local"
              value={values.ends_at}
              onChange={(event) =>
                setValues({ ...values, ends_at: event.target.value })
              }
            />
          </label>
          <label className="form-field">
            <span>排序</span>
            <input
              type="number"
              min="0"
              value={values.sort_order}
              onChange={(event) =>
                setValues({ ...values, sort_order: Number(event.target.value) })
              }
            />
          </label>
          <label className="form-field full-width">
            <span>说明</span>
            <textarea
              value={values.description}
              placeholder="给运营和客服看的兑换说明"
              onChange={(event) =>
                setValues({ ...values, description: event.target.value })
              }
            />
          </label>
        </div>

        <div className="reward-editor">
          <div className="section-title-row">
            <h3>消耗物品</h3>
            <Badge>{formatCosts(values.costs)}</Badge>
          </div>
          <div className="reward-items">
            {values.costs.map((item, index) => (
              <div className="reward-item-row" key={index}>
                <select
                  value={item.itemId || ""}
                  onChange={(event) =>
                    setValues({
                      ...values,
                      costs: updateCostItem(values.costs, index, {
                        itemId: Number(event.target.value),
                      }),
                    })
                  }
                >
                  <option value="">选择消耗物品</option>
                  {consumableGroups.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.options.map((option) => (
                        <option
                          key={String(option.value)}
                          value={String(option.value)}
                          disabled={option.disabled}
                        >
                          {option.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  value={item.num}
                  onChange={(event) =>
                    setValues({
                      ...values,
                      costs: updateCostItem(values.costs, index, {
                        num: Number(event.target.value),
                      }),
                    })
                  }
                />
                <button
                  className="secondary-button compact"
                  type="button"
                  onClick={() =>
                    setValues({
                      ...values,
                      costs: values.costs.filter((_, i) => i !== index),
                    })
                  }
                >
                  移除
                </button>
              </div>
            ))}
          </div>
          <p className="form-note">
            消耗项只支持背包物品，不能选择虚拟积分；积分消耗后续单独设计。
          </p>
          <button
            className="secondary-button compact"
            type="button"
            onClick={() =>
              setValues({
                ...values,
                costs: [...values.costs, { itemId: 0, num: 1 }],
              })
            }
          >
            添加消耗物品
          </button>
        </div>

        <div className="reward-editor">
          <div className="section-title-row">
            <h3>兑换奖励</h3>
            <Badge>{formatRewards(values.rewards)}</Badge>
          </div>
          <label className="form-field">
            <span>奖励积分</span>
            <input
              type="number"
              min="0"
              value={values.rewards.points}
              onChange={(event) =>
                setValues({
                  ...values,
                  rewards: {
                    ...values.rewards,
                    points: Number(event.target.value),
                  },
                })
              }
            />
          </label>
          <div className="reward-items">
            {values.rewards.items.map((item, index) => (
              <div className="reward-item-row" key={index}>
                <select
                  value={item.itemId || ""}
                  onChange={(event) =>
                    setValues({
                      ...values,
                      rewards: updateRewardItem(values.rewards, index, {
                        itemId: Number(event.target.value),
                      }),
                    })
                  }
                >
                  <option value="">选择奖励物品</option>
                  {rewardGroups.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.options.map((option) => (
                        <option
                          key={String(option.value)}
                          value={String(option.value)}
                          disabled={option.disabled}
                        >
                          {option.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  value={item.num}
                  onChange={(event) =>
                    setValues({
                      ...values,
                      rewards: updateRewardItem(values.rewards, index, {
                        num: Number(event.target.value),
                      }),
                    })
                  }
                />
                <button
                  className="secondary-button compact"
                  type="button"
                  onClick={() =>
                    setValues({
                      ...values,
                      rewards: {
                        ...values.rewards,
                        items: values.rewards.items.filter((_, i) => i !== index),
                      },
                    })
                  }
                >
                  移除
                </button>
              </div>
            ))}
          </div>
          <p className="form-note">
            积分请使用“奖励积分”字段；虚拟积分物品不会出现在奖励物品选择里。
          </p>
          <button
            className="secondary-button compact"
            type="button"
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
          </button>
        </div>
        {error && <div className="error-box">{error}</div>}
        <footer>
          <button className="secondary-button" type="button" onClick={onCancel}>
            取消
          </button>
          <button
            className="primary-button compact"
            type="submit"
            disabled={loading}
          >
            {loading ? "保存中..." : "保存兑换项"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function ConfigPage({ options }: { options: AdminOptions | null }) {
  const [data, setData] = useState<GachaConfigData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [editing, setEditing] = useState<{
    poolKey: string;
    config: GachaPoolConfig;
  } | null>(null);

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

  const poolEntries = Object.entries(data?.pools || {}).sort(
    ([left], [right]) => Number(left) - Number(right),
  );
  const filteredPoolEntries = poolEntries.filter(([poolKey, config]) => {
    const poolName = data?.poolNames?.[poolKey] || poolNameById(Number(poolKey));
    const query = keyword.trim().toLowerCase();
    const matchesKeyword =
      !query || `${poolKey} ${poolName}`.toLowerCase().includes(query);
    const matchesSource =
      sourceFilter === "all" ||
      (sourceFilter === "database" && config.source === "database") ||
      (sourceFilter === "env" && config.source !== "database");
    return matchesKeyword && matchesSource;
  });

  return (
    <>
      <Panel
        title="卡池配置工作台"
        icon={<Settings size={18} />}
        action={<RefreshButton onClick={load} loading={loading} />}
      >
        <div className="table-toolbar">
          <label className="search-box">
            <Search size={16} />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索卡池名称或 ID"
            />
          </label>
          <select
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value)}
          >
            <option value="all">全部配置来源</option>
            <option value="database">只看数据库配置</option>
            <option value="env">只看环境默认</option>
          </select>
          <div className="toolbar-actions">
            <button
              className="secondary-button compact"
              type="button"
              onClick={load}
              disabled={loading}
            >
              <RefreshCw size={15} />
              刷新
            </button>
          </div>
        </div>
        {error && <StateBox type="error">{error}</StateBox>}
        {!data && !error && <StateBox>正在加载配置...</StateBox>}
        {data && poolEntries.length === 0 && <StateBox>暂无抽卡配置</StateBox>}
        {data && poolEntries.length > 0 && filteredPoolEntries.length === 0 && (
          <StateBox>没有符合筛选条件的卡池配置</StateBox>
        )}
        {data && filteredPoolEntries.length > 0 && (
          <div className="table-wrap config-workbench">
            <table className="config-table">
              <thead>
                <tr>
                  <th>卡池</th>
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
                {filteredPoolEntries.map(([poolKey, config]) => {
                  const drawCosts = config.drawCosts || { once: 10, ten: 100 };
                  const probabilityTotal = getProbabilityTotal(
                    config.rarityProbabilities,
                  );
                  const sourceText =
                    config.source === "database" && config.enabled !== false
                      ? "数据库配置"
                      : "环境默认";
                  return (
                    <tr key={poolKey}>
                      <td data-label="卡池">
                        <div className="config-pool-cell">
                          <strong>
                            {data.poolNames?.[poolKey] ||
                              poolNameById(Number(poolKey))}
                          </strong>
                          <span>#{config.poolId || poolKey}</span>
                        </div>
                      </td>
                      <td data-label="配置来源">
                        <Badge>{sourceText}</Badge>
                      </td>
                      <td data-label="积分消耗">
                        <span className="cell-text">
                          单抽 {drawCosts.once ?? 10} / 十连{" "}
                          {drawCosts.ten ?? 100}
                        </span>
                      </td>
                      <td data-label="概率合计">
                        <span
                          className={
                            Math.abs(probabilityTotal - 1) < 0.0001
                              ? "config-ok"
                              : "config-warning"
                          }
                        >
                          {(probabilityTotal * 100).toFixed(2)}%
                        </span>
                      </td>
                      <td data-label="UP 状态">
                        <span
                          className="cell-text"
                          title={summarizeUpConfig(config.upCards)}
                        >
                          {summarizeUpConfig(config.upCards)}
                        </span>
                      </td>
                      <td data-label="保底摘要">
                        <span
                          className="cell-text"
                          title={summarizePityConfig(config.pitySystem)}
                        >
                          {summarizePityConfig(config.pitySystem)}
                        </span>
                      </td>
                      <td data-label="更新时间">
                        {config.updatedAt ? formatDate(config.updatedAt) : "-"}
                      </td>
                      <td data-label="操作">
                        <button
                          className="secondary-button compact"
                          type="button"
                          onClick={() => setEditing({ poolKey, config })}
                        >
                          编辑
                        </button>
                      </td>
                    </tr>
                  );
                })}
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
                当前后台权限以数据库 <code>User.is_admin</code>{" "}
                为准，环境变量 <code>ADMIN_UIDS</code> 仅保留展示。
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
      {editing && (
        <GachaConfigModal
          poolKey={editing.poolKey}
          config={editing.config}
          defaultConfig={data?.defaults?.[editing.poolKey]}
          poolName={data?.poolNames?.[editing.poolKey]}
          options={options}
          allPools={poolEntries}
          poolNames={data?.poolNames || {}}
          onCancel={() => setEditing(null)}
          onSubmit={async (poolId, values) => {
            const { poolId: _poolId, source: _source, updatedAt: _updatedAt, ...payload } =
              values;
            await request(`/admin/config/gacha/${poolId}`, {
              method: "PATCH",
              body: JSON.stringify(payload),
            });
            setEditing(null);
            load();
          }}
          onCopy={async (poolId, targetPoolIds) => {
            await request(`/admin/config/gacha/${poolId}/copy`, {
              method: "POST",
              body: JSON.stringify({ targetPoolIds }),
            });
            load();
          }}
        />
      )}
    </>
  );
}

function GachaConfigModal({
  poolKey,
  config,
  defaultConfig,
  poolName,
  options,
  allPools,
  poolNames,
  onCancel,
  onSubmit,
  onCopy,
}: {
  poolKey: string;
  config: GachaPoolConfig;
  defaultConfig?: GachaPoolConfig;
  poolName?: string;
  options: AdminOptions | null;
  allPools: Array<[string, GachaPoolConfig]>;
  poolNames: Record<string, string>;
  onCancel: () => void;
  onSubmit: (poolId: number, values: GachaPoolConfig) => Promise<void>;
  onCopy: (poolId: number, targetPoolIds: number[]) => Promise<void>;
}) {
  const [values, setValues] = useState<GachaFormState>(() =>
    createGachaFormState(poolKey, config),
  );
  const [activeTab, setActiveTab] = useState("base");
  const [upKeyword, setUpKeyword] = useState("");
  const [upRarity, setUpRarity] = useState("");
  const [copyTargets, setCopyTargets] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [copyLoading, setCopyLoading] = useState(false);
  const currentDefault = defaultConfig || config;
  const probabilityTotal = getProbabilityTotal(values.rarityProbabilities);
  const probabilityPercentTotal = probabilityTotal * 100;
  const probabilityIsValid = Math.abs(probabilityTotal - 1) < 0.0001;
  const poolCardOptions = (options?.cards || []).filter(
    (card) => Number(card.pool) === values.poolId,
  );
  const filteredUpCards = poolCardOptions.filter((card) => {
    const matchesKeyword =
      !upKeyword.trim() ||
      String(card.label || "")
        .toLowerCase()
        .includes(upKeyword.trim().toLowerCase());
    const matchesRarity =
      !upRarity || String(card.rarity || "").split(",").includes(upRarity);
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
  const otherPools = allPools.filter(([targetPoolKey]) => targetPoolKey !== poolKey);
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
    setNotice("已填入环境默认配置，保存后将作为数据库配置生效。");
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

  function toggleCopyTarget(poolId: string, checked: boolean) {
    const selected = new Set(copyTargets);
    if (checked) {
      selected.add(poolId);
    } else {
      selected.delete(poolId);
    }
    setCopyTargets(Array.from(selected));
  }

  function validateForm() {
    if (!probabilityIsValid) {
      return `稀有度概率合计必须为 100%，当前为 ${probabilityPercentTotal.toFixed(2)}%`;
    }
    if (
      rarityOptions.some(
        (option) => Number(values.rarityProbabilities[String(option.value)] || 0) < 0,
      )
    ) {
      return "稀有度概率不能小于 0";
    }
    const once = Number(values.drawCosts?.once);
    const ten = Number(values.drawCosts?.ten);
    if (!Number.isInteger(once) || once <= 0 || !Number.isInteger(ten) || ten <= 0) {
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

  async function submit(event: FormEvent) {
    event.preventDefault();
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

  async function copyConfigToTargets() {
    setError("");
    setNotice("");
    const targetPoolIds = copyTargets.map(Number).filter((poolId) => poolId > 0);
    if (targetPoolIds.length === 0) {
      setError("请选择要复制到的目标卡池");
      return;
    }
    if (
      !window.confirm(
        `确认把当前生效配置复制到 ${targetPoolIds.length} 个卡池？目标卡池的数据库配置会被覆盖。`,
      )
    ) {
      return;
    }
    setCopyLoading(true);
    try {
      await onCopy(values.poolId, targetPoolIds);
      setCopyTargets([]);
      setNotice(
        `已复制到：${targetPoolIds
          .map((targetPoolId) => poolNames[String(targetPoolId)] || poolNameById(targetPoolId))
          .join("、")}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "复制失败");
    } finally {
      setCopyLoading(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <form className="modal wide gacha-modal" onSubmit={submit}>
        <header>
          <div>
            <span className="eyebrow">抽卡配置</span>
            <h2>编辑 {poolName || poolNameById(values.poolId)}</h2>
          </div>
          <div className="modal-header-actions">
            <button type="button" onClick={fillFromDefault}>
              从环境默认填充
            </button>
            <button type="button" onClick={onCancel}>
              关闭
            </button>
          </div>
        </header>
        <div className="config-tabs" role="tablist" aria-label="抽卡配置分区">
          {configTabs.map((tab) => (
            <button
              key={tab.key}
              className={activeTab === tab.key ? "active" : ""}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="config-edit config-edit-workspace">
          {activeTab === "base" && (
            <section>
              <div className="section-title-row">
                <h3>基础价格</h3>
                <Badge>{values.enabled === false ? "回退环境默认" : "数据库配置"}</Badge>
              </div>
              <label className="form-field">
                <span>启用数据库配置</span>
                <select
                  value={String(values.enabled !== false)}
                  onChange={(event) =>
                    setValues({ ...values, enabled: event.target.value === "true" })
                  }
                >
                  <option value="true">启用</option>
                  <option value="false">关闭并回退环境默认</option>
                </select>
              </label>
              <div className="form-grid no-padding">
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
              <DescriptionList
                items={[
                  ["环境默认单抽", `${currentDefault.drawCosts?.once ?? 10} 积分`],
                  ["环境默认十连", `${currentDefault.drawCosts?.ten ?? 100} 积分`],
                  [
                    "当前配置来源",
                    config.source === "database" && config.enabled !== false
                      ? "数据库配置"
                      : "环境默认",
                  ],
                ]}
              />
            </section>
          )}

          {activeTab === "probability" && (
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
                  环境默认
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
                    <label className="form-field probability-field" key={rarity}>
                      <span>{rarity} 概率</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={Number((value * 100).toFixed(4))}
                        onChange={(event) =>
                          setProbabilityFromPercent(rarity, Number(event.target.value))
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

          {activeTab === "up" && (
            <section>
              <div className="section-title-row">
                <h3>UP 配置</h3>
                <Badge>{values.upCards?.enabled ? "已开启" : "已关闭"}</Badge>
              </div>
              <div className="form-grid no-padding">
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
                    value={Number(((values.upCards?.upRate || 0) * 100).toFixed(4))}
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
                      <option key={String(option.value)} value={String(option.value)}>
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
                          {card.label} · {card.rarity || "-"} · #{String(card.value)}
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
                        <label className="up-card-option" key={String(card.value)}>
                          <input
                            type="checkbox"
                            checked={(values.upCards?.cardIds || []).includes(cardId)}
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

          {activeTab === "pity" && (
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
                <StateBox>保底已关闭，抽卡时只按基础概率和 UP 配置计算。</StateBox>
              ) : (
                <div className="pity-rule-grid">
                  <div className="pity-rule-card">
                    <h4>软保底</h4>
                    <div className="form-grid no-padding">
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
                            values.pitySystem?.softPity?.guaranteedRarity || "SR"
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
                    <div className="form-grid no-padding">
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
                            values.pitySystem?.hardPity?.guaranteedRarity || "SSR"
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

          {activeTab === "preview" && (
            <section>
              <div className="section-title-row">
                <h3>保存预览</h3>
                <Badge>{probabilityIsValid ? "可保存" : "需修正"}</Badge>
              </div>
              <DescriptionList
                items={[
                  [
                    "保存效果",
                    values.enabled === false
                      ? "关闭数据库配置，抽卡回退环境默认"
                      : "保存为数据库配置，并立即覆盖当前卡池抽卡配置",
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
              <div className="copy-config-box">
                <div className="section-title-row">
                  <div>
                    <h3>复制到其他卡池</h3>
                    <p className="muted-text">
                      复制的是服务器当前已生效配置，不包含未保存修改，目标卡池数据库配置会被覆盖。
                    </p>
                  </div>
                  <button
                    className="secondary-button compact"
                    type="button"
                    onClick={copyConfigToTargets}
                    disabled={copyLoading || copyTargets.length === 0}
                  >
                    {copyLoading ? "复制中..." : "复制配置"}
                  </button>
                </div>
                <div className="copy-target-grid">
                  {otherPools.length ? (
                    otherPools.map(([targetPoolKey]) => (
                      <label className="check-option" key={targetPoolKey}>
                        <input
                          type="checkbox"
                          checked={copyTargets.includes(targetPoolKey)}
                          onChange={(event) =>
                            toggleCopyTarget(targetPoolKey, event.target.checked)
                          }
                        />
                        <span>
                          {poolNames[targetPoolKey] ||
                            poolNameById(Number(targetPoolKey))}
                        </span>
                      </label>
                    ))
                  ) : (
                    <span className="muted-text">暂无其他卡池可复制</span>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>
        {error && <div className="error-box">{error}</div>}
        {notice && <div className="success-box">{notice}</div>}
        <footer>
          <button className="secondary-button" type="button" onClick={onCancel}>
            取消
          </button>
          <button
            className="primary-button compact"
            type="submit"
            disabled={loading}
          >
            {loading ? "保存中..." : "保存配置"}
          </button>
        </footer>
      </form>
    </div>
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
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal detail-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span className="eyebrow">记录详情</span>
            <h2>{title}</h2>
          </div>
          <button type="button" aria-label="关闭详情" onClick={onClose}>
            关闭
          </button>
        </header>
        {loading ? (
          <StateBox>正在读取详情...</StateBox>
        ) : (
          <div className="detail-modal-body">
            <DescriptionList items={items} />
          </div>
        )}
      </section>
    </div>
  );
}

function DescriptionList({
  items,
}: {
  items: Array<[string, unknown]>;
}) {
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
  return <span className="badge">{children}</span>;
}

function RefreshButton({
  onClick,
  loading,
}: {
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <button
      className="secondary-button compact icon-text"
      type="button"
      onClick={onClick}
      disabled={loading}
    >
      <RefreshCw size={15} />
      刷新
    </button>
  );
}

function Panel({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <header className="panel-header">
        <div className="panel-title">
          {icon}
          <h2>{title}</h2>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function StateBox({ children, type }: { children: ReactNode; type?: "error" }) {
  return (
    <div className={type === "error" ? "state-box error" : "state-box"}>
      {children}
    </div>
  );
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
      options: enabledOptions.filter((option: any) => option.type === type.value),
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
        guaranteedRarity:
          config.pitySystem?.softPity?.guaranteedRarity || "SR",
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

function coerceFieldValue(field: FieldConfig, value: string) {
  const fieldOptions =
    field.type === "boolean" ? booleanOptions : field.options || [];
  const matchedOption = fieldOptions.find(
    (option) => String(option.value) === value,
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
    getValue(data, field.key),
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
