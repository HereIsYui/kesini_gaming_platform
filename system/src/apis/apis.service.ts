import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import axios from "axios";
import { OpenIdNonce } from "src/entity/openIdNonce.entity";
import { User } from "src/entity/user.entity";
import { LoginData } from "src/types/api";
import { LessThan, Repository } from "typeorm";
import { JwtUtilsService } from "src/utils/jwt";
import { SiteConfigService } from "src/config/site-config.service";

const NONCE_VALID_MS = 5 * 60 * 1000;

@Injectable()
export class ApisService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(OpenIdNonce)
    private readonly openIdNonceRepository: Repository<OpenIdNonce>,
    private readonly jwtUtilsService: JwtUtilsService,
    private readonly siteConfigService: SiteConfigService,
  ) {}

  private logger = new Logger(ApisService.name);
  private readonly OP_ENDPOINT = "https://fishpi.cn";
  login(data: any) {
    return this.handleCallback(data);
  }

  getPublicSiteConfig() {
    return this.siteConfigService.getSiteConfig();
  }

  /**
   * 生成 OpenID 登录链接
   */
  generateLoginUrl(params: { returnTo: string; realm: string }) {
    const { returnTo, realm } = this.validateLoginUrlParams(params);
    const baseParams = {
      "openid.ns": "http://specs.openid.net/auth/2.0",
      "openid.mode": "checkid_setup",
      "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
      "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
    };

    const queryParams = new URLSearchParams({
      ...baseParams,
      "openid.return_to": returnTo,
      "openid.realm": realm,
    });

    return {
      data: {
        url: `${this.OP_ENDPOINT}/openid/login?${queryParams.toString()}`,
      },
      msg: "生成登录链接成功",
    };
  }

  /**
   * 处理 OpenID 回调
   */
  async handleCallback(callbackData: any) {
    this.logger.debug("收到 OpenID 回调数据:", callbackData);

    // 验证必要字段
    const requiredFields = [
      "openid.ns",
      "openid.mode",
      "openid.op_endpoint",
      "openid.identity",
      "openid.claimed_id",
      "openid.return_to",
      "openid.response_nonce",
      "openid.assoc_handle",
      "openid.signed",
      "openid.sig",
    ];

    for (const field of requiredFields) {
      if (!callbackData[field]) {
        throw new Error(`缺少必要字段: ${field}`);
      }
    }

    // 验证 mode 是否正确
    if (callbackData["openid.mode"] !== "id_res") {
      throw new Error(`无效的 openid.mode: ${callbackData["openid.mode"]}`);
    }

    // 验证 nonce 时间戳（5分钟有效期）
    const nonce = callbackData["openid.response_nonce"];
    const nonceExpiresAt = this.validateNonce(nonce);

    // 验证签名
    const isValid = await this.verifySignature(callbackData);

    if (!isValid) {
      throw new Error("签名验证失败");
    }

    await this.markNonceUsed(nonce, nonceExpiresAt);

    // 从 claimed_id 或 identity 中提取用户ID
    const userId = this.extractUserId(callbackData["openid.claimed_id"]);

    // 获取用户信息
    const userInfo = await this.fetchUserInfo(userId);

    // 获取数据库中的用户数据,如果没有就新增
    let user = await this.userRepository.findOne({ where: { uid: userId } });
    if (!user) {
      const newUser = new User();
      newUser.uid = userId;
      newUser.name = userInfo.userName;
      newUser.nickname = userInfo.userNickname;
      newUser.avatar = userInfo.userAvatarURL;
      newUser.point = 0;
      newUser.card_count_n = 0;
      newUser.card_count_r = 0;
      newUser.card_count_sr = 0;
      newUser.card_count_ssr = 0;
      newUser.card_count_ur = 0;
      newUser.is_admin = false;
      await this.userRepository.save(newUser);
      user = newUser;
    } else {
      user.avatar = userInfo.userAvatarURL;
      user.name = userInfo.userName;
      user.nickname = userInfo.userNickname;
      await this.userRepository.save(user);
    }

    // 生成JWT token
    const token = this.jwtUtilsService.generateToken({ uid: user.uid });

    return {
      data: {
        user,
        token,
      },
      msg: "登录成功",
    };
  }

  /**
   * 获取用户信息
   */
  private async fetchUserInfo(userId: string): Promise<LoginData> {
    const response = await axios.get(
      `${this.OP_ENDPOINT}/api/user/getInfoById?userId=${userId}`,
    );
    const { data } = response;
    if (data && data.code == 0) {
      return data.data;
    } else {
      return {
        userName: "",
        userNickname: "",
        userAvatarURL: "",
      };
    }
  }

  /**
   * 验证签名
   */
  private async verifySignature(callbackData: any): Promise<boolean> {
    try {
      const verifyPayload = {
        "openid.ns": callbackData["openid.ns"],
        "openid.mode": "check_authentication",
        "openid.op_endpoint": callbackData["openid.op_endpoint"],
        "openid.return_to": callbackData["openid.return_to"],
        "openid.identity": callbackData["openid.identity"],
        "openid.claimed_id": callbackData["openid.claimed_id"],
        "openid.response_nonce": callbackData["openid.response_nonce"],
        "openid.assoc_handle": callbackData["openid.assoc_handle"],
        "openid.signed": callbackData["openid.signed"],
        "openid.sig": callbackData["openid.sig"],
      };

      const response = await axios.post(
        `${this.OP_ENDPOINT}/openid/verify`,
        verifyPayload,
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      this.logger.debug("签名验证响应:", response.data);

      // 解析响应（注意：响应是文本格式，不是 JSON）
      const lines = response.data.split("\n");
      const result: Record<string, string> = {};

      lines.forEach((line: string) => {
        const separatorIndex = line.indexOf(":");
        if (separatorIndex > -1) {
          const key = line.slice(0, separatorIndex);
          const value = line.slice(separatorIndex + 1);
          result[key.trim()] = value.trim();
        }
      });

      return result["is_valid"] === "true";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error("签名验证失败:", message);
      return false;
    }
  }

  private validateLoginUrlParams(params: { returnTo: string; realm: string }): {
    returnTo: string;
    realm: string;
  } {
    const returnToUrl = this.parseHttpUrl(params.returnTo, "returnTo");
    const realmUrl = this.parseHttpUrl(params.realm, "realm");
    const normalizedReturnTo = returnToUrl.toString();
    const normalizedRealm =
      realmUrl.pathname === "/" && !realmUrl.search && !realmUrl.hash
        ? realmUrl.origin
        : realmUrl.toString();

    if (process.env.NODE_ENV === "production") {
      if (returnToUrl.protocol !== "https:" || realmUrl.protocol !== "https:") {
        throw new Error("生产环境 OAuth 回调地址必须使用 HTTPS");
      }
    }

    const realmPrefix = normalizedRealm.endsWith("/")
      ? normalizedRealm
      : `${normalizedRealm}/`;
    if (
      normalizedReturnTo !== normalizedRealm &&
      !normalizedReturnTo.startsWith(realmPrefix)
    ) {
      throw new Error("realm 必须是 return_to 的前缀");
    }

    return {
      returnTo: normalizedReturnTo,
      realm: normalizedRealm,
    };
  }

  private parseHttpUrl(value: string, fieldName: string): URL {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error(`${fieldName} 必须是有效的 URL`);
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error(`${fieldName} 只支持 HTTP 或 HTTPS URL`);
    }

    return url;
  }

  /**
   * 验证 nonce（5分钟有效期）
   */
  private validateNonce(nonce: string): Date {
    // nonce 格式通常为：时间戳 + 随机字符串
    const match = nonce.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)/);

    if (!match) {
      throw new Error("登录信息无效");
    }

    const timestamp = new Date(match[1]).getTime();
    if (!Number.isFinite(timestamp)) {
      throw new Error("登录信息无效");
    }

    const now = Date.now();
    const expiresAt = new Date(timestamp + NONCE_VALID_MS);

    if (now > expiresAt.getTime()) {
      throw new Error("登录已失效");
    }

    return expiresAt;
  }

  private async markNonceUsed(nonce: string, expiresAt: Date): Promise<void> {
    await this.openIdNonceRepository.delete({
      expires_at: LessThan(new Date()),
    });

    try {
      await this.openIdNonceRepository.insert({
        nonce,
        expires_at: expiresAt,
      });
    } catch (error) {
      if (this.isDuplicateNonceError(error)) {
        throw new Error("登录已失效");
      }
      throw error;
    }
  }

  private isDuplicateNonceError(error: unknown): boolean {
    const value = error as {
      code?: string;
      errno?: number;
      message?: string;
      driverError?: {
        code?: string;
        errno?: number;
        message?: string;
      };
    };
    const driverError = value?.driverError || {};
    const message = `${value?.message || ""} ${driverError.message || ""}`;
    return (
      value?.code === "ER_DUP_ENTRY" ||
      value?.errno === 1062 ||
      driverError.code === "ER_DUP_ENTRY" ||
      driverError.errno === 1062 ||
      /duplicate|unique/i.test(message)
    );
  }

  /**
   * 从 claimed_id 中提取用户ID
   */
  private extractUserId(claimedId: string): string {
    // claimed_id 格式如：/openid/id/123456
    const match = claimedId.match(/\/openid\/id\/(\d+)/);
    if (!match) {
      throw new Error("无效的 claimed_id 格式");
    }
    return match[1];
  }
}
