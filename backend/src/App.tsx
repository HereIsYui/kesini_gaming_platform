import {
  Activity,
  Boxes,
  ChevronLeft,
  ChevronRight,
  Coins,
  Database,
  Gauge,
  History,
  Layers,
  LogOut,
  Moon,
  Package,
  Search,
  Settings,
  Shield,
  Sparkles,
  Sun,
  Ticket,
  Trash2,
  Users,
} from "lucide-react";
import {
  FormEvent,
  ReactNode,
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
  DashboardData,
  FieldConfig,
  LoginResponse,
  PageResult,
} from "./types";

type Theme = "light" | "dark";
const handledOpenidCallbacks = new Set<string>();

const navItems = [
  { key: "dashboard", label: "总览", icon: Gauge },
  { key: "users", label: "用户", icon: Users },
  { key: "pools", label: "卡池", icon: Layers },
  { key: "cards", label: "卡片", icon: Sparkles },
  { key: "drop-items", label: "道具", icon: Package },
  { key: "histories", label: "历史", icon: History },
  { key: "inventories", label: "背包", icon: Boxes },
  { key: "pity", label: "保底", icon: Ticket },
  { key: "config", label: "配置", icon: Settings },
];

const poolFields: FieldConfig[] = [
  { key: "id", label: "ID", readonly: true },
  { key: "pool_name", label: "卡池名称" },
  { key: "card_desc", label: "描述", type: "textarea" },
  { key: "card_type", label: "类型", type: "number" },
];

const cardFields: FieldConfig[] = [
  { key: "id", label: "ID", readonly: true },
  { key: "card_name", label: "卡片名称" },
  { key: "card_level", label: "稀有度" },
  { key: "pool", label: "卡池ID", type: "number" },
  { key: "card_type", label: "类型", type: "number" },
  { key: "card_desc", label: "描述", type: "textarea" },
  { key: "drop_item", label: "掉落配置" },
];

const dropFields: FieldConfig[] = [
  { key: "id", label: "ID", readonly: true },
  { key: "drop_name", label: "道具名称" },
  { key: "drop_desc", label: "描述", type: "textarea" },
  { key: "drop_type", label: "掉落类型", type: "number" },
  { key: "drop_item_type", label: "道具类型", type: "number" },
  { key: "drop_item_value", label: "道具值", type: "number" },
];

const userFields: FieldConfig[] = [
  { key: "id", label: "ID", readonly: true },
  { key: "uid", label: "UID", readonly: true },
  { key: "name", label: "用户名" },
  { key: "nickname", label: "昵称" },
  { key: "point", label: "积分", type: "number" },
  { key: "is_admin", label: "管理员", type: "boolean" },
];

