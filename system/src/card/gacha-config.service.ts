import { Injectable } from "@nestjs/common";
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

const ALLOWED_RARITIES: CardRarity[] = ["N", "R", "SR", "SSR", "UR"];
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
  updatedAt: Date | null;
}

@Injectable()
export class GachaConfigService {
  constructor(
    private readonly configService: ConfigurationService,
    @InjectRepository(GachaPoolConfig)
    private readonly gachaPoolConfigRepository: Repository<GachaPoolConfig>,
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
    return this.getStandardPoolConfig();
  }

  /**
   * 根据卡池ID获取配置
   */
  getEnvConfigByPoolId(poolId: number): GachaConfig {
    switch (poolId) {
      case 0: // 常驻卡池
      case 1:
        return this.getStandardPoolConfig();
      case 2: // 限定卡池
        return this.getLimitedPoolConfig();
      case 3: // 新手卡池
        return this.getBeginnerPoolConfig();
      case 4: // 活动卡池
        return this.getEventPoolConfig();
      default:
        // 如果是未知的卡池ID，返回默认配置
        return this.getDefaultConfig();
    }
  }

  /**
   * 根据卡池ID获取最终生效配置，数据库配置优先于环境变量
   */
  async getConfigByPoolId(poolId: number): Promise<GachaConfig> {
    const normalizedPoolId = poolId === 0 ? this.getDefaultConfig().poolId! : poolId;
    const envConfig = this.getEnvConfigByPoolId(normalizedPoolId);
    const dbConfig = await this.gachaPoolConfigRepository.findOne({
      where: { pool_id: normalizedPoolId },
    });

    if (!dbConfig?.enabled) {
      return {
        ...envConfig,
        poolId: normalizedPoolId,
      };
    }

    return this.toGachaConfig(dbConfig, envConfig);
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
   * 获取所有可用的卡池类型及其概率配置
   */
  async getAllPoolConfigs(): Promise<Record<number, GachaConfigView>> {
    const envConfigs: Record<number, GachaConfig> = {
      1: this.getStandardPoolConfig(),
      2: this.getLimitedPoolConfig(),
      3: this.getBeginnerPoolConfig(),
      4: this.getEventPoolConfig(),
    };
    const poolIds = Object.keys(envConfigs).map(Number);
    const dbConfigs = await this.gachaPoolConfigRepository.find({
      where: poolIds.length ? { pool_id: In(poolIds) } : {},
      order: { pool_id: "ASC" },
    });
    const dbConfigMap = new Map(
      dbConfigs.map((config) => [config.pool_id, config]),
    );

    return poolIds.reduce(
      (result, poolId) => {
        const dbConfig = dbConfigMap.get(poolId);
        const envConfig = envConfigs[poolId];
        const enabled = dbConfig?.enabled === true;
        result[poolId] = {
          ...(enabled ? this.toGachaConfig(dbConfig, envConfig) : envConfig),
          poolId,
          enabled,
          source: enabled ? "database" : "env",
          updatedAt: dbConfig?.updatedAt || null,
        };
        return result;
      },
      {} as Record<number, GachaConfigView>,
    );
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
      where: { pool_id: In(normalizedPoolIds) },
      order: { pool_id: "ASC" },
    });
    const dbConfigMap = new Map(
      dbConfigs.map((config) => [config.pool_id, config]),
    );

    return normalizedPoolIds.reduce(
      (result, poolId) => {
        const dbConfig = dbConfigMap.get(poolId);
        const envConfig = this.getEnvConfigByPoolId(poolId);
        const enabled = dbConfig?.enabled === true;
        result[poolId] = {
          ...(enabled ? this.toGachaConfig(dbConfig, envConfig) : envConfig),
          poolId,
          enabled,
          source: enabled ? "database" : "env",
          updatedAt: dbConfig?.updatedAt || null,
          drawCosts: enabled
            ? this.toDrawCosts(dbConfig, envConfig.drawCosts)
            : this.normalizeDrawCosts(envConfig.drawCosts),
        };
        return result;
      },
      {} as Record<number, GachaConfigView>,
    );
  }

  async savePoolConfig(
    poolId: number,
    input: EditableGachaConfig,
  ): Promise<GachaConfigView> {
    if (!Number.isInteger(poolId) || poolId <= 0) {
      throw new Error("卡池ID无效");
    }

    const envConfig = this.getEnvConfigByPoolId(poolId);
    const existing = await this.gachaPoolConfigRepository.findOne({
      where: { pool_id: poolId },
    });
    const inheritedDrawCosts = this.normalizeDrawCosts(
      existing
        ? {
            once: existing.single_draw_cost,
            ten: existing.ten_draw_cost,
          }
        : envConfig.drawCosts,
    );
    const nextConfig: EditableGachaConfig = {
      poolId,
      enabled: input.enabled ?? existing?.enabled ?? true,
      rarityProbabilities:
        input.rarityProbabilities ||
        existing?.rarity_probabilities ||
        envConfig.rarityProbabilities,
      upCards:
        input.upCards === null
          ? undefined
          : input.upCards || existing?.up_cards || envConfig.upCards,
      pitySystem:
        input.pitySystem === null
          ? undefined
          : input.pitySystem || existing?.pity_system || envConfig.pitySystem,
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
    return {
      ...this.toGachaConfig(saved, envConfig),
      enabled: saved.enabled,
      source: saved.enabled ? "database" : "env",
      updatedAt: saved.updatedAt || null,
    };
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
      throw new Error("抽卡积分消耗必须为正整数");
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
