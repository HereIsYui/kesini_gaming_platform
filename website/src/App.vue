<script setup lang="ts">
import {
  Boxes,
  CalendarCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Coins,
  Gift,
  History,
  ListChecks,
  Lock,
  LoaderCircle,
  LogIn,
  LogOut,
  Moon,
  Package,
  Recycle,
  RefreshCw,
  Share2,
  ShieldCheck,
  Sparkles,
  Store,
  Sun,
  Swords,
  Ticket,
  Trophy,
  Unlock,
  UserRound,
  UsersRound,
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
  setStoredUser,
  setToken,
  toQuery,
} from "./api";
import type {
  CardItem,
  CardRarity,
  DailySignInClaimResponse,
  DailySignInStatus,
  TaskActivityMilestone,
  TaskClaimResponse,
  TaskItem,
  TaskOverview,
  TaskScope,
  TaskScopeOverview,
  AchievementListResponse,
  AchievementNotification,
  AchievementRecord,
  BulkDecomposeResponse,
  CardUpgradePreview,
  CardUpgradeResponse,
  DrawHistoryRecord,
  DrawHistoryResponse,
  ExchangeClaimResponse,
  ExchangeShopItem,
  FishpiPointResponse,
  FriendRelationRecord,
  FriendsOverviewResponse,
  FormationOverview,
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
  PveChallengeRecord,
  PveChallengeResult,
  PveOverview,
  PveRecordsResponse,
  PveStage,
  PlayerProfileResponse,
  SaveShowcaseRequest,
  SendFriendRequestRequest,
  SiteConfig,
  ShopRecycleCardsResponse,
  ShopRecycleConfig,
  LoginResponse,
  LoginUrlResponse,
  PoolInfo,
  RechargeConfig,
  RechargePointsResponse,
  RedeemClaimResponse,
  SeasonOverview,
  SeasonPointRecord,
  SeasonShopBuyResponse,
  SeasonShopItem,
  SocialActivityFeedResponse,
  SocialActivityRecord,
  TradeConfig,
  TradeListing,
  TradePageResponse,
  TradeRecord,
  UserCatalogItem,
  UserCatalogResponse,
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
  { key: "profile", label: "主页", icon: UserRound },
  { key: "friends", label: "好友", icon: UsersRound },
  { key: "bag", label: "背包", icon: Boxes },
  { key: "formation", label: "阵容", icon: Swords },
  { key: "pve", label: "关卡", icon: Trophy },
  { key: "synthesize", label: "图鉴", icon: Package },
  { key: "points", label: "星穹币", icon: Coins },
  { key: "leaderboard", label: "排行", icon: Trophy },
  { key: "tasks", label: "任务", icon: ListChecks },
  { key: "season", label: "赛季", icon: CalendarDays },
  { key: "achievements", label: "成就", icon: ShieldCheck },
  { key: "trade", label: "交易", icon: Store },
  { key: "redeem", label: "兑换", icon: Gift },
] as const;

type SectionItem = (typeof sectionItems)[number];
type SectionKey = (typeof sectionItems)[number]["key"];

const sectionItemMap = new Map<SectionKey, SectionItem>(
  sectionItems.map((item) => [item.key, item]),
);

const primaryNavSectionKeys = [
  "draw",
  "pve",
  "synthesize",
  "season",
  "leaderboard",
] as const satisfies readonly SectionKey[];

const primaryNavItems = primaryNavSectionKeys
  .map((key) => sectionItemMap.get(key))
  .filter((item): item is SectionItem => Boolean(item));

const accountMenuSectionKeys = [
  "profile",
  "friends",
  "bag",
  "formation",
  "tasks",
  "achievements",
  "points",
  "trade",
  "redeem",
] as const satisfies readonly SectionKey[];

const accountMenuItems = accountMenuSectionKeys
  .map((key) => sectionItemMap.get(key))
  .filter((item): item is SectionItem => Boolean(item));

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

