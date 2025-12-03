import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import axios from "axios";
import { User } from "src/entity/user.entity";
import { CardItem } from "src/entity/card.entity";
import { DropItem } from "src/entity/drop.entity";
import { UserInventory } from "src/entity/inventory.entity";
import { UserCard } from "src/entity/user-card.entity";
import { LoginData } from "src/types/api";
import { Repository } from "typeorm";

@Injectable()
export class ApisService {

  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(CardItem) private readonly cardRepository: Repository<CardItem>,
    @InjectRepository(DropItem) private readonly dropRepository: Repository<DropItem>,
    @InjectRepository(UserInventory) private readonly inventoryRepository: Repository<UserInventory>,
    @InjectRepository(UserCard) private readonly userCardRepository: Repository<UserCard>,
  ) { }

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
      await this.userRepository.save(newUser);
      user = newUser;
    } else {
      user.avatar = userInfo.userAvatarURL;
      user.name = userInfo.userName;
      user.nickname = userInfo.userNickname;
    }


    return {
      data: user,
      msg: "登录成功",
    };
  }

  /**
   * 获取用户信息
   */
  private async fetchUserInfo(userId: string): Promise<LoginData> {
    const response = await axios.get(
      `${this.OP_ENDPOINT}/api/user/getInfoById?userId=${userId}`
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
        }
      );

      this.logger.debug("签名验证响应:", response.data);

      // 解析响应（注意：响应是文本格式，不是 JSON）
      const lines = response.data.split("\n");
      const result: Record<string, string> = {};

      lines.forEach((line) => {
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

  /**
   * 合成卡片
   */
  async synthesizeCard(userId: number, cardId: number) {
    // 检查卡片是否存在
    const card = await this.cardRepository.findOne({ where: { id: cardId } });
    if (!card) {
      throw new Error("卡片不存在");
    }

    // 检查是否为UR卡片
    if (card.card_level.includes('UR')) {
      throw new Error("不能合成UR卡片");
    }

    // 获取合成所需碎片数量
    const requiredFragments = this.getRequiredFragments(card.card_level);
    
    // 查找卡片碎片物品 (drop_type为0的DropItem)
    const fragmentItem = await this.dropRepository.findOne({ 
      where: { drop_type: 0 } 
    });
    
    if (!fragmentItem) {
      throw new Error("卡片碎片物品不存在");
    }

    // 检查用户背包中的碎片数量
    const userInventory = await this.inventoryRepository.findOne({
      where: { user_id: userId, item_id: fragmentItem.id }
    });

    const currentFragments = userInventory?.quantity || 0;
    
    if (currentFragments < requiredFragments) {
      throw new Error(`碎片不足，需要${requiredFragments}个碎片，当前拥有${currentFragments}个`);
    }

    // 扣除碎片
    if (userInventory) {
      userInventory.quantity -= requiredFragments;
      if (userInventory.quantity <= 0) {
        await this.inventoryRepository.remove(userInventory);
      } else {
        await this.inventoryRepository.save(userInventory);
      }
    }

    // 添加卡片到用户背包
    let userCard = await this.userCardRepository.findOne({
      where: { user_id: userId, card_id: cardId }
    });

    if (!userCard) {
      userCard = new UserCard();
      userCard.user_id = userId;
      userCard.card_id = cardId;
      userCard.quantity = 1;
      await this.userCardRepository.save(userCard);
    } else {
      userCard.quantity += 1;
      await this.userCardRepository.save(userCard);
    }

    return {
      data: {
        card_id: cardId,
        card_name: card.card_name,
        fragments_used: requiredFragments,
        total_cards: userCard.quantity
      },
      msg: "合成成功"
    };
  }

  /**
   * 分解卡片
   */
  async decomposeCard(userId: number, cardId: number) {
    // 检查卡片是否存在
    const card = await this.cardRepository.findOne({ where: { id: cardId } });
    if (!card) {
      throw new Error("卡片不存在");
    }

    // 检查是否为UR卡片
    if (card.card_level.includes('UR')) {
      throw new Error("UR卡片不可以分解");
    }

    // 获取分解可获得的碎片数量范围
    const fragmentRange = this.getDecomposeFragmentRange(card.card_level);
    
    // 随机生成碎片数量
    const fragmentCount = Math.floor(Math.random() * (fragmentRange.max - fragmentRange.min + 1)) + fragmentRange.min;

    // 查找卡片碎片物品
    const fragmentItem = await this.dropRepository.findOne({ 
      where: { drop_type: 0 } 
    });
    
    if (!fragmentItem) {
      throw new Error("卡片碎片物品不存在");
    }

    // 检查用户是否拥有这张卡片
    const userCard = await this.userCardRepository.findOne({
      where: { user_id: userId, card_id: cardId }
    });

    if (!userCard || userCard.quantity < 1) {
      throw new Error("用户没有这张卡片");
    }

    // 减少用户卡片数量
    userCard.quantity -= 1;
    if (userCard.quantity <= 0) {
      await this.userCardRepository.remove(userCard);
    } else {
      await this.userCardRepository.save(userCard);
    }

    // 添加碎片到用户背包
    let userInventory = await this.inventoryRepository.findOne({
      where: { user_id: userId, item_id: fragmentItem.id }
    });

    if (!userInventory) {
      userInventory = new UserInventory();
      userInventory.user_id = userId;
      userInventory.item_id = fragmentItem.id;
      userInventory.quantity = fragmentCount;
      await this.inventoryRepository.save(userInventory);
    } else {
      userInventory.quantity += fragmentCount;
      await this.inventoryRepository.save(userInventory);
    }

    return {
      data: {
        card_id: cardId,
        card_name: card.card_name,
        fragments_gained: fragmentCount
      },
      msg: "分解成功"
    };
  }

  /**
   * 根据卡片等级获取合成所需碎片数量
   */
  private getRequiredFragments(cardLevel: string): number {
    if (cardLevel.includes('N')) return 80;
    if (cardLevel.includes('R')) return 160;
    if (cardLevel.includes('SR')) return 320;
    if (cardLevel.includes('SSR')) return 1000;
    throw new Error("未知的卡片等级");
  }

  /**
   * 根据卡片等级获取分解碎片数量范围
   */
  private getDecomposeFragmentRange(cardLevel: string): { min: number; max: number } {
    if (cardLevel.includes('N')) return { min: 1, max: 10 };
    if (cardLevel.includes('R')) return { min: 10, max: 20 };
    if (cardLevel.includes('SR')) return { min: 20, max: 40 };
    if (cardLevel.includes('SSR')) return { min: 40, max: 80 };
    throw new Error("未知的卡片等级");
  }
}
