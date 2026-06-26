export const GUILD_CONFIG_KEY = "guild_config";

export interface GuildConfig {
  enabled: boolean;
  maxLevel: number;
  baseMemberLimit: number;
  memberLimitPerLevel: number;
  checkInReward: { points: number };
  donateOptions: number[];
  dailyDonateLimit: number;
  bossAttempts: number;
  bossHpBase: number;
  bossHpPerLevel: number;
  activeChestThresholds: number[];
}

export const DEFAULT_GUILD_CONFIG: GuildConfig = {
  enabled: true,
  maxLevel: 10,
  baseMemberLimit: 20,
  memberLimitPerLevel: 2,
  checkInReward: { points: 10 },
  donateOptions: [100, 500, 1000],
  dailyDonateLimit: 3,
  bossAttempts: 3,
  bossHpBase: 50000,
  bossHpPerLevel: 20000,
  activeChestThresholds: [100, 300, 600],
};

function positiveInt(value: unknown, fallback: number, min = 1) {
  const number = Number(value);
  return Number.isInteger(number) && number >= min ? number : fallback;
}

function intArray(value: unknown, fallback: number[]) {
  const array = Array.isArray(value) ? value : fallback;
  const normalized = array
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0);
  return normalized.length > 0 ? [...new Set(normalized)] : fallback;
}

export function normalizeGuildConfig(value: unknown): GuildConfig {
  const source = (value || {}) as Partial<GuildConfig> & Record<string, any>;
  const baseMemberLimit = positiveInt(
    source.baseMemberLimit,
    DEFAULT_GUILD_CONFIG.baseMemberLimit,
  );
  const maxLevel = positiveInt(
    source.maxLevel,
    DEFAULT_GUILD_CONFIG.maxLevel,
  );
  return {
    enabled: source.enabled !== false,
    maxLevel,
    baseMemberLimit,
    memberLimitPerLevel: positiveInt(
      source.memberLimitPerLevel,
      DEFAULT_GUILD_CONFIG.memberLimitPerLevel,
      0,
    ),
    checkInReward: {
      points: positiveInt(
        source.checkInReward?.points,
        DEFAULT_GUILD_CONFIG.checkInReward.points,
        0,
      ),
    },
    donateOptions: intArray(
      source.donateOptions,
      DEFAULT_GUILD_CONFIG.donateOptions,
    ),
    dailyDonateLimit: positiveInt(
      source.dailyDonateLimit,
      DEFAULT_GUILD_CONFIG.dailyDonateLimit,
    ),
    bossAttempts: positiveInt(
      source.bossAttempts,
      DEFAULT_GUILD_CONFIG.bossAttempts,
    ),
    bossHpBase: positiveInt(
      source.bossHpBase,
      DEFAULT_GUILD_CONFIG.bossHpBase,
    ),
    bossHpPerLevel: positiveInt(
      source.bossHpPerLevel,
      DEFAULT_GUILD_CONFIG.bossHpPerLevel,
      0,
    ),
    activeChestThresholds: intArray(
      source.activeChestThresholds,
      DEFAULT_GUILD_CONFIG.activeChestThresholds,
    ).sort((left, right) => left - right),
  };
}

