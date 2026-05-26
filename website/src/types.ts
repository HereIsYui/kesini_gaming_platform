export interface ApiResponse<T> {
  code: number;
  msg: string;
  data: T;
}

export interface UserProfile {
  uid?: string;
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

export type CardRarity = "N" | "R" | "SR" | "SSR" | "UR";

export interface PoolInfo {
  id: number;
  pool_name: string;
  card_desc: string;
  card_type: number;
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
  card_type: number;
  pool: number;
  createdAt?: string;
}

export interface GachaResult {
  cardId: number;
  cardName: string;
  cardDesc: string;
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
    drawsSinceSR: number;
    drawsSinceSSR: number;
    drawsSinceUR: number;
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

export interface UserCardRecord {
  id?: number;
  uuid?: string;
  cardId?: number;
  cardName: string;
  cardDesc: string;
  cardLevel: CardRarity | string;
  cardType: number;
  poolId: number;
  count?: number;
  listedCount?: number;
  sellableCount?: number;
  canSell: boolean;
  canLottery: boolean;
  isListed?: boolean;
  tradeListingId?: number | null;
  tradePrice?: number | null;
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
  reservedCount?: number;
  decomposed?: number;
  fragments?: BulkDecomposeFragment[];
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

export type PointLedgerSourceType =
  | "draw_once"
  | "draw_ten"
  | "recharge"
  | "redeem_code"
  | "launch_activity"
  | "exchange_shop"
  | "achievement"
  | "trade_buy"
  | "trade_sell";

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
  | "completedPools";

export interface LeaderboardEntry {
  rank: number;
  uid: string;
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
