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
  Mail,
  Moon,
  Package,
  Recycle,
  RefreshCw,
  Settings,
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
import { computed, onMounted, provide, reactive, ref, watch } from "vue";
import type { Component } from "vue";
import { RouterLink, useRoute } from "vue-router";
import AchievementToastStack from "./components/common/AchievementToastStack.vue";
import FeedbackToast from "./components/common/FeedbackToast.vue";
import DrawPage from "./pages/DrawPage.vue";
import ProfilePage from "./pages/ProfilePage.vue";
import FriendsPage from "./pages/FriendsPage.vue";
import MessagesPage from "./pages/MessagesPage.vue";
import SettingsPage from "./pages/SettingsPage.vue";
import GuildPage from "./pages/GuildPage.vue";
import BagPage from "./pages/BagPage.vue";
import FormationPage from "./pages/FormationPage.vue";
import PvePage from "./pages/PvePage.vue";
import SynthesizePage from "./pages/SynthesizePage.vue";
import PointsPage from "./pages/PointsPage.vue";
import TradePage from "./pages/TradePage.vue";
import LeaderboardPage from "./pages/LeaderboardPage.vue";
import TasksPage from "./pages/TasksPage.vue";
import SeasonPage from "./pages/SeasonPage.vue";
import AchievementsPage from "./pages/AchievementsPage.vue";
import RedeemPage from "./pages/RedeemPage.vue";
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
  CardRarity,
  ClaimMessageRewardResponse,
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
  FormationCard,
  FormationOverview,
  GachaResult,
  CreateGuildRequest,
  GuildMember,
  GuildMessage,
  GuildMessagesResponse,
  GuildOverviewResponse,
  GuildSummary,
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
  PlayerMessage,
  PlayerMessagesResponse,
  PlayerProfileResponse,
  SaveShowcaseRequest,
  SendFriendRequestRequest,
  SendGuildMessageRequest,
  ShopRecycleCardsResponse,
  ShopRecycleConfig,
  LoginResponse,
  LoginUrlResponse,
  RechargePointsResponse,
  RedeemClaimResponse,
  SeasonOverview,
  SeasonPointRecord,
  SeasonShopBuyResponse,
  SeasonShopItem,
  ShowcaseCard,
  SocialActivityFeedResponse,
  SocialActivityRecord,
  TradeConfig,
  TradeListing,
  TradePageResponse,
  TradeRecord,
  UserCatalogItem,
  UserCardsResponse,
  UserGachaStats,
  UserProfile,
} from "./types";
import { APP_CONTEXT_KEY } from "./composables/useAppContext";
import { useAnnouncements } from "./composables/useAnnouncements";
import { useFeedback } from "./composables/useFeedback";
import { useModalStack } from "./composables/useModalStack";
import { usePlayerPreferences } from "./composables/usePlayerPreferences";
import { usePublicData } from "./composables/usePublicData";
import {
  cardMediaUrl,
  hasCardMedia,
  hideBrokenCardMedia,
  isCardVideo,
} from "./utils/cardMedia";
import {
  cardTypeLabel,
  formatCosts,
  formatDate,
  formatFragmentSummary,
  formatPercent,
  formatRewards,
  itemTypeLabel,
  poolTypeLabel,
  tradeRoleLabel,
  tradeStatusLabel,
} from "./utils/format";
import {
  isRecentCardTime,
  newCardSeenKey,
  type NewCardMarkerTarget,
} from "./utils/newCard";
import {
  normalizeRarity,
  parseCardRarities,
  rarityClass,
  rarityOrder,
  rarityRank,
  requiredFragmentsForRarity,
  strongestRarityClass,
  synthesisCostLabel,
} from "./utils/rarity";
import {
  getStoredStringSet,
  persistStringSet,
} from "./utils/storage";

const sectionItems = [
  { key: "draw", label: "抽卡", icon: Sparkles },
  { key: "profile", label: "主页", icon: UserRound },
  { key: "messages", label: "消息", icon: Mail },
  { key: "settings", label: "设置", icon: Settings },
  { key: "friends", label: "好友", icon: UsersRound },
  { key: "guild", label: "公会", icon: UsersRound },
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
  "guild",
] as const satisfies readonly SectionKey[];

const primaryNavItems = primaryNavSectionKeys
  .map((key) => sectionItemMap.get(key))
  .filter((item): item is SectionItem => Boolean(item));

