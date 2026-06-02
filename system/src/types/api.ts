export interface LoginData {
  userName: string;
  userNickname: string;
  userAvatarURL: string;
}

export type CardRarity = "N" | "R" | "SR" | "SSR" | "UR";

export interface PityRule {
  count: number;
  guaranteedRarity: CardRarity;
}

export interface PitySystemConfig {
  enabled: boolean;
  softPity?: PityRule;
  hardPity?: PityRule;
}

export interface DrawCosts {
  once: number;
  ten: number;
}

// 抽卡配置接口
export interface GachaConfig {
  // 卡池ID (如果指定，则从该卡池抽取)
  poolId?: number;

  // 数据库配置是否启用，未提供时视为启用默认配置
  enabled?: boolean;

  // 稀有度概率配置 (总和应为1)
  rarityProbabilities?: {
    [rarity: string]: number; // 如 { 'N': 0.5025, 'R': 0.3025, 'SR': 0.15, 'SSR': 0.045, 'UR': 0 }
  };

  // UP卡配置 (指定UP的卡片ID和UP倍率)
  upCards?: {
    enabled: boolean;
    cardIds: number[]; // UP卡片ID列表
    upRate: number; // UP倍率 (0-1之间，表示抽到该稀有度时获得UP卡的概率)
  };

  // 保底配置，只允许服务端生成
  pitySystem?: PitySystemConfig;

  // 抽卡星穹币消耗，只允许服务端配置
  drawCosts?: DrawCosts;

  // 后台展示用元信息
  source?: "database" | "env";
  updatedAt?: Date | null;
}

// 抽卡结果
export interface GachaResult {
  cardId: number;
  cardName: string;
  cardDesc: string;
  cardImage?: string;
  rarity: string;
  cardType: number; // 卡片类型
  poolId: number; // 所属卡池
  isUp: boolean; // 是否UP卡
  isPity: boolean; // 是否触发保底
  userCardUuid: string; // 用户卡片唯一ID
}

// 用户抽卡统计
export interface UserGachaStats {
  uid: string;
  point: number; // 当前星穹币余额
  totalDraws: number; // 总抽数
  cardCounts: {
    N: number;
    R: number;
    SR: number;
    SSR: number;
    UR: number;
  };
  pity?: Array<{
    poolId: number;
    poolName: string;
    enabled: boolean;
    drawsSinceSR: number;
    drawsSinceSSR: number;
    drawsSinceUR: number;
    soft?: PityProgressView | null;
    hard?: PityProgressView | null;
    next?: {
      label: string;
      guaranteedRarity: CardRarity;
      remaining: number;
    } | null;
  }>;
}

export interface PityProgressView {
  count: number;
  guaranteedRarity: CardRarity;
  current: number;
  remaining: number;
}

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
  rankings: {
    totalCards: LeaderboardBoard;
    ssrCards: LeaderboardBoard;
    urCards: LeaderboardBoard;
    completedPools: LeaderboardBoard;
    rechargeAmount: LeaderboardBoard;
  };
}
