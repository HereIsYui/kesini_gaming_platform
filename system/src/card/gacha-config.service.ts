import { Injectable, Optional } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { GachaPoolConfig } from "src/entity/gachaPoolConfig.entity";
import {
  CardRarity,
  DrawCosts,
  GachaConfig,
  PitySystemConfig,
} from "../types/api";
import { ConfigurationService } from "../config/configuration.service";
import { RedisUtil } from "../utils/redis";

const ALLOWED_RARITIES: CardRarity[] = ["N", "R", "SR", "SSR", "UR"];
export const GLOBAL_DEFAULT_POOL_ID = 0;
// 抽卡配置缓存：写时通过递增版本号失效，旧 key 随 TTL 自然过期。
const GACHA_CONFIG_CACHE_PREFIX = "gacha:config:";
const GACHA_CONFIG_VERSION_KEY = "gacha:config:ver";
const GACHA_CONFIG_CACHE_TTL_SECONDS = 24 * 3600;
export const DEFAULT_DRAW_COSTS: DrawCosts = {
  once: 10,
  ten: 100,
};

export type EditableGachaConfig = Omit<GachaConfig, "upCards" | "pitySystem"> & {
  enabled?: boolean;
  upCards?: GachaConfig["upCards"] | null;
  pitySystem?: GachaConfig["pitySystem"] | null;
  drawCosts?: DrawCosts;
};

export interface GachaConfigView extends GachaConfig {
  enabled: boolean;
  source: "database" | "env";
  scope: "pool" | "global" | "fallback";
  updatedAt: Date | null;
}

export interface PoolGachaConfigDetail {
  effective: GachaConfigView;
  individualConfig: GachaConfigView | null;
  defaultConfig: GachaConfigView;
  fallbackConfig: GachaConfigView;
  hasIndividualConfig: boolean;
}

@Injectable()
export class GachaConfigService {
  constructor(
    private readonly configService: ConfigurationService,
    @InjectRepository(GachaPoolConfig)
    private readonly gachaPoolConfigRepository: Repository<GachaPoolConfig>,
    @Optional()
    private readonly redis?: RedisUtil,
  ) {}

  /**
   * 获取标准卡池配置
   */
  getStandardPoolConfig(): GachaConfig {
    return {
      poolId: 1, // 常驻卡池类型
      rarityProbabilities: this.configService.gachaProbabilities.standard,
      pitySystem: this.configService.gachaPityConfigs.standard,
      drawCosts: DEFAULT_DRAW_COSTS,
    };
  }

  /**
   * 获取限定卡池配置
   */
  getLimitedPoolConfig(): GachaConfig {
    const upConfig = this.configService.upCardConfigs.limited;
    return {
      poolId: 2, // 限定卡池类型
      rarityProbabilities: this.configService.gachaProbabilities.limited,
      upCards: upConfig,
      pitySystem: this.configService.gachaPityConfigs.limited,
      drawCosts: DEFAULT_DRAW_COSTS,
    };
  }

  /**
   * 获取新手卡池配置
   */
  getBeginnerPoolConfig(): GachaConfig {
    return {
      poolId: 3, // 新手卡池
      rarityProbabilities: this.configService.gachaProbabilities.beginner,
      pitySystem: this.configService.gachaPityConfigs.beginner,
      drawCosts: DEFAULT_DRAW_COSTS,
    };
  }

  /**
   * 获取活动卡池配置
   */
  getEventPoolConfig(): GachaConfig {
    const upConfig = this.configService.upCardConfigs.event;
    return {
      poolId: 4, // 活动卡池类型
      rarityProbabilities: this.configService.gachaProbabilities.event,
      upCards: upConfig,
      pitySystem: this.configService.gachaPityConfigs.event,
      drawCosts: DEFAULT_DRAW_COSTS,
    };
  }

  /**
   * 获取默认配置
   */
  getDefaultConfig(): GachaConfig {
    return {
      ...this.getStandardPoolConfig(),
      poolId: GLOBAL_DEFAULT_POOL_ID,
    };
  }

  /**
   * 获取代码/环境兜底默认配置。历史上这里按卡池 ID/type 返回不同配置，
   * 现在只保留一套全局默认，再把 poolId 映射成调用方需要的目标卡池。
   */
  getEnvConfigByPoolId(poolId: number): GachaConfig {
    const normalizedPoolId =
      Number.isInteger(poolId) && poolId >= 0
        ? poolId
        : GLOBAL_DEFAULT_POOL_ID;
    return {
      ...this.getDefaultConfig(),
      poolId: normalizedPoolId,
    };
  }

