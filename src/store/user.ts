// services/user.service.ts
import { Injectable } from "@nestjs/common";
import { RedisUtil } from "../utils/redis";

@Injectable()
export class UserService {
  userList: [];
  constructor(private readonly redis: RedisUtil) {}

  async cacheUser(userId: string, userData: any): Promise<boolean> {
    return await this.redis.set(`user:${userId}`, userData, 3600);
  }

  async getCachedUser(userId: string): Promise<any> {
    return await this.redis.get(`user:${userId}`);
  }

  async getMultipleUsers(userIds: string[]): Promise<Record<string, any>> {
    const keys = userIds.map((id) => `user:${id}`);
    return await this.redis.gets(keys);
  }
}
