export interface ApiResponse<T> {
  code: number;
  msg: string;
  data: T;
}

export interface UserProfile {
  uid?: string;
  publicId?: string;
  public_id?: string | null;
  name?: string;
  nickname?: string;
  avatar?: string;
  point?: number;
  is_admin?: boolean;
  [key: string]: unknown;
}

export interface LoginResponse {
  user: UserProfile;
  token: string;
}

export interface LoginUrlResponse {
  url: string;
}

export interface SiteConfig {
  websiteTitle: string;
  adminTitle: string;
}

export interface Announcement {
  id: number;
  title: string;
  content: string;
  active?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  createdAt?: string | null;
}

export interface AnnouncementListResponse {
  list: Announcement[];
}

export interface PlayerMessage {
  id: number;
  title: string;
  content: string;
  read: boolean;
  claimed: boolean;
  hasReward: boolean;
  rewards?: RedeemRewards | null;
  startsAt?: string | null;
  endsAt?: string | null;
  createdAt?: string | null;
}

export interface PlayerMessagesResponse {
  list: PlayerMessage[];
  unread: number;
}

export interface ClaimMessageRewardResponse {
  claimed: boolean;
  rewards: RedeemRewards;
}

export type CardRarity = "N" | "R" | "SR" | "SSR" | "UR";

export interface PoolInfo {
  id: number;
  pool_name: string;
  card_desc: string;
  card_type: number;
  sort_order?: number;
  sortOrder?: number;
  rarityProbabilities?: Partial<Record<CardRarity | string, number>>;
  drawCosts?: {
    once: number;
    ten: number;
  };
  createdAt?: string;
}

export interface CardItem {
  id: number;
  card_name: string;
  card_level: string;
  drop_item?: string;
  card_desc: string;
  card_image?: string;
  card_type: number;
  pool: number;
  enabled?: boolean;
  createdAt?: string;
}

export interface GachaResult {
  cardId: number;
  cardName: string;
  cardDesc: string;
  cardImage?: string;
  rarity: CardRarity | string;
  cardType: number;
  poolId: number;
  isUp: boolean;
  isPity: boolean;
  userCardUuid: string;
}

export interface UserGachaStats {
  uid: string;
  point: number;
  totalDraws: number;
  cardCounts: Record<CardRarity, number>;
  pity?: Array<{
    poolId: number;
    poolName?: string;
    enabled?: boolean;
    drawsSinceSR: number;
    drawsSinceSSR: number;
    drawsSinceUR: number;
    soft?: PityProgress | null;
    hard?: PityProgress | null;
    next?: {
      label: string;
      guaranteedRarity: CardRarity | string;
      remaining: number;
    } | null;
  }>;
  recentDraws?: Array<{
    count: number;
    cardIds: string[];
    cardLevels: string[];
    cardUuids: string[];
    details?: unknown[];
    createdAt: string;
  }>;
}

export interface PityProgress {
  count: number;
  guaranteedRarity: CardRarity | string;
  current: number;
  remaining: number;
}

export interface UserCardRecord {
  id?: number;
  uuid?: string;
  cardId?: number;
  cardName: string;
  cardDesc: string;
  cardImage?: string;
  cardLevel: CardRarity | string;
  cardType: number;
  poolId: number;
  count?: number;
  listedCount?: number;
  locked?: boolean;
  lockedCount?: number;
  sellableCount?: number;
  lockableUuid?: string | null;
  unlockableUuid?: string | null;
  upgradeableUuid?: string | null;
  canSell: boolean;
  canLottery: boolean;
  canUpgrade?: boolean;
  isListed?: boolean;
  tradeListingId?: number | null;
  tradePrice?: number | null;
  cultivationLevel?: number;
  cultivationExp?: number;
  cultivationMaxLevel?: number;
  power?: number;
  obtainedAt?: string;
  latestObtainedAt?: string;
}

export interface InventoryItem {
  id: number;
  name: string;
  desc: string;
  type: number;
  itemType: number;
  itemValue: number;
  num: number;
}

