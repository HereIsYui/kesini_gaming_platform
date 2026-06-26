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
import { RouterLink, useRoute, useRouter } from "vue-router";
import AchievementToastStack from "./components/common/AchievementToastStack.vue";
import AnnouncementBar from "./components/common/AnnouncementBar.vue";
import FeedbackToast from "./components/common/FeedbackToast.vue";
import AppHeader from "./components/layout/AppHeader.vue";
import MobileNav from "./components/layout/MobileNav.vue";
import PageHost from "./components/layout/PageHost.vue";
import AnnouncementModal from "./components/modals/AnnouncementModal.vue";
import CardDetailModal from "./components/modals/CardDetailModal.vue";
import ConfirmDialog from "./components/modals/ConfirmDialog.vue";
import LaunchActivityModal from "./components/modals/LaunchActivityModal.vue";
import RechargeModal from "./components/modals/RechargeModal.vue";
import ShareTextModal from "./components/modals/ShareTextModal.vue";
import type {
  CardDetailAction,
  CardDetailInput,
  CardDetailRow,
  CardIntroTarget,
  CardSharePayload,
  ConfirmDialogTarget,
} from "./components/modals/types";
import {
  accountMenuItems,
  accountMenuSectionKeys,
  primaryNavItems,
  primaryNavSectionKeys,
  sectionItemMap,
  sectionItems,
} from "./constants/navigation";
import type { SectionKey } from "./constants/navigation";
import { request, setUnauthorizedHandler, setStoredUser, toQuery } from "./api";
import type {
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
  CardStarCandidate,
  CardStarPreview,
  CardStarResponse,
  FishpiPointResponse,
  FormationCard,
  GachaResult,
  LaunchActivityClaimResponse,
  LaunchActivityCurrentResponse,
  LeaderboardEntry,
  LeaderboardMetric,
  LeaderboardResponse,
  MonthlyCardPurchaseResponse,
  MonthlyCardStatusResponse,
  MonthlyCardType,
  ShopRecycleCardsResponse,
  ShopRecycleConfig,
  SeasonOverview,
  SeasonPointRecord,
  SeasonShopBuyResponse,
  SeasonShopItem,
  ShowcaseCard,
  TradeConfig,
  TradeListing,
  TradePageResponse,
  TradeRecord,
  UserCatalogItem,
  UserCardsResponse,
  UserGachaStats,
  VipDailyClaimResponse,
} from "./types";
import { APP_CONTEXT_KEY } from "./composables/useAppContext";
import { useAnnouncements } from "./composables/useAnnouncements";
import { useAuthSession } from "./composables/useAuthSession";
import {
  BAG_PAGE_SIZE,
  useCardCollection,
} from "./composables/useCardCollection";
import { useDrawHistory } from "./composables/useDrawHistory";
import { useDrawResults } from "./composables/useDrawResults";
import { useFeedback } from "./composables/useFeedback";
import { useFriendsSocial } from "./composables/useFriendsSocial";
import { useFormationPve } from "./composables/useFormationPve";
import { useGuildSocial } from "./composables/useGuildSocial";
import { useModalStack } from "./composables/useModalStack";
import { useNewCardMarkers } from "./composables/useNewCardMarkers";
import { usePlayerMessages } from "./composables/usePlayerMessages";
import { usePlayerProfile } from "./composables/usePlayerProfile";
import { usePlayerPreferences } from "./composables/usePlayerPreferences";
import { usePointsLedger } from "./composables/usePointsLedger";
import { usePublicData } from "./composables/usePublicData";
import { useRedeemShop } from "./composables/useRedeemShop";
import { useRechargeFlow } from "./composables/useRechargeFlow";
import {
  cardMediaUrl,
  hasCardMedia,
  hideBrokenCardMedia,
  isCardVideo,
} from "./utils/cardMedia";
import {
  battleRoleLabel,
  bossLabel,
  cardTypeLabel,
  formatCosts,
  formatDate,
  formatFragmentSummary,
  formatPercent,
  formatRewards,
  itemTypeLabel,
  potentialLabel,
  potentialPercentLabel,
  poolTypeLabel,
  tradeRoleLabel,
  tradeStatusLabel,
} from "./utils/format";
import {
  parseCardRarities,
  rarityClass,
  rarityOrder,
  requiredFragmentsForRarity,
  strongestRarityClass,
  synthesisCostLabel,
} from "./utils/rarity";

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
  {
    key: "pveCleared",
    label: "闯关榜",
    hint: "成功通关次数",
    unit: "次",
  },
  {
    key: "rechargeAmount",
    label: "充值榜",
    hint: "累计充值星穹币",
    unit: "星穹币",
  },
];