const inventoryFields: FieldConfig[] = [
  { key: "id", label: "ID", readonly: true },
  { key: "user.uid", label: "UID", readonly: true },
  { key: "item.drop_name", label: "道具", readonly: true },
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

export function App() {
  const [token, setLocalToken] = useState(getToken());
  const [admin, setAdmin] = useState<AdminMeResponse | null>(null);
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
              searchPlaceholder="搜索卡片名称"
              extraFilters={<RarityFilter />}
            />
          )}
          {active === "drop-items" && (
            <AdminTable
              title="道具管理"
              endpoint="/admin/drop-items"
              fields={dropFields}
              editable
              creatable
              deletable
              searchPlaceholder="搜索道具名称或描述"
            />
          )}
          {active === "histories" && (
            <AdminTable
              title="抽卡历史"
              endpoint="/admin/histories"
              fields={historyFields}
              searchPlaceholder="按 UID 查询"
              keywordParam="uid"
              extraFilters={<RarityFilter />}
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
          {active === "config" && <ConfigPage />}
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

  useEffect(() => {
    request<DashboardData>("/admin/dashboard")
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return <StateBox type="error">{error}</StateBox>;
  }
  if (!data) {
    return <StateBox>正在加载总览数据...</StateBox>;
  }

  const stats = [
    ["用户", data.counters.userCount, Users],
    ["卡片", data.counters.cardCount, Sparkles],
    ["卡池", data.counters.poolCount, Layers],
    ["总抽数", data.counters.totalDraws, Activity],
  ];
  const maxRarity = Math.max(...Object.values(data.rarityTotals), 1);

  return (
    <div className="page-stack">
      <div className="stat-grid">
        {stats.map(([label, value, Icon]) => (
          <article className="stat-card" key={String(label)}>
            <div className="stat-icon">
              <Icon size={20} />
            </div>
            <div>
              <span>{label as string}</span>
              <strong>{String(value)}</strong>
            </div>
          </article>
        ))}
      </div>

      <div className="dashboard-grid">
        <Panel title="稀有度分布" icon={<Sparkles size={18} />}>
          <div className="rarity-bars">
            {Object.entries(data.rarityTotals).map(([rarity, value]) => (
              <div className="rarity-row" key={rarity}>
                <span>{rarity}</span>
                <div>
                  <i
                    style={{
                      width: `${Math.max(4, (value / maxRarity) * 100)}%`,
                    }}
                  />
                </div>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="最近抽卡" icon={<History size={18} />}>
          <div className="activity-list">
            {data.recentHistories.map((history, index) => (
              <div key={String(history.id || index)}>
                <span>UID {String(history.uid || "-")}</span>
                <strong>{String(history.count || 0)} 抽</strong>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="当前管理员" icon={<Shield size={18} />}>
        <pre className="code-block">{JSON.stringify(admin, null, 2)}</pre>
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
  searchPlaceholder,
  keywordParam = "keyword",
  extraFilters,
}: {
  title: string;
  endpoint: string;
  fields: FieldConfig[];
  editable?: boolean;
  creatable?: boolean;
  deletable?: boolean;
  searchPlaceholder?: string;
  keywordParam?: string;
  extraFilters?: ReactNode;
}) {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [keyword, setKeyword] = useState("");
  const [rarity, setRarity] = useState("");
  const [data, setData] = useState<PageResult<Record<string, any>> | null>(
    null,
  );
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Record<string, any> | null>(null);
  const [creating, setCreating] = useState(false);

  const filters = useMemo(
    () => ({
      page,
      pageSize,
      [keywordParam]: keyword,
      rarity,
    }),
    [page, pageSize, keyword, keywordParam, rarity],
  );

  function load() {
    setError("");
    request<PageResult<Record<string, any>>>(`${endpoint}${toQuery(filters)}`)
      .then(setData)
      .catch((err) => setError(err.message));
  }

  useEffect(load, [endpoint, filters]);

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

  const rows = data?.list || [];
  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 1;

  return (
    <Panel
      title={title}
      icon={<Database size={18} />}
      action={
        creatable ? (
          <button
            className="primary-button compact"
            type="button"
            onClick={() => setCreating(true)}
          >
            新增
          </button>
        ) : null
      }
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
        {extraFilters && (
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
      </div>

      {error && <StateBox type="error">{error}</StateBox>}
      {!data && !error && <StateBox>正在加载数据...</StateBox>}
      {data && rows.length === 0 && <StateBox>暂无数据</StateBox>}

      {rows.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {fields.map((field) => (
                  <th key={field.key}>{field.label}</th>
                ))}
                {(editable || deletable) && <th>操作</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={String(row.id)}>
                  {fields.map((field) => (
                    <td key={field.key} data-label={field.label}>
                      {formatValue(getValue(row, field.key))}
                    </td>
                  ))}
                  {(editable || deletable) && (
                    <td data-label="操作">
                      <div className="row-actions">
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
                            onClick={() => deleteItem(row)}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
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
        result[field.key] = getValue(initial, field.key) ?? "";
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
      await onSubmit(values);
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
          {fields.map((field) => (
            <label key={field.key}>
              {field.label}
              {field.type === "textarea" ? (
                <textarea
                  value={values[field.key] ?? ""}
                  onChange={(event) =>
                    setValues({ ...values, [field.key]: event.target.value })
                  }
                />
              ) : field.type === "boolean" ? (
                <select
                  value={String(values[field.key] === true)}
                  onChange={(event) =>
                    setValues({
                      ...values,
                      [field.key]: event.target.value === "true",
                    })
                  }
                >
                  <option value="false">否</option>
                  <option value="true">是</option>
                </select>
              ) : (
                <input
                  type={field.type === "number" ? "number" : "text"}
                  value={values[field.key] ?? ""}
                  onChange={(event) =>
                    setValues({
                      ...values,
                      [field.key]:
                        field.type === "number"
                          ? Number(event.target.value)
                          : event.target.value,
                    })
                  }
                />
              )}
            </label>
          ))}
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

function ConfigPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    request<Record<string, unknown>>("/admin/config/gacha")
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <Panel title="系统配置" icon={<Settings size={18} />}>
      {error && <StateBox type="error">{error}</StateBox>}
      {!data && !error && <StateBox>正在加载配置...</StateBox>}
      {data && (
        <pre className="code-block">{JSON.stringify(data, null, 2)}</pre>
      )}
    </Panel>
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

function RarityFilter() {
  return null;
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
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  if (typeof value === "string" && value.includes("T") && value.endsWith("Z")) {
    return new Date(value).toLocaleString();
  }
  return String(value);
}
