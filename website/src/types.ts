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

export type CardRarity = "N" | "R" | "SR" | "SSR" | "UR";

export interface PoolInfo {
  id: number;
  pool_name: string;
  card_desc: string;
  card_type: number;
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
  id: number;
  uuid: string;
  cardName: string;
  cardDesc: string;
  cardLevel: CardRarity | string;
  cardType: number;
  poolId: number;
  canSell: boolean;
  canLottery: boolean;
  obtainedAt: string;
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

export interface RedeemRewards {
  points: number;
  items: RedeemRewardItem[];
}

export interface RedeemClaimResponse {
  code: string;
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
