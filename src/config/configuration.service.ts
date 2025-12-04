import { Injectable } from '@nestjs/common';

@Injectable()
export class ConfigurationService {
  // JWT配置
  get jwtSecret(): string {
    return process.env.JWT_SECRET || 'default-secret-key';
  }

  get jwtExpiresIn(): string {
    return process.env.JWT_EXPIRES_IN || '7d';
  }

  // 数据库配置
  get databaseConfig() {
    return {
      type: 'mysql' as const,
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || '123456',
      database: process.env.DB_DATABASE || 'kesini',
      synchronize: process.env.DB_SYNCHRONIZE === 'true',
      autoLoadEntities: process.env.DB_AUTO_LOAD_ENTITIES === 'true',
      retryDelay: parseInt(process.env.DB_RETRY_DELAY || '500', 10),
      retryAttempts: parseInt(process.env.DB_RETRY_ATTEMPTS || '10', 10),
    };
  }

  // Redis配置
  get redisConfig() {
    return {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
    };
  }

  // 抽卡概率配置
  get gachaProbabilities() {
    return {
      standard: this.parseProbability(process.env.STANDARD_POOL_RARITY_PROBABILITIES || ''),
      limited: this.parseProbability(process.env.LIMITED_POOL_RARITY_PROBABILITIES || ''),
      beginner: this.parseProbability(process.env.BEGINNER_POOL_RARITY_PROBABILITIES || ''),
      event: this.parseProbability(process.env.EVENT_POOL_RARITY_PROBABILITIES || ''),
    };
  }

  // UP卡配置
  get upCardConfigs() {
    return {
      limited: this.parseUpConfig(process.env.LIMITED_POOL_UP_CONFIG || ''),
      event: this.parseUpConfig(process.env.EVENT_POOL_UP_CONFIG || ''),
    };
  }

  private parseProbability(probabilityStr: string): Record<string, number> {
    try {
      return probabilityStr && probabilityStr.trim() ? JSON.parse(probabilityStr) : this.getDefaultProbabilities();
    } catch (error) {
      console.warn('Failed to parse probability config, using default:', error);
      return this.getDefaultProbabilities();
    }
  }

  private parseUpConfig(upConfigStr: string): { enabled: boolean; cardIds: number[]; upRate: number } | undefined {
    try {
      return upConfigStr && upConfigStr.trim() ? JSON.parse(upConfigStr) : undefined;
    } catch (error) {
      console.warn('Failed to parse UP card config:', error);
      return undefined;
    }
  }

  private getDefaultProbabilities(): Record<string, number> {
    return {
      'N': 0.50,
      'R': 0.30,
      'SR': 0.15,
      'SSR': 0.045,
      'UR': 0.005,
    };
  }
}