import { Injectable } from "@nestjs/common";
import { PitySystemConfig } from "src/types/api";

@Injectable()
export class ConfigurationService {
  // JWT配置
  get jwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret && process.env.NODE_ENV === "production") {
      throw new Error("生产环境必须配置 JWT_SECRET");
    }
    return secret || "development-secret-key-change-me";
  }

  get jwtExpiresIn(): string {
    return process.env.JWT_EXPIRES_IN || "7d";
  }

  // 数据库配置
  get databaseConfig() {
    return {
      type: "mysql" as const,
      host: process.env.DB_HOST || "127.0.0.1",
      port: parseInt(process.env.DB_PORT || "3306", 10),
      username: process.env.DB_USERNAME || "root",
      password: process.env.DB_PASSWORD || "123456",
      database: process.env.DB_DATABASE || "kesini",
      synchronize: process.env.DB_SYNCHRONIZE === "true",
      autoLoadEntities: process.env.DB_AUTO_LOAD_ENTITIES === "true",
      retryDelay: parseInt(process.env.DB_RETRY_DELAY || "500", 10),
      retryAttempts: parseInt(process.env.DB_RETRY_ATTEMPTS || "10", 10),
    };
  }

  // Redis配置
  get redisConfig() {
    return {
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: parseInt(process.env.REDIS_PORT || "6379", 10),
      password: process.env.REDIS_PASSWORD || undefined,
    };
  }

  // 管理员UID配置保留展示，后台权限只以用户 is_admin 字段为准
  get adminUids(): string[] {
    return (process.env.ADMIN_UIDS || "")
      .split(",")
      .map((uid) => uid.trim())
      .filter(Boolean);
  }

  // 抽卡概率配置
  get gachaProbabilities() {
    return {
      standard: this.parseProbability(
        process.env.STANDARD_POOL_RARITY_PROBABILITIES || "",
      ),
      limited: this.parseProbability(
        process.env.LIMITED_POOL_RARITY_PROBABILITIES || "",
      ),
      beginner: this.parseProbability(
        process.env.BEGINNER_POOL_RARITY_PROBABILITIES || "",
      ),
      event: this.parseProbability(
        process.env.EVENT_POOL_RARITY_PROBABILITIES || "",
      ),
    };
  }

  // 保底配置
  get gachaPityConfigs() {
    return {
      standard: this.parsePityConfig(
        process.env.STANDARD_POOL_PITY_CONFIG || "",
      ),
      limited: this.parsePityConfig(process.env.LIMITED_POOL_PITY_CONFIG || ""),
      beginner: this.parsePityConfig(
        process.env.BEGINNER_POOL_PITY_CONFIG || "",
      ),
      event: this.parsePityConfig(process.env.EVENT_POOL_PITY_CONFIG || ""),
    };
  }

  // UP卡配置
  get upCardConfigs() {
    return {
      limited: this.parseUpConfig(process.env.LIMITED_POOL_UP_CONFIG || ""),
      event: this.parseUpConfig(process.env.EVENT_POOL_UP_CONFIG || ""),
    };
  }

  private parseProbability(probabilityStr: string): Record<string, number> {
    try {
      const probabilities =
        probabilityStr && probabilityStr.trim()
          ? JSON.parse(probabilityStr)
          : this.getDefaultProbabilities();
      return this.isValidProbability(probabilities)
        ? probabilities
        : this.getDefaultProbabilities();
    } catch (error) {
      console.warn("Failed to parse probability config, using default:", error);
      return this.getDefaultProbabilities();
    }
  }

  private parseUpConfig(
    upConfigStr: string,
  ): { enabled: boolean; cardIds: number[]; upRate: number } | undefined {
    try {
      const upConfig =
        upConfigStr && upConfigStr.trim() ? JSON.parse(upConfigStr) : undefined;
      if (!upConfig) {
        return undefined;
      }

      const validRate =
        typeof upConfig.upRate === "number" &&
        upConfig.upRate >= 0 &&
        upConfig.upRate <= 1;
      const validCards =
        Array.isArray(upConfig.cardIds) &&
        upConfig.cardIds.every((id: unknown) => Number.isInteger(id));
      if (!validRate || !validCards) {
        console.warn("Invalid UP card config, disabling UP config");
        return undefined;
      }
      return upConfig;
    } catch (error) {
      console.warn("Failed to parse UP card config:", error);
      return undefined;
    }
  }

  private parsePityConfig(pityConfigStr: string): PitySystemConfig {
    try {
      const pityConfig =
        pityConfigStr && pityConfigStr.trim()
          ? JSON.parse(pityConfigStr)
          : this.getDefaultPityConfig();
      return this.isValidPityConfig(pityConfig)
        ? pityConfig
        : this.getDefaultPityConfig();
    } catch (error) {
      console.warn("Failed to parse pity config, using default:", error);
      return this.getDefaultPityConfig();
    }
  }

  private isValidProbability(probabilities: Record<string, number>): boolean {
    const allowedRarities = ["N", "R", "SR", "SSR", "UR"];
    const entries = Object.entries(probabilities || {});
    const total = entries.reduce((sum, [rarity, probability]) => {
      if (
        !allowedRarities.includes(rarity) ||
        typeof probability !== "number" ||
        probability < 0 ||
        probability > 1
      ) {
        return Number.NaN;
      }
      return sum + probability;
    }, 0);

    return Number.isFinite(total) && Math.abs(total - 1) < 0.0001;
  }

  private isValidPityConfig(config: PitySystemConfig): boolean {
    const allowedRarities = ["N", "R", "SR", "SSR", "UR"];
    if (!config || typeof config.enabled !== "boolean") {
      return false;
    }

    const rules = [config.softPity, config.hardPity].filter(Boolean);
    return rules.every((rule) => {
      return (
        Number.isInteger(rule!.count) &&
        rule!.count > 0 &&
        allowedRarities.includes(rule!.guaranteedRarity)
      );
    });
  }

  private getDefaultProbabilities(): Record<string, number> {
    return {
      N: 0.5,
      R: 0.3,
      SR: 0.15,
      SSR: 0.045,
      UR: 0.005,
    };
  }

  private getDefaultPityConfig(): PitySystemConfig {
    return {
      enabled: true,
      softPity: {
        count: 10,
        guaranteedRarity: "SR",
      },
      hardPity: {
        count: 90,
        guaranteedRarity: "SSR",
      },
    };
  }
}
