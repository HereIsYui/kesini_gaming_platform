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
   * 原子自增计数，并在键首次创建时设置过期时间。
   * 用于限流：每个窗口内累加调用次数。
   * @param key 键
   * @param ttlSeconds 窗口过期时间（秒）
   * @returns 当前窗口内的计数；Redis 不可用时返回 0（调用方据此放行，避免误伤）
   */
  async incrWithExpire(key: string, ttlSeconds: number): Promise<number> {
    try {
      key = key.toUpperCase();
      const redisClient = this.ensureClient();
      const count = await redisClient.incr(key);
      if (count === 1) {
        await redisClient.expire(key, ttlSeconds);
      }
      return count;
    } catch (error) {
      this.logger.error(`Redis incr error for key ${key}: ${error.message}`);
      return 0;
    }
  }

  /**
   * 检查键是否存在。
   * @param key 键
   * @returns 存在返回 true；Redis 不可用时返回 false（放行）
   */
  async exists(key: string): Promise<boolean> {
    try {
      key = key.toUpperCase();
      const redisClient = this.ensureClient();
      const result = await redisClient.exists(key);
      return result > 0;
    } catch (error) {
      this.logger.error(`Redis exists error for key ${key}: ${error.message}`);
      return false;
    }
  }

  /**
   * 使用 SCAN 游标遍历匹配指定模式的所有键（非阻塞，生产安全）。
   * @param pattern 匹配模式，如 "pve:ban:*"（内部统一大写）
   * @returns 匹配到的键列表；Redis 不可用时返回空数组
   */
  async scanKeys(pattern: string): Promise<string[]> {
    try {
      const match = pattern.toUpperCase();
      const redisClient = this.ensureClient();
      const keys: string[] = [];
      let cursor = "0";
      do {
        const [next, batch] = await redisClient.scan(
          cursor,
          "MATCH",
          match,
          "COUNT",
          100,
        );
        cursor = next;
        keys.push(...batch);
      } while (cursor !== "0");
      return keys;
    } catch (error) {
      this.logger.error(
        `Redis scan error for pattern ${pattern}: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * 获取键的剩余过期时间（秒）。
   * @param key 键
   * @returns 剩余秒数；键不存在返回 -2，无过期时间返回 -1，Redis 不可用返回 -2
   */
  async ttl(key: string): Promise<number> {
    try {
      key = key.toUpperCase();
      const redisClient = this.ensureClient();
      return await redisClient.ttl(key);
    } catch (error) {
      this.logger.error(`Redis ttl error for key ${key}: ${error.message}`);
      return -2;
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
