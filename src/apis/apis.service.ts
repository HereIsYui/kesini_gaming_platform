import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import axios from "axios";
import { User } from "src/entity/user.entity";
import { LoginData } from "src/types/api";
import { Repository } from "typeorm";
import { JwtUtilsService } from "src/utils/jwt";

@Injectable()
export class ApisService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly jwtUtilsService: JwtUtilsService,
  ) {}

  private logger = new Logger(ApisService.name);
  private readonly OP_ENDPOINT = "https://fishpi.cn";
  login(data: any) {
    return this.handleCallback(data);
  }

  /**
   * 生成 OpenID 登录链接
   */
  generateLoginUrl(params: { returnTo: string; realm: string }) {
    const baseParams = {
      "openid.ns": "http://specs.openid.net/auth/2.0",
      "openid.mode": "checkid_setup",
      "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
      "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
    };

    // 验证 realm 是 return_to 的前缀
    if (!params.returnTo.startsWith(params.realm)) {
      throw new Error("realm 必须是 return_to 的前缀");
    }

    const queryParams = new URLSearchParams({
      ...baseParams,
      "openid.return_to": params.returnTo,
      "openid.realm": params.realm,
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
    await this.validateNonce(callbackData["openid.response_nonce"]);

    // 验证签名
    const isValid = await this.verifySignature(callbackData);

    if (!isValid) {
      throw new Error("签名验证失败");
    }

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
        const [key, value] = line.split(":");
        if (key && value) {
          result[key.trim()] = value.trim();
        }
      });

      return result["is_valid"] === "true";
    } catch (error) {
      this.logger.error("签名验证失败:", error.message);
      return false;
    }
  }

  /**
   * 验证 nonce（5分钟有效期）
   */
  private async validateNonce(nonce: string): Promise<void> {
    // nonce 格式通常为：时间戳 + 随机字符串
    const match = nonce.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)/);

    if (!match) {
      throw new Error("无效的 nonce 格式");
    }

    const timestamp = new Date(match[1]).getTime();
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000; // 5分钟（毫秒）

    if (now - timestamp > fiveMinutes) {
      throw new Error("nonce 已过期");
    }

    // TODO: 可在此处添加 nonce 重复使用检查
    // 可以将使用过的 nonce 存储在缓存中，防止重放攻击
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