  /**
   * 根据卡池ID获取最终生效配置：单池配置 > 全局默认 > 代码/环境兜底。
   * 抽卡与卡池列表的热路径入口，优先读 Redis 缓存（写时由版本号失效）。
   */
  async getConfigByPoolId(poolId: number): Promise<GachaConfig> {
    const normalizedPoolId = this.normalizeReadablePoolId(poolId);
    const cacheKey = await this.buildGachaConfigCacheKey(normalizedPoolId);
    if (cacheKey && this.redis) {
      const cached = await this.redis.get<GachaConfig>(cacheKey);
      if (cached) {
        return cached;
      }
    }
    const config =
      normalizedPoolId === GLOBAL_DEFAULT_POOL_ID
        ? await this.getGlobalDefaultConfigView()
        : (await this.getPoolConfigDetail(normalizedPoolId)).effective;
    if (cacheKey && this.redis) {
      await this.redis.set(cacheKey, config, GACHA_CONFIG_CACHE_TTL_SECONDS);
    }
    return config;
  }

  /**
   * 验证概率配置是否有效
   */
  validateProbabilities(probabilities: Record<string, number>): boolean {
    const total = Object.values(probabilities).reduce(
      (sum, prob) => sum + prob,
      0,
    );
    return (
      Object.values(probabilities).every((prob) => prob >= 0 && prob <= 1) &&
      Math.abs(total - 1.0) < 0.0001
    ); // 允许小的浮点误差
  }

  /**
   * 获取默认抽卡配置。后台“默认抽卡配置”页只展示这一项。
   */
  async getAllPoolConfigs(): Promise<Record<number, GachaConfigView>> {
    return {
      [GLOBAL_DEFAULT_POOL_ID]: await this.getGlobalDefaultConfigView(),
    };
  }

  async getPoolConfigsByPoolIds(
    poolIds: number[],
  ): Promise<Record<number, GachaConfigView>> {
    const normalizedPoolIds = [
      ...new Set(
        poolIds
          .map((poolId) => Number(poolId))
          .filter((poolId) => Number.isInteger(poolId) && poolId > 0),
      ),
    ].sort((a, b) => a - b);

    if (normalizedPoolIds.length === 0) {
      return this.getAllPoolConfigs();
    }

    const dbConfigs = await this.gachaPoolConfigRepository.find({
      where: { pool_id: In([GLOBAL_DEFAULT_POOL_ID, ...normalizedPoolIds]) },
      order: { pool_id: "ASC" },
    });
    const dbConfigMap = new Map(
      dbConfigs.map((config) => [config.pool_id, config]),
    );
    const fallbackConfig = this.getFallbackConfigView(GLOBAL_DEFAULT_POOL_ID);
    const defaultConfig = this.resolveGlobalDefaultConfig(
      dbConfigMap.get(GLOBAL_DEFAULT_POOL_ID),
      fallbackConfig,
    );

    return normalizedPoolIds.reduce(
      (result, poolId) => {
        const dbConfig = dbConfigMap.get(poolId);
        result[poolId] = this.resolveEffectivePoolConfig(
          poolId,
          dbConfig,
          defaultConfig,
        );
        return result;
      },
      {} as Record<number, GachaConfigView>,
    );
  }

  async getGlobalDefaultConfigView(): Promise<GachaConfigView> {
    const dbConfig = await this.gachaPoolConfigRepository.findOne({
      where: { pool_id: GLOBAL_DEFAULT_POOL_ID },
    });
    return this.resolveGlobalDefaultConfig(
      dbConfig || undefined,
      this.getFallbackConfigView(GLOBAL_DEFAULT_POOL_ID),
    );
  }

  getFallbackConfigView(poolId = GLOBAL_DEFAULT_POOL_ID): GachaConfigView {
    return {
      ...this.getEnvConfigByPoolId(poolId),
      enabled: false,
      source: "env",
      scope: "fallback",
      updatedAt: null,
    };
  }