export interface UserCardsResponse {
  list: UserCardRecord[];
  dropItems: InventoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ShowcaseCard {
  position: number;
  uuid: string;
  cardId: number;
  cardName: string;
  cardDesc?: string;
  cardImage?: string;
  cardLevel: CardRarity | string;
  cardType: number;
  poolId?: number;
  cultivationLevel: number;
  power: number;
  locked: boolean;
  obtainedAt?: string;
}

export interface PlayerProfileResponse {
  user: {
    uid?: string;
    publicId: string;
    nickname: string;
    avatar: string;
    cardCounts: Record<CardRarity, number>;
    totalCards: number;
    createdAt?: string | null;
  };
  formation: {
    slotCount: number;
    filledCount: number;
    totalPower: number;
  };
  showcase: ShowcaseCard[];
}

export interface SaveShowcaseRequest {
  cardUuids: string[];
}

export type FriendRequestStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "cancelled";

export interface FriendUser {
  uid: string;
  publicId?: string;
  nickname: string;
  avatar: string;
  createdAt?: string | null;
}

export interface FriendRelationRecord {
  id: number;
  status: FriendRequestStatus;
  user: FriendUser;
  createdAt?: string;
  updatedAt?: string;
  respondedAt?: string | null;
}

export interface FriendsOverviewResponse {
  friends: FriendRelationRecord[];
  incoming: FriendRelationRecord[];
  outgoing: FriendRelationRecord[];
  counts: {
    friends: number;
    incoming: number;
    outgoing: number;
  };
}

export type SocialActivityType =
  | "friend_added"
  | "showcase_updated"
  | "card_upgraded"
  | "pve_cleared";

export interface SocialActivityRecord {
  id: number;
  type: SocialActivityType;
  title: string;
  summary?: string;
  createdAt: string;
  user: FriendUser;
}

export interface SocialActivityFeedResponse {
  list: SocialActivityRecord[];
}

export interface SendFriendRequestRequest {
  uid: string;
}

export type GuildMemberRole = "leader" | "member";

export interface GuildSummary {
  id: number;
  name: string;
  description?: string;
  announcement?: string;
  memberCount: number;
  role?: GuildMemberRole | null;
  joined?: boolean;
  createdAt?: string | null;
}

export interface GuildMember {
  uid: string;
  publicId?: string;
  nickname: string;
  avatar: string;
  role: GuildMemberRole;
  joinedAt?: string;
}

export interface GuildCurrent {
  guild: GuildSummary;
  members: GuildMember[];
}

export interface GuildMessage {
  id: number;
  content: string;
  createdAt: string;
  sender: FriendUser;
}

export interface GuildOverviewResponse {
  current: GuildCurrent | null;
  guilds: GuildSummary[];
}

export interface GuildMessagesResponse {
  list: GuildMessage[];
}

export interface GuildListResponse {
  list: GuildSummary[];
}

export interface CreateGuildRequest {
  name: string;
  description?: string;
}

export interface SendGuildMessageRequest {
  content: string;
}

export interface SaveGuildAnnouncementRequest {
  announcement: string;
}

export interface UserCatalogItem {
  key: string;
  card: CardItem;
  rarity: CardRarity;
  collected: boolean;
  ownedCount: number;
  requiredFragments: number;
  fragmentCount: number;
  canSynthesize: boolean;
}

export interface UserCatalogResponse {
  poolId: number;
  list: UserCatalogItem[];
  total: number;
}

export interface RedeemRewardItem {
  itemId: number;
  num: number;
  itemName?: string;
}

export interface RedeemRewardCard {
  cardId: number;
  rarity: string;
  num: number;
  cardName?: string;
}

export interface RedeemRewards {
  points: number;
  items: RedeemRewardItem[];
  cards?: RedeemRewardCard[];
}

export interface RedeemClaimResponse {
  code: string;
  rewards: RedeemRewards;
}

export interface LaunchActivityInfo {
  activityKey: string;
  name: string;
  description?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  rewards: RedeemRewards;
}

export interface LaunchActivityCurrentResponse {
  activity: LaunchActivityInfo | null;
  available: boolean;
  claimed: boolean;
  reason?: string;
}

export interface LaunchActivityClaimResponse {
  activityKey: string;
  name: string;
  rewards: RedeemRewards;
}

export interface DailySignInDay {
  day: number;
  rewardPoints: number;
  signed: boolean;
  current: boolean;
}

export interface DailySignInStatus {
  signedToday: boolean;
  signDate: string;
  currentStreak: number;
  cycleDay: number;
  rewardPoints: number;
  nextRewardPoints: number;
  week: DailySignInDay[];
}

export interface DailySignInClaimResponse extends DailySignInStatus {
  pointBefore: number;
  pointAfter: number;
}

export type TaskScope = "daily" | "weekly";

export interface TaskItem {
  id: string;
  name: string;
  description: string;
  targetValue: number;
  progress: number;
  rawProgress?: number;
  completed: boolean;
  claimed: boolean;
  activityPoints: number;
  rewards: RedeemRewards;
}

export interface TaskActivityMilestone {
  threshold: number;
  rewards: RedeemRewards;
  claimed: boolean;
  available: boolean;
}

export interface TaskScopeOverview {
  scope: TaskScope;
  label: string;
  periodKey: string;
  startsAt: string;
  endsAt: string;
  activity: number;
  maxActivity: number;
  tasks: TaskItem[];
  milestones: TaskActivityMilestone[];
}

export interface TaskOverview {
  generatedAt: string;
  daily: TaskScopeOverview;
  weekly: TaskScopeOverview;
}

export interface TaskClaimResponse {
  scope: TaskScope;
  periodKey: string;
  task?: TaskItem;
  milestone?: TaskActivityMilestone;
  activity?: number;
  rewards: RedeemRewards;
  seasonPoints?: {
    gained: number;
    title: string;
  } | null;
}

export interface SeasonInfo {
  id: number;
  seasonKey: string;
  name: string;
  description?: string;
  shopEnabled: boolean;
  leaderboardEnabled: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
}

export interface SeasonPoints {
  earned: number;
  balance: number;
}

export interface SeasonShopItem {
  id: number;
  seasonKey: string;
  name: string;
  description?: string;
  costPoints: number;
  rewards: RedeemRewards;
  remaining?: number | null;
  usedByUser?: number;
  userLimit?: number | null;
  canBuy: boolean;
  unavailableReason?: string;
  startsAt?: string | null;
  endsAt?: string | null;
}

export interface SeasonPointRecord {
  id: number;
  seasonKey: string;
  changeAmount: number;
  pointBefore: number;
  pointAfter: number;
  sourceType: string;
  title: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface SeasonOverview {
  season: SeasonInfo | null;
  points: SeasonPoints;
  leaderboard: LeaderboardBoard;
  shopItems: SeasonShopItem[];
  records: SeasonPointRecord[];
}

export interface SeasonShopBuyResponse {
  season: SeasonInfo;
  itemId: number;
  count: number;
  costPoints: number;
  rewards: RedeemRewards;
  points: SeasonPoints;
}

export interface ExchangeCostItem {
  itemId: number;
  num: number;
  itemName?: string;
}

export interface ExchangeShopItem {
  id: number;
  name: string;
  description?: string;
  enabled: boolean;
  costs: ExchangeCostItem[];
  rewards: RedeemRewards;
  total_limit?: number | null;
  used_count: number;
  user_limit?: number | null;
  starts_at?: string | null;
  ends_at?: string | null;
  sort_order?: number;
  remaining?: number | null;
  usedByUser?: number;
  canExchange?: boolean;
  unavailableReason?: string;
}

export interface ExchangeClaimResponse {
  exchangeItemId: number;
  count: number;
  costs: ExchangeCostItem[];
  rewards: RedeemRewards;
}

export interface RechargeConfig {
  enabled: boolean;
  minAmount: number;
  maxAmount: number;
  ratio: number;
  hasGoldFingerKey: boolean;
  hasFishpiApiKey: boolean;
}

export interface RechargePointsResponse {
  requestId: string;
  amount: number;
  fishpiCost: number;
  pointBefore: number;
  pointAfter: number;
}

export interface FishpiPointResponse {
  userName: string;
  point: number;
  vip: FishpiVipStatus;
}

export interface FishpiVipStatus {
  checked: boolean;
  active: boolean;
  levelCode: string;
  expiresAt: string | null;
}

export interface BulkDecomposeFragment {
  itemId: number;
  itemName: string;
  count: number;
}

export interface BulkDecomposeResponse {
  selectedRarities: Array<CardRarity | string>;
  total: number;
  countsByRarity: Partial<Record<CardRarity | string, number>>;
  skippedListed: number;
  skippedLocked?: number;
  reservedCount?: number;
  decomposed?: number;
  fragments?: BulkDecomposeFragment[];
}

export interface CardCultivationSnapshot {
  level: number;
  exp: number;
  maxLevel: number;
  power: number;
  cardName: string;
  rarity: CardRarity | string;
}

export interface CardUpgradePreview {
  uuid: string;
  cardId: number;
  cardName: string;
  rarity: CardRarity | string;
  current: CardCultivationSnapshot;
  next: CardCultivationSnapshot | null;
  cost: {
    itemId: number;
    itemName: string;
    num: number;
    owned: number;
  };
  canUpgrade: boolean;
  unavailableReason?: string;
}

export interface CardUpgradeResponse {
  uuid: string;
  cardId: number;
  cardName: string;
  rarity: CardRarity | string;
  before: CardCultivationSnapshot;
  after: CardCultivationSnapshot;
  cost: {
    itemId: number;
    itemName: string;
    num: number;
    remaining: number;
  };
}

export interface FormationCard {
  uuid: string;
  cardId: number;
  cardName: string;
  cardDesc?: string;
  cardImage?: string;
  cardLevel: CardRarity | string;
  cardType: number;
  poolId?: number;
  cultivationLevel: number;
  power: number;
  locked: boolean;
  obtainedAt?: string;
}

export interface FormationSlot {
  position: number;
  card: FormationCard | null;
}

export interface FormationOverview {
  slotCount: number;
  totalPower: number;
  slots: FormationSlot[];
}

export interface DrawHistoryDetail {
  cardId: number;
  cardName: string;
  cardDesc?: string;
  cardImage?: string;
  cardType?: number;
  poolId?: number | null;
  rarity: CardRarity | string;
  cardUuid: string;
  isUp: boolean;
  isPity: boolean;
}

export interface DrawHistoryRecord {
  id: number;
  count: number;
  createdAt: string;
  cardIds: string[];
  cardLevels: string[];
  cardUuids: string[];
  details: DrawHistoryDetail[];
}

export interface DrawHistoryResponse {
  list: DrawHistoryRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ShopRecycleConfig {
  enabled: boolean;
  priceN: number;
  priceR: number;
  priceSR: number;
  priceSSR: number;
  priceUR: number;
}

export interface ShopRecycleCardsResponse {
  cardId: number;
  cardName: string;
  rarity: CardRarity | string;
  poolId: number;
  count: number;
  unitPrice: number;
  rewardPoints: number;
  pointBefore: number;
  pointAfter: number;
}

export type AchievementTargetType =
  | "total_draws"
  | "rarity_draws"
  | "owned_cards"
  | "rarity_owned_cards"
  | "completed_pools"
  | "recharge_points"
  | "redeem_count"
  | "exchange_count"
  | "trade_buy_count"
  | "trade_sell_count"
  | "synthesize_count"
  | "decompose_count";

export interface AchievementRecord {
  id: number;
  code: string;
  name: string;
  description?: string;
  category: string;
  targetType: AchievementTargetType | string;
  targetLabel: string;
  targetValue: number;
  targetScope?: {
    rarity?: string;
    poolId?: number;
  } | null;
  progress: number;
  achieved: boolean;
  achievedAt?: string | null;
  rewards: RedeemRewards;
  sortOrder?: number;
}

export interface AchievementListResponse {
  list: AchievementRecord[];
  total: number;
}

export interface AchievementNotification {
  achievementId: number;
  code: string;
  name: string;
  description?: string;
  category: string;
  achievedAt: string;
  rewards: RedeemRewards;
}

export interface PveStage {
  id: number;
  name: string;
  description?: string;
  enemyPower: number;
  recommendedPower: number;
  dailyLimit: number;
  todayCount: number;
  remainingAttempts: number;
  canChallenge: boolean;
  unavailableReason?: string;
  cleared: boolean;
  rewards: RedeemRewards;
  firstClearRewards: RedeemRewards;
  repeatRewards: RedeemRewards;
  enabled: boolean;
  sortOrder?: number;
  startsAt?: string | null;
  endsAt?: string | null;
}

export interface PveOverview {
  formation: {
    slotCount: number;
    filledCount: number;
    totalPower: number;
  };
  list: PveStage[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  nextUnclearedStageId?: number | null;
  nextUnclearedPage?: number | null;
}

export interface PveChallengeRecord {
  id: number;
  uid: string;
  stageId: number;
  stageName: string;
  formationPower: number;
  enemyPower: number;
  success: boolean;
  mode?: "challenge" | "sweep";
  rewards?: RedeemRewards | null;
  createdAt: string;
}

export interface PveChallengeResult {
  record: PveChallengeRecord;
  stage: PveStage;
  success: boolean;
  rewards?: RedeemRewards | null;
  formationPower: number;
  enemyPower: number;
  pointAfter?: number;
}

export interface PveRecordsResponse {
  list: PveChallengeRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PveSweepResult {
  vipLevel: number;
  vipLabel: string;
  dailyLimit: number;
  usedToday: number;
  remaining: number;
  swept: number;
  skipped: Array<{
    stageId: number;
    stageName: string;
    reason: string;
  }>;
  list: Array<{
    stageId: number;
    stageName: string;
    success: boolean;
    rewards: RedeemRewards | null;
  }>;
  pointAfter: number;
}

export type PointLedgerSourceType =
  | "draw_once"
  | "draw_ten"
  | "recharge"
  | "redeem_code"
  | "launch_activity"
  | "daily_sign_in"
  | "exchange_shop"
  | "achievement"
  | "task"
  | "pve"
  | "trade_buy"
  | "trade_sell"
  | "shop_recycle"
  | "season_shop"
  | "player_message";

export interface PointLedgerRecord {
  id: number;
  changeAmount: number;
  pointBefore: number;
  pointAfter: number;
  sourceType: PointLedgerSourceType | string;
  sourceId?: string | null;
  sourceLabel: string;
  title: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface PointLedgerRecordsResponse {
  list: PointLedgerRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  currentPoint: number;
}

export type LeaderboardMetric =
  | "totalCards"
  | "ssrCards"
  | "urCards"
  | "completedPools"
  | "rechargeAmount"
  | "pveCleared";

export interface LeaderboardEntry {
  rank: number;
  uid: string;
  publicId?: string;
  nickname: string;
  avatar: string;
  value: number;
}

export interface LeaderboardBoard {
  list: LeaderboardEntry[];
  me: LeaderboardEntry | null;
}

export interface LeaderboardResponse {
  generatedAt: string;
  rankings: Record<LeaderboardMetric, LeaderboardBoard>;
}

export interface TradeConfig {
  enabled: boolean;
  feeRate: number;
  minPrice: number;
  maxPrice: number;
}

export interface TradeListing {
  id: number;
  cardId: number;
  cardName: string;
  cardDesc?: string;
  cardImage?: string;
  cardType: number;
  cardLevel: CardRarity | string;
  poolId?: number;
  poolName?: string;
  price: number;
  feeRate: number;
  feeAmount: number;
  sellerIncome: number;
  status: "active" | "sold" | "cancelled";
  isMine?: boolean;
  cardUuid?: string;
  createdAt?: string;
  soldAt?: string | null;
  cancelledAt?: string | null;
}

export interface TradeRecord {
  id: number;
  listingId: number;
  role: "seller" | "buyer";
  cardUuid: string;
  cardId: number;
  cardName: string;
  cardImage?: string;
  cardLevel: CardRarity | string;
  poolId?: number;
  poolName?: string;
  price: number;
  feeRate: number;
  feeAmount: number;
  sellerIncome: number;
  createdAt?: string;
}

export interface TradePageResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  config?: TradeConfig;
}
