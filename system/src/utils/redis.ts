// Redis 工具类
import { Injectable, Logger } from "@nestjs/common";
import Redis from "ioredis";
import { ConfigurationService } from "src/config/configuration.service";

@Injectable()
export class RedisUtil {
  private readonly logger = new Logger(RedisUtil.name);
  private redisClient?: Redis;

  constructor(private readonly configService: ConfigurationService) {}

  /**
   * 获取已创建的 Redis 客户端。
   */
  private getClient(): Redis | undefined {
    return this.redisClient;
  }

  /**
   * 按需创建 Redis 客户端，避免应用启动时建立连接。
   */
  private ensureClient(): Redis {
    const currentClient = this.getClient();
    if (currentClient) {
      return currentClient;
    }

    const redisConfig = this.configService.redisConfig;
    this.redisClient = new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      db: 0,
      keepAlive: 1,
      lazyConnect: true,
    });

    // 基本事件监听
    this.redisClient.on("connect", () => {
      this.logger.log("Redis connected on first use");
    });

    this.redisClient.on("error", (err) => {
      this.logger.error(`Redis error: ${err.message}`);
    });

    return this.redisClient;
  }

  /**
   * 设置值
   * @param key 键
   * @param value 值
   * @param ttl 过期时间（秒），可选
   */
  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    try {
      key = key.toUpperCase();
      const redisClient = this.ensureClient();
      const serializedValue =
        typeof value === "object" ? JSON.stringify(value) : String(value);

      if (ttl) {
        await redisClient.set(key, serializedValue, "EX", ttl);
      } else {
        await redisClient.set(key, serializedValue);
      }

      return true;
    } catch (error) {
      this.logger.error(`Redis set error for key ${key}: ${error.message}`);
      return false;
    }
  }

  /**
   * 获取单个值
   * @param key 键
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      key = key.toUpperCase();
      const redisClient = this.ensureClient();
      const value = await redisClient.get(key);
      if (value === null) return null;

      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    } catch (error) {
      this.logger.error(`Redis get error for key ${key}: ${error.message}`);
      return null;
    }
  }

  /**
   * 批量获取多个值
   * @param keys 键数组
   */
  async gets<T = any>(keys: string[]): Promise<Record<string, T | null>> {
    try {
      const redisClient = this.ensureClient();
      const normalizedKeys = keys.map((key) => key.toUpperCase());
      const values = await redisClient.mget(...normalizedKeys);
      const result: Record<string, T | null> = {};

      keys.forEach((key, index) => {
        const value = values[index];
        if (value === null) {
          result[key] = null;
        } else {
          try {
            result[key] = JSON.parse(value) as T;
          } catch {
            result[key] = value as T;
          }
        }
      });

      return result;
    } catch (error) {
      this.logger.error(`Redis gets error for keys: ${error.message}`);
      return {};
    }
  }

  /**
   * 删除键
   * @param key 键
   */
  async del(key: string): Promise<boolean> {
    try {
      key = key.toUpperCase();
      const redisClient = this.ensureClient();
      const result = await redisClient.del(key);
      return result > 0;
    } catch (error) {
      this.logger.error(`Redis del error for key ${key}: ${error.message}`);
      return false;
    }
  }

  /**
   * 检查连接状态
   */
  async ping(): Promise<boolean> {
    try {
      const redisClient = this.ensureClient();
      await redisClient.ping();
      return true;
    } catch {
      return false;
    }
  }
}
