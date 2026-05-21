<script setup lang="ts">
import {
  Boxes,
  ChevronLeft,
  ChevronRight,
  Gift,
  History,
  LoaderCircle,
  LogIn,
  LogOut,
  Package,
  RefreshCw,
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
  getApiBase,
  getStoredUser,
  getToken,
  request,
  setApiBase,
  setStoredUser,
  setToken,
  toQuery,
} from "./api";
import type {
  CardItem,
  CardRarity,
  ExchangeClaimResponse,
  ExchangeShopItem,
  GachaResult,
  InventoryItem,
  LeaderboardEntry,
  LeaderboardMetric,
  LeaderboardResponse,
  LoginResponse,
  LoginUrlResponse,
  PoolInfo,
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
  { key: "leaderboard", label: "排行", icon: Trophy },
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
const DRAW_RESULTS_KEY = "kesini_website_last_results";

const apiBase = ref(getApiBase());
const route = useRoute();
const manualToken = ref("");
const token = ref(getToken());
const currentUser = ref<UserProfile | null>(getStoredUser<UserProfile>());
const pools = ref<PoolInfo[]>([]);
const activePoolId = ref<number | null>(null);
const poolCards = ref<CardItem[]>([]);
const stats = ref<UserGachaStats | null>(null);
const userCards = ref<UserCardsResponse | null>(null);
const leaderboard = ref<LeaderboardResponse | null>(null);
const leaderboardError = ref("");
const activeLeaderboardMetric = ref<LeaderboardMetric>("totalCards");
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
const listingPrice = ref("");
const redeemCode = ref("");
const exchangeCounts = reactive<Record<number, number>>({});
const feedback = ref<{ type: FeedbackType; text: string } | null>(null);
const callbackBusy = ref(false);
const resultModalOpen = ref(false);
const drawPhase = ref<DrawPhase>("idle");

const busy = reactive({
  public: false,
  auth: false,
  drawing: false,
  assets: false,
  leaderboard: false,
  shop: false,
  redeem: false,
  trade: false,
});

let feedbackTimer: number | undefined;

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
  String(playerDisplayName.value || "?").trim().slice(0, 1).toUpperCase(),
);
const playerUidLabel = computed(() =>
  currentUser.value?.uid ? `UID ${currentUser.value.uid}` : "身份已验证",
);
const selectedPool = computed(() =>
  pools.value.find((pool) => pool.id === activePoolId.value),
);
const selectedDrawCosts = computed(
  () => selectedPool.value?.drawCosts || { once: 10, ten: 100 },
);
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
    leaderboardTabs.find((item) => item.key === activeLeaderboardMetric.value) ||
    leaderboardTabs[0],
);
const activeLeaderboardBoard = computed(
  () => leaderboard.value?.rankings[activeLeaderboardMetric.value] || null,
);
const podiumEntries = computed<LeaderboardEntry[]>(() =>
  activeLeaderboardBoard.value?.list.slice(0, 3) || [],
);
const leaderboardRows = computed<LeaderboardEntry[]>(() =>
  activeLeaderboardBoard.value?.list.slice(3) || [],
);
const totalPages = computed(() => userCards.value?.totalPages || 1);
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
  await loadPublicData();
  if (isAuthed.value) {
    await loadPrivateData();
  }
});