type FeedbackType = "success" | "error" | "info";
type DrawPhase = "idle" | "charging" | "burst";
type ThemeMode = "dark" | "light";
type CatalogCard = UserCatalogItem & {
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
const THEME_KEY = "kesini_website_theme";
const BAG_PAGE_SIZE = 24;
const CARD_DESC_DETAIL_THRESHOLD = 34;

const route = useRoute();
const themeMode = ref<ThemeMode>(getStoredThemeMode());
const userMenuOpen = ref(false);
const userMenuHoverPaused = ref(false);
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
const catalogItems = ref<UserCatalogResponse | null>(null);
const catalogError = ref("");
const poolDetailOpen = ref(false);
const poolDetailLoading = ref(false);
const poolDetailError = ref("");
const poolDetailPool = ref<PoolInfo | null>(null);
const poolDetailCards = ref<CardItem[]>([]);
const stats = ref<UserGachaStats | null>(null);
const fishpiPoint = ref<FishpiPointResponse | null>(null);
const fishpiPointError = ref("");
const drawHistory = ref<DrawHistoryResponse | null>(null);
const drawHistoryOpen = ref(false);
const drawHistoryPage = ref(1);
const userCards = ref<UserCardsResponse | null>(null);
const playerProfile = ref<PlayerProfileResponse | null>(null);
const profileCandidates = ref<UserCardsResponse["list"]>([]);
const profilePickerOpen = ref(false);
const profileSelectedUuids = ref<string[]>([]);
const friendsOverview = ref<FriendsOverviewResponse | null>(null);
const friendsError = ref("");
const friendFeed = ref<SocialActivityRecord[]>([]);
const friendFeedError = ref("");
const friendTargetUid = ref("");
const friendActionBusy = ref("");
const formation = ref<FormationOverview | null>(null);
const formationCandidates = ref<UserCardsResponse["list"]>([]);
const formationPickerOpen = ref(false);
const formationEditingPosition = ref<number | null>(null);
const pveOverview = ref<PveOverview | null>(null);
const pveRecords = ref<PveRecordsResponse | null>(null);
const pveRecordPage = ref(1);
const pveRecordTotalPages = ref(1);
const rechargeConfig = ref<RechargeConfig | null>(null);
const launchActivity = ref<LaunchActivityCurrentResponse | null>(null);
const dailySignIn = ref<DailySignInStatus | null>(null);
const tasksOverview = ref<TaskOverview | null>(null);
const taskScope = ref<TaskScope>("daily");
const seasonOverview = ref<SeasonOverview | null>(null);
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
const seasonShopCounts = reactive<Record<number, number>>({});
const tradeListings = ref<TradeListing[]>([]);
const myTradeListings = ref<TradeListing[]>([]);
const tradeRecords = ref<TradeRecord[]>([]);
const tradeConfig = ref<TradeConfig>({
  enabled: true,
  feeRate: 0,
  minPrice: 1,
  maxPrice: 999999,
});
const shopRecycleConfig = ref<ShopRecycleConfig>({
  enabled: true,
  priceN: 1,
  priceR: 2,
  priceSR: 5,
  priceSSR: 15,
  priceUR: 50,
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
const recycleTarget = ref<UserCardsResponse["list"][number] | null>(null);
const upgradeTarget = ref<UserCardsResponse["list"][number] | null>(null);
const upgradePreview = ref<CardUpgradePreview | null>(null);
const cardIntroTarget = ref<CardIntroTarget | null>(null);
const shareTextTarget = ref("");
const activeBagActionKey = ref("");
const listingPrice = ref("");
const recycleCount = ref(1);
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
  fishpiPoint: false,
  assets: false,
  profile: false,
  profileCandidates: false,
  profileSaving: false,
  friends: false,
  friendFeed: false,
  cardsMore: false,
  leaderboard: false,
  points: false,
  catalog: false,
  shop: false,
  redeem: false,
  tasks: false,
  claimTask: false,
  season: false,
  seasonShop: false,
  achievements: false,
  trade: false,
  recycle: false,
  upgrade: false,
  formation: false,
  formationCandidates: false,
  pve: false,
  pveChallenge: false,
  pveRecords: false,
  recharge: false,
  bulkDecompose: false,
  bulkDecomposePreview: false,
  drawHistory: false,
  launchActivity: false,
  signIn: false,
});

let feedbackTimer: number | undefined;
const achievementToastTimers = new Map<number, number>();

const isAuthed = computed(() => Boolean(token.value));
const activeSection = computed<SectionKey>(() => {
  if (route.name === "publicProfile") {
    return "profile";
  }
  return sectionItems.some((item) => item.key === route.name)
    ? (route.name as SectionKey)
    : "draw";
});
const isPublicProfileRoute = computed(() => route.name === "publicProfile");
const profileRouteUid = computed(() =>
  isPublicProfileRoute.value ? String(route.params.uid || "").trim() : "",
);
const profileDisplayName = computed(
  () =>
    publicPlayerName(
      playerProfile.value?.user.nickname,
      playerProfile.value?.user.uid,
      "玩家主页",
    ),
);
const profileInitial = computed(() =>
  String(profileDisplayName.value || "?")
    .trim()
    .slice(0, 1)
    .toUpperCase(),
);
const profileCanEdit = computed(
  () =>
    Boolean(isAuthed.value) &&
    Boolean(currentUser.value?.uid) &&
    playerProfile.value?.user.uid === currentUser.value?.uid,
);
const profileShareUrl = computed(() => {
  const uid = playerProfile.value?.user.uid || currentUser.value?.uid || "";
  return uid ? `${window.location.origin}/u/${encodeURIComponent(uid)}` : "";
});
const playerDisplayName = computed(
  () => {
    const uid = currentUser.value?.uid;
    return publicPlayerName(
      currentUser.value?.nickname,
      uid,
      publicPlayerName(currentUser.value?.name, uid, "已登录玩家"),
    );
  },
);
const playerInitial = computed(() =>
  String(playerDisplayName.value || "?")
    .trim()
    .slice(0, 1)
    .toUpperCase(),
);
const playerStatusLabel = computed(() => "身份已验证");
const fishpiPointLabel = computed(() => {
  if (busy.fishpiPoint && !fishpiPoint.value) {
    return "同步中";
  }
  if (fishpiPoint.value) {
    return String(Math.floor(fishpiPoint.value.point));
  }
  if (fishpiPointError.value) {
    return "未同步";
  }
  return "--";
});
const profileCardCountRows = computed(() =>
  rarityOrder.map((rarity) => ({
    rarity,
    count: playerProfile.value?.user.cardCounts?.[rarity] || 0,
  })),
);
const profileShowcase = computed(() => playerProfile.value?.showcase || []);
const profileFormation = computed(
  () =>
    playerProfile.value?.formation || {
      slotCount: 3,
      filledCount: 0,
      totalPower: 0,
    },
);
const profileSelectedSet = computed(() => new Set(profileSelectedUuids.value));
const friendRows = computed(() => friendsOverview.value?.friends || []);
const incomingFriendRequests = computed(
  () => friendsOverview.value?.incoming || [],
);
const outgoingFriendRequests = computed(
  () => friendsOverview.value?.outgoing || [],
);
const profileFriendRelation = computed<FriendRelationRecord | null>(() => {
  const uid = playerProfile.value?.user.uid;
  if (!uid) {
    return null;
  }
  return (
    friendRows.value.find((item) => item.user.uid === uid) ||
    incomingFriendRequests.value.find((item) => item.user.uid === uid) ||
    outgoingFriendRequests.value.find((item) => item.user.uid === uid) ||
    null
  );
});
const isProfileFriendIncoming = computed(() =>
  incomingFriendRequests.value.some(
    (item) => item.id === profileFriendRelation.value?.id,
  ),
);
const isProfileFriendOutgoing = computed(() =>
  outgoingFriendRequests.value.some(
    (item) => item.id === profileFriendRelation.value?.id,
  ),
);
const showProfileFriendAction = computed(
  () =>
    Boolean(isAuthed.value) &&
    Boolean(isPublicProfileRoute.value) &&
    Boolean(playerProfile.value?.user.uid) &&
    playerProfile.value?.user.uid !== currentUser.value?.uid,
);
const profileFriendActionLabel = computed(() => {
  const relation = profileFriendRelation.value;
  if (relation?.status === "accepted") {
    return "已添加";
  }
  if (relation?.status === "pending") {
    return isProfileFriendOutgoing.value ? "已申请" : "通过";
  }
  return "添加";
});
const profileFriendStatusLabel = computed(() => {
  if (!showProfileFriendAction.value) {
    return "";
  }
  if (friendsError.value && !friendsOverview.value) {
    return "";
  }
  if (busy.friends && !friendsOverview.value) {
    return "读取中";
  }
  const relation = profileFriendRelation.value;
  if (relation?.status === "accepted") {
    return "好友";
  }
  if (relation?.status === "pending") {
    return isProfileFriendIncoming.value ? "待通过" : "已申请";
  }
  return "未添加";
});
const profileFriendActionDisabled = computed(() => {
  const relation = profileFriendRelation.value;
  return (
    busy.friends ||
    friendActionBusy.value !== "" ||
    relation?.status === "accepted" ||
    isProfileFriendOutgoing.value
  );
});

function toggleUserMenu() {
  userMenuHoverPaused.value = false;
  userMenuOpen.value = !userMenuOpen.value;
}

function closeUserMenu(event?: Event) {
  userMenuOpen.value = false;
  userMenuHoverPaused.value = true;
  if (event?.currentTarget instanceof HTMLElement) {
    event.currentTarget.blur();
  }
}

function resetUserMenuHover() {
  userMenuHoverPaused.value = false;
}

const launchActivityInfo = computed(
  () => launchActivity.value?.activity || null,
);
const hasLaunchActivityReward = computed(
  () =>
    Boolean(isAuthed.value) &&
    launchActivity.value?.available === true &&
    Boolean(launchActivityInfo.value),
);
const dailySignInWeek = computed(
  () =>
    dailySignIn.value?.week ||
    Array.from({ length: 7 }, (_, index) => ({
      day: index + 1,
      rewardPoints: index === 6 ? 100 : 10,
      signed: false,
      current: index === 0,
    })),
);
const dailySignInCycleDay = computed(() => dailySignIn.value?.cycleDay || 1);
const dailySignInRewardPoints = computed(
  () => dailySignIn.value?.rewardPoints || 10,
);
const activeTaskOverview = computed<TaskScopeOverview | null>(() =>
  tasksOverview.value ? tasksOverview.value[taskScope.value] : null,
);
const activeTaskList = computed<TaskItem[]>(
  () => activeTaskOverview.value?.tasks || [],
);
const activeTaskMilestones = computed<TaskActivityMilestone[]>(
  () => activeTaskOverview.value?.milestones || [],
);
const taskCompletedCount = computed(
  () => activeTaskList.value.filter((task) => task.completed).length,
);
const taskClaimedCount = computed(
  () => activeTaskList.value.filter((task) => task.claimed).length,
);
const taskActivityPercent = computed(() => {
  const overview = activeTaskOverview.value;
  if (!overview?.maxActivity) {
    return 0;
  }
  return Math.max(
    0,
    Math.min(100, Math.round((overview.activity / overview.maxActivity) * 100)),
  );
});
const activeSeason = computed(() => seasonOverview.value?.season || null);
const seasonPoints = computed(
  () => seasonOverview.value?.points || { earned: 0, balance: 0 },
);
const seasonShopItems = computed<SeasonShopItem[]>(
  () => seasonOverview.value?.shopItems || [],
);
const seasonPointRecords = computed<SeasonPointRecord[]>(
  () => seasonOverview.value?.records || [],
);
const seasonLeaderboard = computed(
  () => seasonOverview.value?.leaderboard || { list: [], me: null },
);
const seasonLeaderboardRows = computed<LeaderboardEntry[]>(
  () => seasonLeaderboard.value.list || [],
);
const seasonRankText = computed(() =>
  seasonLeaderboard.value.me?.rank
    ? `第 ${seasonLeaderboard.value.me.rank} 名`
    : "暂未上榜",
);
const selectedPool = computed(() =>
  pools.value.find((pool) => pool.id === activePoolId.value),
);
const selectedDrawCosts = computed(
  () => selectedPool.value?.drawCosts || { once: 10, ten: 100 },
);
const selectedPoolPity = computed(() => getPityForPool(activePoolId.value));
const selectedHardPity = computed(
  () => selectedPoolPity.value?.hard || selectedPoolPity.value?.soft || null,
);
const selectedPityPercent = computed(() => {
  const rule = selectedHardPity.value;
  if (!rule?.count) {
    return 0;
  }
  return Math.max(
    0,
    Math.min(100, Math.round((Number(rule.current || 0) / rule.count) * 100)),
  );
});
const selectedPityText = computed(() => {
  const rule = selectedHardPity.value;
  if (!rule) {
    return "当前卡池暂无保底进度";
  }
  const label = selectedPoolPity.value?.hard ? "硬保底" : "保底";
  return `距离${label} ${rule.guaranteedRarity} 还 ${rule.remaining} 抽`;
});
const poolDetailPity = computed(() =>
  getPityForPool(poolDetailPool.value?.id || activePoolId.value),
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
const localCatalogCards = computed<CatalogCard[]>(() =>
  poolCards.value.flatMap((card) =>
    parseCardRarities(card.card_level).map((rarity) => ({
      key: `${card.id}-${rarity}`,
      card,
      rarity,
      collected: false,
      ownedCount: 0,
      requiredFragments:
        rarity === "UR" ? 0 : requiredFragmentsForRarity(rarity),
      fragmentCount: 0,
      canSynthesize: false,
      costLabel: synthesisCostLabel(rarity),
      disabled: rarity === "UR",
    })),
  ),
);
const catalogCards = computed<CatalogCard[]>(() => {
  if (
    isAuthed.value &&
    catalogItems.value &&
    catalogItems.value.poolId === activePoolId.value
  ) {
    return catalogItems.value.list.map((item) => ({
      ...item,
      costLabel: synthesisCostLabel(item.rarity),
      disabled: item.collected || !item.canSynthesize,
    }));
  }
  return localCatalogCards.value;
});
const filteredSynthesisCards = computed<CatalogCard[]>(() => {
  if (!synthesisRarityFilter.value) {
    return catalogCards.value;
  }
  return catalogCards.value.filter(
    (item) => item.rarity === synthesisRarityFilter.value,
  );
});
const synthesisAvailableCount = computed(
  () =>
    filteredSynthesisCards.value.filter((item) => item.canSynthesize).length,
);
const catalogCollectedCount = computed(
  () => catalogCards.value.filter((item) => item.collected).length,
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
    new Set(
      achievements.value.map((achievement) => achievement.category || "常规"),
    ),
  ),
);
const filteredAchievements = computed(() => {
  const keyword = achievementKeyword.value.trim().toLowerCase();
  return achievements.value.filter((achievement) => {
    if (achievementStatusFilter.value === "achieved" && !achievement.achieved) {
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
const achievementVisibleCount = computed(
  () => filteredAchievements.value.length,
);
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
  { value: "daily_sign_in", label: "每日签到" },
  { value: "exchange_shop", label: "兑换商店" },
  { value: "achievement", label: "成就奖励" },
  { value: "task", label: "任务奖励" },
  { value: "pve", label: "关卡奖励" },
  { value: "trade_buy", label: "交易购买" },
  { value: "trade_sell", label: "交易出售" },
  { value: "shop_recycle", label: "商店回收" },
  { value: "season_shop", label: "赛季商店" },
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
const drawHistoryRows = computed<DrawHistoryRecord[]>(
  () => drawHistory.value?.list || [],
);
const drawHistoryTotalPages = computed(
  () => drawHistory.value?.totalPages || 1,
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
const recycleAvailableCount = computed(() => {
  if (!recycleTarget.value) {
    return 0;
  }
  return Math.max(0, Number(recycleTarget.value.sellableCount || 0) - 1);
});
const recycleUnitPrice = computed(() =>
  getRecyclePrice(recycleTarget.value?.cardLevel || ""),
);
const recycleTotalPoints = computed(
  () => Math.max(0, Number(recycleCount.value || 0)) * recycleUnitPrice.value,
);
const upgradePowerGain = computed(() => {
  const preview = upgradePreview.value;
  if (!preview?.next) {
    return 0;
  }
  return Math.max(0, preview.next.power - preview.current.power);
});
const formationSlots = computed(() => {
  const slotCount = formation.value?.slotCount || 3;
  return Array.from({ length: slotCount }, (_, index) => {
    const position = index + 1;
    return (
      formation.value?.slots.find((slot) => slot.position === position) || {
        position,
        card: null,
      }
    );
  });
});
const formationFilledCount = computed(
  () => formationSlots.value.filter((slot) => slot.card).length,
);
const formationCurrentUuids = computed(
  () =>
    new Set(
      formationSlots.value
        .map((slot) => slot.card?.uuid)
        .filter((uuid): uuid is string => Boolean(uuid)),
    ),
);
const formationEditingSlot = computed(() =>
  formationSlots.value.find(
    (slot) => slot.position === formationEditingPosition.value,
  ),
);
const pveStages = computed<PveStage[]>(() => pveOverview.value?.list || []);
const pveFormation = computed(
  () =>
    pveOverview.value?.formation || {
      slotCount: formation.value?.slotCount || 3,
      filledCount: formationFilledCount.value,
      totalPower: formation.value?.totalPower || 0,
    },
);
const pveRecentRecords = computed<PveChallengeRecord[]>(
  () => pveRecords.value?.list || [],
);
const pveClearedCount = computed(
  () => pveRecentRecords.value.filter((record) => record.success).length,
);
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

function getStoredThemeMode(): ThemeMode {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === "light" ? "light" : "dark";
}

function toggleThemeMode() {
  themeMode.value = themeMode.value === "dark" ? "light" : "dark";
}

onMounted(async () => {
  await handleOpenIdCallback();
  await loadSiteConfig();
  await loadPublicData();
  if (isAuthed.value) {
    await loadPrivateData();
  }
  if (activeSection.value === "profile") {
    await loadPlayerProfile();
  }
});

watch(
  themeMode,
  (mode) => {
    document.documentElement.dataset.theme = mode;
    localStorage.setItem(THEME_KEY, mode);
  },
  { immediate: true },
);

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
  await loadUserCatalog();
});

watch(activeSection, async (section) => {
  userMenuOpen.value = false;
  if (section === "profile") {
    await loadPlayerProfile();
    if (isAuthed.value) {
      await loadFriends(false);
    }
  }
  if (section === "friends" && isAuthed.value) {
    await refreshFriendsSection();
  }
  if (section === "synthesize") {
    await loadUserCatalog();
  }
  if (section === "tasks" && isAuthed.value) {
    await loadTasks();
  }
  if (section === "season" && isAuthed.value) {
    await loadSeasonOverview();
  }
  if (section === "formation" && isAuthed.value) {
    await loadFormation();
  }
  if (section === "pve" && isAuthed.value) {
    await Promise.all([loadPveStages(), loadPveRecords()]);
  }
});

watch(
  () => [route.name, String(route.params.uid || ""), token.value],
  async () => {
    if (activeSection.value === "profile") {
      await loadPlayerProfile();
      if (isAuthed.value) {
        await loadFriends(false);
      }
    }
  },
);

function notify(type: FeedbackType, text: string) {
  feedback.value = { type, text };
  window.clearTimeout(feedbackTimer);
  feedbackTimer = window.setTimeout(() => {
    feedback.value = null;
  }, 4200);
}

function publicPlayerName(
  name?: string | null,
  uid?: string | null,
  fallback = "玩家",
) {
  const value = String(name || "").trim();
  const rawUid = String(uid || "").trim();
  return value && value !== rawUid ? value : fallback;
}

function activityUserName(activity: SocialActivityRecord) {
  return publicPlayerName(activity.user.nickname, activity.user.uid);
}

function activityInitial(activity: SocialActivityRecord) {
  return activityUserName(activity).slice(0, 1).toUpperCase();
}

function shortActivityText(value?: string | null) {
  const text = String(value || "").trim();
  return text.length > 15 ? `${text.slice(0, 15)}…` : text;
}

function activityLine(activity: SocialActivityRecord) {
  const summary = shortActivityText(activity.summary);
  return summary ? `${activity.title} · ${summary}` : activity.title;
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
    notify("error", "请输入临时凭证");
    return;
  }
  setToken(value);
  token.value = value;
  currentUser.value = null;
  notify("info", "正在加载资产");
  await loadPrivateData();
  userMenuOpen.value = false;
}

function logout() {
  userMenuOpen.value = false;
  clearToken();
  token.value = "";
  currentUser.value = null;
  stats.value = null;
  fishpiPoint.value = null;
  fishpiPointError.value = "";
  drawHistory.value = null;
  drawHistoryOpen.value = false;
  drawHistoryPage.value = 1;
  userCards.value = null;
  playerProfile.value = null;
  profileCandidates.value = [];
  profilePickerOpen.value = false;
  profileSelectedUuids.value = [];
  friendsOverview.value = null;
  friendsError.value = "";
  friendFeed.value = [];
  friendFeedError.value = "";
  friendTargetUid.value = "";
  friendActionBusy.value = "";
  formation.value = null;
  formationCandidates.value = [];
  formationPickerOpen.value = false;
  formationEditingPosition.value = null;
  pveOverview.value = null;
  pveRecords.value = null;
  pveRecordPage.value = 1;
  pveRecordTotalPages.value = 1;
  catalogItems.value = null;
  catalogError.value = "";
  launchActivity.value = null;
  dailySignIn.value = null;
  tasksOverview.value = null;
  taskScope.value = "daily";
  seasonOverview.value = null;
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
  Object.keys(seasonShopCounts).forEach((key) => {
    delete seasonShopCounts[Number(key)];
  });
  tradeListings.value = [];
  myTradeListings.value = [];
  tradeRecords.value = [];
  upgradeTarget.value = null;
  upgradePreview.value = null;
  lastResults.value = [];
  resultModalOpen.value = false;
  localStorage.removeItem(DRAW_RESULTS_KEY);
  notify("info", "已退出登录");
}

function poolSortOrder(pool: PoolInfo) {
  const value = Number(pool.sortOrder ?? pool.sort_order ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function sortPools(list: PoolInfo[]) {
  return [...list].sort(
    (a, b) => poolSortOrder(a) - poolSortOrder(b) || a.id - b.id,
  );
}

async function loadPublicData() {
  busy.public = true;
  try {
    const [list, recharge] = await Promise.all([
      request<PoolInfo[]>("/card/pools"),
      request<RechargeConfig>("/recharge/config").catch(() => null),
    ]);
    pools.value = sortPools(list || []);
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

async function loadUserCatalog() {
  catalogError.value = "";
  if (!activePoolId.value || !isAuthed.value) {
    catalogItems.value = null;
    return;
  }
  busy.catalog = true;
  try {
    catalogItems.value = await request<UserCatalogResponse>(
      `/card/user/catalog${toQuery({ poolId: activePoolId.value })}`,
    );
  } catch (error) {
    catalogItems.value = null;
    catalogError.value = getErrorMessage(error);
  } finally {
    busy.catalog = false;
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
    loadFishpiPoint(),
    loadUserCards(),
    activeSection.value === "profile" ? loadPlayerProfile() : Promise.resolve(),
    loadFriends(false),
    activeSection.value === "friends" ? loadFriendFeed(false) : Promise.resolve(),
    loadFormation(),
    loadPveStages(),
    loadPveRecords(),
    loadUserCatalog(),
    loadLaunchActivity(),
    loadDailySignIn(),
    loadTasks(),
    loadSeasonOverview(),
    loadLeaderboard(),
    loadAchievements(),
    loadAchievementNotifications(),
    loadPointRecords(),
    loadExchangeItems(),
    loadShopRecycleConfig(),
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

async function loadFishpiPoint(showError = false) {
  if (!isAuthed.value) {
    fishpiPoint.value = null;
    fishpiPointError.value = "";
    return;
  }
  busy.fishpiPoint = true;
  fishpiPointError.value = "";
  try {
    fishpiPoint.value =
      await request<FishpiPointResponse>("/recharge/fishpi-point");
  } catch (error) {
    fishpiPoint.value = null;
    fishpiPointError.value = getErrorMessage(error);
    if (showError) {
      notify("error", fishpiPointError.value);
    }
  } finally {
    busy.fishpiPoint = false;
  }
}

async function loadDrawHistory(page = drawHistoryPage.value) {
  if (!isAuthed.value) {
    return;
  }
  busy.drawHistory = true;
  try {
    const data = await request<DrawHistoryResponse>(
      `/card/history${toQuery({ page, pageSize: 10 })}`,
    );
    drawHistory.value = data;
    drawHistoryPage.value = data.page || page;
  } catch (error) {
    notify("error", getErrorMessage(error));
  } finally {
    busy.drawHistory = false;
  }
}

async function openDrawHistory() {
  if (!isAuthed.value) {
    notify("error", "请先登录后再查看抽卡历史");
    return;
  }
  drawHistoryOpen.value = true;
  drawHistoryPage.value = 1;
  await loadDrawHistory(1);
}

function closeDrawHistory() {
  drawHistoryOpen.value = false;
}

function changeDrawHistoryPage(delta: number) {
  const next = Math.min(
    Math.max(1, drawHistoryPage.value + delta),
    drawHistoryTotalPages.value,
  );
  if (next === drawHistoryPage.value) {
    return;
  }
  void loadDrawHistory(next);
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

async function loadPlayerProfile() {
  if (isPublicProfileRoute.value && !profileRouteUid.value) {
    playerProfile.value = null;
    return;
  }
  if (!isPublicProfileRoute.value && !isAuthed.value) {
    playerProfile.value = null;
    return;
  }

  busy.profile = true;
  try {
    playerProfile.value = await request<PlayerProfileResponse>(
      isPublicProfileRoute.value
        ? `/profile/${encodeURIComponent(profileRouteUid.value)}`
        : "/profile/me",
    );
  } catch (error) {
    playerProfile.value = null;
    if (activeSection.value === "profile") {
      notify("error", getErrorMessage(error));
    }
  } finally {
    busy.profile = false;
  }
}

async function loadProfileCandidates() {
  if (!isAuthed.value) {
    profileCandidates.value = [];
    return;
  }
  busy.profileCandidates = true;
  try {
    const data = await request<UserCardsResponse>(
      `/card/user/cards${toQuery({
        grouped: false,
        page: 1,
        pageSize: 100,
      })}`,
    );
    profileCandidates.value = data.list || [];
  } catch (error) {
    profileCandidates.value = [];
    notify("error", getErrorMessage(error));
  } finally {
    busy.profileCandidates = false;
  }
}

async function openProfilePicker() {
  if (!profileCanEdit.value) {
    notify("error", "请先登录");
    return;
  }
  profileSelectedUuids.value = profileShowcase.value.map((card) => card.uuid);
  profilePickerOpen.value = true;
  await loadProfileCandidates();
}

function closeProfilePicker() {
  if (busy.profileSaving) {
    return;
  }
  profilePickerOpen.value = false;
  profileSelectedUuids.value = [];
}

function isProfileCandidateSelected(card: UserCardsResponse["list"][number]) {
  const uuid = candidateUuid(card);
  return Boolean(uuid && profileSelectedSet.value.has(uuid));
}

function toggleProfileCandidate(card: UserCardsResponse["list"][number]) {
  const uuid = candidateUuid(card);
  if (!uuid) {
    return;
  }
  if (profileSelectedSet.value.has(uuid)) {
    profileSelectedUuids.value = profileSelectedUuids.value.filter(
      (item) => item !== uuid,
    );
    return;
  }
  if (profileSelectedUuids.value.length >= 6) {
    notify("info", "最多 6 张");
    return;
  }
  profileSelectedUuids.value = [...profileSelectedUuids.value, uuid];
}

async function saveProfileShowcase() {
  if (!profileCanEdit.value) {
    notify("error", "请先登录");
    return;
  }
  busy.profileSaving = true;
  try {
    const payload: SaveShowcaseRequest = {
      cardUuids: [...profileSelectedUuids.value],
    };
    playerProfile.value = await request<PlayerProfileResponse>(
      "/profile/showcase",
      {
        method: "PUT",
        body: JSON.stringify(payload),
      },
    );
    profilePickerOpen.value = false;
    notify("success", "展示已保存");
  } catch (error) {
    notify("error", getErrorMessage(error));
  } finally {
    busy.profileSaving = false;
  }
}

async function copyProfileLink() {
  if (!profileShareUrl.value) {
    return;
  }
  try {
    await navigator.clipboard.writeText(profileShareUrl.value);
    notify("success", "链接已复制");
  } catch {
    notify("error", "复制失败");
  }
}

async function loadFriends(showError = activeSection.value === "friends") {
  if (!isAuthed.value) {
    friendsOverview.value = null;
    friendsError.value = "";
    return;
  }
  busy.friends = true;
  friendsError.value = "";
  try {
    friendsOverview.value = await request<FriendsOverviewResponse>("/friends");
  } catch (error) {
    friendsError.value = getErrorMessage(error);
    friendsOverview.value = null;
    if (showError) {
      notify("error", friendsError.value);
    }
  } finally {
    busy.friends = false;
  }
}

async function loadFriendFeed(showError = activeSection.value === "friends") {
  if (!isAuthed.value) {
    friendFeed.value = [];
    friendFeedError.value = "";
    return;
  }
  busy.friendFeed = true;
  friendFeedError.value = "";
  try {
    const data = await request<SocialActivityFeedResponse>(
      "/friends/feed?limit=20",
    );
    friendFeed.value = data.list || [];
  } catch (error) {
    friendFeed.value = [];
    friendFeedError.value = getErrorMessage(error);
    if (showError) {
      notify("error", friendFeedError.value);
    }
  } finally {
    busy.friendFeed = false;
  }
}

async function refreshFriendsSection() {
  await Promise.all([loadFriends(), loadFriendFeed()]);
}

async function sendFriendRequest(uid: string) {
  const targetUid = String(uid || "").trim();
  if (!isAuthed.value) {
    notify("error", "请先登录");
    return false;
  }
  if (!targetUid) {
    notify("error", "请输入玩家名");
    return false;
  }
  friendActionBusy.value = `send:${targetUid}`;
  try {
    const payload: SendFriendRequestRequest = { uid: targetUid };
    await request<FriendRelationRecord>("/friends/requests", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    notify("success", "已申请");
    await Promise.all([loadFriends(false), loadFriendFeed(false)]);
    return true;
  } catch (error) {
    notify("error", getErrorMessage(error));
    return false;
  } finally {
    friendActionBusy.value = "";
  }
}

async function sendManualFriendRequest() {
  const targetUid = friendTargetUid.value.trim();
  if (await sendFriendRequest(targetUid)) {
    friendTargetUid.value = "";
  }
}

async function acceptFriendRequest(requestId: number) {
  friendActionBusy.value = `accept:${requestId}`;
  try {
    await request<FriendRelationRecord>(
      `/friends/requests/${requestId}/accept`,
      {
        method: "POST",
      },
    );
    notify("success", "已通过");
    await Promise.all([loadFriends(false), loadFriendFeed(false)]);
  } catch (error) {
    notify("error", getErrorMessage(error));
  } finally {
    friendActionBusy.value = "";
  }
}

async function rejectFriendRequest(requestId: number) {
  friendActionBusy.value = `reject:${requestId}`;
  try {
    await request<FriendRelationRecord>(
      `/friends/requests/${requestId}/reject`,
      {
        method: "POST",
      },
    );
    notify("success", "已拒绝");
    await Promise.all([loadFriends(false), loadFriendFeed(false)]);
  } catch (error) {
    notify("error", getErrorMessage(error));
  } finally {
    friendActionBusy.value = "";
  }
}

async function cancelFriendRequest(requestId: number) {
  friendActionBusy.value = `cancel:${requestId}`;
  try {
    await request<FriendRelationRecord>(`/friends/requests/${requestId}`, {
      method: "DELETE",
    });
    notify("success", "已取消");
    await Promise.all([loadFriends(false), loadFriendFeed(false)]);
  } catch (error) {
    notify("error", getErrorMessage(error));
  } finally {
    friendActionBusy.value = "";
  }
}

async function removeFriend(uid: string) {
  const targetUid = String(uid || "").trim();
  if (!targetUid) {
    return;
  }
  friendActionBusy.value = `remove:${targetUid}`;
  try {
    await request(`/friends/${encodeURIComponent(targetUid)}`, {
      method: "DELETE",
    });
    notify("success", "已删除");
    await Promise.all([loadFriends(false), loadFriendFeed(false)]);
  } catch (error) {
    notify("error", getErrorMessage(error));
  } finally {
    friendActionBusy.value = "";
  }
}

async function handleProfileFriendAction() {
  const uid = playerProfile.value?.user.uid || "";
  const relation = profileFriendRelation.value;
  if (relation?.status === "pending") {
    if (incomingFriendRequests.value.some((item) => item.id === relation.id)) {
      await acceptFriendRequest(relation.id);
    }
    return;
  }
  await sendFriendRequest(uid);
}

async function loadFormation() {
  if (!isAuthed.value) {
    return;
  }
  busy.formation = true;
  try {
    formation.value = await request<FormationOverview>("/formation");
  } catch (error) {
    if (activeSection.value === "formation") {
      notify("error", getErrorMessage(error));
    }
  } finally {
    busy.formation = false;
  }
}

async function loadFormationCandidates() {
  if (!isAuthed.value) {
    formationCandidates.value = [];
    return;
  }
  busy.formationCandidates = true;
  try {
    const data = await request<UserCardsResponse>(
      `/card/user/cards${toQuery({
        grouped: false,
        page: 1,
        pageSize: 100,
      })}`,
    );
    formationCandidates.value = data.list || [];
  } catch (error) {
    formationCandidates.value = [];
    notify("error", getErrorMessage(error));
  } finally {
    busy.formationCandidates = false;
  }
}

async function openFormationPicker(position: number) {
  if (!isAuthed.value) {
    notify("error", "请先登录后再配置阵容");
    return;
  }
  formationEditingPosition.value = position;
  formationPickerOpen.value = true;
  await loadFormationCandidates();
}

function closeFormationPicker() {
  if (busy.formation) {
    return;
  }
  formationPickerOpen.value = false;
  formationEditingPosition.value = null;
}

function candidateUuid(card: UserCardsResponse["list"][number]) {
  return (
    card.uuid ||
    card.upgradeableUuid ||
    card.lockableUuid ||
    card.unlockableUuid ||
    ""
  );
}

function isFormationCandidateSelected(card: UserCardsResponse["list"][number]) {
  const uuid = candidateUuid(card);
  return Boolean(uuid && formationCurrentUuids.value.has(uuid));
}

async function saveFormationSlot(position: number, cardUuid: string | null) {
  if (!isAuthed.value) {
    notify("error", "请先登录后再配置阵容");
    return;
  }
  const slots = formationSlots.value.map((slot) => ({
    position: slot.position,
    cardUuid: slot.position === position ? cardUuid : slot.card?.uuid || null,
  }));
  busy.formation = true;
  try {
    formation.value = await request<FormationOverview>("/formation", {
      method: "PUT",
      body: JSON.stringify({ slots }),
    });
    notify("success", cardUuid ? "卡片已上阵" : "阵容位置已清空");
    formationPickerOpen.value = false;
    formationEditingPosition.value = null;
    if (pveOverview.value) {
      await loadPveStages();
    }
  } catch (error) {
    notify("error", getErrorMessage(error));
  } finally {
    busy.formation = false;
  }
}

async function loadPveStages() {
  if (!isAuthed.value) {
    return;
  }
  busy.pve = true;
  try {
    pveOverview.value = await request<PveOverview>("/pve/stages");
  } catch (error) {
    if (activeSection.value === "pve") {
      notify("error", getErrorMessage(error));
    }
  } finally {
    busy.pve = false;
  }
}

async function loadPveRecords(page = pveRecordPage.value) {
  if (!isAuthed.value) {
    return;
  }
  busy.pveRecords = true;
  try {
    const data = await request<PveRecordsResponse>(
      `/pve/records${toQuery({ page, pageSize: 6 })}`,
    );
    pveRecords.value = data;
    pveRecordPage.value = data.page || page;
    pveRecordTotalPages.value = data.totalPages || 1;
  } catch (error) {
    if (activeSection.value === "pve") {
      notify("error", getErrorMessage(error));
    }
  } finally {
    busy.pveRecords = false;
  }
}

async function refreshPve() {
  await Promise.all([loadPveStages(), loadPveRecords()]);
}

async function challengePveStage(stage: PveStage) {
  if (!isAuthed.value) {
    notify("error", "请先登录后再挑战关卡");
    return;
  }
  if (!stage.canChallenge) {
    notify("info", stage.unavailableReason || "当前无法挑战");
    return;
  }
  busy.pveChallenge = true;
  try {
    const data = await request<PveChallengeResult>(
      `/pve/stages/${stage.id}/challenge`,
      { method: "POST" },
    );
    if (stats.value && typeof data.pointAfter === "number") {
      stats.value.point = data.pointAfter;
    }
    if (currentUser.value && typeof data.pointAfter === "number") {
      currentUser.value.point = data.pointAfter;
      setStoredUser(currentUser.value);
    }
    notify(
      data.success ? "success" : "info",
      data.success
        ? `挑战胜利：${formatRewards(data.rewards || undefined)}`
        : `挑战失败：战力 ${data.formationPower} / ${data.enemyPower}`,
    );
    await Promise.all([
      loadPveStages(),
      loadPveRecords(1),
      loadStats(),
      loadUserCards(),
      loadUserCatalog(),
      loadAchievements(),
      loadAchievementNotifications(),
      pointRecords.value ? loadPointRecords() : Promise.resolve(),
    ]);
  } catch (error) {
    notify("error", getErrorMessage(error));
  } finally {
    busy.pveChallenge = false;
  }
}

function changePveRecordPage(delta: number) {
  const next = Math.min(
    Math.max(1, pveRecordPage.value + delta),
    pveRecordTotalPages.value,
  );
  if (next === pveRecordPage.value) {
    return;
  }
  void loadPveRecords(next);
}

function resetUserCards() {
  cardPage.value = 1;
  userCards.value = null;
  activeBagActionKey.value = "";
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

async function loadDailySignIn() {
  if (!isAuthed.value) {
    return;
  }
  dailySignIn.value = await request<DailySignInStatus>("/daily-sign-in/status");
}

async function loadTasks() {
  if (!isAuthed.value) {
    return;
  }
  busy.tasks = true;
  try {
    tasksOverview.value = await request<TaskOverview>("/tasks/overview");
  } catch (error) {
    if (activeSection.value === "tasks") {
      notify("error", getErrorMessage(error));
    }
  } finally {
    busy.tasks = false;
  }
}

async function loadSeasonOverview() {
  if (!isAuthed.value) {
    return;
  }
  busy.season = true;
  try {
    const data = await request<SeasonOverview>("/season/overview");
    seasonOverview.value = data;
    (data.shopItems || []).forEach((item) => {
      if (!seasonShopCounts[item.id]) {
        seasonShopCounts[item.id] = 1;
      }
    });
  } catch (error) {
    if (activeSection.value === "season") {
      notify("error", getErrorMessage(error));
    }
  } finally {
    busy.season = false;
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

async function loadShopRecycleConfig() {
  if (!isAuthed.value) {
    return;
  }
  shopRecycleConfig.value = await request<ShopRecycleConfig>(
    "/shop/recycle/config",
  );
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

async function claimDailySignIn() {
  if (!isAuthed.value) {
    notify("error", "请先登录");
    return;
  }
  if (dailySignIn.value?.signedToday) {
    notify("info", "今日已签");
    return;
  }
  busy.signIn = true;
  try {
    const data = await request<DailySignInClaimResponse>(
      "/daily-sign-in/claim",
      { method: "POST" },
    );
    dailySignIn.value = data;
    if (stats.value) {
      stats.value.point = data.pointAfter;
    }
    if (currentUser.value) {
      currentUser.value.point = data.pointAfter;
      setStoredUser(currentUser.value);
    }
    if (pointRecords.value) {
      await loadPointRecords();
    }
    await loadTasks();
    notify("success", `签到 +${data.rewardPoints}`);
  } catch (error) {
    notify("error", getErrorMessage(error));
  } finally {
    busy.signIn = false;
  }
}

async function claimTaskReward(task: TaskItem) {
  const overview = activeTaskOverview.value;
  if (!isAuthed.value || !overview) {
    notify("error", "请先登录");
    return;
  }
  if (!task.completed) {
    notify("info", "任务还在进行中");
    return;
  }
  if (task.claimed) {
    notify("info", "任务奖励已领取");
    return;
  }
  busy.claimTask = true;
  try {
    const data = await request<TaskClaimResponse>("/tasks/claim", {
      method: "POST",
      body: JSON.stringify({
        taskId: task.id,
        periodKey: overview.periodKey,
      }),
    });
    const seasonText = data.seasonPoints?.gained
      ? `，赛季积分 +${data.seasonPoints.gained}`
      : "";
    notify("success", `领取成功：${formatRewards(data.rewards)}${seasonText}`);
    await loadPrivateData();
  } catch (error) {
    notify("error", getErrorMessage(error));
  } finally {
    busy.claimTask = false;
  }
}

async function claimActivityReward(milestone: TaskActivityMilestone) {
  const overview = activeTaskOverview.value;
  if (!isAuthed.value || !overview) {
    notify("error", "请先登录");
    return;
  }
  if (milestone.claimed) {
    notify("info", "活跃度奖励已领取");
    return;
  }
  if (!milestone.available) {
    notify("info", "活跃度还不够");
    return;
  }
  busy.claimTask = true;
  try {
    const data = await request<TaskClaimResponse>("/tasks/activity/claim", {
      method: "POST",
      body: JSON.stringify({
        scope: overview.scope,
        periodKey: overview.periodKey,
        milestone: milestone.threshold,
      }),
    });
    notify("success", `领取成功：${formatRewards(data.rewards)}`);
    await loadPrivateData();
  } catch (error) {
    notify("error", getErrorMessage(error));
  } finally {
    busy.claimTask = false;
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

function shortCardIntro(desc?: string | null) {
  const text = cardIntroText(desc);
  return text.length > 15 ? `${text.slice(0, 15)}…` : text;
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

function cardMediaUrl(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  if (/^(https?:|data:|blob:)/i.test(raw)) {
    return raw;
  }
  return `${getApiBase()}${raw.startsWith("/") ? raw : `/${raw}`}`;
}

function isCardVideo(value?: string | null) {
  return /\.(mp4|webm)(?:[?#]|$)/i.test(String(value || "").trim());
}

function hasCardMedia(value?: string | null) {
  return Boolean(cardMediaUrl(value));
}

function hideBrokenCardMedia(event: Event) {
  const media = event.target as HTMLImageElement | HTMLVideoElement | null;
  if (media) {
    media.hidden = true;
    media.closest(".card-media-frame")?.classList.remove("has-media");
  }
}

function getPoolName(poolId?: number | null) {
  return (
    pools.value.find((pool) => pool.id === Number(poolId))?.pool_name || ""
  );
}

function getPityForPool(poolId?: number | null) {
  const normalizedPoolId = Number(poolId || 0);
  if (!normalizedPoolId) {
    return null;
  }
  return (
    stats.value?.pity?.find(
      (item) => Number(item.poolId) === normalizedPoolId,
    ) || null
  );
}

function pityRuleLabel(
  rule?: { count: number; guaranteedRarity: string; remaining: number } | null,
) {
  if (!rule) {
    return "暂无保底规则";
  }
  return `${rule.count} 抽内必得 ${rule.guaranteedRarity}，当前还差 ${rule.remaining} 抽`;
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

function bagActionKey(card: UserCardsResponse["list"][number]) {
  return `${card.cardId || card.id || card.cardName}-${card.cardLevel}-${card.poolId}`;
}

function openBagCardActions(card: UserCardsResponse["list"][number]) {
  activeBagActionKey.value = bagActionKey(card);
}

function cardLockAction(card: UserCardsResponse["list"][number]) {
  const hasLocked = Number(card.lockedCount || 0) > 0 || card.locked === true;
  const uuid = hasLocked
    ? card.unlockableUuid || card.uuid || null
    : card.lockableUuid || card.uuid || null;
  return {
    uuid,
    locked: !hasLocked,
    label: hasLocked ? "解锁" : "锁定",
  };
}

async function toggleCardLock(card: UserCardsResponse["list"][number]) {
  if (!isAuthed.value) {
    notify("error", "请先登录后再操作卡片");
    return;
  }
  const action = cardLockAction(card);
  if (!action.uuid) {
    notify("info", "当前没有可切换锁定状态的卡片");
    return;
  }
  busy.assets = true;
  try {
    await request(`/card/user/cards/${action.uuid}/lock`, {
      method: "PATCH",
      body: JSON.stringify({ locked: action.locked }),
    });
    notify("success", action.locked ? "卡片已锁定" : "卡片已解锁");
    await loadUserCards();
    await loadBulkDecomposePreview();
  } catch (error) {
    notify("error", getErrorMessage(error));
  } finally {
    busy.assets = false;
  }
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

async function synthesizeCard(item: CatalogCard) {
  if (!isAuthed.value) {
    notify("error", "请先登录");
    return;
  }
  if (item.collected) {
    notify("info", "已收集");
    return;
  }
  if (item.rarity === "UR") {
    notify("error", "UR 不可合成");
    return;
  }
  if (!item.canSynthesize) {
    notify("error", "碎片不足");
    return;
  }
  if (!window.confirm(`合成 ${item.rarity} ${item.card.card_name}？`)) {
    return;
  }
  busy.catalog = true;
  try {
    await request("/card/synthesize", {
      method: "POST",
      body: JSON.stringify({ card_id: item.card.id, rarity: item.rarity }),
    });
    notify("success", "合成成功");
    await loadPrivateData();
  } catch (error) {
    notify("error", getErrorMessage(error));
  } finally {
    busy.catalog = false;
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
  const lockedText =
    Number(preview.skippedLocked || 0) > 0
      ? `；${preview.skippedLocked} 张锁定卡片会跳过`
      : "";
  const reservedText =
    Number(preview.reservedCount || 0) > 0
      ? `；保留 ${preview.reservedCount} 张`
      : "";
  if (
    !window.confirm(
      `确认分解 ${preview.total} 张卡片（${detail}）${skippedText}${lockedText}${reservedText}？`,
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

function getRecyclePrice(rarity: string) {
  const key = String(rarity || "").toUpperCase();
  if (key === "N") {
    return shopRecycleConfig.value.priceN;
  }
  if (key === "R") {
    return shopRecycleConfig.value.priceR;
  }
  if (key === "SR") {
    return shopRecycleConfig.value.priceSR;
  }
  if (key === "SSR") {
    return shopRecycleConfig.value.priceSSR;
  }
  if (key === "UR") {
    return shopRecycleConfig.value.priceUR;
  }
  return 0;
}

function openRecycleModal(card: UserCardsResponse["list"][number]) {
  if (!isAuthed.value) {
    notify("error", "请先登录");
    return;
  }
  if (!shopRecycleConfig.value.enabled) {
    notify("info", "商店未开启");
    return;
  }
  const available = Math.max(0, Number(card.sellableCount || 0) - 1);
  if (available <= 0) {
    notify("info", "无可回收");
    return;
  }
  recycleTarget.value = card;
  recycleCount.value = 1;
}

function closeRecycleModal() {
  recycleTarget.value = null;
  recycleCount.value = 1;
}

function cardUpgradeUuid(card: UserCardsResponse["list"][number]) {
  return card.upgradeableUuid || (card.canUpgrade ? card.uuid : "") || "";
}

async function openUpgradeModal(card: UserCardsResponse["list"][number]) {
  if (!isAuthed.value) {
    notify("error", "请先登录后再养成卡片");
    return;
  }
  const uuid = cardUpgradeUuid(card);
  if (!uuid) {
    notify("info", "当前没有可养成的卡片");
    return;
  }
  upgradeTarget.value = card;
  upgradePreview.value = null;
  busy.upgrade = true;
  try {
    upgradePreview.value = await request<CardUpgradePreview>(
      `/card/user/cards/${uuid}/upgrade-preview`,
    );
  } catch (error) {
    upgradeTarget.value = null;
    notify("error", getErrorMessage(error));
  } finally {
    busy.upgrade = false;
  }
}

function closeUpgradeModal() {
  if (busy.upgrade) {
    return;
  }
  upgradeTarget.value = null;
  upgradePreview.value = null;
}

async function upgradeCard() {
  const uuid =
    upgradePreview.value?.uuid ||
    (upgradeTarget.value ? cardUpgradeUuid(upgradeTarget.value) : "");
  if (!uuid) {
    notify("error", "卡片无效");
    return;
  }
  if (upgradePreview.value && !upgradePreview.value.canUpgrade) {
    notify("info", upgradePreview.value.unavailableReason || "暂时不能养成");
    return;
  }
  busy.upgrade = true;
  try {
    const data = await request<CardUpgradeResponse>(
      `/card/user/cards/${uuid}/upgrade`,
      { method: "POST" },
    );
    notify(
      "success",
      `养成成功：Lv.${data.before.level} → Lv.${data.after.level}，战力 +${data.after.power - data.before.power}`,
    );
    await loadPrivateData();
    try {
      upgradePreview.value = await request<CardUpgradePreview>(
        `/card/user/cards/${uuid}/upgrade-preview`,
      );
    } catch {
      upgradeTarget.value = null;
      upgradePreview.value = null;
    }
  } catch (error) {
    notify("error", getErrorMessage(error));
  } finally {
    busy.upgrade = false;
  }
}

async function recycleCards() {
  const target = recycleTarget.value;
  if (!target?.cardId) {
    notify("error", "卡片无效");
    return;
  }
  const count = Number(recycleCount.value);
  if (!Number.isInteger(count) || count <= 0) {
    notify("error", "数量无效");
    return;
  }
  if (count > recycleAvailableCount.value) {
    notify("error", "数量不足");
    return;
  }

  busy.recycle = true;
  try {
    const data = await request<ShopRecycleCardsResponse>(
      "/shop/recycle/cards",
      {
        method: "POST",
        body: JSON.stringify({
          cardId: target.cardId,
          rarity: target.cardLevel,
          poolId: target.poolId,
          count,
        }),
      },
    );
    notify("success", `回收 +${data.rewardPoints}`);
    if (stats.value) {
      stats.value.point = data.pointAfter;
    }
    if (currentUser.value) {
      currentUser.value.point = data.pointAfter;
      setStoredUser(currentUser.value);
    }
    closeRecycleModal();
    await loadPrivateData();
  } catch (error) {
    notify("error", getErrorMessage(error));
  } finally {
    busy.recycle = false;
  }
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

async function buySeasonShopItem(item: SeasonShopItem) {
  if (!isAuthed.value) {
    notify("error", "请先登录后再兑换赛季奖励");
    return;
  }
  const count = Math.max(
    1,
    Math.min(99, Number(seasonShopCounts[item.id] || 1)),
  );
  seasonShopCounts[item.id] = count;
  busy.seasonShop = true;
  try {
    const data = await request<SeasonShopBuyResponse>(
      `/season/shop/items/${item.id}/buy`,
      {
        method: "POST",
        body: JSON.stringify({ count }),
      },
    );
    notify("success", `兑换成功：${formatRewards(data.rewards)}`);
    seasonOverview.value = {
      ...(seasonOverview.value || {
        season: data.season,
        leaderboard: { list: [], me: null },
        shopItems: [],
        records: [],
      }),
      season: data.season,
      points: data.points,
    };
    await Promise.all([
      loadSeasonOverview(),
      loadStats(),
      loadUserCards(),
      loadUserCatalog(),
      pointRecords.value ? loadPointRecords() : Promise.resolve(),
    ]);
  } catch (error) {
    notify("error", getErrorMessage(error));
  } finally {
    busy.seasonShop = false;
  }
}

function pointChangeClass(amount: number) {
  return amount >= 0 ? "income" : "expense";
}

function formatPointChange(amount: number) {
  return `${amount > 0 ? "+" : ""}${amount}`;
}

function seasonPointSourceLabel(sourceType: string) {
  const labels: Record<string, string> = {
    task_activity: "任务活跃",
    shop_spend: "赛季商店",
    admin_adjust: "后台调整",
  };
  return labels[sourceType] || sourceType;
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
    case "daily_sign_in":
      return `第 ${String(meta("cycleDay") || "-")} 天`;
    case "exchange_shop":
      return `兑换项 ${String(meta("exchangeItemName") || meta("exchangeItemId") || "-")} · ${String(
        meta("count") || 1,
      )} 次`;
    case "task":
      return `${String(meta("taskName") || meta("milestone") || "任务")} · ${String(
        meta("periodKey") || "-",
      )}`;
    case "pve":
      return `${String(meta("stageName") || "关卡")} · 战力 ${String(
        meta("formationPower") || "-",
      )}/${String(meta("enemyPower") || "-")}`;
    case "trade_buy":
      return `订单 #${String(meta("listingId") || record.sourceId || "-")} · 购买`;
    case "trade_sell":
      return `订单 #${String(meta("listingId") || record.sourceId || "-")} · 出售`;
    case "shop_recycle":
      return `${String(meta("cardName") || "卡片")} · ${String(meta("count") || 1)} 张`;
    case "season_shop":
      return `赛季商店 ${String(meta("shopItemName") || meta("shopItemId") || "-")} · ${String(
        meta("count") || 1,
      )} 次`;
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

function strongestRarityClass(rarities: CardRarity[] = []) {
  const strongest = [...rarities].sort(
    (a, b) => (rarityRank[b] || 0) - (rarityRank[a] || 0),
  )[0];
  return rarityClass(strongest);
}

function synthesisCostLabel(rarity?: string) {
  const normalized = normalizeRarity(rarity);
  const cost = requiredFragmentsForRarity(normalized);
  return normalized === "UR" ? "UR 不可合成" : `${cost} 碎片`;
}

function requiredFragmentsForRarity(rarity?: string) {
  const normalized = normalizeRarity(rarity);
  const costs: Record<string, number> = {
    N: 80,
    R: 160,
    SR: 320,
    SSR: 1000,
    UR: 0,
  };
  return costs[normalized] || 0;
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
  cards?: Array<{
    cardName?: string;
    cardId: number;
    rarity: string;
    num: number;
  }>;
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
    parts.push(
      `${card.cardName || `卡片 ${card.cardId}`} ${card.rarity} x${card.num}`,
    );
  });
  return parts.length > 0 ? parts.join("，") : "无奖励";
}

function pvePowerPercent(stage: PveStage) {
  const enemyPower = Math.max(1, Number(stage.enemyPower || 0));
  return Math.max(
    0,
    Math.min(
      100,
      Math.round((pveFormation.value.totalPower / enemyPower) * 100),
    ),
  );
}

function pveStageLevelLabel(stage: PveStage) {
  const power = Number(stage.enemyPower || 0);
  if (power >= 5000) {
    return "高危";
  }
  if (power >= 2000) {
    return "精英";
  }
  return "巡逻";
}

function achievementProgressPercent(achievement: AchievementRecord) {
  if (achievement.achieved) {
    return 100;
  }
  const target = Math.max(1, Number(achievement.targetValue || 0));
  return Math.max(
    0,
    Math.min(
      100,
      Math.round((Number(achievement.progress || 0) / target) * 100),
    ),
  );
}

function achievementProgressText(achievement: AchievementRecord) {
  const target = Math.max(0, Number(achievement.targetValue || 0));
  const progress = Math.min(
    Math.max(0, Number(achievement.progress || 0)),
    target,
  );
  return `${progress} / ${target}`;
}

function taskProgressPercent(task: TaskItem) {
  if (task.claimed || task.completed) {
    return 100;
  }
  const target = Math.max(1, Number(task.targetValue || 0));
  return Math.max(
    0,
    Math.min(100, Math.round((Number(task.progress || 0) / target) * 100)),
  );
}

function taskProgressText(task: TaskItem) {
  const target = Math.max(0, Number(task.targetValue || 0));
  const progress = Math.min(Math.max(0, Number(task.progress || 0)), target);
  return `${progress} / ${target}`;
}

function taskPeriodText(overview?: TaskScopeOverview | null) {
  if (!overview) {
    return "";
  }
  return `${formatDate(overview.startsAt)} - ${formatDate(overview.endsAt)}`;
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
  return publicPlayerName(entry.nickname, entry.uid).slice(0, 1).toUpperCase();
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
          v-for="item in primaryNavItems"
          :key="item.key"
          :to="{ name: item.key }"
          :class="{ active: activeSection === item.key }"
        >
          <component :is="item.icon" :size="16" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div class="top-actions">
        <button
          class="icon-button ghost theme-toggle"
          type="button"
          title="切换主题"
          aria-label="切换主题"
          @click="toggleThemeMode"
        >
          <Sun v-if="themeMode === 'dark'" :size="17" />
          <Moon v-else :size="17" />
          <span>{{ themeMode === "dark" ? "白色" : "暗色" }}</span>
        </button>
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
        <div
          class="user-menu-wrap"
          :class="{ open: userMenuOpen, 'hover-paused': userMenuHoverPaused }"
          @keydown.escape="userMenuOpen = false"
          @mouseleave="resetUserMenuHover"
        >
          <button
            class="user-menu-trigger"
            type="button"
            :aria-expanded="userMenuOpen"
            aria-haspopup="true"
            :aria-label="isAuthed ? '玩家菜单' : '登录菜单'"
            @click="toggleUserMenu"
          >
            <span class="user-menu-avatar">
              <img
                v-if="isAuthed && currentUser?.avatar"
                :src="currentUser.avatar"
                :alt="playerDisplayName"
              />
              <span v-else-if="isAuthed">{{ playerInitial }}</span>
              <LogIn v-else :size="17" />
            </span>
            <span class="user-menu-trigger-text">
              <strong>{{ isAuthed ? playerDisplayName : "登录" }}</strong>
              <small v-if="isAuthed">{{ stats?.point ?? 0 }} 星穹币</small>
            </span>
          </button>

          <div class="user-menu-panel" role="menu">
            <template v-if="isAuthed">
              <div class="user-menu-head">
                <span class="user-menu-avatar large">
                  <img
                    v-if="currentUser?.avatar"
                    :src="currentUser.avatar"
                    :alt="playerDisplayName"
                  />
                  <span v-else>{{ playerInitial }}</span>
                </span>
                <div>
                  <strong>{{ playerDisplayName }}</strong>
                  <small>{{ playerStatusLabel }}</small>
                </div>
              </div>
              <div class="user-menu-balances">
                <div class="user-menu-balance">
                  <span>星穹币</span>
                  <strong>{{ stats?.point ?? currentUser?.point ?? 0 }}</strong>
                </div>
                <div class="user-menu-balance">
                  <span>鱼排积分</span>
                  <strong :class="{ muted: fishpiPointError && !fishpiPoint }">
                    {{ fishpiPointLabel }}
                  </strong>
                </div>
              </div>
              <nav class="user-menu-shortcuts" aria-label="快捷入口">
                <RouterLink
                  v-for="item in accountMenuItems"
                  :key="item.key"
                  class="user-menu-link"
                  :to="{ name: item.key }"
                  :class="{ active: activeSection === item.key }"
                  role="menuitem"
                  @click="closeUserMenu"
                >
                  <component :is="item.icon" :size="16" />
                  {{ item.label }}
                </RouterLink>
              </nav>
              <button
                class="user-menu-link danger"
                type="button"
                role="menuitem"
                @click="logout"
              >
                <LogOut :size="16" />
                退出登录
              </button>
            </template>
            <template v-else>
              <div class="user-menu-head guest">
                <span class="user-menu-avatar large">
                  <UserRound :size="22" />
                </span>
                <div>
                  <strong>登录</strong>
                  <small>同步资产数据</small>
                </div>
              </div>
              <div class="guest-login-actions">
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
                  登录
                </button>
              </div>
            </template>
          </div>
        </div>
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
              <strong
                class="card-name summon-card-name"
                :class="bestResult ? rarityClass(bestResult.rarity) : ''"
              >
                {{ bestResult?.cardName || "星轨待命" }}
              </strong>
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
              <div
                v-if="isAuthed"
                class="pity-progress-card"
                :style="{ '--pity-progress': `${selectedPityPercent}%` }"
              >
                <div>
                  <span>保底进度</span>
                  <strong>{{ selectedPityText }}</strong>
                </div>
                <i aria-hidden="true"></i>
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
              <span>{{ playerStatusLabel }}</span>
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
              <span>资产余额</span>
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
            <div class="point-card-metrics">
              <div>
                <span>星穹币</span>
                <strong>{{ stats?.point || 0 }}</strong>
              </div>
              <div>
                <span>鱼排积分</span>
                <strong :class="{ muted: fishpiPointError && !fishpiPoint }">
                  {{ fishpiPointLabel }}
                </strong>
              </div>
            </div>
            <small>
              当前卡池 {{ selectedPool?.pool_name || "未选择" }} · 充值
              {{ rechargeRangeLabel }}
            </small>
          </div>

          <div v-if="isAuthed" class="sign-in-card">
            <div class="sign-in-main">
              <div>
                <span>每日签到</span>
                <strong>第 {{ dailySignInCycleDay }} 天</strong>
              </div>
              <b>+{{ dailySignInRewardPoints }}</b>
            </div>
            <div class="sign-in-week" aria-label="七日签到">
              <span
                v-for="day in dailySignInWeek"
                :key="day.day"
                class="sign-in-day"
                :class="{
                  signed: day.signed,
                  current: day.current,
                  bonus: day.rewardPoints >= 100,
                }"
              >
                {{ day.rewardPoints >= 100 ? "100" : day.day }}
              </span>
            </div>
            <button
              class="primary-action compact sign-in-action"
              type="button"
              :disabled="busy.signIn || dailySignIn?.signedToday"
              @click="claimDailySignIn"
            >
              <LoaderCircle v-if="busy.signIn" :size="15" class="spin" />
              {{ dailySignIn?.signedToday ? "已签" : "签到" }}
            </button>
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
              登录
            </button>
            <label class="token-box debug-token-box">
              <span>临时凭证</span>
              <textarea v-model="manualToken" placeholder="粘贴凭证"></textarea>
            </label>
            <button
              class="secondary-action wide"
              type="button"
              @click="applyManualToken"
            >
              <ShieldCheck :size="18" />
              进入
            </button>
          </div>
        </aside>
      </section>

      <section
        v-if="activeSection === 'profile'"
        class="panel profile-panel"
        data-section="profile"
      >
        <div class="section-head">
          <div>
            <p class="eyebrow">
              {{ profileCanEdit ? "我的主页" : "玩家主页" }}
            </p>
            <h2>{{ profileDisplayName }}</h2>
          </div>
          <div class="section-actions profile-actions">
            <button
              v-if="profileCanEdit"
              class="primary-action compact"
              type="button"
              :disabled="busy.profile || busy.profileCandidates"
              @click="openProfilePicker"
            >
              <Package :size="16" />
              编辑
            </button>
            <button
              v-if="showProfileFriendAction"
              class="primary-action compact"
              type="button"
              :disabled="profileFriendActionDisabled"
              @click="handleProfileFriendAction"
            >
              <UsersRound :size="16" />
              {{ profileFriendActionLabel }}
            </button>
            <button
              v-if="profileShareUrl"
              class="secondary-action compact"
              type="button"
              @click="copyProfileLink"
            >
              <Share2 :size="16" />
              复制
            </button>
            <button
              class="secondary-action compact"
              type="button"
              :disabled="busy.profile"
              @click="loadPlayerProfile"
            >
              <RefreshCw :size="16" :class="{ spin: busy.profile }" />
              刷新
            </button>
          </div>
        </div>

        <div v-if="!isPublicProfileRoute && !isAuthed" class="empty-state">
          <UserRound :size="30" />
          <strong>登录后查看主页</strong>
          <span>展示卡片和战力。</span>
        </div>
        <div v-else-if="busy.profile && !playerProfile" class="empty-state">
          <LoaderCircle :size="30" class="spin" />
          <strong>正在读取主页</strong>
          <span>稍候片刻</span>
        </div>
        <div v-else-if="!playerProfile" class="empty-state">
          <UserRound :size="30" />
          <strong>暂无主页</strong>
          <span>玩家资料未找到。</span>
        </div>
        <template v-else>
          <div class="profile-hero">
            <div class="profile-avatar">
              <img
                v-if="playerProfile.user.avatar"
                :src="playerProfile.user.avatar"
                :alt="profileDisplayName"
              />
              <span v-else>{{ profileInitial }}</span>
            </div>
            <div>
              <p class="eyebrow">玩家名片</p>
              <h3>{{ profileDisplayName }}</h3>
              <span>{{ profileCanEdit ? "我的主页" : "公开主页" }}</span>
              <span v-if="profileFriendStatusLabel" class="profile-status-pill">
                {{ profileFriendStatusLabel }}
              </span>
            </div>
          </div>

          <div class="profile-summary">
            <article>
              <small>收藏</small>
              <strong>{{ playerProfile.user.totalCards }}</strong>
            </article>
            <article>
              <small>展示</small>
              <strong>{{ profileShowcase.length }}</strong>
            </article>
            <article>
              <small>阵容</small>
              <strong>{{ profileFormation.totalPower }}</strong>
            </article>
            <article>
              <small>上阵</small>
              <strong>
                {{ profileFormation.filledCount }}/{{
                  profileFormation.slotCount
                }}
              </strong>
            </article>
          </div>

          <div class="profile-rarity-strip" aria-label="稀有度收藏">
            <span
              v-for="row in profileCardCountRows"
              :key="row.rarity"
              class="summary-pill"
              :class="rarityClass(row.rarity)"
            >
              {{ row.rarity }} {{ row.count }}
            </span>
          </div>

          <section class="profile-block">
            <div class="section-title-row">
              <div>
                <p class="eyebrow">展示墙</p>
                <h3>精选卡片</h3>
              </div>
            </div>
            <div
              v-if="profileShowcase.length === 0"
              class="empty-state compact"
            >
              <Package :size="26" />
              <strong>暂无展示</strong>
              <span>公开主页会展示精选卡片。</span>
            </div>
            <div v-else class="showcase-grid">
              <article
                v-for="card in profileShowcase"
                :key="card.uuid"
                class="result-card showcase-card"
                :class="rarityClass(card.cardLevel)"
              >
                <div class="card-face">
                  <div
                    class="card-media-frame"
                    :class="{ 'has-media': hasCardMedia(card.cardImage) }"
                  >
                    <video
                      v-if="isCardVideo(card.cardImage)"
                      class="card-art-media"
                      :src="cardMediaUrl(card.cardImage)"
                      muted
                      loop
                      autoplay
                      playsinline
                      @error="hideBrokenCardMedia"
                    />
                    <img
                      v-else-if="cardMediaUrl(card.cardImage)"
                      class="card-art-media"
                      :src="cardMediaUrl(card.cardImage)"
                      :alt="card.cardName"
                      @error="hideBrokenCardMedia"
                    />
                    <div class="card-sigil"></div>
                    <div class="result-card-top">
                      <span class="rarity-badge">{{ card.cardLevel }}</span>
                      <span class="card-type-pill">
                        {{ cardTypeLabel(card.cardType) }}
                      </span>
                    </div>
                  </div>
                  <div class="card-content">
                    <h3 class="card-name">{{ card.cardName }}</h3>
                    <p>{{ shortCardIntro(card.cardDesc) }}</p>
                    <div class="tag-row">
                      <span>Lv.{{ card.cultivationLevel || 1 }}</span>
                      <span>战力 {{ card.power || 0 }}</span>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </section>
        </template>
      </section>

      <section
        v-if="activeSection === 'friends'"
        class="panel friends-panel"
        data-section="friends"
      >
        <div class="section-head">
          <div>
            <p class="eyebrow">好友</p>
            <h2>好友列表</h2>
          </div>
          <div class="section-actions friends-actions">
            <form
              v-if="isAuthed"
              class="friend-add-form"
              @submit.prevent="sendManualFriendRequest"
            >
              <input v-model="friendTargetUid" placeholder="玩家名" />
              <button
                class="primary-action compact"
                type="submit"
                :disabled="busy.friends || friendActionBusy !== ''"
              >
                <UsersRound :size="16" />
                添加
              </button>
            </form>
            <button
              v-if="isAuthed"
              class="secondary-action compact"
              type="button"
              :disabled="busy.friends || busy.friendFeed"
              @click="refreshFriendsSection"
            >
              <RefreshCw
                :size="16"
                :class="{ spin: busy.friends || busy.friendFeed }"
              />
              刷新
            </button>
          </div>
        </div>

        <div v-if="!isAuthed" class="empty-state">
          <UserRound :size="30" />
          <strong>请先登录</strong>
          <span>登录后查看</span>
        </div>
        <div v-else-if="busy.friends && !friendsOverview" class="skeleton-grid">
          <span v-for="item in 3" :key="item"></span>
        </div>
        <div v-else-if="friendsError" class="empty-state">
          <UsersRound :size="30" />
          <strong>好友加载失败</strong>
          <span>{{ friendsError }}</span>
          <button
            class="secondary-action"
            type="button"
            @click="refreshFriendsSection"
          >
            重试
          </button>
        </div>
        <template v-else>
          <div class="friends-summary">
            <article>
              <small>好友</small>
              <strong>{{ friendsOverview?.counts.friends || 0 }}</strong>
            </article>
            <article>
              <small>收到</small>
              <strong>{{ friendsOverview?.counts.incoming || 0 }}</strong>
            </article>
            <article>
              <small>发出</small>
              <strong>{{ friendsOverview?.counts.outgoing || 0 }}</strong>
            </article>
          </div>

          <section class="friends-block friend-feed-block">
            <div class="section-title-row">
              <div>
                <p class="eyebrow">动态</p>
                <h3>好友动态</h3>
              </div>
              <button
                class="secondary-action compact"
                type="button"
                :disabled="busy.friendFeed"
                @click="loadFriendFeed()"
              >
                <RefreshCw :size="15" :class="{ spin: busy.friendFeed }" />
                刷新
              </button>
            </div>
            <div v-if="busy.friendFeed && friendFeed.length === 0" class="empty-mini">
              正在读取
            </div>
            <div v-else-if="friendFeedError" class="empty-mini">
              动态加载失败
            </div>
            <div v-else-if="friendFeed.length === 0" class="empty-mini">
              暂无动态
            </div>
            <div v-else class="friend-feed-list">
              <RouterLink
                v-for="activity in friendFeed"
                :key="activity.id"
                class="friend-feed-row"
                :to="{
                  name: 'publicProfile',
                  params: { uid: activity.user.uid },
                }"
              >
                <span class="friend-avatar">
                  <img
                    v-if="activity.user.avatar"
                    :src="activity.user.avatar"
                    :alt="activityUserName(activity)"
                  />
                  <span v-else>{{ activityInitial(activity) }}</span>
                </span>
                <div class="friend-info">
                  <strong>{{ activityUserName(activity) }}</strong>
                  <span>{{ activityLine(activity) }}</span>
                </div>
                <time>{{ formatDate(activity.createdAt) }}</time>
              </RouterLink>
            </div>
          </section>

          <div class="friends-layout">
            <section class="friends-block">
              <div class="section-title-row">
                <div>
                  <p class="eyebrow">好友</p>
                  <h3>已添加</h3>
                </div>
              </div>
              <div v-if="friendRows.length === 0" class="empty-mini">
                暂无好友
              </div>
              <div v-else class="friend-list">
                <article
                  v-for="friend in friendRows"
                  :key="friend.id"
                  class="friend-row"
                >
                  <span class="friend-avatar">
                    <img
                      v-if="friend.user.avatar"
                      :src="friend.user.avatar"
                      :alt="publicPlayerName(friend.user.nickname, friend.user.uid)"
                    />
                    <span v-else>
                      {{
                        publicPlayerName(friend.user.nickname, friend.user.uid)
                          .slice(0, 1)
                          .toUpperCase()
                      }}
                    </span>
                  </span>
                  <div class="friend-info">
                    <strong>{{
                      publicPlayerName(friend.user.nickname, friend.user.uid)
                    }}</strong>
                    <span>已添加</span>
                  </div>
                  <div class="friend-row-actions">
                    <RouterLink
                      class="secondary-action compact"
                      :to="{
                        name: 'publicProfile',
                        params: { uid: friend.user.uid },
                      }"
                    >
                      查看
                    </RouterLink>
                    <button
                      class="danger-action compact"
                      type="button"
                      :disabled="
                        friendActionBusy === `remove:${friend.user.uid}`
                      "
                      @click="removeFriend(friend.user.uid)"
                    >
                      删除
                    </button>
                  </div>
                </article>
              </div>
            </section>

            <section class="friends-block">
              <div class="section-title-row">
                <div>
                  <p class="eyebrow">收到</p>
                  <h3>好友申请</h3>
                </div>
              </div>
              <div
                v-if="incomingFriendRequests.length === 0"
                class="empty-mini"
              >
                暂无申请
              </div>
              <div v-else class="friend-list">
                <article
                  v-for="requestItem in incomingFriendRequests"
                  :key="requestItem.id"
                  class="friend-row"
                >
                  <span class="friend-avatar">
                    <img
                      v-if="requestItem.user.avatar"
                      :src="requestItem.user.avatar"
                      :alt="
                        publicPlayerName(
                          requestItem.user.nickname,
                          requestItem.user.uid,
                        )
                      "
                    />
                    <span v-else>
                      {{
                        publicPlayerName(
                          requestItem.user.nickname,
                          requestItem.user.uid,
                        )
                          .slice(0, 1)
                          .toUpperCase()
                      }}
                    </span>
                  </span>
                  <div class="friend-info">
                    <strong>{{
                      publicPlayerName(
                        requestItem.user.nickname,
                        requestItem.user.uid,
                      )
                    }}</strong>
                    <span>待处理</span>
                  </div>
                  <div class="friend-row-actions">
                    <RouterLink
                      class="secondary-action compact"
                      :to="{
                        name: 'publicProfile',
                        params: { uid: requestItem.user.uid },
                      }"
                    >
                      查看
                    </RouterLink>
                    <button
                      class="primary-action compact"
                      type="button"
                      :disabled="
                        friendActionBusy === `accept:${requestItem.id}`
                      "
                      @click="acceptFriendRequest(requestItem.id)"
                    >
                      通过
                    </button>
                    <button
                      class="secondary-action compact"
                      type="button"
                      :disabled="
                        friendActionBusy === `reject:${requestItem.id}`
                      "
                      @click="rejectFriendRequest(requestItem.id)"
                    >
                      拒绝
                    </button>
                  </div>
                </article>
              </div>
            </section>

            <section class="friends-block">
              <div class="section-title-row">
                <div>
                  <p class="eyebrow">发出</p>
                  <h3>等待通过</h3>
                </div>
              </div>
              <div
                v-if="outgoingFriendRequests.length === 0"
                class="empty-mini"
              >
                暂无发出
              </div>
              <div v-else class="friend-list">
                <article
                  v-for="requestItem in outgoingFriendRequests"
                  :key="requestItem.id"
                  class="friend-row"
                >
                  <span class="friend-avatar">
                    <img
                      v-if="requestItem.user.avatar"
                      :src="requestItem.user.avatar"
                      :alt="
                        publicPlayerName(
                          requestItem.user.nickname,
                          requestItem.user.uid,
                        )
                      "
                    />
                    <span v-else>
                      {{
                        publicPlayerName(
                          requestItem.user.nickname,
                          requestItem.user.uid,
                        )
                          .slice(0, 1)
                          .toUpperCase()
                      }}
                    </span>
                  </span>
                  <div class="friend-info">
                    <strong>{{
                      publicPlayerName(
                        requestItem.user.nickname,
                        requestItem.user.uid,
                      )
                    }}</strong>
                    <span>等待中</span>
                  </div>
                  <div class="friend-row-actions">
                    <RouterLink
                      class="secondary-action compact"
                      :to="{
                        name: 'publicProfile',
                        params: { uid: requestItem.user.uid },
                      }"
                    >
                      查看
                    </RouterLink>
                    <button
                      class="secondary-action compact"
                      type="button"
                      :disabled="
                        friendActionBusy === `cancel:${requestItem.id}`
                      "
                      @click="cancelFriendRequest(requestItem.id)"
                    >
                      取消
                    </button>
                  </div>
                </article>
              </div>
            </section>
          </div>
        </template>
      </section>

      <section
        v-if="activeSection === 'bag'"
        class="collection-grid bag-layout"
        data-section="bag"
      >
        <div class="panel collection-panel">
          <div class="section-head">
            <div>
              <p class="eyebrow">玩家背包</p>
              <h2>卡片与物品</h2>
            </div>
            <div class="filter-row">
              <select v-model="rarityFilter" @change="resetUserCards">
                <option value="">全部稀有度</option>
                <option
                  v-for="rarity in rarityOrder"
                  :key="rarity"
                  :value="rarity"
                >
                  {{ rarity }}
                </option>
              </select>
              <select v-model="poolFilter" @change="resetUserCards">
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
                    v-if="bulkDecomposePreview?.skippedLocked"
                    class="bulk-preview-line muted"
                  >
                    <span>锁定跳过</span>
                    <strong>{{ bulkDecomposePreview.skippedLocked }} 张</strong>
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

          <div v-if="isAuthed" class="inventory-strip" aria-label="物品库存">
            <template v-if="inventoryItems.length">
              <article
                v-for="item in inventoryItems"
                :key="item.id"
                class="inventory-chip"
                :title="item.desc || item.name"
              >
                <strong>{{ item.name }}</strong>
                <span>{{ itemTypeLabel(item.type) }}</span>
                <b>x{{ item.num }}</b>
              </article>
            </template>
            <span v-else class="inventory-empty-chip">暂无物品</span>
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
                {
                  'is-stacked': Number(card.count || 1) > 1,
                  'actions-open': activeBagActionKey === bagActionKey(card),
                },
              ]"
              :style="{ '--delay': `${Math.min(index * 24, 260)}ms` }"
              role="group"
              tabindex="0"
              @click="openBagCardActions(card)"
              @focusin="openBagCardActions(card)"
              @keydown.enter.prevent="openBagCardActions(card)"
              @keydown.space.prevent="openBagCardActions(card)"
            >
              <div class="card-face">
                <div
                  class="card-media-frame"
                  :class="{ 'has-media': hasCardMedia(card.cardImage) }"
                >
                  <video
                    v-if="isCardVideo(card.cardImage)"
                    class="card-art-media"
                    :src="cardMediaUrl(card.cardImage)"
                    muted
                    loop
                    autoplay
                    playsinline
                    @error="hideBrokenCardMedia"
                  />
                  <img
                    v-else-if="cardMediaUrl(card.cardImage)"
                    class="card-art-media"
                    :src="cardMediaUrl(card.cardImage)"
                    :alt="card.cardName"
                    @error="hideBrokenCardMedia"
                  />
                  <div class="card-sigil"></div>
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
                </div>
                <div class="card-content">
                  <h3 class="card-name">{{ card.cardName }}</h3>
                  <p>{{ cardIntroText(card.cardDesc) }}</p>
                  <div class="tag-row">
                    <span class="cultivation-pill">
                      Lv.{{ card.cultivationLevel || 1 }}
                    </span>
                    <span>战力 {{ card.power || 0 }}</span>
                    <span>{{
                      poolTypeLabel(
                        pools.find((pool) => pool.id === card.poolId)
                          ?.card_type,
                      )
                    }}</span>
                    <span v-if="card.listedCount"
                      >挂售 {{ card.listedCount }}</span
                    >
                    <span v-if="card.lockedCount || card.locked">
                      已锁定 {{ card.lockedCount || 1 }}
                    </span>
                  </div>
                </div>
                <div class="card-action-overlay" aria-label="卡片操作">
                  <span class="card-action-stock">
                    可售 {{ card.sellableCount || 0 }}
                    <b v-if="card.lockedCount">锁定 {{ card.lockedCount }}</b>
                  </span>
                  <button
                    v-if="hasCardIntroDetail(card.cardDesc)"
                    class="card-icon-action"
                    type="button"
                    title="详情"
                    aria-label="详情"
                    @click.stop="
                      openCardIntro({
                        name: card.cardName,
                        desc: card.cardDesc,
                        rarity: String(card.cardLevel),
                        type: cardTypeLabel(card.cardType),
                      })
                    "
                  >
                    <Package :size="16" />
                  </button>
                  <button
                    class="card-icon-action"
                    type="button"
                    :title="cardLockAction(card).label"
                    :aria-label="cardLockAction(card).label"
                    :disabled="!cardLockAction(card).uuid || busy.assets"
                    @click.stop="toggleCardLock(card)"
                  >
                    <Unlock
                      v-if="Number(card.lockedCount || 0) > 0 || card.locked"
                      :size="16"
                    />
                    <Lock v-else :size="16" />
                  </button>
                  <button
                    class="card-icon-action"
                    type="button"
                    :title="
                      card.canSell && Number(card.sellableCount || 0) > 0
                        ? '挂售'
                        : '无可售'
                    "
                    :aria-label="
                      card.canSell && Number(card.sellableCount || 0) > 0
                        ? '挂售'
                        : '无可售'
                    "
                    :disabled="
                      !card.canSell || Number(card.sellableCount || 0) <= 0
                    "
                    @click.stop="openTradeListingModal(card)"
                  >
                    <Store :size="16" />
                  </button>
                  <button
                    class="card-icon-action"
                    type="button"
                    :title="
                      shopRecycleConfig.enabled &&
                      Number(card.sellableCount || 0) > 1
                        ? '回收'
                        : '无可收'
                    "
                    :aria-label="
                      shopRecycleConfig.enabled &&
                      Number(card.sellableCount || 0) > 1
                        ? '回收'
                        : '无可收'
                    "
                    :disabled="
                      !shopRecycleConfig.enabled ||
                      Number(card.sellableCount || 0) <= 1
                    "
                    @click.stop="openRecycleModal(card)"
                  >
                    <Recycle :size="16" />
                  </button>
                  <button
                    class="card-icon-action"
                    type="button"
                    :title="cardUpgradeUuid(card) ? '养成' : '已满级或不可养成'"
                    :aria-label="
                      cardUpgradeUuid(card) ? '养成' : '已满级或不可养成'
                    "
                    :disabled="!cardUpgradeUuid(card) || busy.upgrade"
                    @click.stop="openUpgradeModal(card)"
                  >
                    <WandSparkles :size="16" />
                  </button>
                  <button
                    class="card-icon-action"
                    type="button"
                    title="分享"
                    aria-label="分享"
                    @click.stop="
                      shareCard({
                        cardName: card.cardName,
                        cardDesc: card.cardDesc,
                        cardLevel: String(card.cardLevel),
                        poolId: card.poolId,
                      })
                    "
                  >
                    <Share2 :size="16" />
                  </button>
                </div>
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
              <LoaderCircle v-if="busy.cardsMore" :size="16" class="spin" />
              {{ busy.cardsMore ? "加载中" : "加载" }}
            </button>
            <span v-else class="load-more-done">已全部</span>
          </div>
        </div>
      </section>

      <section
        v-if="activeSection === 'formation'"
        class="panel formation-panel"
        data-section="formation"
      >
        <div class="section-head">
          <div>
            <p class="eyebrow">阵容编队</p>
            <h2>出战卡组</h2>
          </div>
          <div class="section-actions">
            <button
              class="secondary-action compact"
              type="button"
              :disabled="busy.formation"
              @click="loadFormation"
            >
              <RefreshCw :size="16" :class="{ spin: busy.formation }" />
              刷新
            </button>
          </div>
        </div>

        <div v-if="!isAuthed" class="empty-state">
          <UserRound :size="30" />
          <strong>登录后配置阵容</strong>
          <span>选择已拥有的卡片组成出战卡组。</span>
        </div>
        <div v-else-if="busy.formation && !formation" class="skeleton-grid">
          <span v-for="item in 3" :key="item"></span>
        </div>
        <template v-else>
          <div class="formation-summary">
            <article>
              <small>总战力</small>
              <strong>{{ formation?.totalPower || 0 }}</strong>
            </article>
            <article>
              <small>上阵</small>
              <strong
                >{{ formationFilledCount }} /
                {{ formation?.slotCount || 3 }}</strong
              >
            </article>
            <article>
              <small>当前目标</small>
              <strong>编队成型</strong>
            </article>
          </div>

          <div class="formation-slot-grid">
            <article
              v-for="slot in formationSlots"
              :key="slot.position"
              class="formation-slot"
              :class="{ empty: !slot.card }"
            >
              <header>
                <span>位置 {{ slot.position }}</span>
                <b v-if="slot.card">战力 {{ slot.card.power }}</b>
                <b v-else>待上阵</b>
              </header>
              <template v-if="slot.card">
                <div
                  class="formation-card-media"
                  :class="{ 'has-media': hasCardMedia(slot.card.cardImage) }"
                >
                  <video
                    v-if="isCardVideo(slot.card.cardImage)"
                    class="card-art-media"
                    :src="cardMediaUrl(slot.card.cardImage)"
                    muted
                    loop
                    autoplay
                    playsinline
                    @error="hideBrokenCardMedia"
                  />
                  <img
                    v-else-if="cardMediaUrl(slot.card.cardImage)"
                    class="card-art-media"
                    :src="cardMediaUrl(slot.card.cardImage)"
                    :alt="slot.card.cardName"
                    @error="hideBrokenCardMedia"
                  />
                  <span class="rarity-badge">{{ slot.card.cardLevel }}</span>
                </div>
                <div class="formation-card-body">
                  <h3>{{ slot.card.cardName }}</h3>
                  <p>{{ cardIntroText(slot.card.cardDesc) }}</p>
                  <div class="tag-row">
                    <span>Lv.{{ slot.card.cultivationLevel || 1 }}</span>
                    <span>{{ cardTypeLabel(slot.card.cardType) }}</span>
                    <span v-if="slot.card.locked">已锁定</span>
                  </div>
                </div>
                <footer>
                  <button
                    class="secondary-action compact"
                    type="button"
                    :disabled="busy.formation"
                    @click="openFormationPicker(slot.position)"
                  >
                    <Swords :size="15" />
                    更换
                  </button>
                  <button
                    class="danger-action compact"
                    type="button"
                    :disabled="busy.formation"
                    @click="saveFormationSlot(slot.position, null)"
                  >
                    移除
                  </button>
                </footer>
              </template>
              <button
                v-else
                class="formation-empty-action"
                type="button"
                :disabled="busy.formation"
                @click="openFormationPicker(slot.position)"
              >
                <Swords :size="22" />
                <span>选择卡片</span>
              </button>
            </article>
          </div>
        </template>
      </section>

      <section
        v-if="activeSection === 'pve'"
        class="panel pve-panel"
        data-section="pve"
      >
        <div class="section-head">
          <div>
            <p class="eyebrow">轻量关卡</p>
            <h2>星港挑战</h2>
          </div>
          <div class="section-actions">
            <button
              class="secondary-action compact"
              type="button"
              :disabled="busy.pve || busy.pveRecords"
              @click="refreshPve"
            >
              <RefreshCw
                :size="16"
                :class="{ spin: busy.pve || busy.pveRecords }"
              />
              刷新
            </button>
          </div>
        </div>

        <div v-if="!isAuthed" class="empty-state">
          <UserRound :size="30" />
          <strong>登录后挑战关卡</strong>
          <span>先配置阵容，再用总战力挑战开放中的关卡。</span>
        </div>
        <div v-else-if="busy.pve && !pveOverview" class="skeleton-grid">
          <span v-for="item in 4" :key="item"></span>
        </div>
        <template v-else>
          <div class="pve-summary">
            <article>
              <small>阵容战力</small>
              <strong>{{ pveFormation.totalPower }}</strong>
            </article>
            <article>
              <small>上阵卡片</small>
              <strong
                >{{ pveFormation.filledCount }} /
                {{ pveFormation.slotCount }}</strong
              >
            </article>
            <article>
              <small>开放关卡</small>
              <strong>{{ pveStages.length }}</strong>
            </article>
            <article>
              <small>本页胜场</small>
              <strong>{{ pveClearedCount }}</strong>
            </article>
          </div>

          <div v-if="pveStages.length === 0" class="empty-state">
            <Trophy :size="30" />
            <strong>暂无开放关卡</strong>
            <span>稍后再来查看新的挑战。</span>
          </div>
          <div v-else class="pve-stage-grid">
            <article
              v-for="stage in pveStages"
              :key="stage.id"
              class="pve-stage-card"
            >
              <header>
                <span>{{ pveStageLevelLabel(stage) }}</span>
                <b>{{ stage.remainingAttempts }}/{{ stage.dailyLimit }} 次</b>
              </header>
              <h3>{{ stage.name }}</h3>
              <p>{{ stage.description || "完成挑战即可获得胜利奖励。" }}</p>

              <div
                class="pve-power-meter"
                :style="{ '--progress': `${pvePowerPercent(stage)}%` }"
              >
                <div>
                  <span>我方 {{ pveFormation.totalPower }}</span>
                  <span>敌方 {{ stage.enemyPower }}</span>
                </div>
                <i></i>
              </div>

              <dl class="pve-stage-meta">
                <div>
                  <dt>推荐战力</dt>
                  <dd>{{ stage.recommendedPower }}</dd>
                </div>
                <div>
                  <dt>胜利奖励</dt>
                  <dd>{{ formatRewards(stage.rewards) }}</dd>
                </div>
              </dl>

              <button
                class="primary-action wide"
                type="button"
                :disabled="busy.pveChallenge || !stage.canChallenge"
                @click="challengePveStage(stage)"
              >
                <LoaderCircle
                  v-if="busy.pveChallenge"
                  :size="17"
                  class="spin"
                />
                <Swords v-else :size="17" />
                {{
                  stage.canChallenge
                    ? "挑战"
                    : stage.unavailableReason || "不可挑战"
                }}
              </button>
            </article>
          </div>

          <div class="pve-record-panel">
            <div class="section-subhead">
              <div>
                <p class="eyebrow">挑战记录</p>
                <h3>最近结算</h3>
              </div>
              <button
                class="secondary-action compact"
                type="button"
                :disabled="busy.pveRecords"
                @click="loadPveRecords(1)"
              >
                <RefreshCw :size="15" :class="{ spin: busy.pveRecords }" />
                更新
              </button>
            </div>
            <div v-if="busy.pveRecords && !pveRecords" class="skeleton-grid">
              <span v-for="item in 3" :key="item"></span>
            </div>
            <div v-else-if="pveRecentRecords.length === 0" class="empty-mini">
              暂无挑战记录
            </div>
            <div v-else class="pve-record-list">
              <article
                v-for="record in pveRecentRecords"
                :key="record.id"
                :class="{ success: record.success }"
              >
                <div>
                  <strong>{{ record.stageName }}</strong>
                  <span
                    >{{ record.success ? "胜利" : "失败" }} ·
                    {{ formatDate(record.createdAt) }}</span
                  >
                </div>
                <small
                  >战力 {{ record.formationPower }} /
                  {{ record.enemyPower }}</small
                >
                <b>{{
                  record.success
                    ? formatRewards(record.rewards || undefined)
                    : "未获得奖励"
                }}</b>
              </article>
            </div>
            <div v-if="pveRecords" class="pager">
              <button
                class="secondary-action compact"
                type="button"
                :disabled="pveRecordPage <= 1 || busy.pveRecords"
                @click="changePveRecordPage(-1)"
              >
                <ChevronLeft :size="15" />
                上一页
              </button>
              <span>第 {{ pveRecordPage }} / {{ pveRecordTotalPages }} 页</span>
              <button
                class="secondary-action compact"
                type="button"
                :disabled="
                  pveRecordPage >= pveRecordTotalPages || busy.pveRecords
                "
                @click="changePveRecordPage(1)"
              >
                下一页
                <ChevronRight :size="15" />
              </button>
            </div>
          </div>
        </template>
      </section>

      <section
        v-if="activeSection === 'synthesize'"
        class="panel catalog-panel synthesize-panel"
        data-section="synthesize"
      >
        <div class="section-head">
          <div>
            <p class="eyebrow">卡池图鉴</p>
            <h2>收集进度</h2>
          </div>
          <div class="filter-row">
            <select v-model="activePoolId">
              <option v-for="pool in pools" :key="pool.id" :value="pool.id">
                {{ pool.pool_name }}
              </option>
            </select>
            <select v-model="synthesisRarityFilter">
              <option value="">全部</option>
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
            <small>已收集</small>
            <strong
              >{{ catalogCollectedCount }}/{{ catalogCards.length }}</strong
            >
          </article>
          <article>
            <small>可合成</small>
            <strong>{{ synthesisAvailableCount }}</strong>
          </article>
        </div>

        <div v-if="busy.catalog" class="skeleton-grid">
          <span v-for="item in 6" :key="item"></span>
        </div>
        <div v-else-if="catalogError" class="empty-state">
          <Package :size="30" />
          <strong>同步失败</strong>
          <span>{{ catalogError }}</span>
        </div>
        <div v-else-if="poolCards.length === 0" class="empty-state">
          <Package :size="30" />
          <strong>暂无图鉴</strong>
          <span>切换卡池查看</span>
        </div>
        <div
          v-else-if="filteredSynthesisCards.length === 0"
          class="empty-state"
        >
          <Package :size="30" />
          <strong>暂无匹配</strong>
          <span>调整筛选</span>
        </div>
        <div v-else class="catalog-grid synthesis-grid">
          <article
            v-for="(item, index) in filteredSynthesisCards"
            :key="item.key"
            class="result-card synthesis-card"
            :class="[
              rarityClass(item.rarity),
              { 'is-uncollected': !item.collected },
            ]"
            :style="{ '--delay': `${Math.min(index * 24, 260)}ms` }"
          >
            <div class="card-face">
              <div
                class="card-media-frame"
                :class="{ 'has-media': hasCardMedia(item.card.card_image) }"
              >
                <video
                  v-if="isCardVideo(item.card.card_image)"
                  class="card-art-media"
                  :src="cardMediaUrl(item.card.card_image)"
                  muted
                  loop
                  autoplay
                  playsinline
                  @error="hideBrokenCardMedia"
                />
                <img
                  v-else-if="cardMediaUrl(item.card.card_image)"
                  class="card-art-media"
                  :src="cardMediaUrl(item.card.card_image)"
                  :alt="item.card.card_name"
                  @error="hideBrokenCardMedia"
                />
                <div class="card-sigil"></div>
                <div class="result-card-top">
                  <span class="rarity-badge">{{ item.rarity }}</span>
                  <span class="card-type-pill">{{
                    cardTypeLabel(item.card.card_type)
                  }}</span>
                </div>
              </div>
              <div class="card-content">
                <h3 class="card-name">{{ item.card.card_name }}</h3>
                <div class="tag-row">
                  <span>{{ item.collected ? "已收集" : "未收集" }}</span>
                  <span v-if="!item.collected && item.rarity !== 'UR'">
                    {{ item.fragmentCount }}/{{ item.requiredFragments }}
                  </span>
                </div>
              </div>
            </div>
            <button
              v-if="!item.collected"
              class="secondary-action"
              type="button"
              :disabled="busy.catalog || !item.canSynthesize"
              @click="synthesizeCard(item)"
            >
              {{
                item.canSynthesize
                  ? "合成"
                  : item.rarity === "UR"
                    ? "不可合成"
                    : "碎片不足"
              }}
            </button>
            <span v-else class="catalog-owned-label">已收集</span>
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
          <div class="section-actions">
            <button
              class="secondary-action compact"
              type="button"
              :disabled="busy.points"
              @click="loadPointRecords"
            >
              <RefreshCw :size="16" :class="{ spin: busy.points }" />
              刷新
            </button>
          </div>
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
          <div class="section-actions">
            <button
              class="secondary-action compact"
              type="button"
              :disabled="busy.trade"
              @click="loadTradeData"
            >
              <RefreshCw :size="16" :class="{ spin: busy.trade }" />
              刷新
            </button>
          </div>
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
                  <div
                    class="card-media-frame trade-media-frame"
                    :class="{ 'has-media': hasCardMedia(listing.cardImage) }"
                  >
                    <video
                      v-if="isCardVideo(listing.cardImage)"
                      class="card-art-media"
                      :src="cardMediaUrl(listing.cardImage)"
                      muted
                      loop
                      autoplay
                      playsinline
                      @error="hideBrokenCardMedia"
                    />
                    <img
                      v-else-if="cardMediaUrl(listing.cardImage)"
                      class="card-art-media"
                      :src="cardMediaUrl(listing.cardImage)"
                      :alt="listing.cardName"
                      @error="hideBrokenCardMedia"
                    />
                    <div class="card-sigil"></div>
                    <span class="rarity-badge">{{ listing.cardLevel }}</span>
                  </div>
                  <strong class="card-name">{{ listing.cardName }}</strong>
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
          <div class="section-actions">
            <button
              class="secondary-action compact"
              type="button"
              :disabled="busy.leaderboard"
              @click="loadLeaderboard"
            >
              <RefreshCw :size="16" :class="{ spin: busy.leaderboard }" />
              刷新
            </button>
          </div>
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
              <RouterLink
                v-for="entry in podiumEntries"
                :key="`podium-${activeLeaderboardMetric}-${entry.uid}`"
                class="podium-card"
                :class="`rank-${entry.rank}`"
                :to="{
                  name: 'publicProfile',
                  params: { uid: entry.uid },
                }"
              >
                <span class="rank-badge">{{
                  leaderboardRankLabel(entry.rank)
                }}</span>
                <img
                  v-if="entry.avatar"
                  :src="entry.avatar"
                  :alt="publicPlayerName(entry.nickname, entry.uid)"
                />
                <span v-else class="avatar-fallback">{{
                  leaderboardInitial(entry)
                }}</span>
                <h3>{{ publicPlayerName(entry.nickname, entry.uid) }}</h3>
                <p>{{ activeLeaderboardTab.label }}</p>
                <strong>{{ formatLeaderboardValue(entry.value) }}</strong>
              </RouterLink>
            </div>

            <div v-if="leaderboardRows.length" class="leaderboard-list">
              <RouterLink
                v-for="entry in leaderboardRows"
                :key="`${activeLeaderboardMetric}-${entry.uid}`"
                class="leaderboard-row"
                :class="{ mine: entry.uid === activeLeaderboardBoard?.me?.uid }"
                :to="{
                  name: 'publicProfile',
                  params: { uid: entry.uid },
                }"
              >
                <b>{{ leaderboardRankLabel(entry.rank) }}</b>
                <img
                  v-if="entry.avatar"
                  :src="entry.avatar"
                  :alt="publicPlayerName(entry.nickname, entry.uid)"
                />
                <span v-else class="avatar-fallback small">{{
                  leaderboardInitial(entry)
                }}</span>
                <div>
                  <strong>{{ publicPlayerName(entry.nickname, entry.uid) }}</strong>
                  <span>{{ activeLeaderboardTab.label }}</span>
                </div>
                <em>{{ formatLeaderboardValue(entry.value) }}</em>
              </RouterLink>
            </div>
          </div>

          <p class="leaderboard-time">
            更新时间：{{ formatDate(leaderboard?.generatedAt) }}
          </p>
        </div>
      </section>

      <section
        v-if="activeSection === 'tasks'"
        class="panel task-panel"
        data-section="tasks"
      >
        <div class="section-head">
          <div>
            <p class="eyebrow">任务中心</p>
            <h2>日常与周常</h2>
          </div>
          <div class="section-actions">
            <button
              class="secondary-action compact"
              type="button"
              :disabled="busy.tasks"
              @click="loadTasks"
            >
              <RefreshCw :size="16" :class="{ spin: busy.tasks }" />
              刷新
            </button>
          </div>
        </div>

        <div v-if="!isAuthed" class="empty-state">
          <ListChecks :size="30" />
          <strong>登录后查看任务</strong>
          <span>每日目标和周常奖励会出现在这里。</span>
        </div>
        <div
          v-else-if="busy.tasks && !tasksOverview"
          class="skeleton-grid achievement-skeleton"
        >
          <span v-for="item in 6" :key="item"></span>
        </div>
        <div v-else-if="!activeTaskOverview" class="empty-state">
          <ListChecks :size="30" />
          <strong>任务正在整理</strong>
          <span>稍后刷新即可查看。</span>
        </div>
        <div v-else class="task-content">
          <div class="task-toolbar">
            <div class="segmented-control task-scope-switch">
              <button
                type="button"
                :class="{ active: taskScope === 'daily' }"
                @click="taskScope = 'daily'"
              >
                <CalendarCheck :size="15" />
                日常
              </button>
              <button
                type="button"
                :class="{ active: taskScope === 'weekly' }"
                @click="taskScope = 'weekly'"
              >
                <CalendarDays :size="15" />
                周常
              </button>
            </div>
            <span>{{ taskPeriodText(activeTaskOverview) }}</span>
          </div>

          <div class="achievement-summary task-summary">
            <article>
              <small>已完成</small>
              <strong
                >{{ taskCompletedCount }}/{{ activeTaskList.length }}</strong
              >
            </article>
            <article>
              <small>已领取</small>
              <strong>{{ taskClaimedCount }}</strong>
            </article>
            <article>
              <small>活跃度</small>
              <strong>{{ activeTaskOverview.activity }}</strong>
            </article>
          </div>

          <section
            class="task-activity"
            :style="{ '--progress': `${taskActivityPercent}%` }"
          >
            <header>
              <div>
                <strong>{{ activeTaskOverview.label }}活跃度</strong>
                <span>
                  {{ activeTaskOverview.activity }} /
                  {{ activeTaskOverview.maxActivity }}
                </span>
              </div>
              <b>{{ taskActivityPercent }}%</b>
            </header>
            <div class="achievement-progress task-activity-progress">
              <i></i>
            </div>
            <div class="task-milestones">
              <button
                v-for="milestone in activeTaskMilestones"
                :key="`${activeTaskOverview.scope}-${milestone.threshold}`"
                type="button"
                :class="{
                  claimed: milestone.claimed,
                  available: milestone.available,
                }"
                :disabled="
                  busy.claimTask || milestone.claimed || !milestone.available
                "
                @click="claimActivityReward(milestone)"
              >
                <Gift :size="15" />
                <span>{{ milestone.threshold }}</span>
                <small>{{ formatRewards(milestone.rewards) }}</small>
              </button>
            </div>
          </section>

          <div class="achievement-grid task-grid">
            <article
              v-for="task in activeTaskList"
              :key="task.id"
              class="achievement-card task-card"
              :class="{ achieved: task.claimed, completed: task.completed }"
              :style="{ '--progress': `${taskProgressPercent(task)}%` }"
            >
              <header>
                <span class="achievement-icon">
                  <ListChecks :size="17" />
                </span>
                <div>
                  <strong>{{ task.name }}</strong>
                  <small>活跃度 +{{ task.activityPoints }}</small>
                </div>
                <b>{{
                  task.claimed ? "已领取" : task.completed ? "可领取" : "进行中"
                }}</b>
              </header>
              <p>{{ task.description }}</p>
              <div class="achievement-meta">
                <span>{{ taskProgressText(task) }}</span>
                <span>奖励 {{ formatRewards(task.rewards) }}</span>
              </div>
              <div class="achievement-progress" aria-hidden="true">
                <i></i>
              </div>
              <footer>
                <button
                  class="primary-action wide"
                  type="button"
                  :disabled="busy.claimTask || task.claimed || !task.completed"
                  @click="claimTaskReward(task)"
                >
                  <LoaderCircle
                    v-if="busy.claimTask && task.completed && !task.claimed"
                    :size="17"
                    class="spin"
                  />
                  <Gift v-else :size="17" />
                  {{
                    task.claimed
                      ? "已领取"
                      : task.completed
                        ? "领取奖励"
                        : "未完成"
                  }}
                </button>
              </footer>
            </article>
          </div>
        </div>
      </section>

      <section
        v-if="activeSection === 'season'"
        class="panel season-panel"
        data-section="season"
      >
        <div class="section-head">
          <div>
            <p class="eyebrow">赛季远征</p>
            <h2>{{ activeSeason?.name || "当前赛季" }}</h2>
          </div>
          <div class="section-actions">
            <button
              class="secondary-action compact"
              type="button"
              :disabled="busy.season"
              @click="loadSeasonOverview"
            >
              <RefreshCw :size="16" :class="{ spin: busy.season }" />
              刷新
            </button>
          </div>
        </div>

        <div v-if="!isAuthed" class="empty-state">
          <CalendarDays :size="30" />
          <strong>登录后查看赛季</strong>
          <span>完成任务会积累赛季积分，可用于兑换赛季奖励。</span>
        </div>
        <div
          v-else-if="busy.season && !seasonOverview"
          class="skeleton-grid season-skeleton"
        >
          <span v-for="item in 6" :key="item"></span>
        </div>
        <div v-else-if="!activeSeason" class="empty-state">
          <CalendarDays :size="30" />
          <strong>暂无开放赛季</strong>
          <span>新的赛季开放后会出现在这里。</span>
        </div>
        <div v-else class="season-content">
          <div class="season-hero">
            <div>
              <span class="type-pill">赛季进行中</span>
              <h3>{{ activeSeason.name }}</h3>
              <p>
                {{
                  activeSeason.description ||
                  "完成每日与周常任务，积累赛季积分。"
                }}
              </p>
              <small>
                {{ formatDate(activeSeason.startsAt) }} 至
                {{ formatDate(activeSeason.endsAt) }}
              </small>
            </div>
            <div class="season-score">
              <span>我的排名</span>
              <strong>{{ seasonRankText }}</strong>
              <small>累计 {{ seasonPoints.earned }} 赛季积分</small>
            </div>
          </div>

          <div class="season-summary">
            <article>
              <small>累计获得</small>
              <strong>{{ seasonPoints.earned }}</strong>
            </article>
            <article>
              <small>可用余额</small>
              <strong>{{ seasonPoints.balance }}</strong>
            </article>
            <article>
              <small>商店兑换项</small>
              <strong>{{ seasonShopItems.length }}</strong>
            </article>
            <article>
              <small>排行人数</small>
              <strong>{{ seasonLeaderboardRows.length }}</strong>
            </article>
          </div>

          <section class="season-block">
            <div class="section-subhead">
              <div>
                <p class="eyebrow">活动排行</p>
                <h3>赛季积分榜</h3>
              </div>
              <Trophy :size="22" />
            </div>
            <div v-if="seasonLeaderboardRows.length === 0" class="empty-mini">
              暂无排行记录
            </div>
            <div v-else class="season-rank-list">
              <RouterLink
                v-for="entry in seasonLeaderboardRows.slice(0, 10)"
                :key="entry.uid"
                class="season-rank-row"
                :class="{ mine: entry.uid === currentUser?.uid }"
                :to="{
                  name: 'publicProfile',
                  params: { uid: entry.uid },
                }"
              >
                <b>{{ leaderboardRankLabel(entry.rank) }}</b>
                <img
                  v-if="entry.avatar"
                  :src="entry.avatar"
                  :alt="publicPlayerName(entry.nickname, entry.uid)"
                />
                <span v-else class="avatar-fallback small">
                  {{ leaderboardInitial(entry) }}
                </span>
                <div>
                  <strong>{{ publicPlayerName(entry.nickname, entry.uid) }}</strong>
                  <span>赛季积分</span>
                </div>
                <em>{{ entry.value }} 积分</em>
              </RouterLink>
            </div>
          </section>

          <section class="season-block">
            <div class="section-subhead">
              <div>
                <p class="eyebrow">赛季商店</p>
                <h3>积分兑换</h3>
              </div>
              <Store :size="22" />
            </div>
            <div v-if="seasonShopItems.length === 0" class="empty-mini">
              暂无可兑换奖励
            </div>
            <div v-else class="season-shop-grid">
              <article v-for="item in seasonShopItems" :key="item.id">
                <header>
                  <div>
                    <strong>{{ item.name }}</strong>
                    <span>{{ item.description || "赛季限定兑换奖励" }}</span>
                  </div>
                  <b>{{ item.costPoints }} 积分</b>
                </header>
                <dl>
                  <div>
                    <dt>奖励</dt>
                    <dd>{{ formatRewards(item.rewards) }}</dd>
                  </div>
                  <div>
                    <dt>库存</dt>
                    <dd>
                      {{
                        item.remaining === null || item.remaining === undefined
                          ? "不限库存"
                          : `剩余 ${item.remaining}`
                      }}
                    </dd>
                  </div>
                  <div>
                    <dt>限兑</dt>
                    <dd>
                      {{
                        item.userLimit
                          ? `${item.usedByUser || 0}/${item.userLimit}`
                          : "不限"
                      }}
                    </dd>
                  </div>
                </dl>
                <div class="season-shop-actions">
                  <input
                    v-model.number="seasonShopCounts[item.id]"
                    type="number"
                    min="1"
                    max="99"
                    placeholder="1"
                  />
                  <button
                    class="primary-action"
                    type="button"
                    :disabled="busy.seasonShop || !item.canBuy"
                    @click="buySeasonShopItem(item)"
                  >
                    <LoaderCircle
                      v-if="busy.seasonShop"
                      :size="17"
                      class="spin"
                    />
                    <Gift v-else :size="17" />
                    {{
                      item.canBuy
                        ? "兑换"
                        : item.unavailableReason || "不可兑换"
                    }}
                  </button>
                </div>
              </article>
            </div>
          </section>

          <section class="season-block">
            <div class="section-subhead">
              <div>
                <p class="eyebrow">积分记录</p>
                <h3>最近变动</h3>
              </div>
              <History :size="22" />
            </div>
            <div v-if="seasonPointRecords.length === 0" class="empty-mini">
              暂无赛季积分记录
            </div>
            <div v-else class="season-record-list">
              <article
                v-for="record in seasonPointRecords"
                :key="record.id"
                :class="pointChangeClass(record.changeAmount)"
              >
                <div>
                  <strong>{{ record.title }}</strong>
                  <span>
                    {{ seasonPointSourceLabel(record.sourceType) }} ·
                    {{ formatDate(record.createdAt) }}
                  </span>
                </div>
                <b>{{ formatPointChange(record.changeAmount) }}</b>
              </article>
            </div>
          </section>
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
          <div class="section-actions">
            <button
              class="secondary-action compact"
              type="button"
              :disabled="busy.achievements"
              @click="loadAchievements"
            >
              <RefreshCw :size="16" :class="{ spin: busy.achievements }" />
              刷新
            </button>
          </div>
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
            <button
              class="secondary-action"
              type="button"
              @click="resetAchievementFilters"
            >
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
                  <p>
                    {{ achievement.description || "完成目标后自动发放奖励。" }}
                  </p>
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
            <div class="section-actions">
              <button
                class="secondary-action compact"
                type="button"
                :disabled="busy.shop"
                @click="loadExchangeItems"
              >
                <RefreshCw :size="16" :class="{ spin: busy.shop }" />
                刷新
              </button>
            </div>
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
          <button
            class="secondary-action compact"
            type="button"
            :disabled="!isAuthed || busy.drawHistory"
            @click="openDrawHistory"
          >
            <History :size="16" />
            查看全部
          </button>
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
        v-for="item in primaryNavItems"
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
                    <p class="eyebrow">保底规则</p>
                    <h3>当前进度</h3>
                  </div>
                </div>
                <div v-if="poolDetailPity" class="pool-pity-summary">
                  <article v-if="poolDetailPity.soft">
                    <span>阶段保底</span>
                    <strong>{{ pityRuleLabel(poolDetailPity.soft) }}</strong>
                  </article>
                  <article v-if="poolDetailPity.hard">
                    <span>硬保底</span>
                    <strong>{{ pityRuleLabel(poolDetailPity.hard) }}</strong>
                  </article>
                  <article v-if="!poolDetailPity.soft && !poolDetailPity.hard">
                    <span>保底规则</span>
                    <strong>当前卡池暂无保底规则</strong>
                  </article>
                </div>
                <div v-else class="empty-state compact">
                  <ShieldCheck :size="26" />
                  <strong>登录后查看个人保底进度</strong>
                  <span>抽取后这里会记录当前卡池的保底进度。</span>
                </div>
              </section>

              <section class="pool-detail-section">
                <div class="section-title-row">
                  <div>
                    <p class="eyebrow">卡池图鉴</p>
                    <h3>全部卡片</h3>
                  </div>
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
                    <div
                      class="card-media-frame pool-detail-media-frame"
                      :class="{
                        'has-media': hasCardMedia(item.card.card_image),
                      }"
                    >
                      <video
                        v-if="isCardVideo(item.card.card_image)"
                        class="card-art-media"
                        :src="cardMediaUrl(item.card.card_image)"
                        muted
                        loop
                        autoplay
                        playsinline
                        @error="hideBrokenCardMedia"
                      />
                      <img
                        v-else-if="cardMediaUrl(item.card.card_image)"
                        class="card-art-media"
                        :src="cardMediaUrl(item.card.card_image)"
                        :alt="item.card.card_name"
                        @error="hideBrokenCardMedia"
                      />
                      <div class="card-sigil"></div>
                    </div>
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
                    <strong
                      class="card-name"
                      :class="strongestRarityClass(item.rarities)"
                    >
                      {{ item.card.card_name }}
                    </strong>
                    <div class="tag-row">
                      <span>{{ cardTypeLabel(item.card.card_type) }}</span>
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
        v-if="profilePickerOpen"
        class="result-modal-backdrop"
        role="presentation"
        @click.self="closeProfilePicker"
      >
        <section
          class="trade-listing-modal profile-picker-modal"
          role="dialog"
          aria-modal="true"
          aria-label="选择展示卡片"
        >
          <header class="result-modal-head">
            <div>
              <p class="eyebrow">展示墙</p>
              <h2>选择卡片</h2>
              <span>{{ profileSelectedUuids.length }}/6</span>
            </div>
            <button
              class="modal-close"
              type="button"
              :disabled="busy.profileSaving"
              @click="closeProfilePicker"
            >
              关闭
            </button>
          </header>
          <div class="trade-listing-body profile-picker-body">
            <div v-if="busy.profileCandidates" class="empty-state compact">
              <LoaderCircle :size="26" class="spin" />
              <strong>正在读取背包</strong>
              <span>稍候片刻</span>
            </div>
            <div
              v-else-if="profileCandidates.length === 0"
              class="empty-state compact"
            >
              <Package :size="26" />
              <strong>暂无卡片</strong>
              <span>获得卡片后可展示。</span>
            </div>
            <div v-else class="profile-candidate-list">
              <article
                v-for="card in profileCandidates"
                :key="candidateUuid(card) || `${card.cardId}-${card.cardName}`"
                class="profile-candidate"
                :class="[
                  rarityClass(card.cardLevel),
                  { selected: isProfileCandidateSelected(card) },
                ]"
              >
                <div
                  class="profile-candidate-media"
                  :class="{ 'has-media': hasCardMedia(card.cardImage) }"
                >
                  <video
                    v-if="isCardVideo(card.cardImage)"
                    class="card-art-media"
                    :src="cardMediaUrl(card.cardImage)"
                    muted
                    loop
                    autoplay
                    playsinline
                    @error="hideBrokenCardMedia"
                  />
                  <img
                    v-else-if="cardMediaUrl(card.cardImage)"
                    class="card-art-media"
                    :src="cardMediaUrl(card.cardImage)"
                    :alt="card.cardName"
                    @error="hideBrokenCardMedia"
                  />
                  <span class="rarity-badge">{{ card.cardLevel }}</span>
                </div>
                <div class="profile-candidate-body">
                  <strong>{{ card.cardName }}</strong>
                  <span>Lv.{{ card.cultivationLevel || 1 }}</span>
                  <div class="tag-row">
                    <span>战力 {{ card.power || 0 }}</span>
                    <span v-if="card.locked">已锁定</span>
                  </div>
                </div>
                <button
                  class="primary-action compact"
                  type="button"
                  :disabled="!candidateUuid(card) || busy.profileSaving"
                  @click="toggleProfileCandidate(card)"
                >
                  {{ isProfileCandidateSelected(card) ? "已选" : "选择" }}
                </button>
              </article>
            </div>
          </div>
          <footer class="result-modal-actions">
            <button
              class="secondary-action"
              type="button"
              :disabled="busy.profileSaving"
              @click="closeProfilePicker"
            >
              取消
            </button>
            <button
              class="danger-action"
              type="button"
              :disabled="
                busy.profileSaving || profileSelectedUuids.length === 0
              "
              @click="profileSelectedUuids = []"
            >
              清空
            </button>
            <button
              class="primary-action"
              type="button"
              :disabled="busy.profileSaving"
              @click="saveProfileShowcase"
            >
              <LoaderCircle v-if="busy.profileSaving" :size="18" class="spin" />
              <Package v-else :size="18" />
              保存
            </button>
          </footer>
        </section>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="formationPickerOpen"
        class="result-modal-backdrop"
        role="presentation"
        @click.self="closeFormationPicker"
      >
        <section
          class="trade-listing-modal formation-picker-modal"
          role="dialog"
          aria-modal="true"
          aria-label="选择上阵卡片"
        >
          <header class="result-modal-head">
            <div>
              <p class="eyebrow">阵容编队</p>
              <h2>位置 {{ formationEditingPosition || "-" }}</h2>
              <span>
                当前
                {{ formationEditingSlot?.card?.cardName || "空位" }}
              </span>
            </div>
            <button
              class="modal-close"
              type="button"
              :disabled="busy.formation"
              @click="closeFormationPicker"
            >
              关闭
            </button>
          </header>
          <div class="trade-listing-body formation-picker-body">
            <div v-if="busy.formationCandidates" class="empty-state compact">
              <LoaderCircle :size="26" class="spin" />
              <strong>正在读取背包</strong>
              <span>可上阵卡片同步中。</span>
            </div>
            <div
              v-else-if="formationCandidates.length === 0"
              class="empty-state compact"
            >
              <Package :size="26" />
              <strong>暂无可选卡片</strong>
              <span>获得卡片后即可加入阵容。</span>
            </div>
            <div v-else class="formation-candidate-list">
              <article
                v-for="card in formationCandidates"
                :key="candidateUuid(card) || `${card.cardId}-${card.cardName}`"
                class="formation-candidate"
                :class="[
                  rarityClass(card.cardLevel),
                  {
                    listed: card.isListed,
                    selected: isFormationCandidateSelected(card),
                  },
                ]"
              >
                <div
                  class="formation-candidate-media"
                  :class="{ 'has-media': hasCardMedia(card.cardImage) }"
                >
                  <video
                    v-if="isCardVideo(card.cardImage)"
                    class="card-art-media"
                    :src="cardMediaUrl(card.cardImage)"
                    muted
                    loop
                    autoplay
                    playsinline
                    @error="hideBrokenCardMedia"
                  />
                  <img
                    v-else-if="cardMediaUrl(card.cardImage)"
                    class="card-art-media"
                    :src="cardMediaUrl(card.cardImage)"
                    :alt="card.cardName"
                    @error="hideBrokenCardMedia"
                  />
                  <span class="rarity-badge">{{ card.cardLevel }}</span>
                </div>
                <div class="formation-candidate-body">
                  <strong>{{ card.cardName }}</strong>
                  <span>
                    Lv.{{ card.cultivationLevel || 1 }} · 战力
                    {{ card.power || 0 }}
                  </span>
                  <div class="tag-row">
                    <span>{{ cardTypeLabel(card.cardType) }}</span>
                    <span v-if="card.locked">已锁定</span>
                    <span v-if="card.isListed">挂售中</span>
                  </div>
                </div>
                <button
                  class="primary-action compact"
                  type="button"
                  :disabled="
                    busy.formation ||
                    card.isListed ||
                    !candidateUuid(card) ||
                    isFormationCandidateSelected(card)
                  "
                  @click="
                    saveFormationSlot(
                      formationEditingPosition || 1,
                      candidateUuid(card),
                    )
                  "
                >
                  {{
                    isFormationCandidateSelected(card)
                      ? "已上阵"
                      : card.isListed
                        ? "挂售中"
                        : "上阵"
                  }}
                </button>
              </article>
            </div>
          </div>
          <footer class="result-modal-actions">
            <button
              class="secondary-action"
              type="button"
              :disabled="busy.formation"
              @click="closeFormationPicker"
            >
              取消
            </button>
            <button
              class="danger-action"
              type="button"
              :disabled="busy.formation || !formationEditingSlot?.card"
              @click="saveFormationSlot(formationEditingPosition || 1, null)"
            >
              清空位置
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
        v-if="upgradeTarget"
        class="result-modal-backdrop"
        role="presentation"
        @click.self="closeUpgradeModal"
      >
        <section
          class="trade-listing-modal upgrade-modal"
          role="dialog"
          aria-modal="true"
          aria-label="卡片养成"
        >
          <header class="result-modal-head">
            <div>
              <p class="eyebrow">卡片养成</p>
              <h2>{{ upgradeTarget.cardName }}</h2>
              <span>
                {{ upgradeTarget.cardLevel }} · Lv.{{
                  upgradePreview?.current.level ||
                  upgradeTarget.cultivationLevel ||
                  1
                }}
              </span>
            </div>
            <button
              class="modal-close"
              type="button"
              :disabled="busy.upgrade"
              @click="closeUpgradeModal"
            >
              关闭
            </button>
          </header>
          <div class="trade-listing-body upgrade-modal-body">
            <div
              v-if="busy.upgrade && !upgradePreview"
              class="empty-state compact"
            >
              <LoaderCircle :size="26" class="spin" />
              <strong>正在读取养成信息</strong>
              <span>碎片库存与等级状态加载中。</span>
            </div>
            <template v-else-if="upgradePreview">
              <div class="upgrade-compare">
                <article>
                  <span>当前</span>
                  <strong>Lv.{{ upgradePreview.current.level }}</strong>
                  <b>战力 {{ upgradePreview.current.power }}</b>
                </article>
                <ChevronRight :size="22" />
                <article :class="{ muted: !upgradePreview.next }">
                  <span>下一级</span>
                  <strong>
                    Lv.{{
                      upgradePreview.next?.level || upgradePreview.current.level
                    }}
                  </strong>
                  <b>
                    战力
                    {{
                      upgradePreview.next?.power || upgradePreview.current.power
                    }}
                  </b>
                </article>
              </div>
              <dl>
                <div>
                  <dt>等级上限</dt>
                  <dd>{{ upgradePreview.current.maxLevel }}</dd>
                </div>
                <div>
                  <dt>本次提升</dt>
                  <dd>战力 +{{ upgradePowerGain }}</dd>
                </div>
                <div>
                  <dt>消耗碎片</dt>
                  <dd>
                    {{ upgradePreview.cost.itemName }} x{{
                      upgradePreview.cost.num
                    }}
                  </dd>
                </div>
                <div>
                  <dt>当前库存</dt>
                  <dd>{{ upgradePreview.cost.owned }}</dd>
                </div>
              </dl>
              <p
                v-if="upgradePreview.unavailableReason"
                class="upgrade-warning"
              >
                {{ upgradePreview.unavailableReason }}
              </p>
            </template>
          </div>
          <footer class="result-modal-actions">
            <button
              class="secondary-action"
              type="button"
              :disabled="busy.upgrade"
              @click="closeUpgradeModal"
            >
              取消
            </button>
            <button
              class="primary-action"
              type="button"
              :disabled="
                busy.upgrade || !upgradePreview || !upgradePreview.canUpgrade
              "
              @click="upgradeCard"
            >
              <LoaderCircle v-if="busy.upgrade" :size="18" class="spin" />
              <WandSparkles v-else :size="18" />
              确认养成
            </button>
          </footer>
        </section>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="recycleTarget"
        class="result-modal-backdrop"
        role="presentation"
        @click.self="closeRecycleModal"
      >
        <section
          class="trade-listing-modal recycle-modal"
          role="dialog"
          aria-modal="true"
          aria-label="回收"
        >
          <header class="result-modal-head">
            <div>
              <p class="eyebrow">商店</p>
              <h2>{{ recycleTarget.cardName }}</h2>
              <span>{{ recycleTarget.cardLevel }}</span>
            </div>
            <button
              class="modal-close"
              type="button"
              @click="closeRecycleModal"
            >
              关闭
            </button>
          </header>
          <div class="trade-listing-body">
            <label class="redeem-input">
              <span>数量</span>
              <input
                v-model.number="recycleCount"
                type="number"
                min="1"
                :max="recycleAvailableCount"
                step="1"
              />
            </label>
            <dl>
              <div>
                <dt>可回收</dt>
                <dd>{{ recycleAvailableCount }} 张</dd>
              </div>
              <div>
                <dt>单价</dt>
                <dd>{{ recycleUnitPrice }} 星穹币</dd>
              </div>
              <div>
                <dt>总计</dt>
                <dd>{{ recycleTotalPoints }} 星穹币</dd>
              </div>
            </dl>
          </div>
          <footer class="result-modal-actions">
            <button
              class="secondary-action"
              type="button"
              @click="closeRecycleModal"
            >
              取消
            </button>
            <button
              class="primary-action"
              type="button"
              :disabled="busy.recycle || recycleAvailableCount <= 0"
              @click="recycleCards"
            >
              确认回收
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
                  [
                    cardIntroTarget.rarity,
                    cardIntroTarget.type,
                    cardIntroTarget.extra,
                  ]
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
            <button
              class="secondary-action"
              type="button"
              @click="closeShareText"
            >
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
        v-if="drawHistoryOpen"
        class="result-modal-backdrop"
        role="presentation"
        @click.self="closeDrawHistory"
      >
        <section
          class="trade-listing-modal draw-history-modal"
          role="dialog"
          aria-modal="true"
          aria-label="抽卡历史"
        >
          <header class="result-modal-head">
            <div>
              <p class="eyebrow">抽卡历史</p>
              <h2>全部记录</h2>
              <span>
                第 {{ drawHistoryPage }} / {{ drawHistoryTotalPages }} 页 · 共
                {{ drawHistory?.total || 0 }} 条
              </span>
            </div>
            <button class="modal-close" type="button" @click="closeDrawHistory">
              关闭
            </button>
          </header>
          <div class="trade-listing-body draw-history-body">
            <div v-if="busy.drawHistory" class="empty-state compact">
              <LoaderCircle :size="26" class="spin" />
              <strong>正在整理记录</strong>
              <span>抽卡明细加载中。</span>
            </div>
            <div
              v-else-if="drawHistoryRows.length === 0"
              class="empty-state compact"
            >
              <History :size="26" />
              <strong>暂无抽卡历史</strong>
              <span>完成抽取后会出现在这里。</span>
            </div>
            <div v-else class="draw-history-list">
              <article
                v-for="record in drawHistoryRows"
                :key="record.id"
                class="draw-history-record"
              >
                <header>
                  <strong>{{ record.count }} 抽</strong>
                  <time>{{ formatDate(record.createdAt) }}</time>
                </header>
                <div class="draw-history-cards">
                  <div
                    v-for="detail in record.details"
                    :key="
                      detail.cardUuid ||
                      `${record.id}-${detail.cardId}-${detail.rarity}`
                    "
                    class="draw-history-card"
                    :class="rarityClass(detail.rarity)"
                  >
                    <span class="rarity-badge">{{ detail.rarity }}</span>
                    <strong>{{ detail.cardName }}</strong>
                    <small>{{ detail.cardUuid || "旧记录" }}</small>
                    <div v-if="detail.isUp || detail.isPity" class="tag-row">
                      <span v-if="detail.isUp">UP</span>
                      <span v-if="detail.isPity">保底</span>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </div>
          <footer class="result-modal-actions">
            <button
              class="secondary-action"
              type="button"
              :disabled="busy.drawHistory || drawHistoryPage <= 1"
              @click="changeDrawHistoryPage(-1)"
            >
              <ChevronLeft :size="16" />
              上一页
            </button>
            <button
              class="secondary-action"
              type="button"
              :disabled="
                busy.drawHistory || drawHistoryPage >= drawHistoryTotalPages
              "
              @click="changeDrawHistoryPage(1)"
            >
              下一页
              <ChevronRight :size="16" />
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
          class="result-modal draw-result-modal"
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
            class="result-grid modal-result-grid draw-result-grid"
            :class="{ single: lastResults.length === 1 }"
          >
            <article
              v-for="(card, index) in lastResults"
              :key="`${card.userCardUuid}-${index}`"
              class="result-card draw-result-card"
              :class="[
                rarityClass(card.rarity),
                { featured: lastResults.length === 1 },
              ]"
              :style="{ '--delay': `${Math.min(index * 42, 420)}ms` }"
            >
              <div class="card-face">
                <div
                  class="card-media-frame"
                  :class="{ 'has-media': hasCardMedia(card.cardImage) }"
                >
                  <video
                    v-if="isCardVideo(card.cardImage)"
                    class="card-art-media"
                    :src="cardMediaUrl(card.cardImage)"
                    muted
                    loop
                    autoplay
                    playsinline
                    @error="hideBrokenCardMedia"
                  />
                  <img
                    v-else-if="cardMediaUrl(card.cardImage)"
                    class="card-art-media"
                    :src="cardMediaUrl(card.cardImage)"
                    :alt="card.cardName"
                    @error="hideBrokenCardMedia"
                  />
                  <div class="card-sigil"></div>
                  <div class="result-card-top">
                    <span class="rarity-badge">{{ card.rarity }}</span>
                    <span class="card-type-pill">{{
                      cardTypeLabel(card.cardType)
                    }}</span>
                  </div>
                </div>
                <div class="card-content">
                  <h3 class="card-name">{{ card.cardName }}</h3>
                  <div
                    v-if="card.isUp || card.isPity"
                    class="tag-row draw-result-tags"
                  >
                    <span v-if="card.isUp">UP</span>
                    <span v-if="card.isPity">保底</span>
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
