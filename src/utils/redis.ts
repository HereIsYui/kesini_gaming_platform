// common/utils/redis.util.ts
import { Injectable, Logger } from "@nestjs/common";
import Redis from "ioredis";

@Injectable()
export class RedisUtil {
  private readonly logger = new Logger(RedisUtil.name);
  private redisClient: Redis;

  constructor() {
    this.initRedis();
  }

  /**
   * 初始化 Redis 连接
   */
  private initRedis(): void {
    this.redisClient = new Redis({
      host: "154.13.6.73",
      port: 6379,
      password: "yuimeta",
      db: 0,
      keepAlive: 1,
    });

    // 基本事件监听
    this.redisClient.on("connect", () => {
      this.logger.log("Redis connected");
    });

    this.redisClient.on("error", (err) => {
      this.logger.error(`Redis error: ${err.message}`);
    });
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
      const serializedValue =
        typeof value === "object" ? JSON.stringify(value) : String(value);

      if (ttl) {
        await this.redisClient.set(key, serializedValue, "EX", ttl);
      } else {
        await this.redisClient.set(key, serializedValue);
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
      const value = await this.redisClient.get(key);
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
      const values = await this.redisClient.mget(...keys);
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
      const result = await this.redisClient.del(key);
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
      await this.redisClient.ping();
      return true;
    } catch {
      return false;
    }
  }
}