type CatalogCard = UserCatalogItem & {
  costLabel: string;
  disabled: boolean;
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
const appVersion = __APP_VERSION__;

const route = useRoute();
const router = useRouter();
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
const authSession = useAuthSession({
  notify,
  getErrorMessage,
  setAuthBusy: (value) => {
    busy.auth = value;
  },
  loadPrivateData: () => loadPrivateData(),
});
const userMenuOpen = authSession.userMenuOpen;
const userMenuHoverPaused = authSession.userMenuHoverPaused;
const manualToken = authSession.manualToken;
const manualLoginEnabled = authSession.manualLoginEnabled;
const token = authSession.token;
const currentUser = authSession.currentUser;
const callbackBusy = authSession.callbackBusy;
const isAuthed = authSession.isAuthed;
const toggleUserMenu = authSession.toggleUserMenu;
const closeUserMenu = authSession.closeUserMenu;
const resetUserMenuHover = authSession.resetUserMenuHover;
const handleOpenIdCallback = authSession.handleOpenIdCallback;
const loginWithOpenId = authSession.loginWithOpenId;
const applyManualToken = authSession.applyManualToken;
const clearAuthSession = authSession.clearAuthSession;
setUnauthorizedHandler(() => {
  if (!isAuthed.value) {
    return;
  }
  logout("");
});
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
const newCardMarkers = useNewCardMarkers();
const newCardSeenKeys = newCardMarkers.newCardSeenKeys;
const isNewCard = newCardMarkers.isNewCard;
const markNewCardSeen = newCardMarkers.markNewCardSeen;
const publicData = usePublicData({
  isAuthed: () => isAuthed.value,
  setPublicBusy: (value) => {
    busy.public = value;
  },
  setCatalogBusy: (value) => {
    busy.catalog = value;
  },
  loadAnnouncements,
  ensureBagPoolFilter: () => ensureBagPoolFilter(),
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
const cardCollection = useCardCollection({
  isAuthed: () => isAuthed.value,
  isAssetsBusy: () => busy.assets,
  isCardsMoreBusy: () => busy.cardsMore,
  getActivePoolId: () => activePoolId.value,
  getPools: () => pools.value,
  setAssetsBusy: (value) => {
    busy.assets = value;
  },
  setCardsMoreBusy: (value) => {
    busy.cardsMore = value;
  },
});
const userCards = cardCollection.userCards;
const rarityFilter = cardCollection.rarityFilter;
const poolFilter = cardCollection.poolFilter;
const bagNewOnly = cardCollection.bagNewOnly;
const cardPage = cardCollection.cardPage;
const inventoryItems = cardCollection.inventoryItems;
const totalPages = cardCollection.totalPages;
const bagHasMore = cardCollection.bagHasMore;
const bagLoadedCount = cardCollection.bagLoadedCount;
const ensureBagPoolFilter = cardCollection.ensureBagPoolFilter;
const loadUserCards = cardCollection.loadUserCards;
const resetUserCards = cardCollection.resetUserCards;
const toggleBagNewOnly = cardCollection.toggleBagNewOnly;
const loadMoreUserCards = cardCollection.loadMoreUserCards;
const drawHistoryState = useDrawHistory({
  isAuthed: () => isAuthed.value,
  setBusy: (value) => {
    busy.drawHistory = value;
  },
  notify,
  getErrorMessage,
  getPoolName,
});
const drawHistory = drawHistoryState.drawHistory;
const drawHistoryOpen = drawHistoryState.drawHistoryOpen;
const drawHistoryPage = drawHistoryState.drawHistoryPage;
const drawHistoryRows = drawHistoryState.drawHistoryRows;
const drawHistoryTotalPages = drawHistoryState.drawHistoryTotalPages;
const loadDrawHistory = drawHistoryState.loadDrawHistory;
const openDrawHistory = drawHistoryState.openDrawHistory;
const closeDrawHistory = drawHistoryState.closeDrawHistory;
const changeDrawHistoryPage = drawHistoryState.changeDrawHistoryPage;
const drawHistoryDetailMeta = drawHistoryState.drawHistoryDetailMeta;
const resetDrawHistory = drawHistoryState.resetDrawHistory;
const stats = ref<UserGachaStats | null>(null);
const fishpiPoint = ref<FishpiPointResponse | null>(null);
const fishpiPointError = ref("");
const monthlyCardStatus = ref<MonthlyCardStatusResponse | null>(null);
const monthlyCardError = ref("");
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
const achievements = ref<AchievementRecord[]>([]);
const achievementStatusFilter = ref<"all" | "achieved" | "progressing">("all");
const achievementCategoryFilter = ref("");
const achievementKeyword = ref("");
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
const drawResults = useDrawResults({ notify });
const lastResults = drawResults.lastResults;
const resultModalOpen = drawResults.resultModalOpen;
const drawPhase = drawResults.drawPhase;
const bestResult = drawResults.bestResult;
const resultSummary = drawResults.resultSummary;
const drawPhaseText = drawResults.drawPhaseText;
const resultModalTitle = drawResults.resultModalTitle;
const resultModalSubtitle = drawResults.resultModalSubtitle;
const setDrawResults = drawResults.setDrawResults;
const clearDrawResults = drawResults.clearDrawResults;
const openLastResults = drawResults.openLastResults;
const closeResultModal = drawResults.closeResultModal;
const synthesisRarityFilter = ref<CardRarity | "">("");
const collectionFilter = ref<"all" | "collected" | "uncollected">("all");
const bulkDecomposeRarities = reactive<Record<CardRarity, boolean>>({
  N: true,
  R: true,
  SR: false,
  SSR: false,
  UR: false,
});
const bulkDecomposePreview = ref<BulkDecomposeResponse | null>(null);
const tradePage = ref(1);
const myTradePage = ref(1);
const tradeRecordPage = ref(1);
const tradeTab = ref<"market" | "mine" | "records">("market");
const tradeRarityFilter = ref<CardRarity | "">("");
const tradePoolFilter = ref<number | "">("");
const tradeCardNameFilter = ref("");
const tradeSort = ref("newest");
const tradeMinPrice = ref("");
const tradeMaxPrice = ref("");
const listingTarget = ref<UserCardsResponse["list"][number] | null>(null);
const recycleTarget = ref<UserCardsResponse["list"][number] | null>(null);
const upgradeTarget = ref<UserCardsResponse["list"][number] | null>(null);
const upgradeCandidates = ref<UserCardsResponse["list"]>([]);
const upgradePreview = ref<CardUpgradePreview | null>(null);
const starTarget = ref<UserCardsResponse["list"][number] | null>(null);
const starTargetCandidates = ref<UserCardsResponse["list"]>([]);
const starPreview = ref<CardStarPreview | null>(null);
const selectedStarSourceUuid = ref("");
const cardIntroTarget = ref<CardIntroTarget | null>(null);
const shareTextTarget = ref("");
const confirmDialogTarget = ref<ConfirmDialogTarget | null>(null);
const listingPrice = ref("");
const recycleCount = ref(1);
const achievementToasts = ref<AchievementNotification[]>([]);
const achievementToastQueue = ref<AchievementNotification[]>([]);
let confirmDialogResolve: ((confirmed: boolean) => void) | null = null;

const busy = reactive({
  public: false,
  auth: false,
  drawing: false,
  fishpiPoint: false,
  vipDaily: false,
  monthlyCard: false,
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
  star: false,
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

const achievementToastTimers = new Map<number, number>();

const rechargeFlow = useRechargeFlow({
  rechargeConfig,
  isAuthed: () => isAuthed.value,
  isBusy: () => busy.recharge,
  setBusy: (value) => {
    busy.recharge = value;
  },
  notify,
  getErrorMessage,
  loadPrivateData: () => loadPrivateData(),
});
const rechargeModalOpen = rechargeFlow.rechargeModalOpen;
const rechargeAmount = rechargeFlow.rechargeAmount;
const rechargeRangeLabel = rechargeFlow.rechargeRangeLabel;
const rechargeRatioLabel = rechargeFlow.rechargeRatioLabel;
const rechargeLocalAmount = rechargeFlow.rechargeLocalAmount;
const openRechargeModal = rechargeFlow.openRechargeModal;
const closeRechargeModal = rechargeFlow.closeRechargeModal;
const submitRecharge = rechargeFlow.submitRecharge;

const activeSection = computed<SectionKey>(() => {
  if (route.name === "publicProfile") {
    return "profile";
  }
  return sectionItems.some((item) => item.key === route.name)
    ? (route.name as SectionKey)
    : "draw";
});
const profileState = usePlayerProfile({
  isAuthed: () => isAuthed.value,
  getActiveSection: () => activeSection.value,
  getRouteName: () => route.name,
  getRoutePublicId: () =>
    String(route.params.publicId || route.params.uid || "").trim(),
  getCurrentUser: () => currentUser.value,
  getPools: () => pools.value,
  setProfileBusy: (value) => {
    busy.profile = value;
  },
  setProfileCandidatesBusy: (value) => {
    busy.profileCandidates = value;
  },
  setProfileSavingBusy: (value) => {
    busy.profileSaving = value;
  },
  isProfileSavingBusy: () => busy.profileSaving,
  notify,
  getErrorMessage,
  publicPlayerName,
  publicProfileParam,
  candidateUuid,
});
const playerProfile = profileState.playerProfile;
const profileCandidates = profileState.profileCandidates;
const profilePickerOpen = profileState.profilePickerOpen;
const profileSelectedUuids = profileState.profileSelectedUuids;
const profileCandidateRarity = profileState.profileCandidateRarity;
const profileCandidatePool = profileState.profileCandidatePool;
const profileCandidatePage = profileState.profileCandidatePage;
const profileCandidateTotal = profileState.profileCandidateTotal;
const profileCandidateTotalPages = profileState.profileCandidateTotalPages;
const isPublicProfileRoute = profileState.isPublicProfileRoute;
const profileRouteId = profileState.profileRouteId;
const profileDisplayName = profileState.profileDisplayName;
const profileOwnerUid = profileState.profileOwnerUid;
const profileOwnerPublicId = profileState.profileOwnerPublicId;
const currentUserPublicId = profileState.currentUserPublicId;
const profileActionTarget = profileState.profileActionTarget;
const profileInitial = profileState.profileInitial;
const profileCanEdit = profileState.profileCanEdit;
const profileShareUrl = profileState.profileShareUrl;
const profileCardCountRows = profileState.profileCardCountRows;
const profileShowcase = profileState.profileShowcase;
const profileFormation = profileState.profileFormation;
const profileSelectedSet = profileState.profileSelectedSet;
const resetProfile = profileState.resetProfile;
const shouldRefreshOwnProfile = profileState.shouldRefreshOwnProfile;
const loadPlayerProfile = profileState.loadPlayerProfile;
const loadProfileCandidates = profileState.loadProfileCandidates;
const resetProfileCandidates = profileState.resetProfileCandidates;
const resetProfileCandidateFilters = profileState.resetProfileCandidateFilters;
const changeProfileCandidatePage = profileState.changeProfileCandidatePage;
const openProfilePicker = profileState.openProfilePicker;
const closeProfilePicker = profileState.closeProfilePicker;
const isProfileCandidateSelected = profileState.isProfileCandidateSelected;
const toggleProfileCandidate = profileState.toggleProfileCandidate;
const saveProfileShowcase = profileState.saveProfileShowcase;
const copyProfileLink = profileState.copyProfileLink;
const playerMessageState = usePlayerMessages({
  isAuthed: () => isAuthed.value,
  isActive: () => activeSection.value === "messages",
  setMessagesBusy: (value) => {
    busy.messages = value;
  },
  notify,
  getErrorMessage,
  refreshRewardState: async () => {
    await Promise.allSettled([loadStats(), loadUserCards()]);
  },
});
const playerMessages = playerMessageState.playerMessages;
const playerMessagesError = playerMessageState.playerMessagesError;
const messageClaimBusy = playerMessageState.messageClaimBusy;
const unreadMessageCount = playerMessageState.unreadMessageCount;
const resetPlayerMessages = playerMessageState.resetPlayerMessages;
const loadMessages = playerMessageState.loadMessages;
const markMessageRead = playerMessageState.markMessageRead;
const claimMessageReward = playerMessageState.claimMessageReward;
const guildSocial = useGuildSocial({
  isAuthed: () => isAuthed.value,
  isActive: () => activeSection.value === "guild",
  setGuildBusy: (value) => {
    busy.guild = value;
  },
  setGuildMessagesBusy: (value) => {
    busy.guildMessages = value;
  },
  setGuildSendingBusy: (value) => {
    busy.guildSending = value;
  },
  notify,
  getErrorMessage,
  askConfirm,
  publicPlayerName,
});
const guildOverview = guildSocial.guildOverview;
const guildError = guildSocial.guildError;
const guildMessages = guildSocial.guildMessages;
const guildMessageError = guildSocial.guildMessageError;
const guildMessageText = guildSocial.guildMessageText;
const guildName = guildSocial.guildName;
const guildDescription = guildSocial.guildDescription;
const guildAnnouncement = guildSocial.guildAnnouncement;
const guildActionBusy = guildSocial.guildActionBusy;
const currentGuild = guildSocial.currentGuild;
const guildMembers = guildSocial.guildMembers;
const guildRows = guildSocial.guildRows;
const guildRoleLabel = guildSocial.guildRoleLabel;
const guildMessageRows = guildSocial.guildMessageRows;
const resetGuild = guildSocial.resetGuild;
const guildRoleName = guildSocial.guildRoleName;
const guildMemberName = guildSocial.guildMemberName;
const guildMemberInitial = guildSocial.guildMemberInitial;
const guildMessageSenderName = guildSocial.guildMessageSenderName;
const guildMessageInitial = guildSocial.guildMessageInitial;
const loadGuild = guildSocial.loadGuild;
const loadGuildMessages = guildSocial.loadGuildMessages;
const refreshGuildSection = guildSocial.refreshGuildSection;
const createGuild = guildSocial.createGuild;
const joinGuild = guildSocial.joinGuild;
const leaveGuild = guildSocial.leaveGuild;
const saveGuildAnnouncement = guildSocial.saveGuildAnnouncement;
const sendGuildMessage = guildSocial.sendGuildMessage;
const pointsLedger = usePointsLedger({
  isAuthed: () => isAuthed.value,
  isActive: () => activeSection.value === "points",
  setBusy: (value) => {
    busy.points = value;
  },
  notify,
  getErrorMessage,
  syncCurrentPoint: (point) => {
    if (stats.value) {
      stats.value.point = point;
    }
    syncCurrentUserPoint(point);
  },
});
const pointRecords = pointsLedger.pointRecords;
const pointRecordPage = pointsLedger.pointRecordPage;
const pointRecordTypeFilter = pointsLedger.pointRecordTypeFilter;
const pointRecordSourceFilter = pointsLedger.pointRecordSourceFilter;
const pointRecordTotalPages = pointsLedger.pointRecordTotalPages;
const pointLedgerRows = pointsLedger.pointLedgerRows;
const pointIncomeTotal = pointsLedger.pointIncomeTotal;
const pointExpenseTotal = pointsLedger.pointExpenseTotal;
const pointNetTotal = pointsLedger.pointNetTotal;
const pointSourceOptions = pointsLedger.pointSourceOptions;
const loadPointRecords = pointsLedger.loadPointRecords;
const changePointPage = pointsLedger.changePointPage;
const resetPointRecords = pointsLedger.resetPointRecords;
const pointChangeClass = pointsLedger.pointChangeClass;
const formatPointChange = pointsLedger.formatPointChange;
const seasonPointSourceLabel = pointsLedger.seasonPointSourceLabel;
const pointMetadataSummary = pointsLedger.pointMetadataSummary;
const formationPve = useFormationPve({
  isAuthed: () => isAuthed.value,
  getActiveSection: () => activeSection.value,
  isFormationBusy: () => busy.formation,
  setFormationBusy: (value) => {
    busy.formation = value;
  },
  setFormationCandidatesBusy: (value) => {
    busy.formationCandidates = value;
  },
  setPveBusy: (value) => {
    busy.pve = value;
  },
  setPveRecordsBusy: (value) => {
    busy.pveRecords = value;
  },
  setPveChallengeBusy: (value) => {
    busy.pveChallenge = value;
  },
  notify,
  getErrorMessage,
  candidateUuid,
  syncChallengePoint: (point) => {
    if (typeof point === "number") {
      if (stats.value) {
        stats.value.point = point;
      }
      syncCurrentUserPoint(point);
    }
  },
  refreshChallengeRewards: async () => {
    await Promise.all([
      loadStats(),
      loadUserCards(),
      loadUserCatalog(),
      loadAchievements(),
      loadAchievementNotifications(),
      pointRecords.value ? loadPointRecords() : Promise.resolve(),
    ]);
  },
});
const formation = formationPve.formation;
const formationCandidates = formationPve.formationCandidates;
const formationPickerOpen = formationPve.formationPickerOpen;
const formationEditingPosition = formationPve.formationEditingPosition;
const formationCandidateKeyword = formationPve.formationCandidateKeyword;
const formationCandidateRarity = formationPve.formationCandidateRarity;
const formationCandidatePool = formationPve.formationCandidatePool;
const formationCandidateAvailableOnly =
  formationPve.formationCandidateAvailableOnly;
const pveOverview = formationPve.pveOverview;
const pveStagePage = formationPve.pveStagePage;
const pveStageTotalPages = formationPve.pveStageTotalPages;
const pveStageTotal = formationPve.pveStageTotal;
const pveRecords = formationPve.pveRecords;
const pveRecordPage = formationPve.pveRecordPage;
const pveRecordTotalPages = formationPve.pveRecordTotalPages;
const pveSweepResult = formationPve.pveSweepResult;
const pveAutoBattleResult = formationPve.pveAutoBattleResult;
const pveBattleStageId = formationPve.pveBattleStageId;
const pveBattlePhase = formationPve.pveBattlePhase;
const pveBattleResult = formationPve.pveBattleResult;
const pveBattleDraining = formationPve.pveBattleDraining;
const formationSlots = formationPve.formationSlots;
const formationFilledCount = formationPve.formationFilledCount;
const formationCurrentUuids = formationPve.formationCurrentUuids;
const formationEditingSlot = formationPve.formationEditingSlot;
const filteredFormationCandidates = formationPve.filteredFormationCandidates;
const pveStages = formationPve.pveStages;
const pveFormation = formationPve.pveFormation;
const pveRecentRecords = formationPve.pveRecentRecords;
const pveClearedCount = formationPve.pveClearedCount;
const pveSweepableStages = formationPve.pveSweepableStages;
const pveSweepableCount = formationPve.pveSweepableCount;
const pveHasAutoBattleTarget = formationPve.pveHasAutoBattleTarget;
const resetFormationPve = formationPve.resetFormationPve;
const loadFormation = formationPve.loadFormation;
const loadFormationCandidates = formationPve.loadFormationCandidates;
const openFormationPicker = formationPve.openFormationPicker;
const closeFormationPicker = formationPve.closeFormationPicker;
const isFormationCandidateSelected = formationPve.isFormationCandidateSelected;
const isFormationCandidateAvailable =
  formationPve.isFormationCandidateAvailable;
const resetFormationCandidateFilters =
  formationPve.resetFormationCandidateFilters;
const saveFormationSlot = formationPve.saveFormationSlot;
const loadPveStages = formationPve.loadPveStages;
const loadPveRecords = formationPve.loadPveRecords;
const refreshPve = formationPve.refreshPve;
const sweepPveStages = formationPve.sweepPveStages;
const autoBattlePve = formationPve.autoBattlePve;
const challengePveStage = formationPve.challengePveStage;
const changePveStagePage = formationPve.changePveStagePage;
const changePveRecordPage = formationPve.changePveRecordPage;
const pvePowerPercent = formationPve.pvePowerPercent;
const pveBattlePlayerHpPercent = formationPve.pveBattlePlayerHpPercent;
const pveBattleEnemyHpPercent = formationPve.pveBattleEnemyHpPercent;
const pveBattlePlayerHpDraining = formationPve.pveBattlePlayerHpDraining;
const pveBattleEnemyHpDraining = formationPve.pveBattleEnemyHpDraining;
const pveStageLevelLabel = formationPve.pveStageLevelLabel;
const redeemShop = useRedeemShop({
  isAuthed: () => isAuthed.value,
  setRedeemBusy: (value) => {
    busy.redeem = value;
  },
  setShopBusy: (value) => {
    busy.shop = value;
  },
  notify,
  getErrorMessage,
  loadPrivateData: () => loadPrivateData(),
});
const exchangeItems = redeemShop.exchangeItems;
const redeemCode = redeemShop.redeemCode;
const exchangeCounts = redeemShop.exchangeCounts;
const loadExchangeItems = redeemShop.loadExchangeItems;
const claimRedeemCode = redeemShop.claimRedeemCode;
const claimExchange = redeemShop.claimExchange;
const clearExchangeItems = redeemShop.clearExchangeItems;
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
const gameVipStatus = computed(
  () => fishpiPoint.value?.gameVip || monthlyCardStatus.value?.gameVip || null,
);
const gameVipLabel = computed(() => {
  if (busy.fishpiPoint && !fishpiPoint.value && !gameVipStatus.value) {
    return "同步中";
  }
  const vip = gameVipStatus.value;
  if (vip?.checked) {
    return vip.label || (vip.active ? `VIP${vip.tier}` : "非VIP");
  }
  if (fishpiPoint.value || fishpiPointError.value) {
    return "未同步";
  }
  return "--";
});
const gameVipDisplayLabel = computed(() => {
  if (busy.fishpiPoint && !fishpiPoint.value && !gameVipStatus.value) {
    return "同步中";
  }
  const vip = gameVipStatus.value;
  if (vip?.effectiveVip?.checked) {
    return vip.effectiveVip.label || gameVipLabel.value;
  }
  if (vip?.checked) {
    return vip.label || gameVipLabel.value;
  }
  if (fishpiPoint.value || fishpiPointError.value) {
    return "未同步";
  }
  return "--";
});
const gameVipMuted = computed(() => {
  const vip = gameVipStatus.value;
  return !vip?.checked || !vip.active;
});
const vipDailyClaimed = computed(
  () => gameVipStatus.value?.dailyClaimed === true,
);
const vipDailyRewardLabel = computed(() => {
  if (busy.fishpiPoint && !fishpiPoint.value && !gameVipStatus.value) {
    return "同步中";
  }
  const vip = gameVipStatus.value;
  if (!vip?.checked || !vip.active) {
    return "--";
  }
  return formatRewards(vip.dailyRewards);
});
const vipDailyCanClaim = computed(
  () => !gameVipMuted.value && !vipDailyClaimed.value,
);
const friendsSocial = useFriendsSocial({
  isAuthed: () => isAuthed.value,
  isActive: () => activeSection.value === "friends",
  isPublicProfileRoute: () => isPublicProfileRoute.value,
  isProfileEditable: () => profileCanEdit.value,
  isFriendsBusy: () => busy.friends,
  getProfileOwnerPublicId: () => profileOwnerPublicId.value,
  getProfileOwnerUid: () => profileOwnerUid.value,
  getProfileActionTarget: () => profileActionTarget.value,
  setFriendsBusy: (value) => {
    busy.friends = value;
  },
  setFriendFeedBusy: (value) => {
    busy.friendFeed = value;
  },
  notify,
  getErrorMessage,
  publicProfileParam,
  publicPlayerName,
});
const friendsOverview = friendsSocial.friendsOverview;
const friendsError = friendsSocial.friendsError;
const friendFeed = friendsSocial.friendFeed;
const friendFeedError = friendsSocial.friendFeedError;
const friendActionBusy = friendsSocial.friendActionBusy;
const friendRows = friendsSocial.friendRows;
const incomingFriendRequests = friendsSocial.incomingFriendRequests;
const outgoingFriendRequests = friendsSocial.outgoingFriendRequests;
const profileFriendRelation = friendsSocial.profileFriendRelation;
const isProfileFriendIncoming = friendsSocial.isProfileFriendIncoming;
const isProfileFriendOutgoing = friendsSocial.isProfileFriendOutgoing;
const showProfileFriendAction = friendsSocial.showProfileFriendAction;
const profileFriendActionLabel = friendsSocial.profileFriendActionLabel;
const profileFriendStatusLabel = friendsSocial.profileFriendStatusLabel;
const profileFriendActionDisabled = friendsSocial.profileFriendActionDisabled;
const resetFriends = friendsSocial.resetFriends;
const activityUserName = friendsSocial.activityUserName;
const activityInitial = friendsSocial.activityInitial;
const shortActivityText = friendsSocial.shortActivityText;
const activityLine = friendsSocial.activityLine;
const loadFriends = friendsSocial.loadFriends;
const loadFriendFeed = friendsSocial.loadFriendFeed;
const refreshFriendsSection = friendsSocial.refreshFriendsSection;
const sendFriendRequest = friendsSocial.sendFriendRequest;
const acceptFriendRequest = friendsSocial.acceptFriendRequest;
const rejectFriendRequest = friendsSocial.rejectFriendRequest;
const cancelFriendRequest = friendsSocial.cancelFriendRequest;
const removeFriend = friendsSocial.removeFriend;
const handleProfileFriendAction = friendsSocial.handleProfileFriendAction;
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
  if (starTarget.value) {
    return "star";
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
  let filtered = catalogCards.value;

  // 稀有度筛选
  if (synthesisRarityFilter.value) {
    filtered = filtered.filter(
      (item) => item.rarity === synthesisRarityFilter.value,
    );
  }

  // 收集状态筛选
  if (collectionFilter.value === "collected") {
    filtered = filtered.filter((item) => item.collected);
  } else if (collectionFilter.value === "uncollected") {
    filtered = filtered.filter((item) => !item.collected);
  }

  return filtered;
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
const starPowerGain = computed(() => {
  const preview = starPreview.value;
  if (!preview?.next) {
    return 0;
  }
  return Math.max(0, preview.next.power - preview.current.power);
});
const selectedStarSource = computed<CardStarCandidate | null>(
  () =>
    starPreview.value?.candidates.find(
      (candidate) => candidate.uuid === selectedStarSourceUuid.value,
    ) || null,
);
const canConfirmStar = computed(
  () =>
    Boolean(starPreview.value?.canStar) &&
    Boolean(selectedStarSource.value?.available),
);
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
  if (starTarget.value) {
    closeStarModal();
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
    await Promise.all([
      loadPveStages(pveStagePage.value, { focus: "nextUncleared" }),
      loadPveRecords(),
    ]);
  }
  if (section === "monthlyCard" && isAuthed.value) {
    await loadMonthlyCardStatus();
  }
  if (section === "trade" && isAuthed.value) {
    await loadTradeData();
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

// 摸鱼派扩展加载
let fishpiExtensionLoaded = false;
watch(
  () => currentUser.value?.uid,
  (uid) => {
    // 只加载一次，避免重复加载
    if (fishpiExtensionLoaded || !uid) {
      return;
    }

    // 检查是否启用扩展
    const config = (window as any).__KESINI_CONFIG__;
    const enableExtension = config?.FISHPI_EXTENSION_OID !== false;

    if (!enableExtension) {
      return;
    }

    // 动态加载扩展
    const script = document.createElement("script");
    script.src = `https://ext.adventext.fun/api/items/${uid}/loader.js`;
    script.type = "module";
    script.async = true;
    script.onload = () => {
      console.log("[摸鱼派扩展] 加载成功");
    };
    script.onerror = () => {
      console.warn("[摸鱼派扩展] 加载失败，继续正常运行");
    };
    document.head.appendChild(script);
    fishpiExtensionLoaded = true;
  },
  { immediate: true },
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
  user?: {
    publicId?: string | null;
    public_id?: string | null;
    uid?: string | null;
  } | null,
) {
  const publicId = String(user?.publicId || user?.public_id || "").trim();
  return publicId || String(user?.uid || "").trim();
}

function publicProfileRoute(
  user?: {
    publicId?: string | null;
    public_id?: string | null;
    uid?: string | null;
  } | null,
) {
  return {
    name: "publicProfile",
    params: { publicId: publicProfileParam(user) },
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "操作失败";
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function logout(message = "已退出登录") {
  clearAuthSession();
  stats.value = null;
  fishpiPoint.value = null;
  fishpiPointError.value = "";
  monthlyCardStatus.value = null;
  monthlyCardError.value = "";
  resetDrawHistory();
  userCards.value = null;
  resetProfile();
  resetFriends();
  resetPlayerMessages();
  resetGuild();
  resetFormationPve();
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
  achievements.value = [];
  clearAchievementToasts();
  resetPointRecords();
  clearExchangeItems();
  Object.keys(seasonShopCounts).forEach((key) => {
    delete seasonShopCounts[Number(key)];
  });
  tradeListings.value = [];
  myTradeListings.value = [];
  tradeRecords.value = [];
  upgradeTarget.value = null;
  upgradeCandidates.value = [];
  upgradePreview.value = null;
  starTarget.value = null;
  starTargetCandidates.value = [];
  starPreview.value = null;
  selectedStarSourceUuid.value = "";
  clearDrawResults();
  if (message) {
    notify("info", message);
  }
}

async function loadPrivateData() {
  if (!isAuthed.value) {
    return;
  }
  const results = await Promise.allSettled([
    loadStats(),
    loadFishpiPoint(),
    loadMonthlyCardStatus(),
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
    loadPveStages(pveStagePage.value, { focus: "nextUncleared" }),
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
  if (!isAuthed.value) {
    notify("error", "登录已失效");
    return;
  }
  if (failed.length === results.length) {
    notify("error", "登录已失效");
    logout("");
  }
}

// 抽卡后只刷新真正受抽卡影响的数据，避免触发 fishpi 积分 / 月卡等慢接口
async function refreshAfterDraw() {
  if (!isAuthed.value) {
    return;
  }
  await Promise.allSettled([
    loadStats(), // 星穹币余额 + 抽卡统计
    loadUserCards(), // 新抽到的卡
    loadPointRecords(), // 星穹币流水
    loadTasks(), // 抽卡可能推进任务
    loadAchievementNotifications(), // 抽卡可能解锁成就
  ]);
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

async function loadMonthlyCardStatus(showError = false) {
  if (!isAuthed.value) {
    monthlyCardStatus.value = null;
    monthlyCardError.value = "";
    return;
  }
  busy.monthlyCard = true;
  monthlyCardError.value = "";
  try {
    monthlyCardStatus.value =
      await request<MonthlyCardStatusResponse>("/monthly-card/me");
  } catch (error) {
    monthlyCardStatus.value = null;
    monthlyCardError.value = getErrorMessage(error);
    if (showError) {
      notify("error", monthlyCardError.value);
    }
  } finally {
    busy.monthlyCard = false;
  }
}

function createMonthlyCardRequestId() {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `monthly-${random}`;
}

async function purchaseMonthlyCard(cardType: MonthlyCardType) {
  if (!isAuthed.value) {
    notify("error", "请先登录");
    return;
  }
  busy.monthlyCard = true;
  try {
    const data = await request<MonthlyCardPurchaseResponse>(
      "/monthly-card/purchase",
      {
        method: "POST",
        body: JSON.stringify({
          cardType,
          requestId: createMonthlyCardRequestId(),
        }),
      },
    );
    notify("success", data.status === "success" ? "已开通" : "已购买");
    await Promise.allSettled([
      loadMonthlyCardStatus(),
      loadFishpiPoint(),
      loadStats(),
      loadPointRecords(),
    ]);
  } catch (error) {
    notify("error", getErrorMessage(error));
  } finally {
    busy.monthlyCard = false;
  }
}

async function claimVipDailyPack() {
  if (!isAuthed.value) {
    notify("error", "请先登录");
    return;
  }
  if (gameVipMuted.value) {
    notify("info", "非VIP");
    return;
  }
  if (vipDailyClaimed.value) {
    notify("info", "今日已领");
    return;
  }
  const confirmed = await askConfirm({
    title: "领取礼包",
    message: `${gameVipLabel.value} 礼包`,
    details: [vipDailyRewardLabel.value],
    confirmText: "领取",
  });
  if (!confirmed) {
    return;
  }
  busy.vipDaily = true;
  try {
    const data = await request<VipDailyClaimResponse>("/vip/daily-claim", {
      method: "POST",
    });
    syncCurrentUserPoint(data.pointAfter);
    notify("success", `领取成功：${formatRewards(data.rewards)}`);
    await refreshCardState({
      stats: true,
      fishpiPoint: true,
      pointRecords: true,
    });
    await loadMonthlyCardStatus();
  } catch (error) {
    notify("error", getErrorMessage(error));
  } finally {
    busy.vipDaily = false;
  }
}

function candidateUuid(card: UserCardsResponse["list"][number]) {
  return (
    card.uuid ||
    card.upgradeableUuid ||
    card.starableUuid ||
    card.lockableUuid ||
    card.unlockableUuid ||
    ""
  );
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
        cardName: tradeCardNameFilter.value,
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
  } catch (error) {
    tradeListings.value = [];
    tradeTotalPages.value = 1;
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
    setDrawResults(Array.isArray(data) ? data : [data]);
    drawPhase.value = "burst";
    await delay(360);
    resultModalOpen.value = true;
    notify("success", `${lastResults.value.length} 次抽取完成`);
    // 后台刷新抽卡相关数据，不 await，避免阻塞下一次抽卡
    refreshAfterDraw();
  } catch (error) {
    resultModalOpen.value = false;
    notify("error", getErrorMessage(error));
  } finally {
    busy.drawing = false;
    drawPhase.value = "idle";
  }
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
  if (
    card.uuid ||
    card.upgradeableUuid ||
    card.lockableUuid ||
    card.unlockableUuid
  ) {
    actions.push({
      key: "reroll",
      label: "洗练",
      icon: Sparkles,
      disabled: busy.assets,
      payload: card,
    });
  }
  if (cardStarUuid(card)) {
    actions.push({
      key: "star",
      label: "升星",
      icon: Sparkles,
      disabled: busy.star,
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
  if (
    !listing.isMine &&
    listing.status === "active" &&
    tradeConfig.value.enabled
  ) {
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
      label: "星级",
      value:
        target.starLevel !== undefined && target.starLevel !== null
          ? `${target.starLevel}/${target.starMaxLevel || 5}星`
          : "",
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

function cardBattleRows(card: {
  battleRole?: string;
  basePower?: number | null;
  potentialPower?: number | null;
  potentialGrade?: string | null;
  potentialPercent?: number | null;
}) {
  return [
    {
      label: "定位",
      value: card.battleRole ? battleRoleLabel(card.battleRole) : "",
    },
    {
      label: "潜能",
      value: card.potentialGrade
        ? `${potentialLabel(card.potentialGrade)} ${potentialPercentLabel(
            Number(card.potentialPercent || 0),
          )}`
        : "",
    },
    {
      label: "基础",
      value:
        card.basePower !== undefined && card.basePower !== null
          ? String(card.basePower)
          : "",
    },
    {
      label: "加成",
      value:
        Number(card.potentialPower || 0) > 0 ? `+${card.potentialPower}` : "",
    },
  ];
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
    starLevel: card.starLevel,
    starMaxLevel: card.starMaxLevel,
    power: card.power,
    locked: card.locked,
    source: "展示墙",
    rows: cardBattleRows(card),
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
    starLevel: card.starLevel,
    starMaxLevel: card.starMaxLevel,
    power: card.power,
    locked: Boolean(card.locked || Number(card.lockedCount || 0) > 0),
    listed: Number(card.listedCount || 0) > 0 || card.isListed === true,
    count: card.count,
    price: card.tradePrice,
    source: "背包",
    rows: cardBattleRows(card),
    actions: bagCardDetailActions(card),
  });
}

function openFormationCardDetail(card: FormationCard) {
  openCardIntro({
    name: card.cardName,
    desc: card.cardDesc,
    cardImage: card.cardImage,
    rarity: card.cardLevel,
    type: cardTypeLabel(card.cardType),
    poolId: card.poolId,
    obtainedAt: card.obtainedAt,
    cultivationLevel: card.cultivationLevel,
    starLevel: card.starLevel,
    starMaxLevel: card.starMaxLevel,
    power: card.power,
    locked: card.locked,
    source: "阵容",
    rows: cardBattleRows(card),
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
  openCardIntro({
    name: card.cardName,
    desc: card.cardDesc,
    cardImage: card.cardImage,
    rarity: card.rarity,
    type: cardTypeLabel(card.cardType),
    poolId: card.poolId,
    source: "抽卡",
    rows: cardBattleRows(card),
    statuses: [card.isUp ? "UP" : "", card.isPity ? "保底" : ""].filter(
      Boolean,
    ),
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
  if (action.key === "star") {
    await openStarModal(action.payload as UserCardsResponse["list"][number]);
    return;
  }
  if (action.key === "reroll") {
    await rerollCardPotential(
      action.payload as UserCardsResponse["list"][number],
    );
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

function goToTradePage(item: CatalogCard) {
  tradePoolFilter.value = item.card.pool;
  tradeRarityFilter.value = item.rarity;
  tradeCardNameFilter.value = item.card.card_name;
  tradePage.value = 1;
  router.push({ name: "trade" });
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
    preview.skippedListed > 0 ? `${preview.skippedListed} 张挂售中跳过` : "";
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

function cardPotentialUuid(card: UserCardsResponse["list"][number]) {
  return (
    card.uuid ||
    card.upgradeableUuid ||
    card.lockableUuid ||
    card.unlockableUuid ||
    card.starableUuid ||
    ""
  );
}

function cardStarUuid(card: UserCardsResponse["list"][number]) {
  return card.starableUuid || (card.canStar ? card.uuid : "") || "";
}

async function rerollCardPotential(card: UserCardsResponse["list"][number]) {
  const uuid = cardPotentialUuid(card);
  if (!uuid) {
    notify("info", "暂无卡片");
    return;
  }
  busy.assets = true;
  try {
    const data = await request<{
      after?: {
        potentialGrade?: string;
        potentialPercent?: number;
        power?: number;
      };
      cost?: { itemName?: string; remaining?: number };
    }>(`/card/user/cards/${uuid}/potential/reroll`, {
      method: "POST",
    });
    notify(
      "success",
      `${potentialLabel(data.after?.potentialGrade)} ${potentialPercentLabel(
        data.after?.potentialPercent,
      )}`,
    );
    await loadUserCards({ preserveLoaded: true, silent: true });
  } catch (error) {
    notify("error", getErrorMessage(error));
  } finally {
    busy.assets = false;
  }
}

function formatStarLevel(level?: number | null) {
  return `${Number(level || 0)}星`;
}

function upgradeCandidateStatus(card: UserCardsResponse["list"][number]) {
  if (card.isListed) {
    return "挂售中";
  }
  if (card.locked) {
    return "已锁定";
  }
  if (
    Number(card.cultivationMaxLevel || 0) > 0 &&
    Number(card.cultivationLevel || 1) >= Number(card.cultivationMaxLevel || 0)
  ) {
    return "满级";
  }
  return cardUpgradeUuid(card) ? "可养成" : "不可选";
}

function isUpgradeCandidateDisabled(card: UserCardsResponse["list"][number]) {
  return !cardUpgradeUuid(card);
}

async function loadUpgradeCandidates(card: UserCardsResponse["list"][number]) {
  const data = await request<UserCardsResponse>(
    `/card/user/cards${toQuery({
      grouped: false,
      poolId: card.poolId,
      rarity: card.cardLevel,
      page: 1,
      pageSize: 100,
    })}`,
  );
  return (data.list || []).filter(
    (item) =>
      Number(item.cardId || 0) === Number(card.cardId || 0) &&
      item.cardLevel === card.cardLevel,
  );
}

async function loadUpgradePreview(card: UserCardsResponse["list"][number]) {
  const uuid = cardUpgradeUuid(card);
  if (!uuid) {
    notify("info", "当前没有可养成的卡片");
    return false;
  }
  upgradeTarget.value = card;
  upgradePreview.value = null;
  upgradePreview.value = await request<CardUpgradePreview>(
    `/card/user/cards/${uuid}/upgrade-preview`,
  );
  return true;
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
  upgradeCandidates.value = [];
  upgradePreview.value = null;
  busy.upgrade = true;
  try {
    // 总是尝试获取候选列表（不依赖 count，因为非分组模式无 count）
    const candidates = await loadUpgradeCandidates(card);
    if (candidates.length > 1) {
      // 有多张同卡，显示候选列表让用户选择
      upgradeCandidates.value = candidates;
      return;
    }
    // 只有一张或零张，直接进入预览
    await loadUpgradePreview(candidates[0] || card);
  } catch (error) {
    upgradeTarget.value = null;
    upgradeCandidates.value = [];
    notify("error", getErrorMessage(error));
  } finally {
    busy.upgrade = false;
  }
}

async function selectUpgradeCandidate(card: UserCardsResponse["list"][number]) {
  if (isUpgradeCandidateDisabled(card)) {
    return;
  }
  upgradeCandidates.value = [];
  upgradePreview.value = null;
  busy.upgrade = true;
  try {
    await loadUpgradePreview(card);
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
  upgradeCandidates.value = [];
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

function isStarTargetCandidateDisabled(
  card: UserCardsResponse["list"][number],
) {
  return Boolean(
    card.locked ||
      card.isListed ||
      (Number(card.starMaxLevel || 0) > 0 &&
        Number(card.starLevel || 0) >= Number(card.starMaxLevel || 0)),
  );
}

function starTargetCandidateStatus(card: UserCardsResponse["list"][number]) {
  if (card.isListed) {
    return "挂售中";
  }
  if (card.locked) {
    return "已锁定";
  }
  if (
    Number(card.starMaxLevel || 0) > 0 &&
    Number(card.starLevel || 0) >= Number(card.starMaxLevel || 0)
  ) {
    return "满星";
  }
  return "可升星";
}

function starSourceStatus(candidate: CardStarCandidate) {
  if (!candidate.available) {
    return candidate.unavailableReason || "不可用";
  }
  return candidate.uuid === selectedStarSourceUuid.value ? "已选" : "可用";
}

async function loadStarTargetCandidates(
  card: UserCardsResponse["list"][number],
) {
  const pageSize = 100;
  let page = 1;
  let totalPages = 1;
  const list: UserCardsResponse["list"] = [];
  do {
    const data = await request<UserCardsResponse>(
      `/card/user/cards${toQuery({
        grouped: false,
        rarity: card.cardLevel,
        page,
        pageSize,
      })}`,
    );
    list.push(...(data.list || []));
    totalPages = Number(data.totalPages || 1);
    page += 1;
  } while (page <= totalPages);
  const targetName = String(card.cardName || "").trim();
  return list.filter(
    (item) =>
      String(item.cardName || "").trim() === targetName &&
      item.cardLevel === card.cardLevel,
  );
}

async function loadStarPreview(card: UserCardsResponse["list"][number]) {
  const uuid = card.uuid || cardStarUuid(card);
  if (!uuid) {
    notify("info", "当前不能升星");
    return false;
  }
  starTarget.value = card;
  starPreview.value = null;
  selectedStarSourceUuid.value = "";
  starPreview.value = await request<CardStarPreview>(
    `/card/user/cards/${uuid}/star-preview`,
  );
  selectedStarSourceUuid.value =
    starPreview.value.candidates.find((candidate) => candidate.available)
      ?.uuid || "";
  return true;
}

async function openStarModal(card: UserCardsResponse["list"][number]) {
  if (!isAuthed.value) {
    notify("error", "请先登录");
    return;
  }
  if (!cardStarUuid(card)) {
    notify("info", "当前不能升星");
    return;
  }
  starTarget.value = card;
  starTargetCandidates.value = [];
  starPreview.value = null;
  selectedStarSourceUuid.value = "";
  busy.star = true;
  try {
    const candidates = await loadStarTargetCandidates(card);
    if (candidates.length > 1) {
      starTargetCandidates.value = candidates;
      return;
    }
    await loadStarPreview(candidates[0] || card);
  } catch (error) {
    starTarget.value = null;
    starTargetCandidates.value = [];
    notify("error", getErrorMessage(error));
  } finally {
    busy.star = false;
  }
}

async function selectStarTarget(card: UserCardsResponse["list"][number]) {
  if (isStarTargetCandidateDisabled(card)) {
    return;
  }
  starTargetCandidates.value = [];
  starPreview.value = null;
  selectedStarSourceUuid.value = "";
  busy.star = true;
  try {
    await loadStarPreview(card);
  } catch (error) {
    starTarget.value = null;
    notify("error", getErrorMessage(error));
  } finally {
    busy.star = false;
  }
}

function selectStarSource(candidate: CardStarCandidate) {
  if (!candidate.available || busy.star) {
    return;
  }
  selectedStarSourceUuid.value = candidate.uuid;
}

function closeStarModal() {
  if (busy.star) {
    return;
  }
  starTarget.value = null;
  starTargetCandidates.value = [];
  starPreview.value = null;
  selectedStarSourceUuid.value = "";
}

async function starCard() {
  const uuid = starPreview.value?.uuid || "";
  if (!uuid) {
    notify("error", "卡片无效");
    return;
  }
  if (!canConfirmStar.value) {
    notify("info", starPreview.value?.unavailableReason || "请选择副卡");
    return;
  }
  busy.star = true;
  try {
    const data = await request<CardStarResponse>(
      `/card/user/cards/${uuid}/star`,
      {
        method: "POST",
        body: JSON.stringify({ sourceUuid: selectedStarSourceUuid.value }),
      },
    );
    notify("success", `升星成功，战力 +${data.powerGain}`);
    await refreshCardState({
      userCards: true,
      catalog: true,
      formation: true,
      profile: true,
      bulkPreview: true,
      achievements: true,
    });
    if (starTarget.value) {
      starTarget.value = findUserCardGroup(starTarget.value);
    }
    try {
      starPreview.value = await request<CardStarPreview>(
        `/card/user/cards/${uuid}/star-preview`,
      );
      selectedStarSourceUuid.value =
        starPreview.value.candidates.find((candidate) => candidate.available)
          ?.uuid || "";
    } catch {
      starTarget.value = null;
      starPreview.value = null;
      selectedStarSourceUuid.value = "";
    }
  } catch (error) {
    notify("error", getErrorMessage(error));
  } finally {
    busy.star = false;
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
  battleRoleLabel,
  bossLabel,
  cardTypeLabel,
  formatCosts,
  formatDate,
  formatFragmentSummary,
  formatPercent,
  formatRewards,
  itemTypeLabel,
  potentialLabel,
  potentialPercentLabel,
  poolTypeLabel,
  tradeRoleLabel,
  tradeStatusLabel,
  parseCardRarities,
  rarityClass,
  rarityOrder,
  requiredFragmentsForRarity,
  strongestRarityClass,
  synthesisCostLabel,
  sectionItems,
  sectionItemMap,
  primaryNavSectionKeys,
  primaryNavItems,
  accountMenuSectionKeys,
  accountMenuItems,
  leaderboardTabs,
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
  monthlyCardStatus,
  monthlyCardError,
  drawHistory,
  drawHistoryOpen,
  drawHistoryPage,
  userCards,
  playerProfile,
  profileCandidates,
  profilePickerOpen,
  profileSelectedUuids,
  profileCandidateRarity,
  profileCandidatePool,
  profileCandidatePage,
  profileCandidateTotal,
  profileCandidateTotalPages,
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
  guildAnnouncement,
  guildActionBusy,
  formation,
  formationCandidates,
  formationPickerOpen,
  formationEditingPosition,
  formationCandidateKeyword,
  formationCandidateRarity,
  formationCandidatePool,
  formationCandidateAvailableOnly,
  pveOverview,
  pveStagePage,
  pveStageTotalPages,
  pveStageTotal,
  pveRecords,
  pveRecordPage,
  pveRecordTotalPages,
  pveSweepResult,
  pveAutoBattleResult,
  pveBattleStageId,
  pveBattlePhase,
  pveBattleResult,
  pveBattleDraining,
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
  collectionFilter,
  bulkDecomposeRarities,
  bulkDecomposePreview,
  cardPage,
  tradePage,
  myTradePage,
  tradeRecordPage,
  tradeTab,
  tradeRarityFilter,
  tradePoolFilter,
  tradeCardNameFilter,
  tradeSort,
  tradeMinPrice,
  tradeMaxPrice,
  listingTarget,
  recycleTarget,
  upgradeTarget,
  upgradeCandidates,
  upgradePreview,
  starTarget,
  starTargetCandidates,
  starPreview,
  selectedStarSourceUuid,
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
  gameVipLabel,
  gameVipDisplayLabel,
  gameVipMuted,
  vipDailyRewardLabel,
  vipDailyCanClaim,
  vipDailyClaimed,
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
  starPowerGain,
  selectedStarSource,
  canConfirmStar,
  formationSlots,
  formationFilledCount,
  formationCurrentUuids,
  formationEditingSlot,
  filteredFormationCandidates,
  pveStages,
  pveFormation,
  pveRecentRecords,
  pveClearedCount,
  pveSweepableStages,
  pveSweepableCount,
  pveHasAutoBattleTarget,
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
  delay,
  handleOpenIdCallback,
  loginWithOpenId,
  applyManualToken,
  logout,
  loadPrivateData,
  loadStats,
  loadFishpiPoint,
  loadMonthlyCardStatus,
  purchaseMonthlyCard,
  claimVipDailyPack,
  loadDrawHistory,
  openDrawHistory,
  closeDrawHistory,
  changeDrawHistoryPage,
  ensureBagPoolFilter,
  loadUserCards,
  loadPlayerProfile,
  loadProfileCandidates,
  resetProfileCandidates,
  resetProfileCandidateFilters,
  changeProfileCandidatePage,
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
  saveGuildAnnouncement,
  sendGuildMessage,
  loadFormation,
  loadFormationCandidates,
  openFormationPicker,
  closeFormationPicker,
  candidateUuid,
  isFormationCandidateSelected,
  isFormationCandidateAvailable,
  resetFormationCandidateFilters,
  saveFormationSlot,
  loadPveStages,
  loadPveRecords,
  refreshPve,
  sweepPveStages,
  autoBattlePve,
  challengePveStage,
  changePveStagePage,
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
  goToTradePage,
  toggleBulkDecomposeRarity,
  loadBulkDecomposePreview,
  bulkDecomposeCards,
  openTradeListingModal,
  closeTradeListingModal,
  getRecyclePrice,
  openRecycleModal,
  closeRecycleModal,
  cardUpgradeUuid,
  cardStarUuid,
  formatStarLevel,
  upgradeCandidateStatus,
  isUpgradeCandidateDisabled,
  openUpgradeModal,
  selectUpgradeCandidate,
  closeUpgradeModal,
  upgradeCard,
  isStarTargetCandidateDisabled,
  starTargetCandidateStatus,
  starSourceStatus,
  openStarModal,
  selectStarTarget,
  selectStarSource,
  closeStarModal,
  starCard,
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
  pveBattlePlayerHpPercent,
  pveBattleEnemyHpPercent,
  pveBattlePlayerHpDraining,
  pveBattleEnemyHpDraining,
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

    <AppHeader
      :site-title="siteConfig.websiteTitle"
      :app-version="appVersion"
      :primary-nav-items="primaryNavItems"
      :account-menu-items="accountMenuItems"
      :active-section="activeSection"
      :theme-mode="themeMode"
      :refresh-busy="busy.public || busy.assets || busy.leaderboard"
      :auth-busy="busy.auth"
      :callback-busy="callbackBusy"
      :is-authed="isAuthed"
      :current-user="currentUser"
      :player-display-name="playerDisplayName"
      :player-initial="playerInitial"
      :player-status-label="playerStatusLabel"
      :trigger-point="stats?.point ?? 0"
      :account-point="stats?.point ?? currentUser?.point ?? 0"
      :fishpi-point-label="fishpiPointLabel"
      :fishpi-point-muted="Boolean(fishpiPointError && !fishpiPoint)"
      :game-vip-label="gameVipDisplayLabel"
      :game-vip-muted="gameVipMuted"
      :vip-daily-can-claim="vipDailyCanClaim"
      :vip-daily-claim-busy="busy.vipDaily"
      :user-menu-open="userMenuOpen"
      :user-menu-hover-paused="userMenuHoverPaused"
      :unread-message-count="unreadMessageCount"
      @toggle-theme="toggleThemeMode"
      @refresh="refreshAll"
      @toggle-user-menu="toggleUserMenu"
      @close-user-menu="closeUserMenu"
      @collapse-user-menu="userMenuOpen = false"
      @reset-user-menu-hover="resetUserMenuHover"
      @login="loginWithOpenId"
      @claim-vip-daily="claimVipDailyPack"
      @logout="logout"
    />

    <AnnouncementBar
      :announcements="activeAnnouncements"
      :visible-announcements="visibleAnnouncements"
      :unread-count="unreadAnnouncementCount"
      :summary="announcementSummary"
      :is-read="isAnnouncementRead"
      @open-list="openAnnouncementList"
      @open-detail="openAnnouncementDetail"
      @close="closeAnnouncement"
    />

    <PageHost :active-section="activeSection" />

    <MobileNav :items="primaryNavItems" :active-section="activeSection" />

    <FeedbackToast :feedback="feedback" />
    <AchievementToastStack
      :notices="achievementToasts"
      @dismiss="dismissAchievementToast"
    />

    <ConfirmDialog
      :target="confirmDialogTarget"
      @settle="settleConfirmDialog"
    />

    <AnnouncementModal
      :open="announcementModalOpen"
      :announcements="announcements"
      :selected="selectedAnnouncement"
      :summary="announcementSummary"
      :is-read="isAnnouncementRead"
      @close="closeAnnouncementModal"
      @select="openAnnouncementDetail"
      @back="selectedAnnouncement = null"
      @hide="closeAnnouncement"
    />

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

    <LaunchActivityModal
      :open="launchActivityModalOpen"
      :activity="launchActivityInfo"
      :loading="busy.launchActivity"
      @close="closeLaunchActivityModal"
      @claim="claimLaunchActivity"
    />

    <RechargeModal
      v-model:amount="rechargeAmount"
      :open="rechargeModalOpen"
      :loading="busy.recharge"
      :config="rechargeConfig"
      :range-label="rechargeRangeLabel"
      :ratio-label="rechargeRatioLabel"
      :local-amount="rechargeLocalAmount"
      @close="closeRechargeModal"
      @submit="submitRecharge"
    />

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
            <div class="profile-picker-filter">
              <select
                v-model="profileCandidateRarity"
                :disabled="busy.profileCandidates || busy.profileSaving"
                @change="resetProfileCandidates"
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
                v-model="profileCandidatePool"
                :disabled="busy.profileCandidates || busy.profileSaving"
                @change="resetProfileCandidates"
              >
                <option value="">全部卡池</option>
                <option v-for="pool in pools" :key="pool.id" :value="pool.id">
                  {{ pool.pool_name }}
                </option>
              </select>
              <button
                class="secondary-action compact"
                type="button"
                :disabled="busy.profileCandidates || busy.profileSaving"
                @click="resetProfileCandidateFilters"
              >
                重置
              </button>
              <span>{{ profileCandidateTotal }} 张</span>
            </div>
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
              <span>没有结果</span>
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
            <div
              v-if="profileCandidateTotalPages > 1"
              class="profile-picker-pager"
            >
              <button
                class="secondary-action compact"
                type="button"
                :disabled="
                  busy.profileCandidates ||
                  profileCandidatePage <= 1 ||
                  busy.profileSaving
                "
                @click="changeProfileCandidatePage(profileCandidatePage - 1)"
              >
                上一页
              </button>
              <span
                >{{ profileCandidatePage }}/{{
                  profileCandidateTotalPages
                }}</span
              >
              <button
                class="secondary-action compact"
                type="button"
                :disabled="
                  busy.profileCandidates ||
                  profileCandidatePage >= profileCandidateTotalPages ||
                  busy.profileSaving
                "
                @click="changeProfileCandidatePage(profileCandidatePage + 1)"
              >
                下一页
              </button>
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
            <div class="filter-row formation-filter-row">
              <input
                v-model="formationCandidateKeyword"
                type="search"
                placeholder="搜索卡名"
              />
              <select v-model="formationCandidateRarity">
                <option value="">稀有度</option>
                <option
                  v-for="rarity in rarityOrder"
                  :key="rarity"
                  :value="rarity"
                >
                  {{ rarity }}
                </option>
              </select>
              <select v-model="formationCandidatePool">
                <option value="">卡池</option>
                <option v-for="pool in pools" :key="pool.id" :value="pool.id">
                  {{ pool.pool_name }}
                </option>
              </select>
              <button
                class="secondary-action compact filter-toggle"
                :class="{ active: formationCandidateAvailableOnly }"
                type="button"
                :aria-pressed="formationCandidateAvailableOnly"
                @click="
                  formationCandidateAvailableOnly =
                    !formationCandidateAvailableOnly
                "
              >
                可上阵
              </button>
              <button
                class="secondary-action compact"
                type="button"
                @click="resetFormationCandidateFilters"
              >
                清空
              </button>
            </div>
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
            <div
              v-else-if="filteredFormationCandidates.length === 0"
              class="empty-state compact"
            >
              <Package :size="26" />
              <strong>暂无结果</strong>
              <span>调整筛选</span>
            </div>
            <div v-else class="formation-candidate-list">
              <article
                v-for="card in filteredFormationCandidates"
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
            <div
              v-else-if="upgradeCandidates.length"
              class="upgrade-candidate-list"
            >
              <article
                v-for="card in upgradeCandidates"
                :key="candidateUuid(card) || `${card.cardId}-${card.cardName}`"
                class="upgrade-candidate"
                :class="{ disabled: isUpgradeCandidateDisabled(card) }"
              >
                <div>
                  <strong>{{ card.cardName }}</strong>
                  <span>
                    Lv.{{ card.cultivationLevel || 1 }} · 战力
                    {{ card.power || 0 }}
                  </span>
                  <small>{{ formatCardDetailDate(card.obtainedAt) }}</small>
                </div>
                <span class="upgrade-candidate-status">
                  {{ upgradeCandidateStatus(card) }}
                </span>
                <button
                  class="primary-action compact"
                  type="button"
                  :disabled="busy.upgrade || isUpgradeCandidateDisabled(card)"
                  @click="selectUpgradeCandidate(card)"
                >
                  选择
                </button>
              </article>
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
        v-if="starTarget"
        class="result-modal-backdrop"
        role="presentation"
        @click.self="closeStarModal"
      >
        <section
          class="trade-listing-modal upgrade-modal star-modal"
          role="dialog"
          aria-modal="true"
          aria-label="卡片升星"
        >
          <header class="result-modal-head">
            <div>
              <p class="eyebrow">卡片升星</p>
              <h2>{{ starTarget.cardName }}</h2>
              <span>
                {{ starTarget.cardLevel }} ·
                {{
                  formatStarLevel(
                    starPreview?.current.starLevel ?? starTarget.starLevel,
                  )
                }}
              </span>
            </div>
            <button
              class="modal-close"
              type="button"
              :disabled="busy.star"
              @click="closeStarModal"
            >
              关闭
            </button>
          </header>
          <div class="trade-listing-body upgrade-modal-body">
            <div v-if="busy.star && !starPreview" class="empty-state compact">
              <LoaderCircle :size="26" class="spin" />
              <strong>读取升星</strong>
              <span>副卡状态加载中。</span>
            </div>
            <div
              v-else-if="starTargetCandidates.length"
              class="upgrade-candidate-list"
            >
              <article
                v-for="card in starTargetCandidates"
                :key="candidateUuid(card) || `${card.cardId}-${card.cardName}`"
                class="upgrade-candidate"
                :class="{ disabled: isStarTargetCandidateDisabled(card) }"
              >
                <div>
                  <strong>{{ card.cardName }}</strong>
                  <span>
                    {{ formatStarLevel(card.starLevel) }} · Lv.{{
                      card.cultivationLevel || 1
                    }}
                    · 战力 {{ card.power || 0 }}
                  </span>
                  <small>{{ formatCardDetailDate(card.obtainedAt) }}</small>
                </div>
                <span class="upgrade-candidate-status">
                  {{ starTargetCandidateStatus(card) }}
                </span>
                <button
                  class="primary-action compact"
                  type="button"
                  :disabled="busy.star || isStarTargetCandidateDisabled(card)"
                  @click="selectStarTarget(card)"
                >
                  选择
                </button>
              </article>
            </div>
            <template v-else-if="starPreview">
              <div class="upgrade-compare">
                <article>
                  <span>当前</span>
                  <strong>{{
                    formatStarLevel(starPreview.current.starLevel)
                  }}</strong>
                  <b>战力 {{ starPreview.current.power }}</b>
                </article>
                <ChevronRight :size="22" />
                <article :class="{ muted: !starPreview.next }">
                  <span>下一星</span>
                  <strong>
                    {{
                      formatStarLevel(
                        starPreview.next?.starLevel ||
                          starPreview.current.starLevel,
                      )
                    }}
                  </strong>
                  <b>
                    战力
                    {{ starPreview.next?.power || starPreview.current.power }}
                  </b>
                </article>
              </div>
              <dl>
                <div>
                  <dt>星级上限</dt>
                  <dd>{{ starPreview.current.starMaxLevel }}星</dd>
                </div>
                <div>
                  <dt>本次提升</dt>
                  <dd>战力 +{{ starPowerGain }}</dd>
                </div>
                <div>
                  <dt>消耗卡片</dt>
                  <dd>{{ selectedStarSource?.cardName || "未选择" }}</dd>
                </div>
                <div>
                  <dt>可用副卡</dt>
                  <dd>
                    {{
                      starPreview.candidates.filter((item) => item.available)
                        .length
                    }}
                  </dd>
                </div>
              </dl>
              <div class="upgrade-candidate-list">
                <article
                  v-for="candidate in starPreview.candidates"
                  :key="candidate.uuid"
                  class="upgrade-candidate"
                  :class="{
                    disabled: !candidate.available,
                    selected: candidate.uuid === selectedStarSourceUuid,
                  }"
                >
                  <div>
                    <strong>{{ candidate.cardName }}</strong>
                    <span>
                      {{ formatStarLevel(candidate.starLevel) }} · Lv.{{
                        candidate.cultivationLevel || 1
                      }}
                      · 战力 {{ candidate.power || 0 }}
                    </span>
                    <small>
                      {{ formatCardDetailDate(candidate.obtainedAt) }}
                    </small>
                  </div>
                  <span class="upgrade-candidate-status">
                    {{ starSourceStatus(candidate) }}
                  </span>
                  <button
                    class="primary-action compact"
                    type="button"
                    :disabled="busy.star || !candidate.available"
                    @click="selectStarSource(candidate)"
                  >
                    选择
                  </button>
                </article>
              </div>
              <p v-if="starPreview.unavailableReason" class="upgrade-warning">
                {{ starPreview.unavailableReason }}
              </p>
            </template>
          </div>
          <footer class="result-modal-actions">
            <button
              class="secondary-action"
              type="button"
              :disabled="busy.star"
              @click="closeStarModal"
            >
              取消
            </button>
            <button
              class="primary-action"
              type="button"
              :disabled="busy.star || !canConfirmStar"
              @click="starCard"
            >
              <LoaderCircle v-if="busy.star" :size="18" class="spin" />
              <Sparkles v-else :size="18" />
              升星
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

    <CardDetailModal
      :target="cardIntroTarget"
      @close="closeCardIntro"
      @action="handleCardDetailAction"
    />

    <ShareTextModal
      :text="shareTextTarget"
      @close="closeShareText"
      @copy="copyShareText"
    />

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
