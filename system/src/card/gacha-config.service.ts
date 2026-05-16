import { Injectable } from "@nestjs/common";
import { GachaConfig } from "../types/api";
import { ConfigurationService } from "../config/configuration.service";

@Injectable()
export class GachaConfigService {
  constructor(private readonly configService: ConfigurationService) {}

  /**
   * 获取标准卡池配置
   */
  getStandardPoolConfig(): GachaConfig {
    return {
      poolId: 1, // 常驻卡池类型
      rarityProbabilities: this.configService.gachaProbabilities.standard,
      pitySystem: this.configService.gachaPityConfigs.standard,
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
  getConfigByPoolId(poolId: number): GachaConfig {
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
  getAllPoolConfigs(): Record<number, GachaConfig> {
    return {
      1: this.getStandardPoolConfig(),
      2: this.getLimitedPoolConfig(),
      3: this.getBeginnerPoolConfig(),
      4: this.getEventPoolConfig(),
    };
  }
}
