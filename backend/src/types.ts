export interface ApiResponse<T> {
  code: number;
  msg: string;
  data: T;
}

export interface PageResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminUser {
  uid: string;
  is_admin: boolean;
  [key: string]: unknown;
}

export interface LoginResponse {
  user: AdminUser;
  token: string;
}

export interface AdminMeResponse {
  user: AdminUser | null;
  isAdmin: boolean;
}

export interface DashboardData {
  counters: {
    userCount: number;
    cardCount: number;
    poolCount: number;
    dropItemCount: number;
    totalDraws: number;
  };
  rarityTotals: Record<string, number>;
  recentHistories: Array<{
    uid?: string;
    userName?: string;
    count?: number;
    card_levels?: string;
    createdAt?: string;
    [key: string]: unknown;
  }>;
}

export interface SelectOption {
  label: string;
  value: string | number | boolean;
  disabled?: boolean;
}

export interface AdminOptions {
  pools: Array<SelectOption & { type?: number }>;
  cards: Array<SelectOption & { rarity?: string; pool?: number }>;
  dropItems: Array<
    SelectOption & {
      type?: number;
      typeLabel?: string;
      usageLabel?: string;
      disabled?: boolean;
      defaultFragment?: boolean;
    }
  >;
  defaultFragmentItem?: SelectOption | null;
  seasons?: Array<SelectOption & { enabled?: boolean }>;
}

export interface GachaPoolConfig {
  poolId?: number;
  enabled?: boolean;
  rarityProbabilities?: Record<string, number>;
  drawCosts?: {
    once?: number;
    ten?: number;
  };
  upCards?: {
    enabled?: boolean;
    cardIds?: number[];
    upRate?: number;
  };
  pitySystem?: {
    enabled?: boolean;
    softPity?: {
      count?: number;
      guaranteedRarity?: string;
    };
    hardPity?: {
      count?: number;
      guaranteedRarity?: string;
    };
  };
  source?: "database" | "env";
  scope?: "pool" | "global" | "fallback";
  updatedAt?: string | null;
  [key: string]: unknown;
}

export interface PoolGachaConfigDetail {
  effective: GachaPoolConfig;
  individualConfig?: GachaPoolConfig | null;
  defaultConfig: GachaPoolConfig;
  fallbackConfig: GachaPoolConfig;
  hasIndividualConfig?: boolean;
}

export interface GachaConfigData {
  defaultConfig?: GachaPoolConfig;
  fallbackConfig?: GachaPoolConfig;
  pools?: Record<string, GachaPoolConfig>;
  defaults?: Record<string, GachaPoolConfig>;
  poolNames?: Record<string, string>;
  adminUids?: string[];
  [key: string]: unknown;
}

export interface SiteConfig {
  websiteTitle: string;
  adminTitle: string;
}

export interface FieldConfig {
  key: string;
  label: string;
  type?:
    | "text"
    | "number"
    | "boolean"
    | "textarea"
    | "select"
    | "multiSelect"
    | "datetime"
    | "json"
    | "imageUpload"
    | "rewards"
    | "costs"
    | "decomposeConfig";
  options?: SelectOption[];
  helper?: string;
  uploadEndpoint?: string;
  fullWidth?: boolean;
  minWidth?: number | string;
  placeholder?: string;
  readonly?: boolean;
  tableHidden?: boolean;
  formHidden?: boolean;
  detailHidden?: boolean;
  defaultValue?: unknown;
  allowCardRewards?: boolean;
  identity?: {
    uidKey: string;
    nameKey?: string;
    fallback?: string;
  };
}

export interface RedeemRewards {
  points: number;
  items: Array<{ itemId: number; num: number; itemName?: string }>;
  cards?: Array<{
    cardId: number;
    rarity: string;
    num: number;
    cardName?: string;
  }>;
}

export interface ExchangeCostItem {
  itemId: number;
  num: number;
  itemName?: string;
}

export interface RedeemCodeRecord {
  id: number;
  code: string;
  name: string;
  description?: string;
  enabled: boolean;
  total_limit?: number | null;
  used_count: number;
  starts_at?: string | null;
  ends_at?: string | null;
  rewards: RedeemRewards;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface ExchangeShopItemRecord {
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
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface TradeConfigRecord {
  id?: number;
  enabled: boolean;
  fee_rate: number;
  min_price: number;
  max_price: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface RechargeConfigRecord {
  id?: number;
  enabled: boolean;
  min_amount: number;
  max_amount: number;
  recharge_ratio: number;
  memo_template: string;
  hasGoldFingerKey?: boolean;
  maskedGoldFingerKey?: string;
  gold_finger_key?: string;
  hasFishpiApiKey?: boolean;
  maskedFishpiApiKey?: string;
  fishpi_api_key?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RechargeRecord {
  id: number;
  uid: string;
  fishpi_user_name: string;
  request_id: string;
  amount: number;
  fishpi_cost: number;
  point_before: number;
  point_after: number;
  status: string;
  statusLabel?: string;
  thirdPartyMsg?: string;
  failure_reason?: string | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
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

export interface AchievementTargetScope {
  rarity?: string;
  poolId?: number;
}

export interface AchievementConfigRecord {
  id: number;
  code: string;
  name: string;
  description?: string;
  category: string;
  target_type: AchievementTargetType;
  targetTypeLabel?: string;
  target_value: number;
  target_scope?: AchievementTargetScope | null;
  rewards: RedeemRewards;
  sort_order: number;
  enabled: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface UserAchievementRecord {
  id: number;
  uid: string;
  achievementId: number;
  achievementCode: string;
  achievementName: string;
  category?: string;
  progress: number;
  targetValue: number;
  achieved: boolean;
  achievedAt?: string | null;
  notificationAckAt?: string | null;
  rewards?: RedeemRewards | null;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface LaunchActivityConfigRecord {
  id?: number;
  enabled: boolean;
  activity_key: string;
  name: string;
  description?: string;
  starts_at?: string | null;
  ends_at?: string | null;
  rewards: RedeemRewards;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface LaunchActivityClaimRecord {
  id: number;
  activity_key: string;
  activity_name: string;
  uid: string;
  reward_snapshot: RedeemRewards;
  createdAt?: string;
  [key: string]: unknown;
}
