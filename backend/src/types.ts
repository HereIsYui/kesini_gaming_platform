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
}

export interface AdminOptions {
  pools: Array<SelectOption & { type?: number }>;
  cards: Array<SelectOption & { rarity?: string; pool?: number }>;
  dropItems: Array<SelectOption & { type?: number }>;
}

export interface GachaPoolConfig {
  poolId?: number;
  rarityProbabilities?: Record<string, number>;
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
  [key: string]: unknown;
}

export interface GachaConfigData {
  pools?: Record<string, GachaPoolConfig>;
  adminUids?: string[];
  [key: string]: unknown;
}

export interface FieldConfig {
  key: string;
  label: string;
  type?: "text" | "number" | "boolean" | "textarea" | "select";
  options?: SelectOption[];
  helper?: string;
  fullWidth?: boolean;
  placeholder?: string;
  readonly?: boolean;
}