const accountMenuSectionKeys = [
  "profile",
  "messages",
  "settings",
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

type CatalogCard = UserCatalogItem & {
  costLabel: string;
  disabled: boolean;
};
type DrawPhase = "idle" | "charging" | "burst";
type CardDetailRow = {
  label: string;
  value: string;
};
type CardDetailActionKey =
  | "lock"
  | "upgrade"
  | "trade"
  | "recycle"
  | "share"
  | "buy"
  | "synthesize";
type CardDetailAction = {
  key: CardDetailActionKey;
  label: string;
  icon: Component;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  payload?: unknown;
};
type CardSharePayload = {
  cardName: string;
  cardDesc?: string | null;
  cardLevel?: string;
  rarity?: string;
  poolId?: number;
};
type CardIntroTarget = {
  name: string;
  desc: string;
  rarity?: string;
  type?: string;
  extra?: string;
  cardImage?: string | null;
  rows: CardDetailRow[];
  actions: CardDetailAction[];
};
type CardDetailInput = {
  name: string;
  desc?: string | null;
  rarity?: string | number | null;
  type?: string | null;
  extra?: string | null;
  cardImage?: string | null;
  poolId?: number | string | null;
  poolName?: string | null;
  obtainedAt?: string | null;
  latestObtainedAt?: string | null;
  cultivationLevel?: number | null;
  power?: number | null;
  locked?: boolean;
  listed?: boolean;
  count?: number | null;
  price?: number | null;
  source?: string;
  statuses?: string[];
  rows?: CardDetailRow[];
  actions?: CardDetailAction[];
};
type ConfirmDialogVariant = "primary" | "danger";
type ConfirmDialogTarget = {
  title: string;
  message?: string;
  details?: string[];
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmDialogVariant;
  icon?: Component;
};
type LoadUserCardsOptions = {
  append?: boolean;
  preserveLoaded?: boolean;
  silent?: boolean;
};
type SilentLoadOptions = {
  silent?: boolean;
};
type CardStateRefreshOptions = {
  stats?: boolean;
  fishpiPoint?: boolean;
  pointRecords?: boolean;
  userCards?: boolean;
  preserveLoadedCards?: boolean;
  profile?: boolean;
  catalog?: boolean;
  formation?: boolean;
  bulkPreview?: boolean;
  tradeListings?: boolean;
  myTradeListings?: boolean;
  tradeRecords?: boolean;
  achievements?: boolean;
};
const DRAW_RESULTS_KEY = "kesini_website_last_results";
const NEW_CARD_SEEN_KEY = "kesini_new_card_seen";
const BAG_PAGE_SIZE = 24;

const route = useRoute();
const feedbackState = useFeedback();
const feedback = feedbackState.feedback;
const notify = feedbackState.notify;
const playerPreferences = usePlayerPreferences({
  onAchievementNoticesDisabled: () => clearAchievementToasts(),
  onReset: () => notify("success", "设置已恢复"),
});
const themeMode = playerPreferences.themeMode;
const playerPrefs = playerPreferences.playerPrefs;
const achievementNoticesEnabled = playerPreferences.achievementNoticesEnabled;
const motionModeLabel = playerPreferences.motionModeLabel;
const achievementNoticeLabel = playerPreferences.achievementNoticeLabel;
const toggleThemeMode = playerPreferences.toggleThemeMode;
const setThemeMode = playerPreferences.setThemeMode;
const setMotionMode = playerPreferences.setMotionMode;
const setAchievementNotices = playerPreferences.setAchievementNotices;
const resetPlayerPreferences = playerPreferences.resetPlayerPreferences;
const userMenuOpen = ref(false);
const userMenuHoverPaused = ref(false);
const manualToken = ref("");
const manualLoginEnabled =
  import.meta.env.DEV ||
  isEnabledFlag(import.meta.env.VITE_ENABLE_MANUAL_LOGIN) ||
  isEnabledFlag(window.__KESINI_CONFIG__?.ENABLE_MANUAL_LOGIN);
const token = ref(getToken());
const currentUser = ref<UserProfile | null>(getStoredUser<UserProfile>());
const announcementState = useAnnouncements();
const announcements = announcementState.announcements;
const announcementReadIds = announcementState.announcementReadIds;
const announcementClosedIds = announcementState.announcementClosedIds;
const announcementModalOpen = announcementState.announcementModalOpen;
const selectedAnnouncement = announcementState.selectedAnnouncement;
const activeAnnouncements = announcementState.activeAnnouncements;
const visibleAnnouncements = announcementState.visibleAnnouncements;
const unreadAnnouncementCount = announcementState.unreadAnnouncementCount;
const loadAnnouncements = announcementState.loadAnnouncements;
const announcementSummary = announcementState.announcementSummary;
const isAnnouncementRead = announcementState.isAnnouncementRead;
const markAnnouncementRead = announcementState.markAnnouncementRead;
const closeAnnouncement = announcementState.closeAnnouncement;
const openAnnouncementList = announcementState.openAnnouncementList;
const openAnnouncementDetail = announcementState.openAnnouncementDetail;
const closeAnnouncementModal = announcementState.closeAnnouncementModal;
const newCardSeenKeys = ref<Set<string>>(getStoredStringSet(NEW_CARD_SEEN_KEY));
const publicData = usePublicData({
  isAuthed: () => isAuthed.value,
  setPublicBusy: (value) => {
    busy.public = value;
  },
  setCatalogBusy: (value) => {
    busy.catalog = value;
  },
  loadAnnouncements,
  ensureBagPoolFilter,
  notifyError: (error) => notify("error", getErrorMessage(error)),
  notifyErrorText: (text) => notify("error", text),
});
const siteConfig = publicData.siteConfig;
const pools = publicData.pools;
const activePoolId = publicData.activePoolId;
const poolCards = publicData.poolCards;
const catalogItems = publicData.catalogItems;
const catalogError = publicData.catalogError;
const poolDetailOpen = publicData.poolDetailOpen;
const poolDetailLoading = publicData.poolDetailLoading;
const poolDetailError = publicData.poolDetailError;
const poolDetailPool = publicData.poolDetailPool;
const poolDetailCards = publicData.poolDetailCards;
const rechargeConfig = publicData.rechargeConfig;
const selectedPool = publicData.selectedPool;
const selectedDrawCosts = publicData.selectedDrawCosts;
const poolDetailProbabilityRows = publicData.poolDetailProbabilityRows;
const poolDetailCatalogCards = publicData.poolDetailCatalogCards;
const poolSortOrder = publicData.poolSortOrder;
const sortPools = publicData.sortPools;
const loadPublicData = publicData.loadPublicData;
const loadSiteConfig = publicData.loadSiteConfig;
const loadPoolCards = publicData.loadPoolCards;
const loadUserCatalog = publicData.loadUserCatalog;
const openPoolDetail = publicData.openPoolDetail;
const closePoolDetail = publicData.closePoolDetail;
const getPoolName = publicData.getPoolName;
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
const friendActionBusy = ref("");
const playerMessages = ref<PlayerMessage[]>([]);
const playerMessagesError = ref("");
const messageClaimBusy = ref<number | null>(null);
const guildOverview = ref<GuildOverviewResponse | null>(null);
const guildError = ref("");
const guildMessages = ref<GuildMessage[]>([]);
const guildMessageError = ref("");
const guildMessageText = ref("");
const guildName = ref("");
const guildDescription = ref("");
const guildActionBusy = ref("");
const formation = ref<FormationOverview | null>(null);
const formationCandidates = ref<UserCardsResponse["list"]>([]);
const formationPickerOpen = ref(false);
const formationEditingPosition = ref<number | null>(null);
const pveOverview = ref<PveOverview | null>(null);
const pveRecords = ref<PveRecordsResponse | null>(null);
const pveRecordPage = ref(1);
const pveRecordTotalPages = ref(1);
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
const bagNewOnly = ref(false);
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
const confirmDialogTarget = ref<ConfirmDialogTarget | null>(null);
const listingPrice = ref("");
const recycleCount = ref(1);
const redeemCode = ref("");
const rechargeModalOpen = ref(false);
const rechargeAmount = ref(10);
const exchangeCounts = reactive<Record<number, number>>({});
const achievementToasts = ref<AchievementNotification[]>([]);
const achievementToastQueue = ref<AchievementNotification[]>([]);
const callbackBusy = ref(false);
const resultModalOpen = ref(false);
const drawPhase = ref<DrawPhase>("idle");
let confirmDialogResolve: ((confirmed: boolean) => void) | null = null;

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
  messages: false,
  guild: false,
  guildMessages: false,
  guildSending: false,
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

function isEnabledFlag(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value !== "string") {
    return false;
  }
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

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
const profileRouteId = computed(() =>
  isPublicProfileRoute.value
    ? String(route.params.publicId || route.params.uid || "").trim()
    : "",
);
const profileDisplayName = computed(() =>
  publicPlayerName(
    playerProfile.value?.user.nickname,
    playerProfile.value?.user.uid,
    "玩家主页",
  ),
);
const profileOwnerUid = computed(() =>
  String(playerProfile.value?.user.uid || "").trim(),
);
const profileOwnerPublicId = computed(() =>
  publicProfileParam(playerProfile.value?.user),
);
const currentUserPublicId = computed(() => publicProfileParam(currentUser.value));
const profileActionTarget = computed(
  () => profileOwnerPublicId.value || profileOwnerUid.value,
);
const profileInitial = computed(() =>
  String(profileDisplayName.value || "?")
    .trim()
    .slice(0, 1)
    .toUpperCase(),
);
const profileCanEdit = computed(() => {
  if (!isAuthed.value) {
    return false;
  }
  const currentUid = String(currentUser.value?.uid || "").trim();
  if (profileOwnerUid.value && currentUid) {
    return profileOwnerUid.value === currentUid;
  }
  return Boolean(
    profileOwnerPublicId.value &&
      currentUserPublicId.value &&
      profileOwnerPublicId.value === currentUserPublicId.value,
  );
});
const profileShareUrl = computed(() => {
  const profileId = publicProfileParam(
    playerProfile.value?.user || currentUser.value,
  );
  return profileId
    ? `${window.location.origin}/u/${encodeURIComponent(profileId)}`
    : "";
});
const playerDisplayName = computed(() => {
  const uid = currentUser.value?.uid;
  return publicPlayerName(
    currentUser.value?.nickname,
    uid,
    publicPlayerName(currentUser.value?.name, uid, "已登录玩家"),
  );
});
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
  const publicId = profileOwnerPublicId.value;
  const uid = profileOwnerUid.value;
  if (!publicId && !uid) {
    return null;
  }
  const matchesProfile = (item: FriendRelationRecord) => {
    const friendPublicId = publicProfileParam(item.user);
    if (publicId && friendPublicId) {
      return publicId === friendPublicId;
    }
    return Boolean(uid && item.user.uid === uid);
  };
  return (
    friendRows.value.find(matchesProfile) ||
    incomingFriendRequests.value.find(matchesProfile) ||
    outgoingFriendRequests.value.find(matchesProfile) ||
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
    Boolean(profileActionTarget.value) &&
    !profileCanEdit.value,
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
const unreadMessageCount = computed(
  () => playerMessages.value.filter((item) => !item.read).length,
);
const currentGuild = computed(
  () => guildOverview.value?.current?.guild || null,
);
const guildMembers = computed<GuildMember[]>(
  () => guildOverview.value?.current?.members || [],
);
const guildRows = computed<GuildSummary[]>(
  () => guildOverview.value?.guilds || [],
);
const guildRoleLabel = computed(() =>
  currentGuild.value?.role === "leader" ? "会长" : "成员",
);
const guildMessageRows = computed(() => guildMessages.value);
const modalFocusKey = computed(() => {
  if (confirmDialogTarget.value) {
    return "confirm";
  }
  if (shareTextTarget.value) {
    return "share";
  }
  if (cardIntroTarget.value) {
    return "card";
  }
  if (recycleTarget.value) {
    return "recycle";
  }
  if (upgradeTarget.value) {
    return "upgrade";
  }
  if (listingTarget.value) {
    return "listing";
  }
  if (formationPickerOpen.value) {
    return "formation";
  }
  if (profilePickerOpen.value) {
    return "profile";
  }
  if (resultModalOpen.value) {
    return "result";
  }
  if (rechargeModalOpen.value) {
    return "recharge";
  }
  if (launchActivityModalOpen.value) {
    return "launch";
  }
  if (drawHistoryOpen.value) {
    return "history";
  }
  if (poolDetailOpen.value) {
    return "pool";
  }
  if (announcementModalOpen.value) {
    return "announcement";
  }
  return "";
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
  { value: "player_message", label: "消息奖励" },
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
    return "星轨充能中";
  }
  if (drawPhase.value === "burst") {
    return "星门已开启";
  }
  return bestResult.value
    ? `${bestResult.value.rarity} 级信号已锁定`
    : "选择卡池后抽取";
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
function closeTopOverlay() {
  if (confirmDialogTarget.value) {
    settleConfirmDialog(false);
    return true;
  }
  if (shareTextTarget.value) {
    closeShareText();
    return true;
  }
  if (cardIntroTarget.value) {
    closeCardIntro();
    return true;
  }
  if (recycleTarget.value) {
    closeRecycleModal();
    return true;
  }
  if (upgradeTarget.value) {
    closeUpgradeModal();
    return true;
  }
  if (listingTarget.value) {
    closeTradeListingModal();
    return true;
  }
  if (formationPickerOpen.value) {
    closeFormationPicker();
    return true;
  }
  if (profilePickerOpen.value) {
    closeProfilePicker();
    return true;
  }
  if (resultModalOpen.value) {
    closeResultModal();
    return true;
  }
  if (rechargeModalOpen.value) {
    closeRechargeModal();
    return true;
  }
  if (launchActivityModalOpen.value) {
    closeLaunchActivityModal();
    return true;
  }
  if (drawHistoryOpen.value) {
    closeDrawHistory();
    return true;
  }
  if (poolDetailOpen.value) {
    closePoolDetail();
    return true;
  }
  if (announcementModalOpen.value) {
    closeAnnouncementModal();
    return true;
  }
  return false;
}

const modalStack = useModalStack({
  modalFocusKey,
  closeTopOverlay,
});
const modalOverlayOpen = modalStack.modalOverlayOpen;

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
  if (section === "messages" && isAuthed.value) {
    await loadMessages();
  }
  if (section === "guild" && isAuthed.value) {
    await refreshGuildSection();
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
  () => [
    route.name,
    String(route.params.publicId || route.params.uid || ""),
    token.value,
  ],
  async () => {
    if (activeSection.value === "profile") {
      await loadPlayerProfile();
      if (isAuthed.value) {
        await loadFriends(false);
      }
    }
  },
);

function publicPlayerName(
  name?: string | null,
  uid?: string | null,
  fallback = "玩家",
) {
  const value = String(name || "").trim();
  const rawUid = String(uid || "").trim();
  return value && value !== rawUid ? value : fallback;
}

function publicProfileParam(
  user?:
    | {
        publicId?: string | null;
        public_id?: string | null;
        uid?: string | null;
      }
    | null,
) {
  const publicId = String(user?.publicId || user?.public_id || "").trim();
  return publicId || String(user?.uid || "").trim();
}

function publicProfileRoute(
  user?:
    | {
        publicId?: string | null;
        public_id?: string | null;
        uid?: string | null;
      }
    | null,
) {
  return {
    name: "publicProfile",
    params: { publicId: publicProfileParam(user) },
  };
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
  if (!manualLoginEnabled) {
    notify("error", "暂不可用");
    return;
  }
  const value = manualToken.value.trim();
  if (!value) {
    notify("error", "请输入口令");
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
  friendActionBusy.value = "";
  playerMessages.value = [];
  playerMessagesError.value = "";
  messageClaimBusy.value = null;
  guildOverview.value = null;
  guildError.value = "";
  guildMessages.value = [];
  guildMessageError.value = "";
  guildMessageText.value = "";
  guildName.value = "";
  guildDescription.value = "";
  guildActionBusy.value = "";
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
  clearAchievementToasts();
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
    loadMessages(false),
    activeSection.value === "friends"
      ? loadFriendFeed(false)
      : Promise.resolve(),
    activeSection.value === "guild"
      ? refreshGuildSection(false)
      : loadGuild(false),
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
  const data = await request<UserGachaStats>("/card/stats");
  stats.value = data;
  syncCurrentUserPoint(data.point);
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
    fishpiPoint.value = await request<FishpiPointResponse>(
      "/recharge/fishpi-point",
    );
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
    notify("error", "请先登录");
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

async function loadUserCards(options: LoadUserCardsOptions = {}) {
  if (!isAuthed.value) {
    return;
  }
  ensureBagPoolFilter();
  const append = options.append === true;
  const preserveLoaded = !append && options.preserveLoaded === true;
  const silent = !append && options.silent === true;
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
  const requestedNewOnly = bagNewOnly.value;
  const requestedPages = Math.max(1, cardPage.value || 1);
  const page = append ? cardPage.value + 1 : 1;
  const pageSize = preserveLoaded
    ? Math.max(BAG_PAGE_SIZE, requestedPages * BAG_PAGE_SIZE)
    : BAG_PAGE_SIZE;
  if (append) {
    busy.cardsMore = true;
  } else if (!silent) {
    busy.assets = true;
  }
  try {
    const data = await request<UserCardsResponse>(
      `/card/user/cards${toQuery({
        rarity: requestedRarity,
        poolId: requestedPoolId,
        grouped: true,
        newOnly: requestedNewOnly ? true : "",
        page,
        pageSize,
      })}`,
    );
    if (
      requestedRarity !== rarityFilter.value ||
      requestedPoolId !== poolFilter.value ||
      requestedNewOnly !== bagNewOnly.value
    ) {
      return;
    }
    if (append && userCards.value) {
      userCards.value = {
        ...data,
        list: [...userCards.value.list, ...data.list],
        dropItems: data.dropItems,
      };
    } else if (preserveLoaded) {
      const restoredTotalPages = Math.max(
        1,
        Math.ceil(Number(data.total || 0) / BAG_PAGE_SIZE),
      );
      const restoredPage = Math.min(requestedPages, restoredTotalPages);
      userCards.value = {
        ...data,
        page: restoredPage,
        pageSize: BAG_PAGE_SIZE,
        totalPages: restoredTotalPages,
      };
    } else {
      userCards.value = data;
    }
    cardPage.value = userCards.value?.page || data.page || page;
  } finally {
    if (append) {
      busy.cardsMore = false;
    } else if (!silent) {
      busy.assets = false;
    }
  }
}

async function loadPlayerProfile(options: SilentLoadOptions = {}) {
  if (isPublicProfileRoute.value && !profileRouteId.value) {
    playerProfile.value = null;
    return;
  }
  if (!isPublicProfileRoute.value && !isAuthed.value) {
    playerProfile.value = null;
    return;
  }

  if (!options.silent) {
    busy.profile = true;
  }
  try {
    playerProfile.value = await request<PlayerProfileResponse>(
      isPublicProfileRoute.value
        ? `/profile/${encodeURIComponent(profileRouteId.value)}`
        : "/profile/me",
    );
  } catch (error) {
    playerProfile.value = null;
    if (activeSection.value === "profile") {
      notify("error", getErrorMessage(error));
    }
  } finally {
    if (!options.silent) {
      busy.profile = false;
    }
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
  markNewCardSeen(card);
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
    notify("error", "无法添加");
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
  const target = profileActionTarget.value;
  const relation = profileFriendRelation.value;
  if (relation?.status === "pending") {
    if (incomingFriendRequests.value.some((item) => item.id === relation.id)) {
      await acceptFriendRequest(relation.id);
    }
    return;
  }
  await sendFriendRequest(target);
}

async function loadMessages(showError = activeSection.value === "messages") {
  if (!isAuthed.value) {
    playerMessages.value = [];
    playerMessagesError.value = "";
    return;
  }
  busy.messages = true;
  playerMessagesError.value = "";
  try {
    const data = await request<PlayerMessagesResponse>("/messages");
    playerMessages.value = data.list || [];
  } catch (error) {
    playerMessages.value = [];
    playerMessagesError.value = getErrorMessage(error);
    if (showError) {
      notify("error", playerMessagesError.value);
    }
  } finally {
    busy.messages = false;
  }
}

async function markMessageRead(message: PlayerMessage) {
  if (message.read) {
    return;
  }
  try {
    await request(`/messages/${message.id}/read`, { method: "POST" });
    playerMessages.value = playerMessages.value.map((item) =>
      item.id === message.id ? { ...item, read: true } : item,
    );
  } catch (error) {
    notify("error", getErrorMessage(error));
  }
}

async function claimMessageReward(message: PlayerMessage) {
  if (!message.hasReward || message.claimed || messageClaimBusy.value) {
    return;
  }
  messageClaimBusy.value = message.id;
  try {
    const data = await request<ClaimMessageRewardResponse>(
      `/messages/${message.id}/claim`,
      { method: "POST" },
    );
    playerMessages.value = playerMessages.value.map((item) =>
      item.id === message.id ? { ...item, read: true, claimed: true } : item,
    );
    await Promise.allSettled([loadStats(), loadUserCards()]);
    notify("success", `领取成功：${formatRewards(data.rewards)}`);
  } catch (error) {
    notify("error", getErrorMessage(error));
  } finally {
    messageClaimBusy.value = null;
  }
}

function guildRoleName(role?: string | null) {
  return role === "leader" ? "会长" : "成员";
}

function guildMemberName(member: GuildMember) {
  return publicPlayerName(member.nickname, member.uid);
}

function guildMemberInitial(member: GuildMember) {
  return guildMemberName(member).slice(0, 1).toUpperCase();
}

function guildMessageSenderName(message: GuildMessage) {
  return publicPlayerName(message.sender.nickname, message.sender.uid);
}

function guildMessageInitial(message: GuildMessage) {
  return guildMessageSenderName(message).slice(0, 1).toUpperCase();
}

async function loadGuild(showError = activeSection.value === "guild") {
  if (!isAuthed.value) {
    guildOverview.value = null;
    guildError.value = "";
    guildMessages.value = [];
    guildMessageError.value = "";
    return;
  }
  busy.guild = true;
  guildError.value = "";
  try {
    guildOverview.value = await request<GuildOverviewResponse>("/guilds/me");
    if (!guildOverview.value.current) {
      guildMessages.value = [];
      guildMessageError.value = "";
    }
  } catch (error) {
    guildOverview.value = null;
    guildError.value = getErrorMessage(error);
    if (showError) {
      notify("error", guildError.value);
    }
  } finally {
    busy.guild = false;
  }
}

async function loadGuildMessages(showError = activeSection.value === "guild") {
  if (!isAuthed.value || !currentGuild.value) {
    guildMessages.value = [];
    guildMessageError.value = "";
    return;
  }
  busy.guildMessages = true;
  guildMessageError.value = "";
  try {
    const data = await request<GuildMessagesResponse>(
      "/guilds/me/messages?limit=50",
    );
    guildMessages.value = data.list || [];
  } catch (error) {
    guildMessages.value = [];
    guildMessageError.value = getErrorMessage(error);
    if (showError) {
      notify("error", guildMessageError.value);
    }
  } finally {
    busy.guildMessages = false;
  }
}

async function refreshGuildSection(
  showError = activeSection.value === "guild",
) {
  await loadGuild(showError);
  if (currentGuild.value) {
    await loadGuildMessages(showError);
  }
}

async function createGuild() {
  const name = guildName.value.trim();
  const description = guildDescription.value.trim();
  if (!isAuthed.value) {
    notify("error", "请先登录");
    return;
  }
  if (!name) {
    notify("error", "请输入公会名");
    return;
  }
  guildActionBusy.value = "create";
  try {
    const payload: CreateGuildRequest = { name, description };
    guildOverview.value = await request<GuildOverviewResponse>("/guilds", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    guildName.value = "";
    guildDescription.value = "";
    notify("success", "已创建");
    await loadGuildMessages(false);
  } catch (error) {
    notify("error", getErrorMessage(error));
  } finally {
    guildActionBusy.value = "";
  }
}

async function joinGuild(guildId: number) {
  guildActionBusy.value = `join:${guildId}`;
  try {
    guildOverview.value = await request<GuildOverviewResponse>(
      `/guilds/${guildId}/join`,
      { method: "POST" },
    );
    notify("success", "已加入");
    await loadGuildMessages(false);
  } catch (error) {
    notify("error", getErrorMessage(error));
  } finally {
    guildActionBusy.value = "";
  }
}

async function leaveGuild() {
  if (!currentGuild.value) {
    return;
  }
  const confirmed = await askConfirm({
    title: "退出公会",
    message: "成员身份将移除",
    confirmText: "退出",
    variant: "danger",
    icon: LogOut,
  });
  if (!confirmed) {
    return;
  }
  guildActionBusy.value = "leave";
  try {
    guildOverview.value = await request<GuildOverviewResponse>("/guilds/me", {
      method: "DELETE",
    });
    guildMessages.value = [];
    guildMessageError.value = "";
    guildMessageText.value = "";
    notify("success", "已退出");
  } catch (error) {
    notify("error", getErrorMessage(error));
  } finally {
    guildActionBusy.value = "";
  }
}

async function sendGuildMessage() {
  const content = guildMessageText.value.trim();
  if (!content) {
    notify("error", "请输入消息");
    return;
  }
  busy.guildSending = true;
  try {
    const payload: SendGuildMessageRequest = { content };
    const data = await request<GuildMessagesResponse>("/guilds/me/messages", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    guildMessages.value = data.list || [];
    guildMessageText.value = "";
    notify("success", "已发送");
  } catch (error) {
    notify("error", getErrorMessage(error));
  } finally {
    busy.guildSending = false;
  }
}

async function loadFormation(options: SilentLoadOptions = {}) {
  if (!isAuthed.value) {
    return;
  }
  if (!options.silent) {
    busy.formation = true;
  }
  try {
    formation.value = await request<FormationOverview>("/formation");
  } catch (error) {
    if (activeSection.value === "formation") {
      notify("error", getErrorMessage(error));
    }
  } finally {
    if (!options.silent) {
      busy.formation = false;
    }
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
    notify("error", "请先登录");
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
    notify("error", "请先登录");
    return;
  }
  const selectedCard = cardUuid
    ? formationCandidates.value.find((card) => candidateUuid(card) === cardUuid)
    : null;
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
    if (selectedCard) {
      markNewCardSeen(selectedCard);
    }
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
    notify("error", "请先登录");
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
  void loadUserCards();
}

function toggleBagNewOnly() {
  bagNewOnly.value = !bagNewOnly.value;
  resetUserCards();
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
    if (achievementNoticesEnabled.value) {
      enqueueAchievementNotifications(notices);
    }
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

function clearAchievementToasts() {
  achievementToasts.value = [];
  achievementToastQueue.value = [];
  achievementToastTimers.forEach((timer) => window.clearTimeout(timer));
  achievementToastTimers.clear();
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
      syncCurrentUserPoint(data.currentPoint);
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

async function loadTradeListings(options: SilentLoadOptions = {}) {
  if (!isAuthed.value) {
    return;
  }
  if (!options.silent) {
    busy.trade = true;
  }
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
    if (!options.silent) {
      busy.trade = false;
    }
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

function syncCurrentUserPoint(point?: number | null) {
  if (!currentUser.value || typeof point !== "number") {
    return;
  }
  currentUser.value = { ...currentUser.value, point };
  setStoredUser(currentUser.value);
}

function isSameUserCardGroup(
  source: UserCardsResponse["list"][number],
  target: UserCardsResponse["list"][number],
) {
  return (
    Number(source.cardId || 0) === Number(target.cardId || 0) &&
    String(source.cardLevel || "") === String(target.cardLevel || "") &&
    Number(source.poolId || 0) === Number(target.poolId || 0)
  );
}

function findUserCardGroup(card: UserCardsResponse["list"][number]) {
  return (
    userCards.value?.list.find((item) => isSameUserCardGroup(item, card)) ||
    null
  );
}

function shouldRefreshOwnProfile() {
  return Boolean(playerProfile.value) && !isPublicProfileRoute.value;
}

async function refreshCardState(options: CardStateRefreshOptions) {
  if (!isAuthed.value) {
    return;
  }
  const jobs: Promise<unknown>[] = [];
  if (options.stats) {
    jobs.push(loadStats());
  }
  if (options.fishpiPoint) {
    jobs.push(loadFishpiPoint());
  }
  if (options.pointRecords && pointRecords.value) {
    jobs.push(loadPointRecords());
  }
  if (options.userCards) {
    jobs.push(
      loadUserCards({
        preserveLoaded: options.preserveLoadedCards !== false,
        silent: true,
      }),
    );
  }
  if (options.profile && shouldRefreshOwnProfile()) {
    jobs.push(loadPlayerProfile({ silent: true }));
  }
  if (options.catalog) {
    jobs.push(loadUserCatalog({ silent: true }));
  }
  if (options.formation) {
    jobs.push(loadFormation({ silent: true }));
  }
  if (options.bulkPreview) {
    jobs.push(loadBulkDecomposePreview());
  }
  if (options.tradeListings) {
    jobs.push(loadTradeListings({ silent: true }));
  }
  if (options.myTradeListings) {
    jobs.push(loadMyTradeListings());
  }
  if (options.tradeRecords) {
    jobs.push(loadTradeRecords());
  }
  if (options.achievements) {
    jobs.push(loadAchievements(), loadAchievementNotifications());
  }
  await Promise.allSettled(jobs);
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
    notify("error", "请先登录");
    return;
  }
  if (!rechargeConfig.value?.enabled) {
    notify("error", "充值功能暂未开启");
    return;
  }
  if (!rechargeConfig.value.hasGoldFingerKey) {
    notify("error", "充值暂不可用");
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
    notify("error", "请先登录");
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
    notify("error", "请先登录");
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
    notify("error", "请先登录");
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
    notify("error", "请先登录");
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

function compactCardDetailValue(value?: string | number | null) {
  return String(value ?? "").trim();
}

function formatCardDetailDate(value?: string | null) {
  const raw = compactCardDetailValue(value);
  if (!raw) {
    return "";
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString("zh-CN", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function uniqueCardDetailRows(rows: CardDetailRow[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const label = compactCardDetailValue(row.label);
    const value = compactCardDetailValue(row.value);
    if (!label || !value) {
      return false;
    }
    const key = `${label}:${value}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function cardDetailActionClass(action: CardDetailAction) {
  return action.variant === "primary" ? "primary-action" : "secondary-action";
}

function cardSharePayload(card: {
  cardName: string;
  cardDesc?: string | null;
  cardLevel?: string | number | null;
  rarity?: string | number | null;
  poolId?: number | string | null;
}): CardSharePayload {
  const poolId = Number(card.poolId || 0);
  return {
    cardName: card.cardName,
    cardDesc: card.cardDesc,
    cardLevel: compactCardDetailValue(card.cardLevel),
    rarity: compactCardDetailValue(card.rarity),
    poolId: Number.isFinite(poolId) && poolId > 0 ? poolId : undefined,
  };
}

function shareCardDetailAction(payload: CardSharePayload): CardDetailAction {
  return {
    key: "share",
    label: "分享",
    icon: Share2,
    payload,
  };
}

function bagCardDetailActions(
  card: UserCardsResponse["list"][number],
): CardDetailAction[] {
  const actions: CardDetailAction[] = [];
  const lockAction = cardLockAction(card);
  if (lockAction.uuid) {
    actions.push({
      key: "lock",
      label: lockAction.label,
      icon: lockAction.locked ? Lock : Unlock,
      disabled: busy.assets,
      payload: card,
    });
  }
  if (cardUpgradeUuid(card)) {
    actions.push({
      key: "upgrade",
      label: "养成",
      icon: WandSparkles,
      disabled: busy.upgrade,
      payload: card,
    });
  }
  if (card.canSell && Number(card.sellableCount || 0) > 0) {
    actions.push({
      key: "trade",
      label: "挂售",
      icon: Store,
      payload: card,
    });
  }
  if (shopRecycleConfig.value.enabled && Number(card.sellableCount || 0) > 1) {
    actions.push({
      key: "recycle",
      label: "回收",
      icon: Recycle,
      payload: card,
    });
  }
  actions.push(shareCardDetailAction(cardSharePayload(card)));
  return actions;
}

function tradeListingDetailActions(listing: TradeListing): CardDetailAction[] {
  const actions: CardDetailAction[] = [];
  if (!listing.isMine && listing.status === "active" && tradeConfig.value.enabled) {
    actions.push({
      key: "buy",
      label: "购买",
      icon: Store,
      variant: "primary",
      disabled: busy.trade,
      payload: listing,
    });
  }
  return actions;
}

function catalogCardDetailActions(item: CatalogCard): CardDetailAction[] {
  if (item.collected || item.rarity === "UR" || !item.canSynthesize) {
    return [];
  }
  return [
    {
      key: "synthesize",
      label: "合成",
      icon: Package,
      variant: "primary",
      disabled: busy.catalog,
      payload: item,
    },
  ];
}

function openCardIntro(target: CardDetailInput) {
  const rarity = compactCardDetailValue(target.rarity);
  const type = compactCardDetailValue(target.type);
  const poolName = compactCardDetailValue(
    target.poolName || target.extra || getPoolName(Number(target.poolId || 0)),
  );
  const obtainedAt = formatCardDetailDate(
    target.latestObtainedAt || target.obtainedAt || "",
  );
  const statuses = [...(target.statuses || [])];
  if (target.locked) {
    statuses.push("已锁定");
  }
  if (target.listed) {
    statuses.push("挂售中");
  }
  const rows = uniqueCardDetailRows([
    { label: "等级", value: rarity },
    { label: "类型", value: type },
    { label: "卡池", value: poolName },
    { label: "获得", value: obtainedAt },
    {
      label: "养成",
      value: target.cultivationLevel ? `Lv.${target.cultivationLevel}` : "",
    },
    {
      label: "战力",
      value:
        target.power !== undefined && target.power !== null
          ? String(target.power)
          : "",
    },
    {
      label: "数量",
      value:
        target.count !== undefined && target.count !== null
          ? `x${target.count}`
          : "",
    },
    { label: "状态", value: statuses.filter(Boolean).join(" · ") },
    { label: "价格", value: target.price ? `${target.price} 星穹币` : "" },
    { label: "来源", value: target.source || "" },
    ...(target.rows || []),
  ]);
  cardIntroTarget.value = {
    name: target.name,
    desc: cardIntroText(target.desc),
    rarity,
    type,
    extra: poolName,
    cardImage: target.cardImage,
    rows,
    actions: target.actions || [],
  };
}

function closeCardIntro() {
  cardIntroTarget.value = null;
}

function askConfirm(target: ConfirmDialogTarget) {
  if (confirmDialogResolve) {
    confirmDialogResolve(false);
  }
  confirmDialogTarget.value = {
    confirmText: "确认",
    cancelText: "取消",
    variant: "primary",
    ...target,
  };
  return new Promise<boolean>((resolve) => {
    confirmDialogResolve = resolve;
  });
}

function settleConfirmDialog(confirmed: boolean) {
  const resolve = confirmDialogResolve;
  confirmDialogResolve = null;
  confirmDialogTarget.value = null;
  resolve?.(confirmed);
}

function confirmDialogActionClass(target: ConfirmDialogTarget) {
  return target.variant === "danger" ? "danger-action" : "primary-action";
}

function openShowcaseCardDetail(card: ShowcaseCard) {
  openCardIntro({
    name: card.cardName,
    desc: card.cardDesc,
    cardImage: card.cardImage,
    rarity: card.cardLevel,
    type: cardTypeLabel(card.cardType),
    poolId: card.poolId,
    obtainedAt: card.obtainedAt,
    cultivationLevel: card.cultivationLevel,
    power: card.power,
    locked: card.locked,
    source: "展示墙",
    actions: [shareCardDetailAction(cardSharePayload(card))],
  });
}

function openBagCardDetail(card: UserCardsResponse["list"][number]) {
  markNewCardSeen(card);
  openCardIntro({
    name: card.cardName,
    desc: card.cardDesc,
    cardImage: card.cardImage,
    rarity: card.cardLevel,
    type: cardTypeLabel(card.cardType),
    poolId: card.poolId,
    obtainedAt: card.obtainedAt,
    latestObtainedAt: card.latestObtainedAt,
    cultivationLevel: card.cultivationLevel,
    power: card.power,
    locked: Boolean(card.locked || Number(card.lockedCount || 0) > 0),
    listed: Number(card.listedCount || 0) > 0 || card.isListed === true,
    count: card.count,
    price: card.tradePrice,
    source: "背包",
    actions: bagCardDetailActions(card),
  });
}

function openFormationCardDetail(card: FormationCard) {
  markNewCardSeen(card);
  openCardIntro({
    name: card.cardName,
    desc: card.cardDesc,
    cardImage: card.cardImage,
    rarity: card.cardLevel,
    type: cardTypeLabel(card.cardType),
    poolId: card.poolId,
    obtainedAt: card.obtainedAt,
    cultivationLevel: card.cultivationLevel,
    power: card.power,
    locked: card.locked,
    source: "阵容",
    actions: [shareCardDetailAction(cardSharePayload(card))],
  });
}

function openTradeListingDetail(listing: TradeListing) {
  openCardIntro({
    name: listing.cardName,
    desc: listing.cardDesc,
    cardImage: listing.cardImage,
    rarity: listing.cardLevel,
    type: cardTypeLabel(listing.cardType),
    poolId: listing.poolId,
    poolName: listing.poolName,
    obtainedAt: listing.createdAt,
    listed: true,
    price: listing.price,
    source: "交易",
    actions: tradeListingDetailActions(listing),
  });
}

function openCatalogCardDetail(item: CatalogCard) {
  openCardIntro({
    name: item.card.card_name,
    desc: item.card.card_desc,
    cardImage: item.card.card_image,
    rarity: item.rarity,
    type: cardTypeLabel(item.card.card_type),
    poolId: item.card.pool,
    source: "图鉴",
    count: item.ownedCount,
    statuses: [item.collected ? "已收集" : "未收集"],
    actions: catalogCardDetailActions(item),
    rows:
      !item.collected && item.rarity !== "UR"
        ? [
            {
              label: "碎片",
              value: `${item.fragmentCount}/${item.requiredFragments}`,
            },
          ]
        : [],
  });
}

function openDrawResultDetail(card: GachaResult) {
  markNewCardSeen(card);
  openCardIntro({
    name: card.cardName,
    desc: card.cardDesc,
    cardImage: card.cardImage,
    rarity: card.rarity,
    type: cardTypeLabel(card.cardType),
    poolId: card.poolId,
    source: "抽卡",
    statuses: [
      card.isUp ? "UP" : "",
      card.isPity ? "保底" : "",
      "新获得",
    ].filter(Boolean),
    actions: [
      shareCardDetailAction(
        cardSharePayload({
          cardName: card.cardName,
          cardDesc: card.cardDesc,
          rarity: card.rarity,
          poolId: card.poolId,
        }),
      ),
    ],
  });
}

async function handleCardDetailAction(action: CardDetailAction) {
  if (action.disabled) {
    return;
  }
  if (action.key === "lock") {
    const updatedCard = await toggleCardLock(
      action.payload as UserCardsResponse["list"][number],
    );
    if (updatedCard) {
      openBagCardDetail(updatedCard);
    }
    return;
  }
  if (action.key === "share") {
    await shareCard(action.payload as CardSharePayload);
    return;
  }
  closeCardIntro();
  if (action.key === "upgrade") {
    await openUpgradeModal(action.payload as UserCardsResponse["list"][number]);
    return;
  }
  if (action.key === "trade") {
    openTradeListingModal(action.payload as UserCardsResponse["list"][number]);
    return;
  }
  if (action.key === "recycle") {
    openRecycleModal(action.payload as UserCardsResponse["list"][number]);
    return;
  }
  if (action.key === "buy") {
    await buyTradeListing(action.payload as TradeListing);
    return;
  }
  if (action.key === "synthesize") {
    await synthesizeCard(action.payload as CatalogCard);
  }
}

function drawHistoryDetailMeta(detail: DrawHistoryRecord["details"][number]) {
  const poolName = getPoolName(detail.poolId);
  if (poolName) {
    return poolName;
  }
  if (detail.cardType !== undefined && detail.cardType !== null) {
    return cardTypeLabel(detail.cardType);
  }
  return "抽卡记录";
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

function buildCardShareText(card: CardSharePayload) {
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

async function shareCard(card: CardSharePayload) {
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
    notify("error", "请先登录");
    return null;
  }
  const action = cardLockAction(card);
  if (!action.uuid) {
    notify("info", "暂不可切换");
    return null;
  }
  busy.assets = true;
  try {
    await request(`/card/user/cards/${action.uuid}/lock`, {
      method: "PATCH",
      body: JSON.stringify({ locked: action.locked }),
    });
    notify("success", action.locked ? "卡片已锁定" : "卡片已解锁");
    await refreshCardState({
      userCards: true,
      formation: true,
      profile: true,
      bulkPreview: true,
    });
    return findUserCardGroup(card);
  } catch (error) {
    notify("error", getErrorMessage(error));
    return null;
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
  const confirmed = await askConfirm({
    title: "合成卡片",
    message: item.card.card_name,
    details: [`${item.rarity} 卡片`],
    confirmText: "合成",
    icon: Package,
  });
  if (!confirmed) {
    return;
  }
  busy.catalog = true;
  try {
    await request("/card/synthesize", {
      method: "POST",
      body: JSON.stringify({ card_id: item.card.id, rarity: item.rarity }),
    });
    notify("success", "合成成功");
    await refreshCardState({
      stats: true,
      userCards: true,
      catalog: true,
      formation: true,
      profile: true,
      bulkPreview: true,
      achievements: true,
    });
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
    notify("error", "请先登录");
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
      ? `${preview.skippedListed} 张挂售中跳过`
      : "";
  const lockedText =
    Number(preview.skippedLocked || 0) > 0
      ? `${preview.skippedLocked} 张锁定跳过`
      : "";
  const reservedText =
    Number(preview.reservedCount || 0) > 0
      ? `保留 ${preview.reservedCount} 张`
      : "";
  const confirmed = await askConfirm({
    title: "批量分解",
    message: `${preview.total} 张卡片`,
    details: [detail, skippedText, lockedText, reservedText].filter(Boolean),
    confirmText: "分解",
    variant: "danger",
    icon: Recycle,
  });
  if (!confirmed) {
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
    await refreshCardState({
      stats: true,
      pointRecords: true,
      userCards: true,
      catalog: true,
      formation: true,
      profile: true,
      bulkPreview: true,
      achievements: true,
    });
  } catch (error) {
    notify("error", getErrorMessage(error));
  } finally {
    busy.assets = false;
    busy.bulkDecompose = false;
  }
}

function openTradeListingModal(card: UserCardsResponse["list"][number]) {
  if (!isAuthed.value) {
    notify("error", "请先登录");
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
    notify("error", "请先登录");
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
    await refreshCardState({
      userCards: true,
      catalog: true,
      formation: true,
      profile: true,
      bulkPreview: true,
      achievements: true,
    });
    if (upgradeTarget.value) {
      upgradeTarget.value = findUserCardGroup(upgradeTarget.value);
    }
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
    syncCurrentUserPoint(data.pointAfter);
    closeRecycleModal();
    await refreshCardState({
      stats: true,
      pointRecords: true,
      userCards: true,
      catalog: true,
      formation: true,
      profile: true,
      bulkPreview: true,
      achievements: true,
    });
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
    await refreshCardState({
      userCards: true,
      formation: true,
      profile: true,
      bulkPreview: true,
      tradeListings: true,
      myTradeListings: true,
      tradeRecords: true,
    });
  } catch (error) {
    notify("error", getErrorMessage(error));
  } finally {
    busy.trade = false;
  }
}

async function cancelTradeListing(listing: TradeListing) {
  const confirmed = await askConfirm({
    title: "取消挂售",
    message: listing.cardName,
    confirmText: "撤销",
    variant: "danger",
    icon: Store,
  });
  if (!confirmed) {
    return;
  }
  busy.trade = true;
  try {
    await request(`/trade/listings/${listing.id}`, { method: "DELETE" });
    notify("success", "挂单已取消");
    await refreshCardState({
      userCards: true,
      formation: true,
      profile: true,
      bulkPreview: true,
      tradeListings: true,
      myTradeListings: true,
      tradeRecords: true,
    });
  } catch (error) {
    notify("error", getErrorMessage(error));
  } finally {
    busy.trade = false;
  }
}

async function buyTradeListing(listing: TradeListing) {
  if (listing.isMine) {
    notify("info", "这是你的挂单");
    return;
  }
  const confirmed = await askConfirm({
    title: "购买卡片",
    message: `${listing.price} 星穹币`,
    details: [`${listing.cardName} ${listing.cardLevel}`],
    confirmText: "购买",
    icon: Store,
  });
  if (!confirmed) {
    return;
  }
  busy.trade = true;
  try {
    await request(`/trade/listings/${listing.id}/buy`, { method: "POST" });
    notify("success", "购买成功，卡片已进入背包");
    await refreshCardState({
      stats: true,
      pointRecords: true,
      userCards: true,
      catalog: true,
      formation: true,
      profile: true,
      bulkPreview: true,
      tradeListings: true,
      myTradeListings: true,
      tradeRecords: true,
      achievements: true,
    });
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
    notify("error", "请先登录");
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
    admin_adjust: "运营调整",
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
    case "player_message":
      return String(meta("title") || record.title || "消息奖励");
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

function isNewCard(
  card?: NewCardMarkerTarget,
  options: { ignoreSeen?: boolean } = {},
) {
  if (!isRecentCardTime(card?.latestObtainedAt || card?.obtainedAt)) {
    return false;
  }
  const key = newCardSeenKey(card);
  return Boolean(options.ignoreSeen || !key || !newCardSeenKeys.value.has(key));
}

function markNewCardSeen(card?: NewCardMarkerTarget) {
  const key = newCardSeenKey(card);
  if (!key || newCardSeenKeys.value.has(key)) {
    return;
  }
  const next = new Set(newCardSeenKeys.value);
  next.add(key);
  newCardSeenKeys.value = next;
  persistStringSet(NEW_CARD_SEEN_KEY, next);
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

function leaderboardInitial(entry: LeaderboardEntry) {
  return publicPlayerName(entry.nickname, entry.uid).slice(0, 1).toUpperCase();
}

function formatLeaderboardValue(value?: number) {
  return `${value || 0}${activeLeaderboardTab.value.unit}`;
}

function leaderboardRankLabel(rank?: number) {
  return rank ? `#${rank}` : "未上榜";
}
const appContext = {
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
  Mail,
  Moon,
  Package,
  Recycle,
  RefreshCw,
  Settings,
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
  RouterLink,
  cardMediaUrl,
  hasCardMedia,
  hideBrokenCardMedia,
  isCardVideo,
  cardTypeLabel,
  formatCosts,
  formatDate,
  formatFragmentSummary,
  formatPercent,
  formatRewards,
  itemTypeLabel,
  poolTypeLabel,
  tradeRoleLabel,
  tradeStatusLabel,
  isRecentCardTime,
  newCardSeenKey,
  normalizeRarity,
  parseCardRarities,
  rarityClass,
  rarityOrder,
  rarityRank,
  requiredFragmentsForRarity,
  strongestRarityClass,
  synthesisCostLabel,
  getStoredStringSet,
  persistStringSet,
  sectionItems,
  sectionItemMap,
  primaryNavSectionKeys,
  primaryNavItems,
  accountMenuSectionKeys,
  accountMenuItems,
  leaderboardTabs,
  DRAW_RESULTS_KEY,
  NEW_CARD_SEEN_KEY,
  BAG_PAGE_SIZE,
  route,
  feedbackState,
  feedback,
  notify,
  playerPreferences,
  themeMode,
  playerPrefs,
  achievementNoticesEnabled,
  motionModeLabel,
  achievementNoticeLabel,
  toggleThemeMode,
  setThemeMode,
  setMotionMode,
  setAchievementNotices,
  resetPlayerPreferences,
  userMenuOpen,
  userMenuHoverPaused,
  manualToken,
  manualLoginEnabled,
  token,
  currentUser,
  announcementState,
  announcements,
  announcementReadIds,
  announcementClosedIds,
  announcementModalOpen,
  selectedAnnouncement,
  activeAnnouncements,
  visibleAnnouncements,
  unreadAnnouncementCount,
  loadAnnouncements,
  announcementSummary,
  isAnnouncementRead,
  markAnnouncementRead,
  closeAnnouncement,
  openAnnouncementList,
  openAnnouncementDetail,
  closeAnnouncementModal,
  newCardSeenKeys,
  publicData,
  siteConfig,
  pools,
  activePoolId,
  poolCards,
  catalogItems,
  catalogError,
  poolDetailOpen,
  poolDetailLoading,
  poolDetailError,
  poolDetailPool,
  poolDetailCards,
  rechargeConfig,
  selectedPool,
  selectedDrawCosts,
  poolDetailProbabilityRows,
  poolDetailCatalogCards,
  poolSortOrder,
  sortPools,
  loadPublicData,
  loadSiteConfig,
  loadPoolCards,
  loadUserCatalog,
  openPoolDetail,
  closePoolDetail,
  getPoolName,
  stats,
  fishpiPoint,
  fishpiPointError,
  drawHistory,
  drawHistoryOpen,
  drawHistoryPage,
  userCards,
  playerProfile,
  profileCandidates,
  profilePickerOpen,
  profileSelectedUuids,
  friendsOverview,
  friendsError,
  friendFeed,
  friendFeedError,
  friendActionBusy,
  playerMessages,
  playerMessagesError,
  messageClaimBusy,
  guildOverview,
  guildError,
  guildMessages,
  guildMessageError,
  guildMessageText,
  guildName,
  guildDescription,
  guildActionBusy,
  formation,
  formationCandidates,
  formationPickerOpen,
  formationEditingPosition,
  pveOverview,
  pveRecords,
  pveRecordPage,
  pveRecordTotalPages,
  launchActivity,
  dailySignIn,
  tasksOverview,
  taskScope,
  seasonOverview,
  launchActivityModalOpen,
  launchActivityDismissedKey,
  leaderboard,
  leaderboardError,
  activeLeaderboardMetric,
  pointRecords,
  achievements,
  achievementStatusFilter,
  achievementCategoryFilter,
  achievementKeyword,
  pointRecordPage,
  pointRecordTypeFilter,
  pointRecordSourceFilter,
  pointRecordTotalPages,
  exchangeItems,
  seasonShopCounts,
  tradeListings,
  myTradeListings,
  tradeRecords,
  tradeConfig,
  shopRecycleConfig,
  lastResults,
  rarityFilter,
  poolFilter,
  bagNewOnly,
  synthesisRarityFilter,
  bulkDecomposeRarities,
  bulkDecomposePreview,
  cardPage,
  tradePage,
  myTradePage,
  tradeRecordPage,
  tradeTab,
  tradeRarityFilter,
  tradePoolFilter,
  tradeSort,
  tradeMinPrice,
  tradeMaxPrice,
  listingTarget,
  recycleTarget,
  upgradeTarget,
  upgradePreview,
  cardIntroTarget,
  shareTextTarget,
  confirmDialogTarget,
  listingPrice,
  recycleCount,
  redeemCode,
  rechargeModalOpen,
  rechargeAmount,
  exchangeCounts,
  achievementToasts,
  achievementToastQueue,
  callbackBusy,
  resultModalOpen,
  drawPhase,
  confirmDialogResolve,
  busy,
  isEnabledFlag,
  achievementToastTimers,
  isAuthed,
  activeSection,
  isPublicProfileRoute,
  profileRouteId,
  profileDisplayName,
  profileOwnerUid,
  profileOwnerPublicId,
  currentUserPublicId,
  profileActionTarget,
  profileInitial,
  profileCanEdit,
  profileShareUrl,
  playerDisplayName,
  playerInitial,
  playerStatusLabel,
  fishpiPointLabel,
  profileCardCountRows,
  profileShowcase,
  profileFormation,
  profileSelectedSet,
  friendRows,
  incomingFriendRequests,
  outgoingFriendRequests,
  profileFriendRelation,
  isProfileFriendIncoming,
  isProfileFriendOutgoing,
  showProfileFriendAction,
  profileFriendActionLabel,
  profileFriendStatusLabel,
  profileFriendActionDisabled,
  unreadMessageCount,
  currentGuild,
  guildMembers,
  guildRows,
  guildRoleLabel,
  guildMessageRows,
  modalFocusKey,
  toggleUserMenu,
  closeUserMenu,
  resetUserMenuHover,
  launchActivityInfo,
  hasLaunchActivityReward,
  dailySignInWeek,
  dailySignInCycleDay,
  dailySignInRewardPoints,
  activeTaskOverview,
  activeTaskList,
  activeTaskMilestones,
  taskCompletedCount,
  taskClaimedCount,
  taskActivityPercent,
  activeSeason,
  seasonPoints,
  seasonShopItems,
  seasonPointRecords,
  seasonLeaderboard,
  seasonLeaderboardRows,
  seasonRankText,
  selectedPoolPity,
  selectedHardPity,
  selectedPityPercent,
  selectedPityText,
  poolDetailPity,
  rechargeRangeLabel,
  rechargeRatioLabel,
  rechargeLocalAmount,
  inventoryItems,
  localCatalogCards,
  catalogCards,
  filteredSynthesisCards,
  synthesisAvailableCount,
  catalogCollectedCount,
  activeLeaderboardTab,
  activeLeaderboardBoard,
  podiumEntries,
  leaderboardRows,
  pointLedgerRows,
  achievementCategories,
  filteredAchievements,
  achievementGroups,
  achievementVisibleCount,
  achievementUnlockedCount,
  achievementProgressingCount,
  achievementCompletionPercent,
  pointIncomeTotal,
  pointExpenseTotal,
  pointNetTotal,
  pointSourceOptions,
  totalPages,
  bagHasMore,
  bagLoadedCount,
  bulkDecomposeSelectedRarities,
  bulkDecomposeSelectedLabel,
  bulkDecomposePreviewTotal,
  bulkDecomposeReservedCount,
  drawHistoryRows,
  drawHistoryTotalPages,
  tradeTotalPages,
  myTradeTotalPages,
  tradeRecordTotalPages,
  listingFeePreview,
  recycleAvailableCount,
  recycleUnitPrice,
  recycleTotalPoints,
  upgradePowerGain,
  formationSlots,
  formationFilledCount,
  formationCurrentUuids,
  formationEditingSlot,
  pveStages,
  pveFormation,
  pveRecentRecords,
  pveClearedCount,
  bestResult,
  resultSummary,
  drawPhaseText,
  resultModalTitle,
  resultModalSubtitle,
  closeTopOverlay,
  modalStack,
  modalOverlayOpen,
  publicPlayerName,
  publicProfileParam,
  publicProfileRoute,
  activityUserName,
  activityInitial,
  shortActivityText,
  activityLine,
  getErrorMessage,
  getStoredDrawResults,
  setStoredDrawResults,
  delay,
  createRechargeRequestId,
  handleOpenIdCallback,
  loginWithOpenId,
  applyManualToken,
  logout,
  loadPrivateData,
  loadStats,
  loadFishpiPoint,
  loadDrawHistory,
  openDrawHistory,
  closeDrawHistory,
  changeDrawHistoryPage,
  ensureBagPoolFilter,
  loadUserCards,
  loadPlayerProfile,
  loadProfileCandidates,
  openProfilePicker,
  closeProfilePicker,
  isProfileCandidateSelected,
  toggleProfileCandidate,
  saveProfileShowcase,
  copyProfileLink,
  loadFriends,
  loadFriendFeed,
  refreshFriendsSection,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
  removeFriend,
  handleProfileFriendAction,
  loadMessages,
  markMessageRead,
  claimMessageReward,
  guildRoleName,
  guildMemberName,
  guildMemberInitial,
  guildMessageSenderName,
  guildMessageInitial,
  loadGuild,
  loadGuildMessages,
  refreshGuildSection,
  createGuild,
  joinGuild,
  leaveGuild,
  sendGuildMessage,
  loadFormation,
  loadFormationCandidates,
  openFormationPicker,
  closeFormationPicker,
  candidateUuid,
  isFormationCandidateSelected,
  saveFormationSlot,
  loadPveStages,
  loadPveRecords,
  refreshPve,
  challengePveStage,
  changePveRecordPage,
  resetUserCards,
  toggleBagNewOnly,
  loadMoreUserCards,
  loadLaunchActivity,
  loadDailySignIn,
  loadTasks,
  loadSeasonOverview,
  loadLeaderboard,
  loadAchievements,
  loadAchievementNotifications,
  enqueueAchievementNotifications,
  flushAchievementToastQueue,
  clearAchievementToasts,
  dismissAchievementToast,
  loadPointRecords,
  loadExchangeItems,
  loadShopRecycleConfig,
  loadTradeData,
  loadTradeListings,
  loadMyTradeListings,
  loadTradeRecords,
  syncCurrentUserPoint,
  isSameUserCardGroup,
  findUserCardGroup,
  shouldRefreshOwnProfile,
  refreshCardState,
  refreshAll,
  changePointPage,
  openRechargeModal,
  closeRechargeModal,
  openLaunchActivityModal,
  closeLaunchActivityModal,
  claimLaunchActivity,
  claimDailySignIn,
  claimTaskReward,
  claimActivityReward,
  submitRecharge,
  performDraw,
  openLastResults,
  closeResultModal,
  cardIntroText,
  shortCardIntro,
  compactCardDetailValue,
  formatCardDetailDate,
  uniqueCardDetailRows,
  cardDetailActionClass,
  cardSharePayload,
  shareCardDetailAction,
  bagCardDetailActions,
  tradeListingDetailActions,
  catalogCardDetailActions,
  openCardIntro,
  closeCardIntro,
  askConfirm,
  settleConfirmDialog,
  confirmDialogActionClass,
  openShowcaseCardDetail,
  openBagCardDetail,
  openFormationCardDetail,
  openTradeListingDetail,
  openCatalogCardDetail,
  openDrawResultDetail,
  handleCardDetailAction,
  drawHistoryDetailMeta,
  getPityForPool,
  pityRuleLabel,
  buildCardShareText,
  shareCard,
  closeShareText,
  cardLockAction,
  toggleCardLock,
  copyShareText,
  synthesizeCard,
  toggleBulkDecomposeRarity,
  loadBulkDecomposePreview,
  bulkDecomposeCards,
  openTradeListingModal,
  closeTradeListingModal,
  getRecyclePrice,
  openRecycleModal,
  closeRecycleModal,
  cardUpgradeUuid,
  openUpgradeModal,
  closeUpgradeModal,
  upgradeCard,
  recycleCards,
  createTradeListing,
  cancelTradeListing,
  buyTradeListing,
  claimRedeemCode,
  claimExchange,
  buySeasonShopItem,
  pointChangeClass,
  formatPointChange,
  seasonPointSourceLabel,
  pointMetadataSummary,
  changeTradePage,
  isNewCard,
  markNewCardSeen,
  pvePowerPercent,
  pveStageLevelLabel,
  achievementProgressPercent,
  achievementProgressText,
  taskProgressPercent,
  taskProgressText,
  taskPeriodText,
  resetAchievementFilters,
  achievementScopeLabel,
  leaderboardInitial,
  formatLeaderboardValue,
  leaderboardRankLabel,
};

provide(APP_CONTEXT_KEY, appContext);

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
                  <span
                    v-if="item.key === 'messages' && unreadMessageCount > 0"
                    class="user-menu-badge"
                  >
                    {{ unreadMessageCount }}
                  </span>
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
                  <small>同步资产</small>
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
        v-if="announcements.length > 0"
        class="announcement-strip"
        :class="{ compact: visibleAnnouncements.length === 0 }"
      >
        <div class="announcement-strip-head">
          <div>
            <p class="eyebrow">公告</p>
            <strong>{{
              unreadAnnouncementCount > 0
                ? `${unreadAnnouncementCount} 条未读`
                : "全部已读"
            }}</strong>
          </div>
          <button
            class="secondary-action compact"
            type="button"
            @click="openAnnouncementList"
          >
            全部
          </button>
        </div>
        <article
          v-for="item in visibleAnnouncements"
          :key="item.id"
          class="announcement-item"
          :class="{ read: isAnnouncementRead(item) }"
          @click="openAnnouncementDetail(item)"
        >
          <div class="announcement-item-main">
            <strong>{{ item.title }}</strong>
            <span>{{ announcementSummary(item.content) }}</span>
          </div>
          <div class="announcement-item-actions">
            <span v-if="!isAnnouncementRead(item)" class="unread-dot"></span>
            <button type="button" @click.stop="closeAnnouncement(item)">
              关闭
            </button>
          </div>
        </article>
      </section>

      <DrawPage v-if="activeSection === 'draw'" />

      <ProfilePage v-if="activeSection === 'profile'" />

      <FriendsPage v-if="activeSection === 'friends'" />

      <MessagesPage v-if="activeSection === 'messages'" />

      <SettingsPage v-if="activeSection === 'settings'" />

      <GuildPage v-if="activeSection === 'guild'" />

      <BagPage v-if="activeSection === 'bag'" />

      <FormationPage v-if="activeSection === 'formation'" />

      <PvePage v-if="activeSection === 'pve'" />

      <SynthesizePage v-if="activeSection === 'synthesize'" />

      <PointsPage v-if="activeSection === 'points'" />

      <TradePage v-if="activeSection === 'trade'" />

      <LeaderboardPage v-if="activeSection === 'leaderboard'" />

      <TasksPage v-if="activeSection === 'tasks'" />

      <SeasonPage v-if="activeSection === 'season'" />

      <AchievementsPage v-if="activeSection === 'achievements'" />

      <RedeemPage v-if="activeSection === 'redeem'" />

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

    <FeedbackToast :feedback="feedback" />
    <AchievementToastStack
      :notices="achievementToasts"
      @dismiss="dismissAchievementToast"
    />

    <Teleport to="body">
      <div
        v-if="confirmDialogTarget"
        class="result-modal-backdrop confirm-modal-backdrop"
        role="presentation"
        @click.self="settleConfirmDialog(false)"
      >
        <section
          class="confirm-modal"
          role="dialog"
          aria-modal="true"
          :aria-label="confirmDialogTarget.title"
        >
          <div class="confirm-modal-icon">
            <component
              :is="confirmDialogTarget.icon || ShieldCheck"
              :size="22"
            />
          </div>
          <div class="confirm-modal-body">
            <h2>{{ confirmDialogTarget.title }}</h2>
            <p v-if="confirmDialogTarget.message">
              {{ confirmDialogTarget.message }}
            </p>
            <ul v-if="confirmDialogTarget.details?.length">
              <li
                v-for="detail in confirmDialogTarget.details"
                :key="detail"
              >
                {{ detail }}
              </li>
            </ul>
          </div>
          <footer class="result-modal-actions confirm-modal-actions">
            <button
              class="secondary-action"
              type="button"
              @click="settleConfirmDialog(false)"
            >
              {{ confirmDialogTarget.cancelText }}
            </button>
            <button
              :class="confirmDialogActionClass(confirmDialogTarget)"
              type="button"
              @click="settleConfirmDialog(true)"
            >
              {{ confirmDialogTarget.confirmText }}
            </button>
          </footer>
        </section>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="announcementModalOpen"
        class="result-modal-backdrop"
        role="presentation"
        @click.self="closeAnnouncementModal"
      >
        <section
          class="announcement-modal"
          role="dialog"
          aria-modal="true"
          aria-label="公告"
        >
          <header class="result-modal-head">
            <div>
              <p class="eyebrow">公告</p>
              <h2>{{ selectedAnnouncement?.title || "公告" }}</h2>
              <span v-if="selectedAnnouncement">
                {{ selectedAnnouncement.active !== false ? "进行中" : "已归档" }}
                · {{ formatDate(selectedAnnouncement.createdAt) }}
              </span>
              <span v-else>{{ announcements.length }} 条</span>
            </div>
            <button
              class="modal-close"
              type="button"
              @click="closeAnnouncementModal"
            >
              关闭
            </button>
          </header>

          <div class="announcement-modal-body">
            <article
              v-if="selectedAnnouncement"
              class="announcement-detail-card"
            >
              <p>{{ selectedAnnouncement.content }}</p>
              <dl>
                <div>
                  <dt>时间</dt>
                  <dd>
                    {{ formatDate(selectedAnnouncement.startsAt) }} 至
                    {{ formatDate(selectedAnnouncement.endsAt) }}
                  </dd>
                </div>
                <div>
                  <dt>状态</dt>
                  <dd>
                    {{
                      selectedAnnouncement.active !== false
                        ? "进行中"
                        : "已归档"
                    }}
                  </dd>
                </div>
              </dl>
            </article>
            <div v-else class="announcement-list">
              <button
                v-for="item in announcements"
                :key="item.id"
                class="announcement-list-item"
                :class="{ read: isAnnouncementRead(item) }"
                type="button"
                @click="openAnnouncementDetail(item)"
              >
                <span class="announcement-status">{{
                  item.active !== false ? "进行中" : "已归档"
                }}</span>
                <strong>{{ item.title }}</strong>
                <span>{{ announcementSummary(item.content) }}</span>
                <small>{{ isAnnouncementRead(item) ? "已读" : "未读" }}</small>
              </button>
            </div>
          </div>

          <footer class="result-modal-actions">
            <button
              v-if="selectedAnnouncement"
              class="secondary-action"
              type="button"
              @click="selectedAnnouncement = null"
            >
              返回
            </button>
            <button
              v-if="selectedAnnouncement"
              class="secondary-action"
              type="button"
              @click="selectedAnnouncement && closeAnnouncement(selectedAnnouncement)"
            >
              隐藏
            </button>
            <button
              class="primary-action"
              type="button"
              @click="closeAnnouncementModal"
            >
              关闭
            </button>
          </footer>
        </section>
      </div>
    </Teleport>

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
                  <span>抽取后记录进度</span>
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
              {{ launchActivityInfo.description || "登录可领一次" }}
            </p>
            <div class="launch-reward-card">
              <span>本次奖励</span>
              <strong>{{ formatRewards(launchActivityInfo.rewards) }}</strong>
              <small>领取后刷新资产</small>
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
                  <span
                    v-if="isNewCard(card)"
                    class="new-card-badge"
                    aria-label="新获得"
                  >
                    NEW
                  </span>
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
                  <span
                    v-if="isNewCard(card)"
                    class="new-card-badge"
                    aria-label="新获得"
                  >
                    NEW
                  </span>
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
          class="trade-listing-modal trade-create-modal"
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
          aria-label="卡片详情"
        >
          <header class="result-modal-head">
            <div>
              <p class="eyebrow">卡片详情</p>
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
          <div class="trade-listing-body card-intro-body card-detail-body">
            <div
              class="card-detail-preview"
              :class="rarityClass(cardIntroTarget.rarity || '')"
            >
              <div
                class="card-media-frame"
                :class="{ 'has-media': hasCardMedia(cardIntroTarget.cardImage) }"
              >
                <video
                  v-if="isCardVideo(cardIntroTarget.cardImage)"
                  class="card-art-media"
                  :src="cardMediaUrl(cardIntroTarget.cardImage)"
                  muted
                  loop
                  autoplay
                  playsinline
                  @error="hideBrokenCardMedia"
                />
                <img
                  v-else-if="cardMediaUrl(cardIntroTarget.cardImage)"
                  class="card-art-media"
                  :src="cardMediaUrl(cardIntroTarget.cardImage)"
                  :alt="cardIntroTarget.name"
                  @error="hideBrokenCardMedia"
                />
                <div class="card-sigil"></div>
                <div class="result-card-top">
                  <span v-if="cardIntroTarget.rarity" class="rarity-badge">
                    {{ cardIntroTarget.rarity }}
                  </span>
                  <span v-if="cardIntroTarget.type" class="card-type-pill">
                    {{ cardIntroTarget.type }}
                  </span>
                </div>
              </div>
            </div>
            <div class="card-detail-info">
              <p>{{ cardIntroTarget.desc }}</p>
              <dl v-if="cardIntroTarget.rows.length" class="card-detail-meta">
                <div v-for="row in cardIntroTarget.rows" :key="row.label">
                  <dt>{{ row.label }}</dt>
                  <dd>{{ row.value }}</dd>
                </div>
              </dl>
            </div>
          </div>
          <footer
            v-if="cardIntroTarget.actions.length"
            class="result-modal-actions card-detail-actions"
          >
            <button
              v-for="action in cardIntroTarget.actions"
              :key="action.key"
              :class="cardDetailActionClass(action)"
              type="button"
              :disabled="action.disabled"
              @click="handleCardDetailAction(action)"
            >
              <component :is="action.icon" :size="16" />
              {{ action.label }}
            </button>
          </footer>
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
                    <small>{{ drawHistoryDetailMeta(detail) }}</small>
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
              class="result-card draw-result-card clickable-card-area"
              :class="[
                rarityClass(card.rarity),
                { featured: lastResults.length === 1 },
              ]"
              :style="{ '--delay': `${Math.min(index * 42, 420)}ms` }"
              role="button"
              tabindex="0"
              @click="openDrawResultDetail(card)"
              @keydown.enter.prevent="openDrawResultDetail(card)"
              @keydown.space.prevent="openDrawResultDetail(card)"
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
                    <div class="card-top-right">
                      <span class="new-card-badge" aria-label="新获得">
                        NEW
                      </span>
                      <span class="card-type-pill">{{
                        cardTypeLabel(card.cardType)
                      }}</span>
                    </div>
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
