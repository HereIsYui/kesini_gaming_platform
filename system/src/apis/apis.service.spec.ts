import { Logger } from "@nestjs/common";
import axios from "axios";
import { ApisService } from "./apis.service";

jest.mock("axios");

const mockedAxios = axios as jest.Mocked<typeof axios>;

function createRepository(overrides: Record<string, any> = {}) {
  return {
    delete: jest.fn().mockResolvedValue({ affected: 0 }),
    findOne: jest.fn().mockResolvedValue(null),
    insert: jest.fn().mockResolvedValue({ identifiers: [{ id: 1 }] }),
    save: jest.fn((value) => Promise.resolve({ id: 1, ...value })),
    ...overrides,
  };
}

function createCallback(overrides: Record<string, any> = {}) {
  return {
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "id_res",
    "openid.op_endpoint": "https://fishpi.cn",
    "openid.identity": "https://fishpi.cn/openid/id/123456",
    "openid.claimed_id": "https://fishpi.cn/openid/id/123456",
    "openid.return_to": "https://web.example.com/callback",
    "openid.response_nonce": "2026-05-30T08:00:00Zabc123",
    "openid.assoc_handle": "handle123",
    "openid.signed": "op_endpoint,return_to,response_nonce,assoc_handle",
    "openid.sig": "sig123",
    ...overrides,
  };
}

function createService(
  userRepository = createRepository(),
  openIdNonceRepository = createRepository(),
) {
  const jwtUtilsService = {
    generateToken: jest.fn().mockReturnValue("JWT_TOKEN"),
  };
  const siteConfigService = {
    getSiteConfig: jest.fn().mockReturnValue({}),
  };

  return {
    service: new ApisService(
      userRepository as any,
      openIdNonceRepository as any,
      jwtUtilsService as any,
      siteConfigService as any,
    ),
    jwtUtilsService,
    openIdNonceRepository,
    siteConfigService,
    userRepository,
  };
}

describe("ApisService", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-05-30T08:00:00Z"));
    jest.spyOn(Logger.prototype, "debug").mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    mockedAxios.post.mockResolvedValue({ data: "is_valid:true\n" });
    mockedAxios.get.mockResolvedValue({
      data: {
        code: 0,
        data: {
          userName: "yui",
          userNickname: "Yui",
          userAvatarURL: "https://example.com/avatar.png",
        },
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("登录成功后写入已使用 nonce", async () => {
    const { service, openIdNonceRepository, userRepository, jwtUtilsService } =
      createService();

    await expect(service.handleCallback(createCallback())).resolves.toEqual({
      data: {
        user: expect.objectContaining({
          uid: "123456",
          name: "yui",
          nickname: "Yui",
          avatar: "https://example.com/avatar.png",
        }),
        token: "JWT_TOKEN",
      },
      msg: "登录成功",
    });
    expect(openIdNonceRepository.insert).toHaveBeenCalledWith({
      nonce: "2026-05-30T08:00:00Zabc123",
      expires_at: new Date("2026-05-30T08:05:00Z"),
    });
    expect(mockedAxios.post.mock.invocationCallOrder[0]).toBeLessThan(
      openIdNonceRepository.insert.mock.invocationCallOrder[0],
    );
    expect(
      openIdNonceRepository.insert.mock.invocationCallOrder[0],
    ).toBeLessThan(userRepository.findOne.mock.invocationCallOrder[0]);
    expect(jwtUtilsService.generateToken).toHaveBeenCalledWith({
      uid: "123456",
    });
  });

  it("重复使用同一个 nonce 会被拒绝", async () => {
    const openIdNonceRepository = createRepository({
      insert: jest.fn().mockRejectedValue({ code: "ER_DUP_ENTRY" }),
    });
    const userRepository = createRepository();
    const { service } = createService(userRepository, openIdNonceRepository);

    await expect(service.handleCallback(createCallback())).rejects.toThrow(
      "登录已失效",
    );
    expect(openIdNonceRepository.insert).toHaveBeenCalledWith({
      nonce: "2026-05-30T08:00:00Zabc123",
      expires_at: new Date("2026-05-30T08:05:00Z"),
    });
    expect(userRepository.findOne).not.toHaveBeenCalled();
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it("过期 nonce 会在签名前被拒绝", async () => {
    const openIdNonceRepository = createRepository();
    const { service } = createService(
      createRepository(),
      openIdNonceRepository,
    );

    await expect(
      service.handleCallback(
        createCallback({
          "openid.response_nonce": "2026-05-30T07:54:59Zabc123",
        }),
      ),
    ).rejects.toThrow("登录已失效");
    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(openIdNonceRepository.insert).not.toHaveBeenCalled();
  });

  it("签名失败不会占用 nonce", async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: "is_valid:false\n" });
    const openIdNonceRepository = createRepository();
    const { service } = createService(
      createRepository(),
      openIdNonceRepository,
    );

    await expect(service.handleCallback(createCallback())).rejects.toThrow(
      "签名验证失败",
    );
    expect(openIdNonceRepository.insert).not.toHaveBeenCalled();
  });
});