  async getPoolConfigDetail(poolId: number): Promise<PoolGachaConfigDetail> {
    if (!Number.isInteger(poolId) || poolId <= 0) {
      throw new Error("卡池ID无效");
    }

    const dbConfigs = await this.gachaPoolConfigRepository.find({
      where: { pool_id: In([GLOBAL_DEFAULT_POOL_ID, poolId]) },
      order: { pool_id: "ASC" },
    });
    const dbConfigMap = new Map(
      dbConfigs.map((config) => [config.pool_id, config]),
    );
    const fallbackConfig = this.getFallbackConfigView(GLOBAL_DEFAULT_POOL_ID);
    const defaultConfig = this.resolveGlobalDefaultConfig(
      dbConfigMap.get(GLOBAL_DEFAULT_POOL_ID),
      fallbackConfig,
    );
    const individualDbConfig = dbConfigMap.get(poolId);
    const effective = this.resolveEffectivePoolConfig(
      poolId,
      individualDbConfig,
      defaultConfig,
    );
    const individualConfig = individualDbConfig
      ? this.toGachaConfigView(
          individualDbConfig,
          this.withPoolId(defaultConfig, poolId),
          poolId,
          "pool",
        )
      : null;

    return {
      effective,
      individualConfig,
      defaultConfig,
      fallbackConfig,
      hasIndividualConfig: individualDbConfig?.enabled === true,
    };
  }

  async savePoolConfig(
    poolId: number,
    input: EditableGachaConfig,
  ): Promise<GachaConfigView> {
    if (!Number.isInteger(poolId) || poolId < 0) {
      throw new Error("卡池ID无效");
    }

    const fallbackConfig =
      poolId === GLOBAL_DEFAULT_POOL_ID
        ? this.getFallbackConfigView(GLOBAL_DEFAULT_POOL_ID)
        : this.withPoolId(await this.getGlobalDefaultConfigView(), poolId);
    const existing = await this.gachaPoolConfigRepository.findOne({
      where: { pool_id: poolId },
    });
    const inheritedDrawCosts = this.normalizeDrawCosts(
      existing
        ? {
            once: existing.single_draw_cost,
            ten: existing.ten_draw_cost,
          }
        : fallbackConfig.drawCosts,
    );
    const nextConfig: EditableGachaConfig = {
      poolId,
      enabled: input.enabled ?? existing?.enabled ?? true,
      rarityProbabilities:
        input.rarityProbabilities ||
        existing?.rarity_probabilities ||
        fallbackConfig.rarityProbabilities,
      upCards:
        input.upCards === null
          ? undefined
          : input.upCards || existing?.up_cards || fallbackConfig.upCards,
      pitySystem:
        input.pitySystem === null
          ? undefined
          : input.pitySystem || existing?.pity_system || fallbackConfig.pitySystem,
      drawCosts: input.drawCosts || inheritedDrawCosts,
    };

    this.validateEditableConfig(nextConfig);

    const entity = this.gachaPoolConfigRepository.create({
      ...(existing || {}),
      pool_id: poolId,
      enabled: nextConfig.enabled ?? true,
      rarity_probabilities: nextConfig.rarityProbabilities!,
      up_cards: nextConfig.upCards || null,
      pity_system: nextConfig.pitySystem || null,
      single_draw_cost: nextConfig.drawCosts!.once,
      ten_draw_cost: nextConfig.drawCosts!.ten,
    });
    const saved = await this.gachaPoolConfigRepository.save(entity);
    // 配置变更后递增版本号，使所有旧缓存 key 失效（含全局默认对各池兜底的影响）。
    await this.invalidateGachaConfigCache();
    return this.toGachaConfigView(
      saved,
      fallbackConfig,
      poolId,
      poolId === GLOBAL_DEFAULT_POOL_ID ? "global" : "pool",
    );
  }

  /**
   * 当前抽卡配置缓存版本号；读取 key 里带版本号，写时递增即可整体失效。
   */
  private async buildGachaConfigCacheKey(
    poolId: number,
  ): Promise<string | null> {
    if (!this.redis) {
      return null;
    }
    const version = (await this.redis.get<number>(GACHA_CONFIG_VERSION_KEY)) || 0;
    return `${GACHA_CONFIG_CACHE_PREFIX}v${version}:${poolId}`;
  }

  private async invalidateGachaConfigCache(): Promise<void> {
    if (!this.redis) {
      return;
    }
    const version = (await this.redis.get<number>(GACHA_CONFIG_VERSION_KEY)) || 0;
    await this.redis.set(GACHA_CONFIG_VERSION_KEY, version + 1);
  }

