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
  recentHistories: Record<string, unknown>[];
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
  updatedAt?: string | null;
  [key: string]: unknown;
}

export interface GachaConfigData {
  pools?: Record<string, GachaPoolConfig>;
  defaults?: Record<string, GachaPoolConfig>;
  poolNames?: Record<string, string>;
  adminUids?: string[];
  [key: string]: unknown;
}

export interface FieldConfig {
  key: string;
  label: string;
  type?: "text" | "number" | "boolean" | "textarea" | "select" | "multiSelect";
  options?: SelectOption[];
  helper?: string;
  fullWidth?: boolean;
  placeholder?: string;
  readonly?: boolean;
}

export interface RedeemRewards {
  points: number;
  items: Array<{ itemId: number; num: number; itemName?: string }>;
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
