<script setup lang="ts">
import {
  Boxes,
  ChevronLeft,
  ChevronRight,
  Coins,
  Gift,
  History,
  LoaderCircle,
  LogIn,
  LogOut,
  Package,
  RefreshCw,
  Share2,
  ShieldCheck,
  Sparkles,
  Store,
  Ticket,
  Trophy,
  UserRound,
  WandSparkles,
} from "@lucide/vue";
import { computed, onMounted, reactive, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import {
  clearToken,
  getStoredUser,
  getToken,
  request,
  setStoredUser,
  setToken,
  toQuery,
} from "./api";
import type {
  CardItem,
  CardRarity,
  AchievementListResponse,
  AchievementNotification,
  AchievementRecord,
  BulkDecomposeResponse,
  ExchangeClaimResponse,
  ExchangeShopItem,
  GachaResult,
  InventoryItem,
  LaunchActivityClaimResponse,
  LaunchActivityCurrentResponse,
  LeaderboardEntry,
  LeaderboardMetric,
  LeaderboardResponse,
  PointLedgerRecord,
  PointLedgerRecordsResponse,
  PointLedgerSourceType,
  SiteConfig,
  LoginResponse,
  LoginUrlResponse,
  PoolInfo,
  RechargeConfig,
  RechargePointsResponse,
  RedeemClaimResponse,
  TradeConfig,
  TradeListing,
  TradePageResponse,
  TradeRecord,
  UserCardsResponse,
  UserGachaStats,
  UserProfile,
} from "./types";

const rarityOrder: CardRarity[] = ["N", "R", "SR", "SSR", "UR"];
const rarityRank: Record<string, number> = {
  N: 1,
  R: 2,
  SR: 3,
  SSR: 4,
  UR: 5,
};

const sectionItems = [
  { key: "draw", label: "抽卡", icon: Sparkles },
  { key: "bag", label: "背包", icon: Boxes },
  { key: "synthesize", label: "合成", icon: WandSparkles },
  { key: "points", label: "星穹币", icon: Coins },
  { key: "leaderboard", label: "排行", icon: Trophy },
  { key: "achievements", label: "成就", icon: ShieldCheck },
  { key: "trade", label: "交易", icon: Store },
  { key: "redeem", label: "兑换", icon: Gift },
] as const;

const leaderboardTabs: Array<{
  key: LeaderboardMetric;
  label: string;
  hint: string;
  unit: string;
}> = [
  {
    key: "totalCards",
    label: "卡片总数",
    hint: "当前收藏卡片数量",
    unit: "张",
  },
  { key: "ssrCards", label: "SSR 数量", hint: "当前 SSR 收藏", unit: "张" },
  { key: "urCards", label: "UR 数量", hint: "当前 UR 收藏", unit: "张" },
  {
    key: "completedPools",
    label: "集齐卡池",
    hint: "按稀有度版本完整集齐",
    unit: "个",
  },
];

type SectionKey = (typeof sectionItems)[number]["key"];
type FeedbackType = "success" | "error" | "info";
type DrawPhase = "idle" | "charging" | "burst";
type SynthesisCard = {
  card: CardItem;
  rarity: CardRarity;
  key: string;
  costLabel: string;
  disabled: boolean;
};
type PoolCatalogCard = {
  card: CardItem;
  rarities: CardRarity[];
};
type CardIntroTarget = {
  name: string;
  desc?: string | null;
  rarity?: string;
  type?: string;
  extra?: string;
};
const DRAW_RESULTS_KEY = "kesini_website_last_results";
const BAG_PAGE_SIZE = 24;
const CARD_DESC_DETAIL_THRESHOLD = 34;

const route = useRoute();
const manualToken = ref("");
const token = ref(getToken());
const currentUser = ref<UserProfile | null>(getStoredUser<UserProfile>());
const siteConfig = ref<SiteConfig>({
  websiteTitle: "Kesini 抽卡站",
  adminTitle: "Kesini 后台管理",
});
const pools = ref<PoolInfo[]>([]);
const activePoolId = ref<number | null>(null);
const poolCards = ref<CardItem[]>([]);
const poolDetailOpen = ref(false);
const poolDetailLoading = ref(false);
const poolDetailError = ref("");
const poolDetailPool = ref<PoolInfo | null>(null);
const poolDetailCards = ref<CardItem[]>([]);
const stats = ref<UserGachaStats | null>(null);
const userCards = ref<UserCardsResponse | null>(null);
const rechargeConfig = ref<RechargeConfig | null>(null);
const launchActivity = ref<LaunchActivityCurrentResponse | null>(null);
const launchActivityModalOpen = ref(false);
const launchActivityDismissedKey = ref("");
const leaderboard = ref<LeaderboardResponse | null>(null);
const leaderboardError = ref("");
const activeLeaderboardMetric = ref<LeaderboardMetric>("totalCards");
const pointRecords = ref<PointLedgerRecordsResponse | null>(null);
const achievements = ref<AchievementRecord[]>([]);
const achievementStatusFilter = ref<"all" | "achieved" | "progressing">("all");
const achievementCategoryFilter = ref("");
const achievementKeyword = ref("");
const pointRecordPage = ref(1);
const pointRecordTypeFilter = ref<"all" | "income" | "expense">("all");
const pointRecordSourceFilter = ref<PointLedgerSourceType | "">("");
const pointRecordTotalPages = ref(1);
const exchangeItems = ref<ExchangeShopItem[]>([]);
const tradeListings = ref<TradeListing[]>([]);
const myTradeListings = ref<TradeListing[]>([]);
const tradeRecords = ref<TradeRecord[]>([]);
const tradeConfig = ref<TradeConfig>({
  enabled: true,
  feeRate: 0,
  minPrice: 1,
  maxPrice: 999999,
});
const lastResults = ref<GachaResult[]>(getStoredDrawResults());
const rarityFilter = ref("");
const poolFilter = ref<number | "">("");
const synthesisRarityFilter = ref<CardRarity | "">("");
const bulkDecomposeRarities = reactive<Record<CardRarity, boolean>>({
  N: true,
  R: true,
  SR: false,
  SSR: false,
  UR: false,
});
const bulkDecomposePreview = ref<BulkDecomposeResponse | null>(null);
const cardPage = ref(1);
const tradePage = ref(1);
const myTradePage = ref(1);
const tradeRecordPage = ref(1);
const tradeTab = ref<"market" | "mine" | "records">("market");
const tradeRarityFilter = ref<CardRarity | "">("");
const tradePoolFilter = ref<number | "">("");
const tradeSort = ref("newest");
const tradeMinPrice = ref("");
const tradeMaxPrice = ref("");
const listingTarget = ref<UserCardsResponse["list"][number] | null>(null);
const cardIntroTarget = ref<CardIntroTarget | null>(null);
const shareTextTarget = ref("");
const listingPrice = ref("");
const redeemCode = ref("");
const rechargeModalOpen = ref(false);
const rechargeAmount = ref(10);
const exchangeCounts = reactive<Record<number, number>>({});
const feedback = ref<{ type: FeedbackType; text: string } | null>(null);
const achievementToasts = ref<AchievementNotification[]>([]);
const achievementToastQueue = ref<AchievementNotification[]>([]);
const callbackBusy = ref(false);
const resultModalOpen = ref(false);
const drawPhase = ref<DrawPhase>("idle");

const busy = reactive({
  public: false,
  auth: false,
  drawing: false,
  assets: false,
  cardsMore: false,
  leaderboard: false,
  points: false,
  shop: false,
  redeem: false,
  achievements: false,
  trade: false,
  recharge: false,
  bulkDecompose: false,
  bulkDecomposePreview: false,
  launchActivity: false,
});

let feedbackTimer: number | undefined;
const achievementToastTimers = new Map<number, number>();

const isAuthed = computed(() => Boolean(token.value));
const activeSection = computed<SectionKey>(() => {
  return sectionItems.some((item) => item.key === route.name)
    ? (route.name as SectionKey)
    : "draw";
});
const playerDisplayName = computed(
  () =>
    currentUser.value?.nickname ||
    currentUser.value?.name ||
    currentUser.value?.uid ||
    "已登录玩家",
);
const playerInitial = computed(() =>
  String(playerDisplayName.value || "?")
    .trim()
    .slice(0, 1)
    .toUpperCase(),
);
const playerUidLabel = computed(() =>
  currentUser.value?.uid ? `UID ${currentUser.value.uid}` : "身份已验证",
);
const launchActivityInfo = computed(
  () => launchActivity.value?.activity || null,
);
const hasLaunchActivityReward = computed(
  () =>
    Boolean(isAuthed.value) &&
    launchActivity.value?.available === true &&
    Boolean(launchActivityInfo.value),
);
const selectedPool = computed(() =>
  pools.value.find((pool) => pool.id === activePoolId.value),
);
const selectedDrawCosts = computed(
  () => selectedPool.value?.drawCosts || { once: 10, ten: 100 },
);
const poolDetailProbabilityRows = computed(() => {
  const probabilities =
    poolDetailPool.value?.rarityProbabilities ||
    selectedPool.value?.rarityProbabilities ||
    {};
  return rarityOrder.map((rarity) => {
    const value = Number(probabilities[rarity] || 0);
    return {
      rarity,
      value,
      percent: Math.max(0, Math.min(100, value * 100)),
    };
  });
});
const poolDetailCatalogCards = computed<PoolCatalogCard[]>(() =>
  poolDetailCards.value.map((card) => ({
    card,
    rarities: parseCardRarities(card.card_level),
  })),
);
const rechargeRangeLabel = computed(() => {
  const config = rechargeConfig.value;
  if (!config) {
    return "充值配置同步中";
  }
  return `${config.minAmount} - ${config.maxAmount} 鱼排积分`;
});
const rechargeRatioLabel = computed(() => {
  const ratio = Number(rechargeConfig.value?.ratio || 1);
  return `1 鱼排积分 = ${ratio} 星穹币`;
});
const rechargeLocalAmount = computed(() => {
  const amount = Number(rechargeAmount.value || 0);
  const ratio = Number(rechargeConfig.value?.ratio || 1);
  if (!Number.isFinite(amount) || !Number.isFinite(ratio)) {
    return 0;
  }
  return Math.max(0, Math.floor(amount * ratio));
});
const inventoryItems = computed<InventoryItem[]>(
  () => userCards.value?.dropItems || [],
);
const synthesisCards = computed<SynthesisCard[]>(() =>
  poolCards.value.flatMap((card) =>
    parseCardRarities(card.card_level).map((rarity) => ({
      card,
      rarity,
      key: `${card.id}-${rarity}`,
      costLabel: synthesisCostLabel(rarity),
      disabled: rarity === "UR",
    })),
  ),
);
const filteredSynthesisCards = computed<SynthesisCard[]>(() => {
  if (!synthesisRarityFilter.value) {
    return synthesisCards.value;
  }
  return synthesisCards.value.filter(
    (item) => item.rarity === synthesisRarityFilter.value,
  );
});
const synthesisAvailableCount = computed(
  () => filteredSynthesisCards.value.filter((item) => !item.disabled).length,
);
const activeLeaderboardTab = computed(
  () =>
    leaderboardTabs.find(
      (item) => item.key === activeLeaderboardMetric.value,
    ) || leaderboardTabs[0],
);
const activeLeaderboardBoard = computed(
  () => leaderboard.value?.rankings[activeLeaderboardMetric.value] || null,
);
const podiumEntries = computed<LeaderboardEntry[]>(
  () => activeLeaderboardBoard.value?.list.slice(0, 3) || [],
);
const leaderboardRows = computed<LeaderboardEntry[]>(
  () => activeLeaderboardBoard.value?.list.slice(3) || [],
);
const pointLedgerRows = computed<PointLedgerRecord[]>(
  () => pointRecords.value?.list || [],
);
const achievementCategories = computed(() =>
  Array.from(
    new Set(achievements.value.map((achievement) => achievement.category || "常规")),
  ),
);
const filteredAchievements = computed(() => {
  const keyword = achievementKeyword.value.trim().toLowerCase();
  return achievements.value.filter((achievement) => {
    if (
      achievementStatusFilter.value === "achieved" &&
      !achievement.achieved
    ) {
      return false;
    }
    if (
      achievementStatusFilter.value === "progressing" &&
      achievement.achieved
    ) {
      return false;
    }
    if (
      achievementCategoryFilter.value &&
      (achievement.category || "常规") !== achievementCategoryFilter.value
    ) {
      return false;
    }
    if (!keyword) {
      return true;
    }
    return [
      achievement.name,
      achievement.description,
      achievement.category,
      achievement.targetLabel,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(keyword));
  });
});
const achievementGroups = computed(() => {
  const groups = new Map<string, AchievementRecord[]>();
  filteredAchievements.value.forEach((achievement) => {
    const category = achievement.category || "常规";
    if (!groups.has(category)) {
      groups.set(category, []);
    }
    groups.get(category)!.push(achievement);
  });
  return Array.from(groups.entries()).map(([category, list]) => ({
    category,
    list: [...list].sort(
      (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.id - b.id,
    ),
  }));
});
const achievementVisibleCount = computed(() => filteredAchievements.value.length);
const achievementUnlockedCount = computed(
  () => achievements.value.filter((achievement) => achievement.achieved).length,
);
const achievementProgressingCount = computed(
  () => achievements.value.length - achievementUnlockedCount.value,
);
const achievementCompletionPercent = computed(() => {
  if (achievements.value.length === 0) {
    return 0;
  }
  return Math.round(
    (achievementUnlockedCount.value / achievements.value.length) * 100,
  );
});
const pointIncomeTotal = computed(() =>
  pointLedgerRows.value
    .filter((record) => record.changeAmount > 0)
    .reduce((sum, record) => sum + record.changeAmount, 0),
);
const pointExpenseTotal = computed(() =>
  pointLedgerRows.value
    .filter((record) => record.changeAmount < 0)
    .reduce((sum, record) => sum + Math.abs(record.changeAmount), 0),
);
const pointNetTotal = computed(() =>
  pointLedgerRows.value.reduce((sum, record) => sum + record.changeAmount, 0),
);
const pointSourceOptions = [
  { value: "", label: "全部来源" },
  { value: "draw_once", label: "单抽消耗" },
  { value: "draw_ten", label: "十连消耗" },
  { value: "recharge", label: "星穹币充值" },
  { value: "redeem_code", label: "兑换码奖励" },
  { value: "launch_activity", label: "开服福利" },
  { value: "exchange_shop", label: "兑换商店" },
  { value: "achievement", label: "成就奖励" },
  { value: "trade_buy", label: "交易购买" },
  { value: "trade_sell", label: "交易出售" },
] as const;
const totalPages = computed(() => userCards.value?.totalPages || 1);
const bagHasMore = computed(
  () => Boolean(userCards.value) && cardPage.value < totalPages.value,
);
const bagLoadedCount = computed(() => userCards.value?.list.length || 0);
const bulkDecomposeSelectedRarities = computed(() =>
  rarityOrder.filter(
    (rarity) => rarity !== "UR" && bulkDecomposeRarities[rarity],
  ),
);
const bulkDecomposeSelectedLabel = computed(() =>
  bulkDecomposeSelectedRarities.value.length > 0
    ? bulkDecomposeSelectedRarities.value.join(" / ")
    : "未选择",
);
const bulkDecomposePreviewTotal = computed(
  () => bulkDecomposePreview.value?.total || 0,
);
const bulkDecomposeReservedCount = computed(
  () => bulkDecomposePreview.value?.reservedCount || 0,
);
const tradeTotalPages = ref(1);
const myTradeTotalPages = ref(1);
const tradeRecordTotalPages = ref(1);
const listingFeePreview = computed(() => {
  const price = Math.max(0, Number(listingPrice.value || 0));
  const feeAmount = Math.floor(price * Number(tradeConfig.value.feeRate || 0));
  return {
    feeAmount,
    sellerIncome: Math.max(0, price - feeAmount),
  };
});
const bestResult = computed(() => {
  return [...lastResults.value].sort(
    (a, b) => (rarityRank[b.rarity] || 0) - (rarityRank[a.rarity] || 0),
  )[0];
});
const resultSummary = computed(() => {
  const counts = rarityOrder.reduce(
    (result, rarity) => ({ ...result, [rarity]: 0 }),
    {} as Record<CardRarity, number>,
  );
  lastResults.value.forEach((item) => {
    const rarity = normalizeRarity(item.rarity);
    counts[rarity] += 1;
  });
  return counts;
});
const drawPhaseText = computed(() => {
  if (drawPhase.value === "charging") {
    return "星轨正在充能，信号汇聚中";
  }
  if (drawPhase.value === "burst") {
    return "星门已开启，结果解析中";
  }
  return bestResult.value
    ? `${bestResult.value.rarity} 级信号已锁定`
    : "选择卡池并登录后开始抽取";
});
const resultModalTitle = computed(() =>
  lastResults.value.length > 1 ? "十连回响" : "星轨回应",
);
const resultModalSubtitle = computed(() => {
  if (lastResults.value.length === 0) {
    return "暂无抽卡结果";
  }
  const best = bestResult.value;
  return best
    ? `${lastResults.value.length} 次抽取完成，最高稀有度 ${best.rarity}`
    : `${lastResults.value.length} 次抽取完成`;
});

onMounted(async () => {
  await handleOpenIdCallback();
  await loadSiteConfig();
  await loadPublicData();
  if (isAuthed.value) {
    await loadPrivateData();
  }
});

watch(activePoolId, async (poolId) => {
  if (poolId && (!poolFilter.value || activeSection.value === "bag")) {
    poolFilter.value = poolId;
    cardPage.value = 1;
    if (isAuthed.value && activeSection.value === "bag") {
      userCards.value = null;
      await loadUserCards();
    }
  }
  await loadPoolCards();
});

function notify(type: FeedbackType, text: string) {
  feedback.value = { type, text };
  window.clearTimeout(feedbackTimer);
  feedbackTimer = window.setTimeout(() => {
    feedback.value = null;
  }, 4200);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "操作失败";
}

function getStoredDrawResults(): GachaResult[] {
  const raw = localStorage.getItem(DRAW_RESULTS_KEY);
  if (!raw) {
    return [];
  }
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch {
    localStorage.removeItem(DRAW_RESULTS_KEY);
    return [];
  }
}

function setStoredDrawResults(results: GachaResult[]) {
  localStorage.setItem(DRAW_RESULTS_KEY, JSON.stringify(results));
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function createRechargeRequestId() {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `website-${random}`;
}

async function handleOpenIdCallback() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("openid.mode")) {
    return;
  }

  const callbackKey = `kesini_website_openid:${params.get("openid.response_nonce") || params.get("openid.sig") || window.location.search}`;
  if (sessionStorage.getItem(callbackKey)) {
    return;
  }

  sessionStorage.setItem(callbackKey, "1");
  callbackBusy.value = true;
  try {
    const payload = Object.fromEntries(params.entries());
    const data = await request<LoginResponse>("/apis/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setToken(data.token);
    setStoredUser(data.user);
    token.value = data.token;
    currentUser.value = data.user;
    notify("success", "登录成功，欢迎回来");
    window.history.replaceState({}, document.title, window.location.pathname);
  } catch (error) {
    sessionStorage.removeItem(callbackKey);
    notify("error", getErrorMessage(error));
  } finally {
    callbackBusy.value = false;
  }
}

async function loginWithOpenId() {
  busy.auth = true;
  try {
    const oauthOrigin = window.location.origin;
    const returnToUrl = new URL(window.location.pathname, oauthOrigin);
    const data = await request<LoginUrlResponse>(
      `/apis/login-url${toQuery({
        returnTo: returnToUrl.toString(),
        realm: oauthOrigin,
      })}`,
    );
    window.location.href = data.url;
  } catch (error) {
    notify("error", getErrorMessage(error));
  } finally {
    busy.auth = false;
  }
}

async function applyManualToken() {
  const value = manualToken.value.trim();
  if (!value) {
    notify("error", "请输入用于调试的 JWT Token");
    return;
  }
  setToken(value);
  token.value = value;
  currentUser.value = null;
  notify("info", "Token 已写入，正在加载玩家资产");
  await loadPrivateData();
}

function logout() {
  clearToken();
  token.value = "";
  currentUser.value = null;
  stats.value = null;
  userCards.value = null;
  launchActivity.value = null;
  launchActivityModalOpen.value = false;
  launchActivityDismissedKey.value = "";
  leaderboard.value = null;
  leaderboardError.value = "";
  pointRecords.value = null;
  achievements.value = [];
  achievementToasts.value = [];
  achievementToastQueue.value = [];
  achievementToastTimers.forEach((timer) => window.clearTimeout(timer));
  achievementToastTimers.clear();
  pointRecordPage.value = 1;
  exchangeItems.value = [];
  tradeListings.value = [];
  myTradeListings.value = [];
  tradeRecords.value = [];
  lastResults.value = [];
  resultModalOpen.value = false;
  localStorage.removeItem(DRAW_RESULTS_KEY);
  notify("info", "已退出登录");
}

async function loadPublicData() {
  busy.public = true;
  try {
    const [list, recharge] = await Promise.all([
      request<PoolInfo[]>("/card/pools"),
      request<RechargeConfig>("/recharge/config").catch(() => null),
    ]);
    pools.value = list || [];
    rechargeConfig.value = recharge;
    if (!activePoolId.value && pools.value.length > 0) {
      activePoolId.value = pools.value[0].id;
    }
    ensureBagPoolFilter();
    await loadPoolCards();
  } catch (error) {
    notify("error", getErrorMessage(error));
  } finally {
    busy.public = false;
  }
}

async function loadSiteConfig() {
  try {
    const data = await request<SiteConfig>("/apis/site-config");
    siteConfig.value = {
      websiteTitle: data.websiteTitle || "Kesini 抽卡站",
      adminTitle: data.adminTitle || "Kesini 后台管理",
    };
  } catch {
    siteConfig.value = {
      websiteTitle: "Kesini 抽卡站",
      adminTitle: "Kesini 后台管理",
    };
  }
  document.title = siteConfig.value.websiteTitle;
}

async function loadPoolCards() {
  if (!activePoolId.value) {
    poolCards.value = [];
    return;
  }
  try {
    poolCards.value = await request<CardItem[]>(
      `/card/pool/${activePoolId.value}/cards`,
    );
  } catch {
    poolCards.value = [];
  }
}

async function openPoolDetail() {
  const poolId = activePoolId.value;
  if (!poolId) {
    notify("error", "请先选择一个卡池");
    return;
  }
  poolDetailOpen.value = true;
  poolDetailLoading.value = true;
  poolDetailError.value = "";
  poolDetailPool.value = selectedPool.value || null;
  poolDetailCards.value = poolCards.value;
  try {
    const [pool, cards] = await Promise.all([
      request<PoolInfo>(`/card/pool/${poolId}`),
      request<CardItem[]>(`/card/pool/${poolId}/cards`),
    ]);
    poolDetailPool.value = pool;
    poolDetailCards.value = cards || [];
  } catch (error) {
    poolDetailError.value = getErrorMessage(error);
  } finally {
    poolDetailLoading.value = false;
  }
}

function closePoolDetail() {
  poolDetailOpen.value = false;
}

async function loadPrivateData() {
  if (!isAuthed.value) {
    return;
  }
  const results = await Promise.allSettled([
    loadStats(),
    loadUserCards(),
    loadLaunchActivity(),
    loadLeaderboard(),
    loadAchievements(),
    loadAchievementNotifications(),
    loadPointRecords(),
    loadExchangeItems(),
    loadTradeData(),
  ]);
  const failed = results.filter((item) => item.status === "rejected");
  if (failed.length === results.length) {
    notify("error", "登录状态不可用，请重新登录");
    logout();
  }
}

async function loadStats() {
  stats.value = await request<UserGachaStats>("/card/stats");
}

function ensureBagPoolFilter() {
  const poolId = activePoolId.value || pools.value[0]?.id || null;
  if (!poolFilter.value && poolId) {
    poolFilter.value = poolId;
  }
  if (
    poolFilter.value &&
    !pools.value.some((pool) => pool.id === Number(poolFilter.value))
  ) {
    poolFilter.value = poolId || "";
  }
}

async function loadUserCards(options: { append?: boolean } = {}) {
  if (!isAuthed.value) {
    return;
  }
  ensureBagPoolFilter();
  const append = options.append === true;
  if (append && (busy.assets || busy.cardsMore || !bagHasMore.value)) {
    return;
  }
  if (!poolFilter.value) {
    userCards.value = {
      list: [],
      dropItems: [],
      total: 0,
      page: 1,
      pageSize: BAG_PAGE_SIZE,
      totalPages: 0,
    };
    cardPage.value = 1;
    return;
  }
  const requestedRarity = rarityFilter.value;
  const requestedPoolId = poolFilter.value;
  const page = append ? cardPage.value + 1 : 1;
  if (append) {
    busy.cardsMore = true;
  } else {
    busy.assets = true;
  }
  try {
    const data = await request<UserCardsResponse>(
      `/card/user/cards${toQuery({
        rarity: requestedRarity,
        poolId: requestedPoolId,
        grouped: true,
        page,
        pageSize: BAG_PAGE_SIZE,
      })}`,
    );
    if (
      requestedRarity !== rarityFilter.value ||
      requestedPoolId !== poolFilter.value
    ) {
      return;
    }
    if (append && userCards.value) {
      userCards.value = {
        ...data,
        list: [...userCards.value.list, ...data.list],
        dropItems: data.dropItems,
      };
    } else {
      userCards.value = data;
    }
    cardPage.value = data.page || page;
  } finally {
    if (append) {
      busy.cardsMore = false;
    } else {
      busy.assets = false;
    }
  }
}

function resetUserCards() {
  cardPage.value = 1;
  userCards.value = null;
  void loadUserCards();
}

function loadMoreUserCards() {
  void loadUserCards({ append: true });
}

async function loadLaunchActivity() {
  if (!isAuthed.value) {
    return;
  }
  try {
    const data = await request<LaunchActivityCurrentResponse>(
      "/launch-activity/current",
    );
    launchActivity.value = data;
    const activityKey = data.activity?.activityKey || "";
    if (
      data.available &&
      activityKey &&
      launchActivityDismissedKey.value !== activityKey
    ) {
      launchActivityModalOpen.value = true;
    }
  } catch {
    launchActivity.value = null;
  }
}

async function loadLeaderboard() {
  if (!isAuthed.value) {
    return;
  }
  busy.leaderboard = true;
  leaderboardError.value = "";
  try {
    leaderboard.value = await request<LeaderboardResponse>(
      "/card/leaderboard?limit=50",
    );
  } catch (error) {
    leaderboardError.value = getErrorMessage(error);
    throw error;
  } finally {
    busy.leaderboard = false;
  }
}

async function loadAchievements() {
  if (!isAuthed.value) {
    return;
  }
  busy.achievements = true;
  try {
    const data = await request<AchievementListResponse>("/achievement/list");
    achievements.value = data.list || [];
  } catch (error) {
    if (activeSection.value === "achievements") {
      notify("error", getErrorMessage(error));
    }
  } finally {
    busy.achievements = false;
  }
}

async function loadAchievementNotifications() {
  if (!isAuthed.value) {
    return;
  }
  try {
    const notices = await request<AchievementNotification[]>(
      "/achievement/notifications/unread",
    );
    if (!notices.length) {
      return;
    }
    enqueueAchievementNotifications(notices);
    await request("/achievement/notifications/ack", {
      method: "POST",
      body: JSON.stringify({
        achievementIds: notices.map((notice) => notice.achievementId),
      }),
    });
  } catch {
    // 成就通知不影响主流程。
  }
}

function enqueueAchievementNotifications(notices: AchievementNotification[]) {
  notices.forEach((notice) => {
    const exists =
      achievementToasts.value.some(
        (item) => item.achievementId === notice.achievementId,
      ) ||
      achievementToastQueue.value.some(
        (item) => item.achievementId === notice.achievementId,
      );
    if (!exists) {
      achievementToastQueue.value.push(notice);
    }
  });
  flushAchievementToastQueue();
}

function flushAchievementToastQueue() {
  while (
    achievementToasts.value.length < 3 &&
    achievementToastQueue.value.length > 0
  ) {
    const notice = achievementToastQueue.value.shift()!;
    achievementToasts.value.push(notice);
    const timer = window.setTimeout(() => {
      dismissAchievementToast(notice.achievementId);
    }, 6000);
    achievementToastTimers.set(notice.achievementId, timer);
  }
}

function dismissAchievementToast(achievementId: number) {
  const timer = achievementToastTimers.get(achievementId);
  if (timer) {
    window.clearTimeout(timer);
    achievementToastTimers.delete(achievementId);
  }
  achievementToasts.value = achievementToasts.value.filter(
    (notice) => notice.achievementId !== achievementId,
  );
  flushAchievementToastQueue();
}

async function loadPointRecords() {
  if (!isAuthed.value) {
    return;
  }
  busy.points = true;
  try {
    const data = await request<PointLedgerRecordsResponse>(
      `/points/records${toQuery({
        page: pointRecordPage.value,
        pageSize: 20,
        type:
          pointRecordTypeFilter.value === "all"
            ? ""
            : pointRecordTypeFilter.value,
        sourceType: pointRecordSourceFilter.value,
      })}`,
    );
    pointRecords.value = data;
    pointRecordTotalPages.value = data.totalPages || 1;
    if (stats.value && typeof data.currentPoint === "number") {
      stats.value.point = data.currentPoint;
    }
  } catch (error) {
    if (activeSection.value === "points") {
      notify("error", getErrorMessage(error));
    }
  } finally {
    busy.points = false;
  }
}

async function loadExchangeItems() {
  if (!isAuthed.value) {
    return;
  }
  busy.shop = true;
  try {
    exchangeItems.value = await request<ExchangeShopItem[]>("/exchange/items");
  } finally {
    busy.shop = false;
  }
}

async function loadTradeData() {
  if (!isAuthed.value) {
    return;
  }
  await Promise.all([
    loadTradeListings(),
    loadMyTradeListings(),
    loadTradeRecords(),
  ]);
}

async function loadTradeListings() {
  if (!isAuthed.value) {
    return;
  }
  busy.trade = true;
  try {
    const data = await request<TradePageResponse<TradeListing>>(
      `/trade/listings${toQuery({
        page: tradePage.value,
        pageSize: 12,
        rarity: tradeRarityFilter.value,
        poolId: tradePoolFilter.value,
        sort: tradeSort.value,
        minPrice: tradeMinPrice.value,
        maxPrice: tradeMaxPrice.value,
      })}`,
    );
    tradeListings.value = data.list || [];
    tradeTotalPages.value = data.totalPages || 1;
    if (data.config) {
      tradeConfig.value = data.config;
    }
  } finally {
    busy.trade = false;
  }
}

async function loadMyTradeListings() {
  if (!isAuthed.value) {
    return;
  }
  const data = await request<TradePageResponse<TradeListing>>(
    `/trade/my-listings${toQuery({
      page: myTradePage.value,
      pageSize: 8,
    })}`,
  );
  myTradeListings.value = data.list || [];
  myTradeTotalPages.value = data.totalPages || 1;
}

async function loadTradeRecords() {
  if (!isAuthed.value) {
    return;
  }
  const data = await request<TradePageResponse<TradeRecord>>(
    `/trade/my-records${toQuery({
      page: tradeRecordPage.value,
      pageSize: 8,
    })}`,
  );
  tradeRecords.value = data.list || [];
  tradeRecordTotalPages.value = data.totalPages || 1;
}

async function refreshAll() {
  await loadPublicData();
  if (isAuthed.value) {
    await loadPrivateData();
  }
  notify("success", "页面数据已刷新");
}

function changePointPage(delta: number) {
  const next = Math.min(
    Math.max(1, pointRecordPage.value + delta),
    pointRecordTotalPages.value,
  );
  if (next === pointRecordPage.value) {
    return;
  }
  pointRecordPage.value = next;
  void loadPointRecords();
}

function openRechargeModal() {
  if (!isAuthed.value) {
    notify("error", "请先登录后再充值");
    return;
  }
  if (!rechargeConfig.value?.enabled) {
    notify("error", "充值功能暂未开启");
    return;
  }
  if (!rechargeConfig.value.hasGoldFingerKey) {
    notify("error", "后台尚未配置充值密钥");
    return;
  }
  if (!rechargeConfig.value.hasFishpiApiKey) {
    notify("error", "后台尚未配置鱼排查询密钥");
    return;
  }
  rechargeAmount.value = Math.max(
    rechargeConfig.value.minAmount || 1,
    Math.min(
      rechargeConfig.value.maxAmount || 9999,
      rechargeAmount.value || 10,
    ),
  );
  rechargeModalOpen.value = true;
}

function closeRechargeModal() {
  if (!busy.recharge) {
    rechargeModalOpen.value = false;
  }
}

function openLaunchActivityModal() {
  if (!isAuthed.value) {
    notify("error", "请先登录后再领取开服福利");
    return;
  }
  if (!hasLaunchActivityReward.value) {
    notify("info", launchActivity.value?.reason || "当前暂无可领取的开服福利");
    return;
  }
  launchActivityModalOpen.value = true;
}

function closeLaunchActivityModal() {
  if (busy.launchActivity) {
    return;
  }
  const activityKey = launchActivityInfo.value?.activityKey || "";
  if (activityKey) {
    launchActivityDismissedKey.value = activityKey;
  }
  launchActivityModalOpen.value = false;
}

async function claimLaunchActivity() {
  if (!isAuthed.value) {
    notify("error", "请先登录后再领取开服福利");
    return;
  }
  busy.launchActivity = true;
  try {
    const data = await request<LaunchActivityClaimResponse>(
      "/launch-activity/claim",
      { method: "POST" },
    );
    notify("success", `领取成功：${formatRewards(data.rewards)}`);
    launchActivityModalOpen.value = false;
    launchActivityDismissedKey.value = data.activityKey;
    await loadPrivateData();
  } catch (error) {
    notify("error", getErrorMessage(error));
  } finally {
    busy.launchActivity = false;
  }
}

async function submitRecharge() {
  if (!isAuthed.value) {
    notify("error", "请先登录后再充值");
    return;
  }
  const config = rechargeConfig.value;
  const amount = Number(rechargeAmount.value);
  if (!config) {
    notify("error", "充值配置还未加载完成");
    return;
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    notify("error", "扣除鱼排积分数量必须为正整数");
    return;
  }
  if (amount < config.minAmount || amount > config.maxAmount) {
    notify(
      "error",
      `扣除鱼排积分需在 ${config.minAmount}-${config.maxAmount} 之间`,
    );
    return;
  }

  busy.recharge = true;
  try {
    const data = await request<RechargePointsResponse>("/recharge/points", {
      method: "POST",
      body: JSON.stringify({
        amount,
        requestId: createRechargeRequestId(),
      }),
    });
    notify(
      "success",
      `充值成功：扣除鱼排积分 ${data.fishpiCost}，星穹币 ${data.pointBefore} → ${data.pointAfter}`,
    );
    rechargeModalOpen.value = false;
    await loadPrivateData();
  } catch (error) {
    notify("error", getErrorMessage(error));
  } finally {
    busy.recharge = false;
  }
}

async function performDraw(mode: "once" | "ten") {
  if (!isAuthed.value) {
    notify("error", "请先登录后再抽卡");
    return;
  }

  const endpoint = mode === "once" ? "/card/draw/once" : "/card/draw/ten";
  const body = {
    poolId: activePoolId.value || undefined,
  };

  resultModalOpen.value = false;
  busy.drawing = true;
  drawPhase.value = "charging";
  try {
    const data = await request<GachaResult | GachaResult[]>(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
    });
    lastResults.value = Array.isArray(data) ? data : [data];
    setStoredDrawResults(lastResults.value);
    drawPhase.value = "burst";
    await delay(360);
    resultModalOpen.value = true;
    notify("success", `${lastResults.value.length} 次抽取完成`);
    await loadPrivateData();
  } catch (error) {
    resultModalOpen.value = false;
    notify("error", getErrorMessage(error));
  } finally {
    busy.drawing = false;
    drawPhase.value = "idle";
  }
}

function openLastResults() {
  if (lastResults.value.length === 0) {
    notify("info", "暂无可查看的抽卡结果");
    return;
  }
  resultModalOpen.value = true;
}

function closeResultModal() {
  resultModalOpen.value = false;
}

function cardIntroText(desc?: string | null) {
  const text = String(desc || "").trim();
  return text || "暂无介绍";
}

function hasCardIntroDetail(desc?: string | null) {
  return cardIntroText(desc).length > CARD_DESC_DETAIL_THRESHOLD;
}

function openCardIntro(target: CardIntroTarget) {
  cardIntroTarget.value = {
    ...target,
    desc: cardIntroText(target.desc),
  };
}

function closeCardIntro() {
  cardIntroTarget.value = null;
}

function getPoolName(poolId?: number | null) {
  return pools.value.find((pool) => pool.id === Number(poolId))?.pool_name || "";
}

function buildCardShareText(card: {
  cardName: string;
  cardDesc?: string | null;
  cardLevel?: string;
  rarity?: string;
  poolId?: number;
}) {
  const rarity = String(card.cardLevel || card.rarity || "").trim();
  const poolName = getPoolName(card.poolId);
  const lines = [
    `**${rarity ? `[${rarity}] ` : ""}${card.cardName}**`,
    "",
    `> ${cardIntroText(card.cardDesc)}`,
  ];
  if (poolName) {
    lines.push("", `卡池：${poolName}`);
  }
  lines.push("", `[进入抽卡站](${window.location.origin})`);
  return lines.join("\n");
}

async function shareCard(card: {
  cardName: string;
  cardDesc?: string | null;
  cardLevel?: string;
  rarity?: string;
  poolId?: number;
}) {
  const text = buildCardShareText(card);
  try {
    await navigator.clipboard.writeText(text);
    notify("success", "已复制");
  } catch {
    shareTextTarget.value = text;
  }
}

function closeShareText() {
  shareTextTarget.value = "";
}

async function copyShareText() {
  if (!shareTextTarget.value) {
    return;
  }
  try {
    await navigator.clipboard.writeText(shareTextTarget.value);
    notify("success", "已复制");
    closeShareText();
  } catch {
    notify("error", "复制失败");
  }
}

async function synthesizeCard(item: SynthesisCard) {
  if (!isAuthed.value) {
    notify("error", "请先登录后再合成卡片");
    return;
  }
  if (item.disabled) {
    notify("error", "UR 卡片不能通过碎片合成");
    return;
  }
  if (
    !window.confirm(
      `确认消耗${item.costLabel}合成「${item.card.card_name}」${item.rarity} 吗？`,
    )
  ) {
    return;
  }
  busy.assets = true;
  try {
    await request("/card/synthesize", {
      method: "POST",
      body: JSON.stringify({ card_id: item.card.id, rarity: item.rarity }),
    });
    notify("success", `${item.rarity} 合成成功`);
    await loadPrivateData();
  } catch (error) {
    notify("error", getErrorMessage(error));
  } finally {
    busy.assets = false;
  }
}

function toggleBulkDecomposeRarity(rarity: CardRarity) {
  if (rarity === "UR") {
    return;
  }
  bulkDecomposeRarities[rarity] = !bulkDecomposeRarities[rarity];
  void loadBulkDecomposePreview();
}

async function loadBulkDecomposePreview() {
  if (!isAuthed.value || bulkDecomposeSelectedRarities.value.length === 0) {
    bulkDecomposePreview.value = null;
    return null;
  }
  busy.bulkDecomposePreview = true;
  try {
    const data = await request<BulkDecomposeResponse>(
      `/card/decompose/bulk-preview${toQuery({
        rarities: bulkDecomposeSelectedRarities.value.join(","),
      })}`,
    );
    bulkDecomposePreview.value = data;
    return data;
  } catch (error) {
    notify("error", getErrorMessage(error));
    return null;
  } finally {
    busy.bulkDecomposePreview = false;
  }
}

async function bulkDecomposeCards() {
  if (!isAuthed.value) {
    notify("error", "请先登录后再分解卡片");
    return;
  }
  const selectedRarities = [...bulkDecomposeSelectedRarities.value];
  if (selectedRarities.length === 0) {
    notify("error", "请至少选择一个可分解等级");
    return;
  }

  const preview =
    (await loadBulkDecomposePreview()) || bulkDecomposePreview.value;
  if (!preview || preview.total <= 0) {
    notify("info", "当前没有符合条件的可分解卡片");
    return;
  }
  const detail = rarityOrder
    .filter((rarity) => Number(preview.countsByRarity?.[rarity] || 0) > 0)
    .map((rarity) => `${rarity} ${preview.countsByRarity?.[rarity] || 0} 张`)
    .join("、");
  const skippedText =
    preview.skippedListed > 0
      ? `；${preview.skippedListed} 张挂售中卡片会跳过`
      : "";
  const reservedText =
    Number(preview.reservedCount || 0) > 0
      ? `；保留 ${preview.reservedCount} 张`
      : "";
  if (
    !window.confirm(
      `确认分解 ${preview.total} 张卡片（${detail}）${skippedText}${reservedText}？`,
    )
  ) {
    return;
  }

  busy.assets = true;
  busy.bulkDecompose = true;
  try {
    const data = await request<BulkDecomposeResponse>("/card/decompose/bulk", {
      method: "POST",
      body: JSON.stringify({ rarities: selectedRarities }),
    });
    notify(
      "success",
      `一键分解完成：${data.decomposed || 0} 张，获得 ${formatFragmentSummary(
        data.fragments,
      )}`,
    );
    await loadPrivateData();
    await loadBulkDecomposePreview();
  } catch (error) {
    notify("error", getErrorMessage(error));
  } finally {
    busy.assets = false;
    busy.bulkDecompose = false;
  }
}

function openTradeListingModal(card: UserCardsResponse["list"][number]) {
  if (!isAuthed.value) {
    notify("error", "请先登录后再挂售卡片");
    return;
  }
  if (Number(card.sellableCount ?? (card.canSell ? 1 : 0)) <= 0) {
    notify("info", "暂无可售卡片");
    return;
  }
  if (!card.canSell) {
    notify("error", "这张卡片不可交易");
    return;
  }
  listingTarget.value = card;
  listingPrice.value = String(tradeConfig.value.minPrice || 1);
}

function closeTradeListingModal() {
  listingTarget.value = null;
  listingPrice.value = "";
}

async function createTradeListing() {
  if (!listingTarget.value) {
    return;
  }
  if (!listingTarget.value.cardId) {
    notify("error", "卡片无效");
    return;
  }
  const price = Number(listingPrice.value);
  if (!Number.isInteger(price)) {
    notify("error", "交易价格必须为整数");
    return;
  }
  busy.trade = true;
  try {
    await request("/trade/listings/random", {
      method: "POST",
      body: JSON.stringify({
        cardId: listingTarget.value.cardId,
        rarity: listingTarget.value.cardLevel,
        poolId: listingTarget.value.poolId,
        price,
      }),
    });
    notify("success", "挂售成功，卡片已锁定在交易市场");
    closeTradeListingModal();
    await loadPrivateData();
  } catch (error) {
    notify("error", getErrorMessage(error));
  } finally {
    busy.trade = false;
  }
}

async function cancelTradeListing(listing: TradeListing) {
  if (!window.confirm(`确认取消「${listing.cardName}」的挂售吗？`)) {
    return;
  }
  busy.trade = true;
  try {
    await request(`/trade/listings/${listing.id}`, { method: "DELETE" });
    notify("success", "挂单已取消");
    await loadPrivateData();
  } catch (error) {
    notify("error", getErrorMessage(error));
  } finally {
    busy.trade = false;
  }
}

async function buyTradeListing(listing: TradeListing) {
  if (listing.isMine) {
    notify("info", "不能购买自己的挂单");
    return;
  }
  if (
    !window.confirm(
      `确认花费 ${listing.price} 星穹币购买「${listing.cardName}」${listing.cardLevel} 吗？`,
    )
  ) {
    return;
  }
  busy.trade = true;
  try {
    await request(`/trade/listings/${listing.id}/buy`, { method: "POST" });
    notify("success", "购买成功，卡片已进入背包");
    await loadPrivateData();
  } catch (error) {
    notify("error", getErrorMessage(error));
  } finally {
    busy.trade = false;
  }
}

async function claimRedeemCode() {
  const code = redeemCode.value.trim();
  if (!code) {
    notify("error", "请输入兑换码");
    return;
  }
  busy.redeem = true;
  try {
    const data = await request<RedeemClaimResponse>("/redeem/claim", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
    notify("success", `兑换成功：${formatRewards(data.rewards)}`);
    redeemCode.value = "";
    await loadPrivateData();
  } catch (error) {
    notify("error", getErrorMessage(error));
  } finally {
    busy.redeem = false;
  }
}

async function claimExchange(item: ExchangeShopItem) {
  const count = Math.max(1, Math.min(99, Number(exchangeCounts[item.id] || 1)));
  exchangeCounts[item.id] = count;
  busy.shop = true;
  try {
    const data = await request<ExchangeClaimResponse>(
      `/exchange/items/${item.id}/claim`,
      {
        method: "POST",
        body: JSON.stringify({ count }),
      },
    );
    notify("success", `兑换成功：${formatRewards(data.rewards)}`);
    await loadPrivateData();
  } catch (error) {
    notify("error", getErrorMessage(error));
  } finally {
    busy.shop = false;
  }
}

function pointChangeClass(amount: number) {
  return amount >= 0 ? "income" : "expense";
}

function formatPointChange(amount: number) {
  return `${amount > 0 ? "+" : ""}${amount}`;
}

function pointMetadataSummary(record: PointLedgerRecord) {
  const metadata = record.metadata || {};
  const meta = (key: string) => metadata[key];
  switch (record.sourceType) {
    case "draw_once":
    case "draw_ten":
      return `卡池 ${String(meta("poolName") || meta("poolId") || "-")} · ${String(
        meta("count") || 1,
      )} 次`;
    case "recharge":
      return `鱼排用户名 ${String(meta("fishpiUserName") || "-")} · 扣除 ${String(
        meta("fishpiCost") || Math.abs(record.changeAmount),
      )}`;
    case "redeem_code":
      return `兑换码 ${String(meta("code") || "-")}`;
    case "launch_activity":
      return `活动 ${String(meta("activityName") || meta("activityKey") || "-")}`;
    case "exchange_shop":
      return `兑换项 ${String(meta("exchangeItemName") || meta("exchangeItemId") || "-")} · ${String(
        meta("count") || 1,
      )} 次`;
    case "trade_buy":
      return `订单 #${String(meta("listingId") || record.sourceId || "-")} · 购买`;
    case "trade_sell":
      return `订单 #${String(meta("listingId") || record.sourceId || "-")} · 出售`;
    default:
      return record.title;
  }
}

function changeTradePage(kind: "market" | "mine" | "records", delta: number) {
  if (kind === "market") {
    const next = Math.min(
      Math.max(1, tradePage.value + delta),
      tradeTotalPages.value,
    );
    if (next !== tradePage.value) {
      tradePage.value = next;
      void loadTradeListings();
    }
    return;
  }
  if (kind === "mine") {
    const next = Math.min(
      Math.max(1, myTradePage.value + delta),
      myTradeTotalPages.value,
    );
    if (next !== myTradePage.value) {
      myTradePage.value = next;
      void loadMyTradeListings();
    }
    return;
  }
  const next = Math.min(
    Math.max(1, tradeRecordPage.value + delta),
    tradeRecordTotalPages.value,
  );
  if (next !== tradeRecordPage.value) {
    tradeRecordPage.value = next;
    void loadTradeRecords();
  }
}

function normalizeRarity(value?: string): CardRarity {
  return rarityOrder.includes(value as CardRarity)
    ? (value as CardRarity)
    : "N";
}

function rarityClass(value?: string) {
  return `rarity-${normalizeRarity(value).toLowerCase()}`;
}

function parseCardRarities(levels?: string): CardRarity[] {
  return String(levels || "N")
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is CardRarity =>
      rarityOrder.includes(item as CardRarity),
    );
}

function synthesisCostLabel(rarity?: string) {
  const normalized = normalizeRarity(rarity);
  const costs: Record<string, number> = {
    N: 80,
    R: 160,
    SR: 320,
    SSR: 1000,
  };
  return normalized === "UR" ? "UR 不可合成" : `${costs[normalized]} 碎片`;
}

function poolTypeLabel(type?: number) {
  return ["常驻", "活动", "限定"][Number(type || 0)] || "卡池";
}

function cardTypeLabel(type?: number) {
  return ["普通", "限定", "纪念", "活动", "隐藏"][Number(type || 0)] || "卡片";
}

function itemTypeLabel(type?: number) {
  return (
    ["卡片碎片", "虚拟星穹币", "普通道具", "其他"][Number(type || 0)] || "物品"
  );
}

function tradeStatusLabel(status?: string) {
  const labels: Record<string, string> = {
    active: "交易中",
    sold: "已成交",
    cancelled: "已取消",
  };
  return labels[String(status || "")] || "未知";
}

function tradeRoleLabel(role?: string) {
  return role === "seller" ? "卖出" : "买入";
}

function formatPercent(value?: number) {
  return `${(Number(value || 0) * 100).toFixed(2)}%`;
}

function formatDate(value?: string | null) {
  if (!value) {
    return "不限";
  }
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRewards(rewards?: {
  points?: number;
  items?: Array<{ itemName?: string; itemId: number; num: number }>;
  cards?: Array<{ cardName?: string; cardId: number; rarity: string; num: number }>;
}) {
  if (!rewards) {
    return "无奖励";
  }
  const parts = [];
  if (Number(rewards.points || 0) > 0) {
    parts.push(`${rewards.points} 星穹币`);
  }
  rewards.items?.forEach((item) => {
    parts.push(`${item.itemName || `物品 ${item.itemId}`} x${item.num}`);
  });
  rewards.cards?.forEach((card) => {
    parts.push(`${card.cardName || `卡片 ${card.cardId}`} ${card.rarity} x${card.num}`);
  });
  return parts.length > 0 ? parts.join("，") : "无奖励";
}

function achievementProgressPercent(achievement: AchievementRecord) {
  if (achievement.achieved) {
    return 100;
  }
  const target = Math.max(1, Number(achievement.targetValue || 0));
  return Math.max(
    0,
    Math.min(100, Math.round((Number(achievement.progress || 0) / target) * 100)),
  );
}

function achievementProgressText(achievement: AchievementRecord) {
  const target = Math.max(0, Number(achievement.targetValue || 0));
  const progress = Math.min(Math.max(0, Number(achievement.progress || 0)), target);
  return `${progress} / ${target}`;
}

function resetAchievementFilters() {
  achievementStatusFilter.value = "all";
  achievementCategoryFilter.value = "";
  achievementKeyword.value = "";
}

function achievementScopeLabel(achievement: AchievementRecord) {
  const scope = achievement.targetScope || {};
  const parts: string[] = [];
  if (scope.rarity) {
    parts.push(`${scope.rarity} 稀有度`);
  }
  if (scope.poolId) {
    const pool = pools.value.find((item) => item.id === scope.poolId);
    parts.push(pool?.pool_name || `卡池 #${scope.poolId}`);
  }
  return parts.length > 0 ? parts.join(" · ") : achievement.targetLabel;
}

function formatFragmentSummary(
  fragments?: Array<{ itemName?: string; itemId: number; count: number }>,
) {
  if (!fragments || fragments.length === 0) {
    return "无碎片";
  }
  return fragments
    .map((item) => `${item.itemName || `物品 ${item.itemId}`} x${item.count}`)
    .join("，");
}

function formatCosts(
  costs?: Array<{ itemName?: string; itemId: number; num: number }>,
) {
  if (!costs || costs.length === 0) {
    return "无消耗";
  }
  return costs
    .map((item) => `${item.itemName || `物品 ${item.itemId}`} x${item.num}`)
    .join("，");
}

function leaderboardInitial(entry: LeaderboardEntry) {
  return (entry.nickname || entry.uid || "?").slice(0, 1).toUpperCase();
}

function formatLeaderboardValue(value?: number) {
  return `${value || 0}${activeLeaderboardTab.value.unit}`;
}

function leaderboardRankLabel(rank?: number) {
  return rank ? `#${rank}` : "未上榜";
}
</script>

<template>
  <div class="app-shell">
    <div class="starfield" aria-hidden="true">
      <span class="star star-a"></span>
      <span class="star star-b"></span>
      <span class="star star-c"></span>
    </div>

    <header class="topbar">
      <RouterLink class="brand" :to="{ name: 'draw' }">
        <span class="brand-mark"><Sparkles :size="20" /></span>
        <span>
          <strong>{{ siteConfig.websiteTitle }}</strong>
          <small>星穹调度台</small>
        </span>
      </RouterLink>

      <nav class="desktop-nav" aria-label="页面导航">
        <RouterLink
          v-for="item in sectionItems"
          :key="item.key"
          :to="{ name: item.key }"
          :class="{ active: activeSection === item.key }"
        >
          <component :is="item.icon" :size="16" />
          {{ item.label }}
        </RouterLink>
      </nav>

      <div class="top-actions">
        <button
          class="icon-button"
          type="button"
          :disabled="busy.public || busy.assets || busy.leaderboard"
          @click="refreshAll"
        >
          <RefreshCw
            :size="17"
            :class="{ spin: busy.public || busy.assets || busy.leaderboard }"
          />
          <span>刷新</span>
        </button>
        <button
          v-if="isAuthed"
          class="icon-button ghost"
          type="button"
          @click="logout"
        >
          <LogOut :size="17" />
          <span>退出</span>
        </button>
      </div>
    </header>

    <main class="page">
      <section
        v-if="activeSection === 'draw'"
        class="hero-grid"
        data-section="draw"
      >
        <div class="panel draw-panel">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">当前卡池</p>
              <h1>{{ selectedPool?.pool_name || "等待卡池同步" }}</h1>
            </div>
            <div class="pool-heading-actions">
              <span class="type-pill">{{
                poolTypeLabel(selectedPool?.card_type)
              }}</span>
              <button
                class="secondary-action compact"
                type="button"
                :disabled="!activePoolId || busy.public"
                @click="openPoolDetail"
              >
                <Package :size="16" />
                图鉴
              </button>
            </div>
          </div>

          <p class="pool-desc">
            {{
              selectedPool?.card_desc || "选择喜欢的卡池，准备开启本次抽取。"
            }}
          </p>

          <div class="pool-strip" aria-label="卡池列表">
            <button
              v-for="pool in pools"
              :key="pool.id"
              type="button"
              class="pool-chip"
              :class="{ active: activePoolId === pool.id }"
              @click="activePoolId = pool.id"
            >
              <span>{{ pool.pool_name }}</span>
              <small>{{ poolTypeLabel(pool.card_type) }} · 消耗见操作区</small>
            </button>
            <div v-if="!busy.public && pools.length === 0" class="empty-inline">
              暂无可用卡池
            </div>
          </div>

          <div class="summon-stage">
            <div
              class="summon-core"
              :class="{
                drawing: busy.drawing,
                'summon-charging': drawPhase === 'charging',
                'summon-burst': drawPhase === 'burst',
              }"
            >
              <div class="orbit orbit-one"></div>
              <div class="orbit orbit-two"></div>
              <div class="summon-flare"></div>
              <WandSparkles :size="44" />
              <strong>{{ bestResult?.cardName || "星轨待命" }}</strong>
              <span>{{ drawPhaseText }}</span>
            </div>

            <div class="draw-actions">
              <div class="cost-board">
                <div>
                  <span>星穹币余额</span>
                  <strong>{{
                    isAuthed ? (stats?.point ?? 0) : "未登录"
                  }}</strong>
                </div>
                <div>
                  <span>单抽</span>
                  <strong>{{ selectedDrawCosts.once }} 星穹币</strong>
                </div>
                <div>
                  <span>十连</span>
                  <strong>{{ selectedDrawCosts.ten }} 星穹币</strong>
                </div>
              </div>
              <button
                class="primary-action"
                type="button"
                :disabled="busy.drawing"
                @click="performDraw('once')"
              >
                <Sparkles :size="18" />
                单抽 · {{ selectedDrawCosts.once }} 星穹币
              </button>
              <button
                class="primary-action golden"
                type="button"
                :disabled="busy.drawing"
                @click="performDraw('ten')"
              >
                <Ticket :size="18" />
                十连 · {{ selectedDrawCosts.ten }} 星穹币
              </button>
              <button
                class="secondary-action wide"
                type="button"
                :disabled="busy.drawing || lastResults.length === 0"
                @click="openLastResults"
              >
                <Sparkles :size="18" />
                查看上次结果
              </button>
            </div>
          </div>
        </div>

        <aside class="panel auth-panel identity-card">
          <div v-if="isAuthed" class="player-profile">
            <div class="player-avatar">
              <img
                v-if="currentUser?.avatar"
                :src="currentUser.avatar"
                :alt="playerDisplayName"
              />
              <span v-else>{{ playerInitial }}</span>
            </div>
            <div class="player-info">
              <p class="eyebrow">玩家身份</p>
              <h2>{{ playerDisplayName }}</h2>
              <span>{{ playerUidLabel }}</span>
            </div>
            <span class="status-pill online">
              <span class="status-dot online"></span>
              在线
            </span>
          </div>

          <div v-else class="identity-login-head">
            <div class="player-avatar guest">
              <UserRound :size="28" />
            </div>
            <div>
              <p class="eyebrow">玩家身份</p>
              <h2>登录后同步资产</h2>
              <span>登录后可抽卡、交易、查看背包和排行榜。</span>
            </div>
          </div>

          <div v-if="isAuthed" class="point-card">
            <div class="point-card-head">
              <span>星穹币余额</span>
              <button
                class="recharge-trigger"
                type="button"
                :disabled="busy.recharge || rechargeConfig?.enabled === false"
                @click="openRechargeModal"
              >
                <Coins :size="15" />
                充值
              </button>
            </div>
            <strong>{{ stats?.point || 0 }}</strong>
            <small>
              当前卡池 {{ selectedPool?.pool_name || "未选择" }} · 充值
              {{ rechargeRangeLabel }}
            </small>
          </div>

          <div v-if="hasLaunchActivityReward" class="launch-activity-callout">
            <div>
              <span>开服福利待领取</span>
              <strong>{{ launchActivityInfo?.name || "开服福利" }}</strong>
              <small>{{ formatRewards(launchActivityInfo?.rewards) }}</small>
            </div>
            <button
              class="secondary-action compact"
              type="button"
              :disabled="busy.launchActivity"
              @click="openLaunchActivityModal"
            >
              <Gift :size="15" />
              领取
            </button>
          </div>

          <div v-if="isAuthed" class="player-metrics">
            <article>
              <small>累计抽数</small>
              <strong>{{ stats?.totalDraws || 0 }}</strong>
            </article>
            <article>
              <small>UR 收藏</small>
              <strong>{{ stats?.cardCounts?.UR || 0 }}</strong>
            </article>
            <article>
              <small>SSR 收藏</small>
              <strong>{{ stats?.cardCounts?.SSR || 0 }}</strong>
            </article>
          </div>

          <div v-if="isAuthed" class="identity-status-list">
            <div>
              <span>最近最高结果</span>
              <strong>{{
                bestResult
                  ? `${bestResult.rarity} · ${bestResult.cardName}`
                  : "暂无抽卡结果"
              }}</strong>
            </div>
            <div>
              <span>资产状态</span>
              <strong>已同步当前星穹币、背包与收藏</strong>
            </div>
          </div>

          <div v-if="!isAuthed" class="login-stack">
            <button
              class="primary-action wide"
              type="button"
              :disabled="busy.auth || callbackBusy"
              @click="loginWithOpenId"
            >
              <LoaderCircle
                v-if="busy.auth || callbackBusy"
                :size="18"
                class="spin"
              />
              <LogIn v-else :size="18" />
              使用 OpenID 登录
            </button>
            <label class="token-box debug-token-box">
              <span>本地调试 Token</span>
              <textarea
                v-model="manualToken"
                placeholder="粘贴玩家 JWT，仅保存在当前浏览器"
              ></textarea>
            </label>
            <button
              class="secondary-action wide"
              type="button"
              @click="applyManualToken"
            >
              <ShieldCheck :size="18" />
              使用 Token 进入
            </button>
          </div>
        </aside>
      </section>

      <section
        v-if="activeSection === 'bag'"
        class="collection-grid"
        data-section="bag"
      >
        <div class="panel collection-panel">
          <div class="section-head">
            <div>
              <p class="eyebrow">玩家背包</p>
              <h2>卡片与物品</h2>
            </div>
            <div class="filter-row">
              <select
                v-model="rarityFilter"
                @change="resetUserCards"
              >
                <option value="">全部稀有度</option>
                <option
                  v-for="rarity in rarityOrder"
                  :key="rarity"
                  :value="rarity"
                >
                  {{ rarity }}
                </option>
              </select>
              <select
                v-model="poolFilter"
                @change="resetUserCards"
              >
                <option v-for="pool in pools" :key="pool.id" :value="pool.id">
                  {{ pool.pool_name }}
                </option>
              </select>
              <div
                class="bulk-decompose-control"
                @mouseenter="loadBulkDecomposePreview"
                @focusin="loadBulkDecomposePreview"
              >
                <button
                  class="danger-action bulk-decompose-trigger"
                  type="button"
                  :disabled="
                    busy.assets ||
                    !isAuthed ||
                    bulkDecomposeSelectedRarities.length === 0
                  "
                  @click="bulkDecomposeCards"
                >
                  <LoaderCircle
                    v-if="busy.bulkDecompose"
                    :size="16"
                    class="spin"
                  />
                  <Package v-else :size="16" />
                  一键分解
                </button>
                <div
                  class="bulk-decompose-popover"
                  role="group"
                  aria-label="一键分解等级选择"
                >
                  <div class="bulk-popover-head">
                    <strong>分解等级</strong>
                    <small>{{ bulkDecomposeSelectedLabel }}</small>
                  </div>
                  <div class="bulk-switch-list">
                    <div
                      v-for="rarity in rarityOrder"
                      :key="rarity"
                      class="bulk-switch-row"
                      :class="{ disabled: rarity === 'UR' }"
                    >
                      <span>{{ rarity }}</span>
                      <button
                        class="switch-toggle"
                        type="button"
                        role="switch"
                        :aria-label="`一键分解 ${rarity}`"
                        :aria-checked="bulkDecomposeRarities[rarity]"
                        :disabled="rarity === 'UR' || busy.bulkDecompose"
                        @click="toggleBulkDecomposeRarity(rarity)"
                      >
                        <i></i>
                      </button>
                    </div>
                  </div>
                  <div class="bulk-preview-line">
                    <span>可分解</span>
                    <strong>
                      {{
                        busy.bulkDecomposePreview
                          ? "同步中"
                          : `${bulkDecomposePreviewTotal} 张`
                      }}
                    </strong>
                  </div>
                  <div
                    v-if="bulkDecomposePreview?.skippedListed"
                    class="bulk-preview-line muted"
                  >
                    <span>挂售跳过</span>
                    <strong>{{ bulkDecomposePreview.skippedListed }} 张</strong>
                  </div>
                  <div
                    v-if="bulkDecomposeReservedCount"
                    class="bulk-preview-line muted"
                  >
                    <span>默认保留</span>
                    <strong>{{ bulkDecomposeReservedCount }} 张</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="!isAuthed" class="empty-state">
            <UserRound :size="30" />
            <strong>登录后查看背包</strong>
            <span>你的卡片、背包和抽卡统计会在登录后加载。</span>
          </div>
          <div v-else-if="busy.assets" class="skeleton-grid">
            <span v-for="item in 6" :key="item"></span>
          </div>
          <div v-else-if="!userCards?.list.length" class="empty-state">
            <Package :size="30" />
            <strong>暂无卡片</strong>
            <span>去抽卡区试试手气，或调整筛选条件。</span>
          </div>
          <div v-else class="owned-grid">
            <article
              v-for="(card, index) in userCards.list"
              :key="`${card.cardId || card.id}-${card.cardLevel}`"
              class="result-card owned-card"
              :class="[
                rarityClass(card.cardLevel),
                { 'is-stacked': Number(card.count || 1) > 1 },
              ]"
              :style="{ '--delay': `${Math.min(index * 24, 260)}ms` }"
            >
              <div class="card-face">
                <div class="result-card-top">
                  <span class="rarity-badge">{{ card.cardLevel }}</span>
                  <div class="owned-card-top-right">
                    <span class="card-type-pill">{{
                      cardTypeLabel(card.cardType)
                    }}</span>
                    <span
                      v-if="Number(card.count || 1) > 1"
                      class="card-stack-count"
                    >
                      x{{ card.count }}
                    </span>
                  </div>
                </div>
                <div class="card-sigil"></div>
                <div class="card-content">
                  <h3>{{ card.cardName }}</h3>
                  <p>{{ cardIntroText(card.cardDesc) }}</p>
                  <div class="tag-row">
                    <span>{{
                      poolTypeLabel(
                        pools.find((pool) => pool.id === card.poolId)
                          ?.card_type,
                      )
                    }}</span>
                    <span v-if="card.listedCount"
                      >挂售 {{ card.listedCount }}</span
                    >
                    <button
                      v-if="hasCardIntroDetail(card.cardDesc)"
                      class="tag-action"
                      type="button"
                      @click="
                        openCardIntro({
                          name: card.cardName,
                          desc: card.cardDesc,
                          rarity: String(card.cardLevel),
                          type: cardTypeLabel(card.cardType),
                        })
                      "
                    >
                      详情
                    </button>
                    <button
                      class="tag-action"
                      type="button"
                      @click="
                        shareCard({
                          cardName: card.cardName,
                          cardDesc: card.cardDesc,
                          rarity: String(card.cardLevel),
                          poolId: card.poolId,
                        })
                      "
                    >
                      分享
                    </button>
                  </div>
                </div>
              </div>
              <div class="card-actions">
                <span class="stack-count-badge">
                  可售 {{ card.sellableCount || 0 }}
                </span>
                <button
                  class="secondary-action"
                  type="button"
                  :disabled="!card.canSell || Number(card.sellableCount || 0) <= 0"
                  @click="openTradeListingModal(card)"
                >
                  {{ card.canSell && Number(card.sellableCount || 0) > 0 ? "挂售" : "无可售" }}
                </button>
                <button
                  class="secondary-action"
                  type="button"
                  @click="
                    shareCard({
                      cardName: card.cardName,
                      cardDesc: card.cardDesc,
                      cardLevel: String(card.cardLevel),
                      poolId: card.poolId,
                    })
                  "
                >
                  <Share2 :size="15" />
                  分享
                </button>
              </div>
            </article>
          </div>

          <div v-if="bagLoadedCount" class="load-more-row">
            <button
              v-if="bagHasMore"
              class="secondary-action"
              type="button"
              :disabled="busy.cardsMore"
              @click="loadMoreUserCards"
            >
              <LoaderCircle
                v-if="busy.cardsMore"
                :size="16"
                class="spin"
              />
              {{ busy.cardsMore ? "加载中" : "更多" }}
            </button>
            <span v-else class="load-more-done">已全部</span>
          </div>
        </div>

        <aside class="panel inventory-panel">
          <div class="section-head">
            <div>
              <p class="eyebrow">背包</p>
              <h2>物品库存</h2>
            </div>
          </div>
          <div v-if="inventoryItems.length === 0" class="empty-mini">
            暂无背包物品
          </div>
          <div v-else class="inventory-list">
            <article v-for="item in inventoryItems" :key="item.id">
              <div>
                <strong>{{ item.name }}</strong>
                <span>{{ itemTypeLabel(item.type) }}</span>
              </div>
              <b>x{{ item.num }}</b>
              <p>{{ item.desc || "暂无说明" }}</p>
            </article>
          </div>
        </aside>
      </section>

      <section
        v-if="activeSection === 'synthesize'"
        class="panel catalog-panel synthesize-panel"
        data-section="synthesize"
      >
        <div class="section-head">
          <div>
            <p class="eyebrow">碎片合成</p>
            <h2>选择目标卡片</h2>
          </div>
          <div class="filter-row">
            <select v-model="activePoolId">
              <option v-for="pool in pools" :key="pool.id" :value="pool.id">
                {{ pool.pool_name }}
              </option>
            </select>
            <select v-model="synthesisRarityFilter">
              <option value="">全部稀有度</option>
              <option
                v-for="rarity in rarityOrder"
                :key="rarity"
                :value="rarity"
              >
                {{ rarity }}
              </option>
            </select>
            <button
              class="secondary-action"
              type="button"
              @click="synthesisRarityFilter = ''"
            >
              重置
            </button>
          </div>
        </div>

        <div class="synthesis-overview">
          <article>
            <small>当前卡池</small>
            <strong>{{ selectedPool?.pool_name || "未选择" }}</strong>
          </article>
          <article>
            <small>筛选后可合成</small>
            <strong>{{ synthesisAvailableCount }}</strong>
          </article>
          <article>
            <small>当前稀有度</small>
            <strong>{{ synthesisRarityFilter || "全部" }}</strong>
          </article>
        </div>

        <div v-if="poolCards.length === 0" class="empty-state">
          <Package :size="30" />
          <strong>当前卡池暂无卡片</strong>
          <span>切换卡池后可查看可合成卡片。</span>
        </div>
        <div
          v-else-if="filteredSynthesisCards.length === 0"
          class="empty-state"
        >
          <Package :size="30" />
          <strong>暂无该稀有度版本</strong>
          <span
            >当前卡池没有 {{ synthesisRarityFilter }} 稀有度的可展示卡片。</span
          >
        </div>
        <div v-else class="catalog-grid synthesis-grid">
          <article
            v-for="(item, index) in filteredSynthesisCards"
            :key="item.key"
            class="result-card synthesis-card"
            :class="rarityClass(item.rarity)"
            :style="{ '--delay': `${Math.min(index * 24, 260)}ms` }"
          >
            <div class="card-face">
              <div class="result-card-top">
                <span class="rarity-badge">{{ item.rarity }}</span>
                <span class="card-type-pill">{{
                  cardTypeLabel(item.card.card_type)
                }}</span>
              </div>
              <div class="card-sigil"></div>
              <div class="card-content">
                <h3>{{ item.card.card_name }}</h3>
                <p>{{ cardIntroText(item.card.card_desc) }}</p>
                <div class="tag-row">
                  <span>{{ item.costLabel }}</span>
                  <span>#{{ item.card.id }}</span>
                  <button
                    v-if="hasCardIntroDetail(item.card.card_desc)"
                    class="tag-action"
                    type="button"
                    @click="
                      openCardIntro({
                        name: item.card.card_name,
                        desc: item.card.card_desc,
                        rarity: item.rarity,
                        type: cardTypeLabel(item.card.card_type),
                      })
                    "
                  >
                    详情
                  </button>
                </div>
              </div>
            </div>
            <button
              class="secondary-action"
              type="button"
              :disabled="busy.assets || item.disabled"
              @click="synthesizeCard(item)"
            >
              {{ item.disabled ? "不可合成" : "碎片合成" }}
            </button>
          </article>
        </div>
      </section>

      <section
        v-if="activeSection === 'points'"
        class="panel points-panel"
        data-section="points"
      >
        <div class="section-head">
          <div>
            <p class="eyebrow">星穹币流水</p>
            <h2>星穹币变化记录</h2>
          </div>
          <button
            class="secondary-action"
            type="button"
            :disabled="busy.points"
            @click="loadPointRecords"
          >
            <RefreshCw :size="16" :class="{ spin: busy.points }" />
            刷新
          </button>
        </div>

        <div v-if="!isAuthed" class="empty-state">
          <Coins :size="30" />
          <strong>登录后查看星穹币流水</strong>
          <span>抽卡、充值、交易和活动奖励都会在这里记录。</span>
        </div>
        <div v-else class="points-content">
          <div class="points-overview">
            <article>
              <small>当前余额</small>
              <strong>{{
                pointRecords?.currentPoint ?? stats?.point ?? 0
              }}</strong>
            </article>
            <article class="income">
              <small>本页收入</small>
              <strong>+{{ pointIncomeTotal }}</strong>
            </article>
            <article class="expense">
              <small>本页支出</small>
              <strong>-{{ pointExpenseTotal }}</strong>
            </article>
            <article :class="pointNetTotal >= 0 ? 'income' : 'expense'">
              <small>本页净变动</small>
              <strong>{{ formatPointChange(pointNetTotal) }}</strong>
            </article>
          </div>

          <div class="filter-row point-filter-row">
            <select
              v-model="pointRecordTypeFilter"
              @change="
                pointRecordPage = 1;
                loadPointRecords();
              "
            >
              <option value="all">全部收支</option>
              <option value="income">只看收入</option>
              <option value="expense">只看支出</option>
            </select>
            <select
              v-model="pointRecordSourceFilter"
              @change="
                pointRecordPage = 1;
                loadPointRecords();
              "
            >
              <option
                v-for="option in pointSourceOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </div>

          <div
            v-if="busy.points && !pointRecords"
            class="skeleton-grid points-skeleton"
          >
            <span v-for="item in 6" :key="item"></span>
          </div>
          <div v-else-if="pointLedgerRows.length === 0" class="empty-state">
            <Coins :size="30" />
            <strong>暂无星穹币流水</strong>
            <span>新的星穹币收入和支出会从现在开始记录。</span>
          </div>
          <div v-else class="point-ledger-list">
            <article
              v-for="record in pointLedgerRows"
              :key="record.id"
              class="point-ledger-card"
              :class="pointChangeClass(record.changeAmount)"
            >
              <div class="point-ledger-main">
                <div class="point-ledger-head">
                  <span>{{ record.sourceLabel }}</span>
                  <time>{{ formatDate(record.createdAt) }}</time>
                </div>
                <strong>{{ record.title }}</strong>
                <small>{{ pointMetadataSummary(record) }}</small>
              </div>
              <div class="point-ledger-amount">
                <strong>{{ formatPointChange(record.changeAmount) }}</strong>
                <span>{{ record.pointBefore }} → {{ record.pointAfter }}</span>
              </div>
            </article>
          </div>

          <div
            v-if="pointRecords && pointRecords.total > pointRecords.pageSize"
            class="pager"
          >
            <button
              type="button"
              :disabled="pointRecordPage <= 1"
              @click="changePointPage(-1)"
            >
              <ChevronLeft :size="16" />
              上一页
            </button>
            <span
              >第 {{ pointRecordPage }} / {{ pointRecordTotalPages }} 页</span
            >
            <button
              type="button"
              :disabled="pointRecordPage >= pointRecordTotalPages"
              @click="changePointPage(1)"
            >
              下一页
              <ChevronRight :size="16" />
            </button>
          </div>
        </div>
      </section>

      <section
        v-if="activeSection === 'trade'"
        class="panel trade-panel"
        data-section="trade"
      >
        <div class="section-head">
          <div>
            <p class="eyebrow">匿名交易</p>
            <h2>卡片交易市场</h2>
          </div>
          <button
            class="secondary-action"
            type="button"
            :disabled="busy.trade"
            @click="loadTradeData"
          >
            <RefreshCw :size="16" :class="{ spin: busy.trade }" />
            刷新
          </button>
        </div>

        <div v-if="!isAuthed" class="empty-state">
          <Store :size="30" />
          <strong>登录后进入交易市场</strong>
          <span>市场匿名展示，成交后入背包。</span>
        </div>
        <div v-else class="trade-content">
          <div class="trade-config-strip">
            <article>
              <small>交易状态</small>
              <strong>{{ tradeConfig.enabled ? "已开启" : "已关闭" }}</strong>
            </article>
            <article>
              <small>手续费</small>
              <strong>{{ formatPercent(tradeConfig.feeRate) }}</strong>
            </article>
            <article>
              <small>价格范围</small>
              <strong
                >{{ tradeConfig.minPrice }} - {{ tradeConfig.maxPrice }}</strong
              >
            </article>
            <article>
              <small>我的星穹币</small>
              <strong>{{ stats?.point || 0 }}</strong>
            </article>
          </div>

          <div class="trade-tabs" role="tablist" aria-label="交易分区">
            <button
              type="button"
              :class="{ active: tradeTab === 'market' }"
              @click="tradeTab = 'market'"
            >
              市场
            </button>
            <button
              type="button"
              :class="{ active: tradeTab === 'mine' }"
              @click="tradeTab = 'mine'"
            >
              我的挂售
            </button>
            <button
              type="button"
              :class="{ active: tradeTab === 'records' }"
              @click="tradeTab = 'records'"
            >
              成交记录
            </button>
          </div>

          <div v-if="tradeTab === 'market'" class="trade-section">
            <div class="filter-row trade-filter-row">
              <select
                v-model="tradeRarityFilter"
                @change="
                  tradePage = 1;
                  loadTradeListings();
                "
              >
                <option value="">全部稀有度</option>
                <option
                  v-for="rarity in rarityOrder"
                  :key="rarity"
                  :value="rarity"
                >
                  {{ rarity }}
                </option>
              </select>
              <select
                v-model="tradePoolFilter"
                @change="
                  tradePage = 1;
                  loadTradeListings();
                "
              >
                <option value="">全部卡池</option>
                <option v-for="pool in pools" :key="pool.id" :value="pool.id">
                  {{ pool.pool_name }}
                </option>
              </select>
              <select
                v-model="tradeSort"
                @change="
                  tradePage = 1;
                  loadTradeListings();
                "
              >
                <option value="newest">最新上架</option>
                <option value="priceAsc">价格从低到高</option>
                <option value="priceDesc">价格从高到低</option>
              </select>
              <input
                v-model="tradeMinPrice"
                type="number"
                min="0"
                placeholder="最低价"
                @change="
                  tradePage = 1;
                  loadTradeListings();
                "
              />
              <input
                v-model="tradeMaxPrice"
                type="number"
                min="0"
                placeholder="最高价"
                @change="
                  tradePage = 1;
                  loadTradeListings();
                "
              />
            </div>

            <div
              v-if="busy.trade && tradeListings.length === 0"
              class="skeleton-grid"
            >
              <span v-for="item in 6" :key="item"></span>
            </div>
            <div v-else-if="tradeListings.length === 0" class="empty-state">
              <Store :size="30" />
              <strong>暂无在售卡片</strong>
              <span>可以从背包选择卡片挂售，市场不会展示卖家身份。</span>
            </div>
            <div v-else class="trade-grid">
              <article
                v-for="listing in tradeListings"
                :key="listing.id"
                class="trade-card"
                :class="rarityClass(listing.cardLevel)"
              >
                <div class="trade-card-art">
                  <span class="rarity-badge">{{ listing.cardLevel }}</span>
                  <strong>{{ listing.cardName }}</strong>
                  <small>{{ listing.poolName || "未知卡池" }}</small>
                </div>
                <div class="trade-card-body">
                  <p>{{ cardIntroText(listing.cardDesc) }}</p>
                  <button
                    v-if="hasCardIntroDetail(listing.cardDesc)"
                    class="tag-action intro-inline-action"
                    type="button"
                    @click="
                      openCardIntro({
                        name: listing.cardName,
                        desc: listing.cardDesc,
                        rarity: listing.cardLevel,
                        extra: listing.poolName || '未知卡池',
                      })
                    "
                  >
                    详情
                  </button>
                  <dl>
                    <div>
                      <dt>价格</dt>
                      <dd class="trade-price-value">
                        {{ listing.price }} 星穹币
                      </dd>
                    </div>
                    <div>
                      <dt>卖家</dt>
                      <dd>匿名玩家</dd>
                    </div>
                    <div>
                      <dt>上架</dt>
                      <dd>{{ formatDate(listing.createdAt) }}</dd>
                    </div>
                  </dl>
                  <button
                    class="primary-action wide"
                    type="button"
                    :disabled="
                      busy.trade || listing.isMine || !tradeConfig.enabled
                    "
                    @click="buyTradeListing(listing)"
                  >
                    {{ listing.isMine ? "自己的挂单" : "购买" }}
                  </button>
                </div>
              </article>
            </div>
            <div class="pager">
              <button
                type="button"
                :disabled="tradePage <= 1"
                @click="changeTradePage('market', -1)"
              >
                <ChevronLeft :size="16" />
                上一页
              </button>
              <span>第 {{ tradePage }} / {{ tradeTotalPages }} 页</span>
              <button
                type="button"
                :disabled="tradePage >= tradeTotalPages"
                @click="changeTradePage('market', 1)"
              >
                下一页
                <ChevronRight :size="16" />
              </button>
            </div>
          </div>

          <div v-if="tradeTab === 'mine'" class="trade-section">
            <div v-if="myTradeListings.length === 0" class="empty-state">
              <Store :size="30" />
              <strong>暂无我的挂售</strong>
              <span>从背包卡片点击“挂售”即可上架。</span>
            </div>
            <div v-else class="trade-list">
              <article v-for="listing in myTradeListings" :key="listing.id">
                <div>
                  <strong
                    >{{ listing.cardName }} · {{ listing.cardLevel }}</strong
                  >
                  <span>{{ listing.poolName || "未知卡池" }}</span>
                </div>
                <b>{{ listing.price }} 星穹币</b>
                <span>{{ tradeStatusLabel(listing.status) }}</span>
                <button
                  class="secondary-action"
                  type="button"
                  :disabled="busy.trade || listing.status !== 'active'"
                  @click="cancelTradeListing(listing)"
                >
                  取消挂售
                </button>
              </article>
            </div>
            <div class="pager">
              <button
                type="button"
                :disabled="myTradePage <= 1"
                @click="changeTradePage('mine', -1)"
              >
                上一页
              </button>
              <span>第 {{ myTradePage }} / {{ myTradeTotalPages }} 页</span>
              <button
                type="button"
                :disabled="myTradePage >= myTradeTotalPages"
                @click="changeTradePage('mine', 1)"
              >
                下一页
              </button>
            </div>
          </div>

          <div v-if="tradeTab === 'records'" class="trade-section">
            <div v-if="tradeRecords.length === 0" class="empty-state">
              <History :size="30" />
              <strong>暂无成交记录</strong>
              <span>买入或卖出卡片后会在这里看到记录，对方身份保持匿名。</span>
            </div>
            <div v-else class="trade-list">
              <article v-for="record in tradeRecords" :key="record.id">
                <div>
                  <strong
                    >{{ tradeRoleLabel(record.role) }} · {{ record.cardName }} ·
                    {{ record.cardLevel }}</strong
                  >
                  <span>{{ record.poolName || "未知卡池" }}</span>
                </div>
                <b>{{ record.price }} 星穹币</b>
                <span v-if="record.role === 'seller'"
                  >实收 {{ record.sellerIncome }}，手续费
                  {{ record.feeAmount }}</span
                >
                <span v-else>成交 {{ formatDate(record.createdAt) }}</span>
              </article>
            </div>
            <div class="pager">
              <button
                type="button"
                :disabled="tradeRecordPage <= 1"
                @click="changeTradePage('records', -1)"
              >
                上一页
              </button>
              <span
                >第 {{ tradeRecordPage }} / {{ tradeRecordTotalPages }} 页</span
              >
              <button
                type="button"
                :disabled="tradeRecordPage >= tradeRecordTotalPages"
                @click="changeTradePage('records', 1)"
              >
                下一页
              </button>
            </div>
          </div>
        </div>
      </section>

      <section
        v-if="activeSection === 'leaderboard'"
        class="panel leaderboard-panel"
        data-section="leaderboard"
      >
        <div class="section-head">
          <div>
            <p class="eyebrow">玩家排行</p>
            <h2>收藏榜单</h2>
          </div>
          <button
            class="secondary-action"
            type="button"
            :disabled="busy.leaderboard"
            @click="loadLeaderboard"
          >
            <RefreshCw :size="16" :class="{ spin: busy.leaderboard }" />
            刷新
          </button>
        </div>

        <div v-if="!isAuthed" class="empty-state">
          <Trophy :size="30" />
          <strong>登录后查看排行榜</strong>
          <span>排行榜按当前收藏统计，分解后的卡片不会计入排名。</span>
        </div>
        <div
          v-else-if="busy.leaderboard && !leaderboard"
          class="skeleton-grid leaderboard-skeleton"
        >
          <span v-for="item in 6" :key="item"></span>
        </div>
        <div v-else-if="leaderboardError" class="empty-state">
          <Trophy :size="30" />
          <strong>排行榜加载失败</strong>
          <span>{{ leaderboardError }}</span>
          <button
            class="secondary-action"
            type="button"
            @click="loadLeaderboard"
          >
            重新加载
          </button>
        </div>
        <div v-else class="leaderboard-content">
          <div class="leaderboard-tabs" role="tablist" aria-label="排行榜类型">
            <button
              v-for="tab in leaderboardTabs"
              :key="tab.key"
              type="button"
              :class="{ active: activeLeaderboardMetric === tab.key }"
              @click="activeLeaderboardMetric = tab.key"
            >
              <strong>{{ tab.label }}</strong>
              <span>{{ tab.hint }}</span>
            </button>
          </div>

          <div v-if="activeLeaderboardBoard?.me" class="my-rank-card">
            <div>
              <small>我的排名</small>
              <strong>{{
                leaderboardRankLabel(activeLeaderboardBoard.me.rank)
              }}</strong>
            </div>
            <div>
              <small>{{ activeLeaderboardTab.label }}</small>
              <strong>{{
                formatLeaderboardValue(activeLeaderboardBoard.me.value)
              }}</strong>
            </div>
            <span>{{ activeLeaderboardTab.hint }}</span>
          </div>

          <div v-if="!activeLeaderboardBoard?.list.length" class="empty-state">
            <Trophy :size="30" />
            <strong>当前暂无上榜玩家</strong>
            <span>获得卡片后榜单会自动更新。</span>
          </div>
          <div v-else class="leaderboard-board">
            <div class="podium-grid">
              <article
                v-for="entry in podiumEntries"
                :key="`podium-${activeLeaderboardMetric}-${entry.uid}`"
                class="podium-card"
                :class="`rank-${entry.rank}`"
              >
                <span class="rank-badge">{{
                  leaderboardRankLabel(entry.rank)
                }}</span>
                <img
                  v-if="entry.avatar"
                  :src="entry.avatar"
                  :alt="entry.nickname"
                />
                <span v-else class="avatar-fallback">{{
                  leaderboardInitial(entry)
                }}</span>
                <h3>{{ entry.nickname || entry.uid }}</h3>
                <p>{{ entry.uid }}</p>
                <strong>{{ formatLeaderboardValue(entry.value) }}</strong>
              </article>
            </div>

            <div v-if="leaderboardRows.length" class="leaderboard-list">
              <article
                v-for="entry in leaderboardRows"
                :key="`${activeLeaderboardMetric}-${entry.uid}`"
                :class="{ mine: entry.uid === activeLeaderboardBoard?.me?.uid }"
              >
                <b>{{ leaderboardRankLabel(entry.rank) }}</b>
                <img
                  v-if="entry.avatar"
                  :src="entry.avatar"
                  :alt="entry.nickname"
                />
                <span v-else class="avatar-fallback small">{{
                  leaderboardInitial(entry)
                }}</span>
                <div>
                  <strong>{{ entry.nickname || entry.uid }}</strong>
                  <span>{{ entry.uid }}</span>
                </div>
                <em>{{ formatLeaderboardValue(entry.value) }}</em>
              </article>
            </div>
          </div>

          <p class="leaderboard-time">
            更新时间：{{ formatDate(leaderboard?.generatedAt) }}
          </p>
        </div>
      </section>

      <section
        v-if="activeSection === 'achievements'"
        class="panel achievement-panel"
        data-section="achievements"
      >
        <div class="section-head">
          <div>
            <p class="eyebrow">成就图鉴</p>
            <h2>目标进度</h2>
          </div>
          <button
            class="secondary-action"
            type="button"
            :disabled="busy.achievements"
            @click="loadAchievements"
          >
            <RefreshCw :size="16" :class="{ spin: busy.achievements }" />
            刷新
          </button>
        </div>

        <div v-if="!isAuthed" class="empty-state">
          <ShieldCheck :size="30" />
          <strong>登录后查看成就</strong>
          <span>抽卡、收藏、交易和兑换记录会汇聚成你的成就进度。</span>
        </div>
        <div
          v-else-if="busy.achievements && achievements.length === 0"
          class="skeleton-grid achievement-skeleton"
        >
          <span v-for="item in 6" :key="item"></span>
        </div>
        <div v-else-if="achievements.length === 0" class="empty-state">
          <Trophy :size="30" />
          <strong>暂无可见成就</strong>
          <span>新的目标开放后会出现在这里。</span>
        </div>
        <div v-else class="achievement-content">
          <div class="achievement-filter-bar">
            <div class="segmented-control">
              <button
                type="button"
                :class="{ active: achievementStatusFilter === 'all' }"
                @click="achievementStatusFilter = 'all'"
              >
                全部
              </button>
              <button
                type="button"
                :class="{ active: achievementStatusFilter === 'achieved' }"
                @click="achievementStatusFilter = 'achieved'"
              >
                已达成
              </button>
              <button
                type="button"
                :class="{ active: achievementStatusFilter === 'progressing' }"
                @click="achievementStatusFilter = 'progressing'"
              >
                进行中
              </button>
            </div>
            <select v-model="achievementCategoryFilter">
              <option value="">全部分类</option>
              <option
                v-for="category in achievementCategories"
                :key="category"
                :value="category"
              >
                {{ category }}
              </option>
            </select>
            <input
              v-model="achievementKeyword"
              type="search"
              placeholder="搜索成就"
            />
            <button class="secondary-action" type="button" @click="resetAchievementFilters">
              重置
            </button>
          </div>

          <div class="achievement-summary">
            <article>
              <small>已达成</small>
              <strong>{{ achievementUnlockedCount }}</strong>
            </article>
            <article>
              <small>进行中</small>
              <strong>{{ achievementProgressingCount }}</strong>
            </article>
            <article>
              <small>完成度</small>
              <strong>{{ achievementCompletionPercent }}%</strong>
            </article>
          </div>

          <div v-if="achievementVisibleCount === 0" class="empty-state compact">
            <Trophy :size="26" />
            <strong>暂无匹配</strong>
            <span>换个条件试试</span>
          </div>
          <template v-else>
            <section
              v-for="group in achievementGroups"
              :key="group.category"
              class="achievement-group"
            >
              <div class="achievement-group-head">
                <h3>{{ group.category }}</h3>
                <span>{{ group.list.length }} 项</span>
              </div>
              <div class="achievement-grid">
                <article
                  v-for="achievement in group.list"
                  :key="achievement.id"
                  class="achievement-card"
                  :class="{ achieved: achievement.achieved }"
                  :style="{
                    '--progress': `${achievementProgressPercent(achievement)}%`,
                  }"
                >
                  <header>
                    <span class="achievement-icon">
                      <Trophy v-if="achievement.achieved" :size="17" />
                      <ShieldCheck v-else :size="17" />
                    </span>
                    <div>
                      <strong>{{ achievement.name }}</strong>
                      <small>{{ achievement.targetLabel }}</small>
                    </div>
                    <b>{{ achievement.achieved ? "已达成" : "进行中" }}</b>
                  </header>
                  <p>{{ achievement.description || "完成目标后自动发放奖励。" }}</p>
                  <div class="achievement-meta">
                    <span>{{ achievementScopeLabel(achievement) }}</span>
                    <span>{{ achievementProgressText(achievement) }}</span>
                  </div>
                  <div class="achievement-progress" aria-hidden="true">
                    <i></i>
                  </div>
                  <footer>
                    <span>奖励</span>
                    <strong>{{ formatRewards(achievement.rewards) }}</strong>
                  </footer>
                </article>
              </div>
            </section>
          </template>
        </div>
      </section>

      <section
        v-if="activeSection === 'redeem'"
        class="redeem-grid"
        data-section="redeem"
      >
        <div class="panel redeem-panel">
          <div class="section-head">
            <div>
              <p class="eyebrow">兑换码</p>
              <h2>领取奖励</h2>
            </div>
            <Gift :size="24" />
          </div>
          <label class="redeem-input">
            <span>兑换码</span>
            <input
              v-model="redeemCode"
              type="text"
              placeholder="输入兑换码"
              @keyup.enter="claimRedeemCode"
            />
          </label>
          <button
            class="primary-action wide"
            type="button"
            :disabled="busy.redeem"
            @click="claimRedeemCode"
          >
            <LoaderCircle v-if="busy.redeem" :size="18" class="spin" />
            <Gift v-else :size="18" />
            立即兑换
          </button>
        </div>

        <div class="panel shop-panel">
          <div class="section-head">
            <div>
              <p class="eyebrow">兑换商店</p>
              <h2>物品消费</h2>
            </div>
            <button
              class="secondary-action"
              type="button"
              :disabled="busy.shop"
              @click="loadExchangeItems"
            >
              <RefreshCw :size="16" :class="{ spin: busy.shop }" />
              刷新
            </button>
          </div>

          <div v-if="!isAuthed" class="empty-state">
            <Store :size="30" />
            <strong>登录后查看商店</strong>
            <span>兑换商店会根据你的背包数量显示可兑换状态。</span>
          </div>
          <div
            v-else-if="busy.shop && exchangeItems.length === 0"
            class="skeleton-grid"
          >
            <span v-for="item in 4" :key="item"></span>
          </div>
          <div v-else-if="exchangeItems.length === 0" class="empty-state">
            <Store :size="30" />
            <strong>暂无可见兑换项</strong>
            <span>后台启用兑换项后会出现在这里。</span>
          </div>
          <div v-else class="shop-grid">
            <article
              v-for="item in exchangeItems"
              :key="item.id"
              class="shop-card"
            >
              <div class="shop-card-head">
                <div>
                  <h3>{{ item.name }}</h3>
                  <p>{{ item.description || "暂无说明" }}</p>
                </div>
                <span>{{
                  item.remaining === null || item.remaining === undefined
                    ? "不限库存"
                    : `剩余 ${item.remaining}`
                }}</span>
              </div>
              <dl>
                <div>
                  <dt>消耗</dt>
                  <dd>{{ formatCosts(item.costs) }}</dd>
                </div>
                <div>
                  <dt>奖励</dt>
                  <dd>{{ formatRewards(item.rewards) }}</dd>
                </div>
                <div>
                  <dt>限兑</dt>
                  <dd>
                    {{
                      item.user_limit
                        ? `${item.usedByUser || 0}/${item.user_limit}`
                        : "不限"
                    }}
                  </dd>
                </div>
                <div>
                  <dt>时间</dt>
                  <dd>
                    {{ formatDate(item.starts_at) }} 至
                    {{ formatDate(item.ends_at) }}
                  </dd>
                </div>
              </dl>
              <div class="shop-actions">
                <input
                  v-model.number="exchangeCounts[item.id]"
                  type="number"
                  min="1"
                  max="99"
                  placeholder="1"
                />
                <button
                  class="primary-action"
                  type="button"
                  :disabled="busy.shop || item.canExchange === false"
                  @click="claimExchange(item)"
                >
                  {{
                    item.canExchange === false
                      ? item.unavailableReason || "不可兑换"
                      : "兑换"
                  }}
                </button>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section v-if="activeSection === 'draw'" class="panel recent-panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">最近记录</p>
            <h2>抽卡脉冲</h2>
          </div>
          <History :size="22" />
        </div>
        <div v-if="!stats?.recentDraws?.length" class="empty-mini">
          暂无最近抽卡记录
        </div>
        <div v-else class="recent-list">
          <article
            v-for="(record, index) in stats.recentDraws"
            :key="`${record.createdAt}-${index}`"
          >
            <strong>{{ record.count }} 抽</strong>
            <span>{{ record.cardLevels.join(" / ") || "未记录稀有度" }}</span>
            <time>{{ formatDate(record.createdAt) }}</time>
          </article>
        </div>
      </section>
    </main>

    <nav class="mobile-nav" aria-label="移动端导航">
      <RouterLink
        v-for="item in sectionItems"
        :key="item.key"
        :to="{ name: item.key }"
        :class="{ active: activeSection === item.key }"
      >
        <component :is="item.icon" :size="18" />
        <span>{{ item.label }}</span>
      </RouterLink>
    </nav>

    <div v-if="feedback" class="toast" :class="feedback.type" role="status">
      {{ feedback.text }}
    </div>

    <div
      v-if="achievementToasts.length"
      class="achievement-toast-stack"
      aria-live="polite"
    >
      <article
        v-for="notice in achievementToasts"
        :key="notice.achievementId"
        class="achievement-toast"
        role="status"
      >
        <div class="achievement-toast-icon">
          <Trophy :size="18" />
        </div>
        <div class="achievement-toast-body">
          <span>成就达成</span>
          <strong>{{ notice.name }}</strong>
          <p>{{ notice.description || "奖励已发放到账户。" }}</p>
          <small>{{ formatRewards(notice.rewards) }}</small>
        </div>
        <button
          type="button"
          aria-label="关闭成就通知"
          @click="dismissAchievementToast(notice.achievementId)"
        >
          ×
        </button>
      </article>
    </div>

    <Teleport to="body">
      <div
        v-if="poolDetailOpen"
        class="result-modal-backdrop"
        role="presentation"
        @click.self="closePoolDetail"
      >
        <section
          class="pool-detail-modal"
          role="dialog"
          aria-modal="true"
          aria-label="卡池图鉴"
        >
          <header class="result-modal-head">
            <div>
              <p class="eyebrow">卡池图鉴</p>
              <h2>
                {{
                  poolDetailPool?.pool_name ||
                  selectedPool?.pool_name ||
                  "卡池图鉴"
                }}
              </h2>
              <span>
                {{
                  poolTypeLabel(
                    poolDetailPool?.card_type ?? selectedPool?.card_type,
                  )
                }}
                · 抽取一次
                {{ poolDetailPool?.drawCosts?.once || selectedDrawCosts.once }}
                星穹币 · 连续十次
                {{ poolDetailPool?.drawCosts?.ten || selectedDrawCosts.ten }}
                星穹币
              </span>
            </div>
            <button class="modal-close" type="button" @click="closePoolDetail">
              关闭
            </button>
          </header>

          <div class="pool-detail-body">
            <div v-if="poolDetailLoading" class="empty-state">
              <LoaderCircle :size="30" class="spin" />
              <strong>正在同步图鉴</strong>
              <span>正在整理卡池内容。</span>
            </div>
            <div v-else-if="poolDetailError" class="empty-state">
              <Package :size="30" />
              <strong>图鉴加载失败</strong>
              <span>{{ poolDetailError }}</span>
            </div>
            <template v-else>
              <section class="pool-detail-section">
                <div class="section-title-row">
                  <div>
                    <p class="eyebrow">抽卡概率</p>
                    <h3>稀有度分布</h3>
                  </div>
                  <span class="type-pill"
                    >{{ poolDetailCatalogCards.length }} 张卡片</span
                  >
                </div>
                <div class="pool-probability-list">
                  <div
                    v-for="item in poolDetailProbabilityRows"
                    :key="item.rarity"
                    class="pool-probability-row"
                    :class="rarityClass(item.rarity)"
                  >
                    <span class="rarity-badge">{{ item.rarity }}</span>
                    <div class="probability-track">
                      <i :style="{ width: `${item.percent}%` }"></i>
                    </div>
                    <strong>{{ formatPercent(item.value) }}</strong>
                  </div>
                </div>
              </section>

              <section class="pool-detail-section">
                <div class="section-title-row">
                  <div>
                    <p class="eyebrow">卡池图鉴</p>
                    <h3>全部卡片</h3>
                  </div>
                  <span class="type-pill"
                    >{{ poolDetailCatalogCards.length }} 张</span
                  >
                </div>
                <div
                  v-if="poolDetailCards.length === 0"
                  class="empty-state compact"
                >
                  <Package :size="26" />
                  <strong>当前卡池暂无卡片</strong>
                  <span>暂无图鉴</span>
                </div>
                <div v-else class="pool-detail-card-grid">
                  <div
                    v-for="item in poolDetailCatalogCards"
                    :key="item.card.id"
                    class="pool-detail-card"
                  >
                    <div class="catalog-rarity-list">
                      <span
                        v-for="rarity in item.rarities"
                        :key="`${item.card.id}-${rarity}`"
                        class="rarity-badge"
                        :class="rarityClass(rarity)"
                      >
                        {{ rarity }}
                      </span>
                    </div>
                    <strong>{{ item.card.card_name }}</strong>
                    <p>{{ cardIntroText(item.card.card_desc) }}</p>
                    <div class="tag-row">
                      <span>{{ cardTypeLabel(item.card.card_type) }}</span>
                      <span>#{{ item.card.id }}</span>
                      <button
                        v-if="hasCardIntroDetail(item.card.card_desc)"
                        class="tag-action"
                        type="button"
                        @click="
                          openCardIntro({
                            name: item.card.card_name,
                            desc: item.card.card_desc,
                            type: cardTypeLabel(item.card.card_type),
                          })
                        "
                      >
                        详情
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </template>
          </div>
        </section>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="launchActivityModalOpen && launchActivityInfo"
        class="result-modal-backdrop"
        role="presentation"
        @click.self="closeLaunchActivityModal"
      >
        <section
          class="trade-listing-modal launch-activity-modal"
          role="dialog"
          aria-modal="true"
          aria-label="开服福利"
        >
          <header class="result-modal-head">
            <div>
              <p class="eyebrow">开服福利</p>
              <h2>{{ launchActivityInfo.name }}</h2>
              <span>
                {{ formatDate(launchActivityInfo.startsAt) }} 至
                {{ formatDate(launchActivityInfo.endsAt) }}
              </span>
            </div>
            <button
              class="modal-close"
              type="button"
              :disabled="busy.launchActivity"
              @click="closeLaunchActivityModal"
            >
              关闭
            </button>
          </header>
          <div class="trade-listing-body launch-activity-body">
            <p class="launch-activity-desc">
              {{
                launchActivityInfo.description || "登录后可领取一次开服福利。"
              }}
            </p>
            <div class="launch-reward-card">
              <span>本次奖励</span>
              <strong>{{ formatRewards(launchActivityInfo.rewards) }}</strong>
              <small>领取后会立即刷新星穹币和背包库存。</small>
            </div>
            <div class="launch-reward-grid">
              <article
                v-if="Number(launchActivityInfo.rewards.points || 0) > 0"
              >
                <span>星穹币</span>
                <strong>{{ launchActivityInfo.rewards.points }}</strong>
              </article>
              <article
                v-for="item in launchActivityInfo.rewards.items"
                :key="`${item.itemId}-${item.num}`"
              >
                <span>{{ item.itemName || `物品 ${item.itemId}` }}</span>
                <strong>x{{ item.num }}</strong>
              </article>
            </div>
          </div>
          <footer class="result-modal-actions">
            <button
              class="secondary-action"
              type="button"
              :disabled="busy.launchActivity"
              @click="closeLaunchActivityModal"
            >
              稍后领取
            </button>
            <button
              class="primary-action golden"
              type="button"
              :disabled="busy.launchActivity"
              @click="claimLaunchActivity"
            >
              <LoaderCircle
                v-if="busy.launchActivity"
                :size="18"
                class="spin"
              />
              <Gift v-else :size="18" />
              立即领取
            </button>
          </footer>
        </section>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="rechargeModalOpen"
        class="result-modal-backdrop"
        role="presentation"
        @click.self="closeRechargeModal"
      >
        <section
          class="trade-listing-modal recharge-modal"
          role="dialog"
          aria-modal="true"
          aria-label="星穹币充值"
        >
          <header class="result-modal-head">
            <div>
              <p class="eyebrow">星穹币充值</p>
              <h2>扣鱼排积分换星穹币</h2>
              <span>{{ rechargeRatioLabel }}</span>
            </div>
            <button
              class="modal-close"
              type="button"
              :disabled="busy.recharge"
              @click="closeRechargeModal"
            >
              关闭
            </button>
          </header>
          <div class="trade-listing-body recharge-modal-body">
            <label class="redeem-input">
              <span>扣除鱼排积分</span>
              <input
                v-model.number="rechargeAmount"
                type="number"
                :min="rechargeConfig?.minAmount || 1"
                :max="rechargeConfig?.maxAmount || 9999"
                step="1"
                placeholder="输入要扣除的鱼排积分"
                @keyup.enter="submitRecharge"
              />
            </label>
            <dl>
              <div>
                <dt>充值范围</dt>
                <dd>{{ rechargeRangeLabel }}</dd>
              </div>
              <div>
                <dt>将扣除鱼排积分</dt>
                <dd>{{ rechargeAmount || 0 }}</dd>
              </div>
              <div>
                <dt>到账星穹币</dt>
                <dd>{{ rechargeLocalAmount }}</dd>
              </div>
              <div>
                <dt>说明</dt>
                <dd>
                  充值成功后会刷新星穹币余额；重复提交同一请求不会重复入账。
                </dd>
              </div>
            </dl>
          </div>
          <footer class="result-modal-actions">
            <button
              class="secondary-action"
              type="button"
              :disabled="busy.recharge"
              @click="closeRechargeModal"
            >
              取消
            </button>
            <button
              class="primary-action"
              type="button"
              :disabled="busy.recharge"
              @click="submitRecharge"
            >
              <LoaderCircle v-if="busy.recharge" :size="18" class="spin" />
              <Coins v-else :size="18" />
              确认充值
            </button>
          </footer>
        </section>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="listingTarget"
        class="result-modal-backdrop"
        role="presentation"
        @click.self="closeTradeListingModal"
      >
        <section
          class="trade-listing-modal"
          role="dialog"
          aria-modal="true"
          aria-label="挂售卡片"
        >
          <header class="result-modal-head">
            <div>
              <p class="eyebrow">卡片挂售</p>
              <h2>{{ listingTarget.cardName }}</h2>
              <span>
                {{ listingTarget.cardLevel }} · 共
                {{ listingTarget.count || 1 }} 张 · 可售
                {{ listingTarget.sellableCount || 0 }} 张
              </span>
            </div>
            <button
              class="modal-close"
              type="button"
              @click="closeTradeListingModal"
            >
              关闭
            </button>
          </header>
          <div class="trade-listing-body">
            <label class="redeem-input">
              <span>挂售价格</span>
              <input
                v-model="listingPrice"
                type="number"
                :min="tradeConfig.minPrice"
                :max="tradeConfig.maxPrice"
                step="1"
                placeholder="输入星穹币价格"
              />
            </label>
            <dl>
              <div>
                <dt>价格范围</dt>
                <dd>{{ tradeConfig.minPrice }} - {{ tradeConfig.maxPrice }}</dd>
              </div>
              <div>
                <dt>手续费</dt>
                <dd>
                  {{ formatPercent(tradeConfig.feeRate) }} · 预计
                  {{ listingFeePreview.feeAmount }} 星穹币
                </dd>
              </div>
              <div>
                <dt>预计实收</dt>
                <dd>{{ listingFeePreview.sellerIncome }} 星穹币</dd>
              </div>
              <div>
                <dt>挂售数量</dt>
                <dd>本次挂售 1 张</dd>
              </div>
            </dl>
          </div>
          <footer class="result-modal-actions">
            <button
              class="secondary-action"
              type="button"
              @click="closeTradeListingModal"
            >
              取消
            </button>
            <button
              class="primary-action"
              type="button"
              :disabled="busy.trade || !tradeConfig.enabled"
              @click="createTradeListing"
            >
              确认挂售
            </button>
          </footer>
        </section>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="cardIntroTarget"
        class="result-modal-backdrop"
        role="presentation"
        @click.self="closeCardIntro"
      >
        <section
          class="trade-listing-modal card-intro-modal"
          role="dialog"
          aria-modal="true"
          aria-label="卡片介绍"
        >
          <header class="result-modal-head">
            <div>
              <p class="eyebrow">卡片介绍</p>
              <h2>{{ cardIntroTarget.name }}</h2>
              <span>
                {{
                  [cardIntroTarget.rarity, cardIntroTarget.type, cardIntroTarget.extra]
                    .filter(Boolean)
                    .join(" · ")
                }}
              </span>
            </div>
            <button class="modal-close" type="button" @click="closeCardIntro">
              关闭
            </button>
          </header>
          <div class="trade-listing-body card-intro-body">
            <p>{{ cardIntroTarget.desc }}</p>
          </div>
        </section>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="shareTextTarget"
        class="result-modal-backdrop share-modal-backdrop"
        role="presentation"
        @click.self="closeShareText"
      >
        <section
          class="trade-listing-modal share-text-modal"
          role="dialog"
          aria-modal="true"
          aria-label="分享文案"
        >
          <header class="result-modal-head">
            <div>
              <p class="eyebrow">分享</p>
              <h2>分享文案</h2>
            </div>
            <button class="modal-close" type="button" @click="closeShareText">
              关闭
            </button>
          </header>
          <div class="trade-listing-body">
            <textarea
              class="share-textarea"
              readonly
              :value="shareTextTarget"
            ></textarea>
          </div>
          <footer class="result-modal-actions">
            <button class="secondary-action" type="button" @click="closeShareText">
              关闭
            </button>
            <button class="primary-action" type="button" @click="copyShareText">
              复制
            </button>
          </footer>
        </section>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="resultModalOpen"
        class="result-modal-backdrop"
        role="presentation"
        @click.self="closeResultModal"
      >
        <section
          class="result-modal"
          role="dialog"
          aria-modal="true"
          aria-label="抽卡结果"
        >
          <header class="result-modal-head">
            <div>
              <p class="eyebrow">抽取结果</p>
              <h2>{{ resultModalTitle }}</h2>
              <span>{{ resultModalSubtitle }}</span>
            </div>
            <button
              class="modal-close"
              type="button"
              aria-label="关闭抽卡结果"
              @click="closeResultModal"
            >
              关闭
            </button>
          </header>

          <div class="result-modal-summary">
            <span
              v-for="rarity in rarityOrder"
              :key="rarity"
              :class="['summary-pill', rarityClass(rarity)]"
            >
              {{ rarity }} {{ resultSummary[rarity] }}
            </span>
          </div>

          <div
            v-if="lastResults.length"
            class="result-grid modal-result-grid"
            :class="{ single: lastResults.length === 1 }"
          >
            <article
              v-for="(card, index) in lastResults"
              :key="`${card.userCardUuid}-${index}`"
              class="result-card"
              :class="[
                rarityClass(card.rarity),
                { featured: lastResults.length === 1 },
              ]"
              :style="{ '--delay': `${Math.min(index * 42, 420)}ms` }"
            >
              <div class="card-face">
                <div class="result-card-top">
                  <span class="rarity-badge">{{ card.rarity }}</span>
                  <span class="card-type-pill">{{
                    cardTypeLabel(card.cardType)
                  }}</span>
                </div>
                <div class="card-sigil"></div>
                <div class="card-content">
                  <h3>{{ card.cardName }}</h3>
                  <p>{{ cardIntroText(card.cardDesc) }}</p>
                  <div class="tag-row">
                    <span v-if="card.isUp">UP</span>
                    <span v-if="card.isPity">保底</span>
                    <span>#{{ card.cardId }}</span>
                    <button
                      v-if="hasCardIntroDetail(card.cardDesc)"
                      class="tag-action"
                      type="button"
                      @click="
                        openCardIntro({
                          name: card.cardName,
                          desc: card.cardDesc,
                          rarity: card.rarity,
                          type: cardTypeLabel(card.cardType),
                        })
                      "
                    >
                      详情
                    </button>
                  </div>
                </div>
              </div>
            </article>
          </div>

          <footer class="result-modal-actions">
            <button
              class="secondary-action"
              type="button"
              @click="closeResultModal"
            >
              收起结果
            </button>
            <button
              class="primary-action"
              type="button"
              :disabled="busy.drawing"
              @click="performDraw('once')"
            >
              <Sparkles :size="18" />
              继续单抽
            </button>
            <button
              class="primary-action golden"
              type="button"
              :disabled="busy.drawing"
              @click="performDraw('ten')"
            >
              <Ticket :size="18" />
              再来十连
            </button>
          </footer>
        </section>
      </div>
    </Teleport>
  </div>
</template>