  validateEditableConfig(config: EditableGachaConfig): void {
    if (!config.rarityProbabilities) {
      throw new Error("稀有度概率不能为空");
    }
    if (!this.validateProbabilities(config.rarityProbabilities)) {
      throw new Error("稀有度概率配置无效，概率总和必须为1");
    }
    Object.keys(config.rarityProbabilities).forEach((rarity) => {
      if (!ALLOWED_RARITIES.includes(rarity as CardRarity)) {
        throw new Error(`稀有度${rarity}不支持`);
      }
    });

    if (config.upCards) {
      const validCards =
        Array.isArray(config.upCards.cardIds) &&
        config.upCards.cardIds.every((id) => Number.isInteger(id) && id > 0);
      const validRate =
        typeof config.upCards.upRate === "number" &&
        config.upCards.upRate >= 0 &&
        config.upCards.upRate <= 1;
      if (
        typeof config.upCards.enabled !== "boolean" ||
        !validCards ||
        !validRate
      ) {
        throw new Error("UP配置无效");
      }
    }

    if (config.pitySystem) {
      this.assertPityConfig(config.pitySystem);
    }

    if (config.drawCosts) {
      this.assertDrawCosts(config.drawCosts);
    }
  }

  private normalizeReadablePoolId(poolId: number): number {
    if (!Number.isInteger(poolId) || poolId < 0) {
      throw new Error("卡池ID无效");
    }
    return poolId;
  }

  private resolveGlobalDefaultConfig(
    dbConfig: GachaPoolConfig | undefined,
    fallback: GachaConfigView,
  ): GachaConfigView {
    if (dbConfig?.enabled === true) {
      return this.toGachaConfigView(
        dbConfig,
        fallback,
        GLOBAL_DEFAULT_POOL_ID,
        "global",
      );
    }
    return {
      ...fallback,
      updatedAt: dbConfig?.updatedAt || null,
    };
  }

  private resolveEffectivePoolConfig(
    poolId: number,
    dbConfig: GachaPoolConfig | undefined,
    defaultConfig: GachaConfigView,
  ): GachaConfigView {
    if (dbConfig?.enabled === true) {
      return this.toGachaConfigView(
        dbConfig,
        this.withPoolId(defaultConfig, poolId),
        poolId,
        "pool",
      );
    }
    return this.withPoolId(defaultConfig, poolId);
  }

  private withPoolId(config: GachaConfigView, poolId: number): GachaConfigView {
    return {
      ...config,
      poolId,
    };
  }

  private toGachaConfigView(
    dbConfig: GachaPoolConfig,
    fallback: GachaConfig,
    poolId: number,
    scope: GachaConfigView["scope"],
  ): GachaConfigView {
    return {
      ...this.toGachaConfig(dbConfig, fallback),
      poolId,
      enabled: dbConfig.enabled,
      source: dbConfig.enabled ? "database" : "env",
      scope: dbConfig.enabled ? scope : "fallback",
      updatedAt: dbConfig.updatedAt || null,
    };
  }

  private toGachaConfig(
    dbConfig: GachaPoolConfig,
    fallback: GachaConfig,
  ): GachaConfig {
    return {
      poolId: dbConfig.pool_id,
      rarityProbabilities:
        dbConfig.rarity_probabilities || fallback.rarityProbabilities,
      upCards: dbConfig.up_cards || undefined,
      pitySystem: dbConfig.pity_system || fallback.pitySystem,
      drawCosts: this.toDrawCosts(dbConfig, fallback.drawCosts),
    };
  }

  private toDrawCosts(
    dbConfig: GachaPoolConfig,
    fallback?: DrawCosts,
  ): DrawCosts {
    return this.normalizeDrawCosts({
      once: dbConfig.single_draw_cost,
      ten: dbConfig.ten_draw_cost,
    }, fallback);
  }

  private normalizeDrawCosts(
    costs?: Partial<DrawCosts>,
    fallback: DrawCosts = DEFAULT_DRAW_COSTS,
  ): DrawCosts {
    const once = Number(costs?.once ?? fallback.once);
    const ten = Number(costs?.ten ?? fallback.ten);
    return {
      once: Number.isInteger(once) && once > 0 ? once : fallback.once,
      ten: Number.isInteger(ten) && ten > 0 ? ten : fallback.ten,
    };
  }

  private assertDrawCosts(costs: DrawCosts): void {
    const once = Number(costs.once);
    const ten = Number(costs.ten);
    if (
      !Number.isInteger(once) ||
      once <= 0 ||
      !Number.isInteger(ten) ||
      ten <= 0
    ) {
      throw new Error("抽卡星穹币消耗必须为正整数");
    }
  }

  private assertPityConfig(config: PitySystemConfig): void {
    if (typeof config.enabled !== "boolean") {
      throw new Error("保底启用状态无效");
    }
    const rules = [config.softPity, config.hardPity].filter(Boolean);
    rules.forEach((rule) => {
      if (
        !Number.isInteger(rule!.count) ||
        rule!.count <= 0 ||
        !ALLOWED_RARITIES.includes(rule!.guaranteedRarity)
      ) {
        throw new Error("保底配置无效");
      }
    });
  }
}
