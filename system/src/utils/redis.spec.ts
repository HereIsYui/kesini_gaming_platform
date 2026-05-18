import Redis from "ioredis";
import { RedisUtil } from "./redis";

jest.mock("ioredis", () => ({
  __esModule: true,
  default: jest.fn(),
}));

const RedisMock = Redis as unknown as jest.Mock;

function createConfigService() {
  return {
    redisConfig: {
      host: "127.0.0.1",
      port: 6379,
      password: undefined,
    },
  } as any;
}

describe("RedisUtil", () => {
  let redisClient: Record<string, jest.Mock>;

  beforeEach(() => {
    redisClient = {
      del: jest.fn().mockResolvedValue(1),
      get: jest.fn().mockResolvedValue('{"uid":"u1"}'),
      mget: jest.fn().mockResolvedValue(["1"]),
      on: jest.fn(),
      ping: jest.fn().mockResolvedValue("PONG"),
      set: jest.fn().mockResolvedValue("OK"),
    };

    RedisMock.mockClear();
    RedisMock.mockImplementation(() => redisClient);
  });

  it("实例化时不会创建 Redis 客户端", () => {
    new RedisUtil(createConfigService());

    expect(RedisMock).not.toHaveBeenCalled();
  });

  it("首次调用读取方法时才创建 Redis 客户端", async () => {
    const redisUtil = new RedisUtil(createConfigService());

    await expect(redisUtil.get("user:u1")).resolves.toEqual({ uid: "u1" });

    expect(RedisMock).toHaveBeenCalledTimes(1);
    expect(RedisMock).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "127.0.0.1",
        lazyConnect: true,
        port: 6379,
      }),
    );
    expect(redisClient.get).toHaveBeenCalledWith("USER:U1");
  });

  it("ping 会按需创建客户端并复用懒连接配置", async () => {
    const redisUtil = new RedisUtil(createConfigService());

    await expect(redisUtil.ping()).resolves.toBe(true);

    expect(RedisMock).toHaveBeenCalledTimes(1);
    expect(redisClient.ping).toHaveBeenCalledTimes(1);
  });
});