watch(activePoolId, async () => {
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

function saveApiBase() {
  setApiBase(apiBase.value);
  notify("success", "API 地址已保存");
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
    saveApiBase();
    const returnToUrl = new URL(window.location.href);
    returnToUrl.search = "";
    returnToUrl.hash = "";
    const data = await request<LoginUrlResponse>(
      `/apis/login-url${toQuery({
        returnTo: returnToUrl.toString(),
        realm: window.location.origin,
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
  leaderboard.value = null;
  leaderboardError.value = "";
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
    const list = await request<PoolInfo[]>("/card/pools");
    pools.value = list || [];
    if (!activePoolId.value && pools.value.length > 0) {
      activePoolId.value = pools.value[0].id;
    }
    await loadPoolCards();
  } catch (error) {
    notify("error", getErrorMessage(error));
  } finally {
    busy.public = false;
  }
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

async function loadPrivateData() {
  if (!isAuthed.value) {
    return;
  }
  const results = await Promise.allSettled([
    loadStats(),
    loadUserCards(),
    loadLeaderboard(),
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

async function loadUserCards() {
  if (!isAuthed.value) {
    return;
  }
  busy.assets = true;
  try {
    userCards.value = await request<UserCardsResponse>(
      `/card/user/cards${toQuery({
        rarity: rarityFilter.value,
        poolId: poolFilter.value,
        page: cardPage.value,
        pageSize: 12,
      })}`,
    );
  } finally {
    busy.assets = false;
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
  await Promise.all([loadTradeListings(), loadMyTradeListings(), loadTradeRecords()]);
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

async function decomposeCard(card: { uuid: string; cardName: string }) {
  if (!window.confirm(`分解后将移除「${card.cardName}」，确认继续吗？`)) {
    return;
  }
  busy.assets = true;
  try {
    await request("/card/decompose", {
      method: "POST",
      body: JSON.stringify({ card_uuid: card.uuid }),
    });
    notify("success", "分解成功，碎片已进入背包");
    await loadPrivateData();
  } catch (error) {
    notify("error", getErrorMessage(error));
  } finally {
    busy.assets = false;
  }
}

function openTradeListingModal(card: UserCardsResponse["list"][number]) {
  if (!isAuthed.value) {
    notify("error", "请先登录后再挂售卡片");
    return;
  }
  if (card.isListed) {
    notify("info", "这张卡片已经在交易中");
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
  const price = Number(listingPrice.value);
  if (!Number.isInteger(price)) {
    notify("error", "交易价格必须为整数");
    return;
  }
  busy.trade = true;
  try {
    await request("/trade/listings", {
      method: "POST",
      body: JSON.stringify({
        cardUuid: listingTarget.value.uuid,
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
      `确认花费 ${listing.price} 积分购买「${listing.cardName}」${listing.cardLevel} 吗？`,
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

function changeCardPage(delta: number) {
  const next = Math.min(Math.max(1, cardPage.value + delta), totalPages.value);
  if (next === cardPage.value) {
    return;
  }
  cardPage.value = next;
  void loadUserCards();
}

function changeTradePage(kind: "market" | "mine" | "records", delta: number) {
  if (kind === "market") {
    const next = Math.min(Math.max(1, tradePage.value + delta), tradeTotalPages.value);
    if (next !== tradePage.value) {
      tradePage.value = next;
      void loadTradeListings();
    }
    return;
  }
  if (kind === "mine") {
    const next = Math.min(Math.max(1, myTradePage.value + delta), myTradeTotalPages.value);
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

function resetCardFilters() {
  rarityFilter.value = "";
  poolFilter.value = "";
  cardPage.value = 1;
  void loadUserCards();
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
  return ["卡片碎片", "虚拟积分", "普通道具", "其他"][Number(type || 0)] || "物品";
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

function formatRewards(rewards?: { points?: number; items?: Array<{ itemName?: string; itemId: number; num: number }> }) {
  if (!rewards) {
    return "无奖励";
  }
  const parts = [];
  if (Number(rewards.points || 0) > 0) {
    parts.push(`${rewards.points} 积分`);
  }
  rewards.items?.forEach((item) => {
    parts.push(`${item.itemName || `物品 ${item.itemId}`} x${item.num}`);
  });
  return parts.length > 0 ? parts.join("，") : "无奖励";
}

function formatCosts(costs?: Array<{ itemName?: string; itemId: number; num: number }>) {
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
          <strong>Kesini 抽卡站</strong>
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
        <button class="icon-button" type="button" :disabled="busy.public || busy.assets || busy.leaderboard" @click="refreshAll">
          <RefreshCw :size="17" :class="{ spin: busy.public || busy.assets || busy.leaderboard }" />
          <span>刷新</span>
        </button>
        <button v-if="isAuthed" class="icon-button ghost" type="button" @click="logout">
          <LogOut :size="17" />
          <span>退出</span>
        </button>
      </div>
    </header>

    <main class="page">
      <section v-if="activeSection === 'draw'" class="hero-grid" data-section="draw">
        <div class="panel draw-panel">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">当前卡池</p>
              <h1>{{ selectedPool?.pool_name || "等待卡池同步" }}</h1>
            </div>
            <span class="type-pill">{{ poolTypeLabel(selectedPool?.card_type) }}</span>
          </div>

          <p class="pool-desc">
            {{ selectedPool?.card_desc || "选择一个卡池后即可开始抽取，所有概率与保底均由服务端控制。" }}
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
              <small>
                {{ poolTypeLabel(pool.card_type) }} · 单抽 {{ pool.drawCosts?.once || 10 }}
              </small>
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
                  <span>积分余额</span>
                  <strong>{{ isAuthed ? stats?.point ?? 0 : "未登录" }}</strong>
                </div>
                <div>
                  <span>单抽</span>
                  <strong>{{ selectedDrawCosts.once }} 积分</strong>
                </div>
                <div>
                  <span>十连</span>
                  <strong>{{ selectedDrawCosts.ten }} 积分</strong>
                </div>
              </div>
              <button class="primary-action" type="button" :disabled="busy.drawing" @click="performDraw('once')">
                <Sparkles :size="18" />
                单抽 · {{ selectedDrawCosts.once }}
              </button>
              <button class="primary-action golden" type="button" :disabled="busy.drawing" @click="performDraw('ten')">
                <Ticket :size="18" />
                十连 · {{ selectedDrawCosts.ten }}
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
              <img v-if="currentUser?.avatar" :src="currentUser.avatar" :alt="playerDisplayName" />
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
            <span>积分余额</span>
            <strong>{{ stats?.point || 0 }}</strong>
            <small>当前卡池 {{ selectedPool?.pool_name || "未选择" }}</small>
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
              <strong>{{ bestResult ? `${bestResult.rarity} · ${bestResult.cardName}` : "暂无抽卡结果" }}</strong>
            </div>
            <div>
              <span>服务连接</span>
              <strong>{{ apiBase }}</strong>
            </div>
          </div>

          <div class="connection-card" :class="{ compact: isAuthed }">
            <label>
              <span>{{ isAuthed ? "连接信息" : "API 地址" }}</span>
              <input v-model="apiBase" type="url" placeholder="http://localhost:3000" @blur="saveApiBase" />
            </label>
          </div>

          <div v-if="!isAuthed" class="login-stack">
            <button class="primary-action wide" type="button" :disabled="busy.auth || callbackBusy" @click="loginWithOpenId">
              <LoaderCircle v-if="busy.auth || callbackBusy" :size="18" class="spin" />
              <LogIn v-else :size="18" />
              使用 OpenID 登录
            </button>
            <label class="token-box debug-token-box">
              <span>本地调试 Token</span>
              <textarea v-model="manualToken" placeholder="粘贴玩家 JWT，仅保存在当前浏览器"></textarea>
            </label>
            <button class="secondary-action wide" type="button" @click="applyManualToken">
              <ShieldCheck :size="18" />
              使用 Token 进入
            </button>
          </div>
        </aside>
      </section>

      <section v-if="activeSection === 'bag'" class="collection-grid" data-section="bag">
        <div class="panel collection-panel">
          <div class="section-head">
            <div>
              <p class="eyebrow">玩家背包</p>
              <h2>卡片与物品</h2>
            </div>
            <div class="filter-row">
              <select v-model="rarityFilter" @change="cardPage = 1; loadUserCards()">
                <option value="">全部稀有度</option>
                <option v-for="rarity in rarityOrder" :key="rarity" :value="rarity">{{ rarity }}</option>
              </select>
              <select v-model="poolFilter" @change="cardPage = 1; loadUserCards()">
                <option value="">全部卡池</option>
                <option v-for="pool in pools" :key="pool.id" :value="pool.id">{{ pool.pool_name }}</option>
              </select>
              <button class="secondary-action" type="button" @click="resetCardFilters">重置</button>
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
            <article v-for="(card, index) in userCards.list" :key="card.uuid" class="result-card owned-card" :class="rarityClass(card.cardLevel)" :style="{ '--delay': `${Math.min(index * 24, 260)}ms` }">
              <div class="card-face">
                <div class="result-card-top">
                  <span class="rarity-badge">{{ card.cardLevel }}</span>
                  <span class="card-type-pill">{{ cardTypeLabel(card.cardType) }}</span>
                </div>
                <div class="card-sigil"></div>
                <div class="card-content">
                  <h3>{{ card.cardName }}</h3>
                  <p>{{ card.cardDesc || "暂无介绍" }}</p>
                  <div class="tag-row">
                    <span>{{ poolTypeLabel(pools.find((pool) => pool.id === card.poolId)?.card_type) }}</span>
                    <span>{{ formatDate(card.obtainedAt) }}</span>
                    <span v-if="card.isListed">交易中 · {{ card.tradePrice }}积分</span>
                  </div>
                </div>
              </div>
              <div class="card-actions">
                <button
                  class="secondary-action"
                  type="button"
                  :disabled="card.isListed || !card.canSell"
                  @click="openTradeListingModal(card)"
                >
                  {{ card.isListed ? '已挂售' : '挂售' }}
                </button>
                <button class="danger-action" type="button" :disabled="card.cardLevel === 'UR' || card.isListed" @click="decomposeCard(card)">
                  分解
                </button>
              </div>
            </article>
          </div>

          <div class="pager">
            <button type="button" :disabled="cardPage <= 1" @click="changeCardPage(-1)">
              <ChevronLeft :size="16" />
              上一页
            </button>
            <span>第 {{ cardPage }} / {{ totalPages }} 页</span>
            <button type="button" :disabled="cardPage >= totalPages" @click="changeCardPage(1)">
              下一页
              <ChevronRight :size="16" />
            </button>
          </div>
        </div>

        <aside class="panel inventory-panel">
          <div class="section-head">
            <div>
              <p class="eyebrow">背包</p>
              <h2>物品库存</h2>
            </div>
          </div>
          <div v-if="inventoryItems.length === 0" class="empty-mini">暂无背包物品</div>
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

      <section v-if="activeSection === 'synthesize'" class="panel catalog-panel synthesize-panel" data-section="synthesize">
        <div class="section-head">
          <div>
            <p class="eyebrow">碎片合成</p>
            <h2>选择目标卡片</h2>
          </div>
          <div class="filter-row">
            <select v-model="activePoolId">
              <option v-for="pool in pools" :key="pool.id" :value="pool.id">{{ pool.pool_name }}</option>
            </select>
            <select v-model="synthesisRarityFilter">
              <option value="">全部稀有度</option>
              <option v-for="rarity in rarityOrder" :key="rarity" :value="rarity">{{ rarity }}</option>
            </select>
            <button class="secondary-action" type="button" @click="synthesisRarityFilter = ''">
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
        <div v-else-if="filteredSynthesisCards.length === 0" class="empty-state">
          <Package :size="30" />
          <strong>暂无该稀有度版本</strong>
          <span>当前卡池没有 {{ synthesisRarityFilter }} 稀有度的可展示卡片。</span>
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
                <span class="card-type-pill">{{ cardTypeLabel(item.card.card_type) }}</span>
              </div>
              <div class="card-sigil"></div>
              <div class="card-content">
                <h3>{{ item.card.card_name }}</h3>
                <p>{{ item.card.card_desc || "暂无介绍" }}</p>
                <div class="tag-row">
                  <span>{{ item.costLabel }}</span>
                  <span>#{{ item.card.id }}</span>
                </div>
              </div>
            </div>
            <button
              class="secondary-action"
              type="button"
              :disabled="busy.assets || item.disabled"
              @click="synthesizeCard(item)"
            >
              {{ item.disabled ? '不可合成' : '碎片合成' }}
            </button>
          </article>
        </div>
      </section>

      <section v-if="activeSection === 'trade'" class="panel trade-panel" data-section="trade">
        <div class="section-head">
          <div>
            <p class="eyebrow">匿名交易</p>
            <h2>卡片交易市场</h2>
          </div>
          <button class="secondary-action" type="button" :disabled="busy.trade" @click="loadTradeData">
            <RefreshCw :size="16" :class="{ spin: busy.trade }" />
            刷新
          </button>
        </div>

        <div v-if="!isAuthed" class="empty-state">
          <Store :size="30" />
          <strong>登录后进入交易市场</strong>
          <span>市场匿名展示，成交后卡片 UUID 保持不变。</span>
        </div>
        <div v-else class="trade-content">
          <div class="trade-config-strip">
            <article>
              <small>交易状态</small>
              <strong>{{ tradeConfig.enabled ? '已开启' : '已关闭' }}</strong>
            </article>
            <article>
              <small>手续费</small>
              <strong>{{ formatPercent(tradeConfig.feeRate) }}</strong>
            </article>
            <article>
              <small>价格范围</small>
              <strong>{{ tradeConfig.minPrice }} - {{ tradeConfig.maxPrice }}</strong>
            </article>
            <article>
              <small>我的积分</small>
              <strong>{{ stats?.point || 0 }}</strong>
            </article>
          </div>

          <div class="trade-tabs" role="tablist" aria-label="交易分区">
            <button type="button" :class="{ active: tradeTab === 'market' }" @click="tradeTab = 'market'">市场</button>
            <button type="button" :class="{ active: tradeTab === 'mine' }" @click="tradeTab = 'mine'">我的挂售</button>
            <button type="button" :class="{ active: tradeTab === 'records' }" @click="tradeTab = 'records'">成交记录</button>
          </div>

          <div v-if="tradeTab === 'market'" class="trade-section">
            <div class="filter-row trade-filter-row">
              <select v-model="tradeRarityFilter" @change="tradePage = 1; loadTradeListings()">
                <option value="">全部稀有度</option>
                <option v-for="rarity in rarityOrder" :key="rarity" :value="rarity">{{ rarity }}</option>
              </select>
              <select v-model="tradePoolFilter" @change="tradePage = 1; loadTradeListings()">
                <option value="">全部卡池</option>
                <option v-for="pool in pools" :key="pool.id" :value="pool.id">{{ pool.pool_name }}</option>
              </select>
              <select v-model="tradeSort" @change="tradePage = 1; loadTradeListings()">
                <option value="newest">最新上架</option>
                <option value="priceAsc">价格从低到高</option>
                <option value="priceDesc">价格从高到低</option>
              </select>
              <input v-model="tradeMinPrice" type="number" min="0" placeholder="最低价" @change="tradePage = 1; loadTradeListings()" />
              <input v-model="tradeMaxPrice" type="number" min="0" placeholder="最高价" @change="tradePage = 1; loadTradeListings()" />
            </div>

            <div v-if="busy.trade && tradeListings.length === 0" class="skeleton-grid">
              <span v-for="item in 6" :key="item"></span>
            </div>
            <div v-else-if="tradeListings.length === 0" class="empty-state">
              <Store :size="30" />
              <strong>暂无在售卡片</strong>
              <span>可以从背包选择卡片挂售，市场不会展示卖家身份。</span>
            </div>
            <div v-else class="trade-grid">
              <article v-for="listing in tradeListings" :key="listing.id" class="trade-card" :class="rarityClass(listing.cardLevel)">
                <div class="trade-card-art">
                  <span class="rarity-badge">{{ listing.cardLevel }}</span>
                  <strong>{{ listing.cardName }}</strong>
                  <small>{{ listing.poolName || '未知卡池' }}</small>
                </div>
                <div class="trade-card-body">
                  <p>{{ listing.cardDesc || "暂无介绍" }}</p>
                  <dl>
                    <div>
                      <dt>价格</dt>
                      <dd>{{ listing.price }} 积分</dd>
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
                  <button class="primary-action wide" type="button" :disabled="busy.trade || listing.isMine || !tradeConfig.enabled" @click="buyTradeListing(listing)">
                    {{ listing.isMine ? '自己的挂单' : '购买' }}
                  </button>
                </div>
              </article>
            </div>
            <div class="pager">
              <button type="button" :disabled="tradePage <= 1" @click="changeTradePage('market', -1)">
                <ChevronLeft :size="16" />
                上一页
              </button>
              <span>第 {{ tradePage }} / {{ tradeTotalPages }} 页</span>
              <button type="button" :disabled="tradePage >= tradeTotalPages" @click="changeTradePage('market', 1)">
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
                  <strong>{{ listing.cardName }} · {{ listing.cardLevel }}</strong>
                  <span>{{ listing.cardUuid }} · {{ listing.poolName || '未知卡池' }}</span>
                </div>
                <b>{{ listing.price }} 积分</b>
                <span>{{ tradeStatusLabel(listing.status) }}</span>
                <button class="secondary-action" type="button" :disabled="busy.trade || listing.status !== 'active'" @click="cancelTradeListing(listing)">
                  取消挂售
                </button>
              </article>
            </div>
            <div class="pager">
              <button type="button" :disabled="myTradePage <= 1" @click="changeTradePage('mine', -1)">上一页</button>
              <span>第 {{ myTradePage }} / {{ myTradeTotalPages }} 页</span>
              <button type="button" :disabled="myTradePage >= myTradeTotalPages" @click="changeTradePage('mine', 1)">下一页</button>
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
                  <strong>{{ tradeRoleLabel(record.role) }} · {{ record.cardName }} · {{ record.cardLevel }}</strong>
                  <span>{{ record.cardUuid }} · {{ record.poolName || '未知卡池' }}</span>
                </div>
                <b>{{ record.price }} 积分</b>
                <span v-if="record.role === 'seller'">实收 {{ record.sellerIncome }}，手续费 {{ record.feeAmount }}</span>
                <span v-else>成交 {{ formatDate(record.createdAt) }}</span>
              </article>
            </div>
            <div class="pager">
              <button type="button" :disabled="tradeRecordPage <= 1" @click="changeTradePage('records', -1)">上一页</button>
              <span>第 {{ tradeRecordPage }} / {{ tradeRecordTotalPages }} 页</span>
              <button type="button" :disabled="tradeRecordPage >= tradeRecordTotalPages" @click="changeTradePage('records', 1)">下一页</button>
            </div>
          </div>
        </div>
      </section>

      <section v-if="activeSection === 'leaderboard'" class="panel leaderboard-panel" data-section="leaderboard">
        <div class="section-head">
          <div>
            <p class="eyebrow">玩家排行</p>
            <h2>收藏榜单</h2>
          </div>
          <button class="secondary-action" type="button" :disabled="busy.leaderboard" @click="loadLeaderboard">
            <RefreshCw :size="16" :class="{ spin: busy.leaderboard }" />
            刷新
          </button>
        </div>

        <div v-if="!isAuthed" class="empty-state">
          <Trophy :size="30" />
          <strong>登录后查看排行榜</strong>
          <span>排行榜按当前收藏统计，分解后的卡片不会计入排名。</span>
        </div>
        <div v-else-if="busy.leaderboard && !leaderboard" class="skeleton-grid leaderboard-skeleton">
          <span v-for="item in 6" :key="item"></span>
        </div>
        <div v-else-if="leaderboardError" class="empty-state">
          <Trophy :size="30" />
          <strong>排行榜加载失败</strong>
          <span>{{ leaderboardError }}</span>
          <button class="secondary-action" type="button" @click="loadLeaderboard">重新加载</button>
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
              <strong>{{ leaderboardRankLabel(activeLeaderboardBoard.me.rank) }}</strong>
            </div>
            <div>
              <small>{{ activeLeaderboardTab.label }}</small>
              <strong>{{ formatLeaderboardValue(activeLeaderboardBoard.me.value) }}</strong>
            </div>
            <span>{{ activeLeaderboardTab.hint }}</span>
          </div>

          <div v-if="!activeLeaderboardBoard?.list.length" class="empty-state">
            <Trophy :size="30" />
            <strong>暂无排行榜数据</strong>
            <span>玩家开始收集卡片后会在这里出现。</span>
          </div>
          <div v-else class="leaderboard-board">
            <div class="podium-grid">
              <article
                v-for="entry in podiumEntries"
                :key="`podium-${activeLeaderboardMetric}-${entry.uid}`"
                class="podium-card"
                :class="`rank-${entry.rank}`"
              >
                <span class="rank-badge">{{ leaderboardRankLabel(entry.rank) }}</span>
                <img v-if="entry.avatar" :src="entry.avatar" :alt="entry.nickname" />
                <span v-else class="avatar-fallback">{{ leaderboardInitial(entry) }}</span>
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
                <img v-if="entry.avatar" :src="entry.avatar" :alt="entry.nickname" />
                <span v-else class="avatar-fallback small">{{ leaderboardInitial(entry) }}</span>
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

      <section v-if="activeSection === 'redeem'" class="redeem-grid" data-section="redeem">
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
            <input v-model="redeemCode" type="text" placeholder="输入兑换码" @keyup.enter="claimRedeemCode" />
          </label>
          <button class="primary-action wide" type="button" :disabled="busy.redeem" @click="claimRedeemCode">
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
            <button class="secondary-action" type="button" :disabled="busy.shop" @click="loadExchangeItems">
              <RefreshCw :size="16" :class="{ spin: busy.shop }" />
              刷新
            </button>
          </div>

          <div v-if="!isAuthed" class="empty-state">
            <Store :size="30" />
            <strong>登录后查看商店</strong>
            <span>兑换商店会根据你的背包数量显示可兑换状态。</span>
          </div>
          <div v-else-if="busy.shop && exchangeItems.length === 0" class="skeleton-grid">
            <span v-for="item in 4" :key="item"></span>
          </div>
          <div v-else-if="exchangeItems.length === 0" class="empty-state">
            <Store :size="30" />
            <strong>暂无可见兑换项</strong>
            <span>后台启用兑换项后会出现在这里。</span>
          </div>
          <div v-else class="shop-grid">
            <article v-for="item in exchangeItems" :key="item.id" class="shop-card">
              <div class="shop-card-head">
                <div>
                  <h3>{{ item.name }}</h3>
                  <p>{{ item.description || "暂无说明" }}</p>
                </div>
                <span>{{ item.remaining === null || item.remaining === undefined ? "不限库存" : `剩余 ${item.remaining}` }}</span>
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
                  <dd>{{ item.user_limit ? `${item.usedByUser || 0}/${item.user_limit}` : "不限" }}</dd>
                </div>
                <div>
                  <dt>时间</dt>
                  <dd>{{ formatDate(item.starts_at) }} 至 {{ formatDate(item.ends_at) }}</dd>
                </div>
              </dl>
              <div class="shop-actions">
                <input v-model.number="exchangeCounts[item.id]" type="number" min="1" max="99" placeholder="1" />
                <button
                  class="primary-action"
                  type="button"
                  :disabled="busy.shop || item.canExchange === false"
                  @click="claimExchange(item)"
                >
                  {{ item.canExchange === false ? item.unavailableReason || "不可兑换" : "兑换" }}
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
        <div v-if="!stats?.recentDraws?.length" class="empty-mini">暂无最近抽卡记录</div>
        <div v-else class="recent-list">
          <article v-for="(record, index) in stats.recentDraws" :key="`${record.createdAt}-${index}`">
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

    <Teleport to="body">
      <div
        v-if="listingTarget"
        class="result-modal-backdrop"
        role="presentation"
        @click.self="closeTradeListingModal"
      >
        <section class="trade-listing-modal" role="dialog" aria-modal="true" aria-label="挂售卡片">
          <header class="result-modal-head">
            <div>
              <p class="eyebrow">卡片挂售</p>
              <h2>{{ listingTarget.cardName }}</h2>
              <span>{{ listingTarget.cardLevel }} · UUID {{ listingTarget.uuid }}</span>
            </div>
            <button class="modal-close" type="button" @click="closeTradeListingModal">关闭</button>
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
                placeholder="输入积分价格"
              />
            </label>
            <dl>
              <div>
                <dt>价格范围</dt>
                <dd>{{ tradeConfig.minPrice }} - {{ tradeConfig.maxPrice }}</dd>
              </div>
              <div>
                <dt>手续费</dt>
                <dd>{{ formatPercent(tradeConfig.feeRate) }} · 预计 {{ listingFeePreview.feeAmount }} 积分</dd>
              </div>
              <div>
                <dt>预计实收</dt>
                <dd>{{ listingFeePreview.sellerIncome }} 积分</dd>
              </div>
              <div>
                <dt>交易说明</dt>
                <dd>挂售后卡片会被锁定，取消或成交前不能分解。</dd>
              </div>
            </dl>
          </div>
          <footer class="result-modal-actions">
            <button class="secondary-action" type="button" @click="closeTradeListingModal">取消</button>
            <button class="primary-action" type="button" :disabled="busy.trade || !tradeConfig.enabled" @click="createTradeListing">
              确认挂售
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
            <button class="modal-close" type="button" aria-label="关闭抽卡结果" @click="closeResultModal">
              关闭
            </button>
          </header>

          <div class="result-modal-summary">
            <span v-for="rarity in rarityOrder" :key="rarity" :class="['summary-pill', rarityClass(rarity)]">
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
              :class="[rarityClass(card.rarity), { featured: lastResults.length === 1 }]"
              :style="{ '--delay': `${Math.min(index * 42, 420)}ms` }"
            >
              <div class="card-face">
                <div class="result-card-top">
                  <span class="rarity-badge">{{ card.rarity }}</span>
                  <span class="card-type-pill">{{ cardTypeLabel(card.cardType) }}</span>
                </div>
                <div class="card-sigil"></div>
                <div class="card-content">
                  <h3>{{ card.cardName }}</h3>
                  <p>{{ card.cardDesc || "暂无卡片介绍" }}</p>
                  <div class="tag-row">
                    <span v-if="card.isUp">UP</span>
                    <span v-if="card.isPity">保底</span>
                    <span>#{{ card.cardId }}</span>
                  </div>
                </div>
              </div>
            </article>
          </div>

          <footer class="result-modal-actions">
            <button class="secondary-action" type="button" @click="closeResultModal">
              收起结果
            </button>
            <button class="primary-action" type="button" :disabled="busy.drawing" @click="performDraw('once')">
              <Sparkles :size="18" />
              继续单抽
            </button>
            <button class="primary-action golden" type="button" :disabled="busy.drawing" @click="performDraw('ten')">
              <Ticket :size="18" />
              再来十连
            </button>
          </footer>
        </section>
      </div>
    </Teleport>
  </div>
</template>
