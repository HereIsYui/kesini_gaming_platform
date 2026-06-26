import { Injectable, Optional } from "@nestjs/common";
import { randomInt, randomUUID } from "crypto";
import { EntityManager, In, Repository } from "typeorm";
import { CardItem } from "src/entity/card.entity";
import { DropItem } from "src/entity/drop.entity";
import { UserInventory } from "src/entity/inventory.entity";
import {
  RedeemRewards,
  RedeemRewardCard,
  RedeemRewardItem,
} from "src/entity/redeemCode.entity";
import { User } from "src/entity/user.entity";
import { UserCard } from "src/entity/userCard.entity";
import { getPotentialGrade, getPotentialRange } from "src/card/cultivation";
import {
  PointLedgerContext,
  PointLedgerService,
} from "src/point-ledger/point-ledger.service";

@Injectable()
export class RewardService {
  constructor(
    @Optional()
    private readonly pointLedgerService?: PointLedgerService,
  ) {}

  normalizeRewards(
    rewards: unknown,
    emptyMessage = "奖励不能为空",
  ): RedeemRewards {
    const value = (rewards || {}) as Partial<RedeemRewards>;
    const points = Number(value.points || 0);
    if (!Number.isInteger(points) || points < 0) {
      throw new Error("奖励星穹币必须为非负整数");
    }

    const items = Array.isArray(value.items) ? value.items : [];
    const normalizedItems = items
      .map((item) => ({
        itemId: Number(item.itemId),
        num: Number(item.num),
      }))
      .filter((item) => item.itemId > 0 || item.num > 0);

    normalizedItems.forEach((item) => {
      if (!Number.isInteger(item.itemId) || item.itemId <= 0) {
        throw new Error("奖励物品ID无效");
      }
      if (!Number.isInteger(item.num) || item.num <= 0) {
        throw new Error("奖励物品数量无效");
      }
    });

    const cards = Array.isArray(value.cards) ? value.cards : [];
    const normalizedCards = cards
      .map((card) => ({
        cardId: Number(card.cardId),
        rarity: String(card.rarity || "")
          .trim()
          .toUpperCase(),
        num: Number(card.num),
      }))
      .filter((card) => card.cardId > 0 || card.num > 0 || card.rarity);

    normalizedCards.forEach((card) => {
      if (!Number.isInteger(card.cardId) || card.cardId <= 0) {
        throw new Error("奖励卡片ID无效");
      }
      if (!this.isRarity(card.rarity)) {
        throw new Error("奖励卡片稀有度无效");
      }
      if (!Number.isInteger(card.num) || card.num <= 0) {
        throw new Error("奖励卡片数量无效");
      }
    });

    if (
      points === 0 &&
      normalizedItems.length === 0 &&
      normalizedCards.length === 0
    ) {
      throw new Error(emptyMessage);
    }

    return {
      points,
      items: normalizedItems,
      ...(normalizedCards.length > 0 ? { cards: normalizedCards } : {}),
    };
  }

  async assertRewardItemsAvailable(
    dropRepository: Repository<DropItem>,
    items: RedeemRewardItem[],
  ) {
    for (const item of items) {
      const dropItem = await dropRepository.findOne({
        where: { id: item.itemId },
      });
      if (!dropItem) {
        throw new Error(`奖励物品不存在: ${item.itemId}`);
      }
      if (dropItem.disabled) {
        throw new Error(`奖励物品已禁用: ${dropItem.drop_name}`);
      }
    }
  }

  async assertRewardCardsAvailable(
    cardRepository: Repository<CardItem>,
    cards: RedeemRewardCard[] = [],
  ) {
    const cardIds = [
      ...new Set(cards.map((card) => Number(card.cardId))),
    ].filter((cardId) => Number.isInteger(cardId) && cardId > 0);
    if (cardIds.length === 0) {
      return;
    }
    const cardItems = await cardRepository.find({ where: { id: In(cardIds) } });
    const cardMap = new Map(cardItems.map((card) => [card.id, card]));
    cards.forEach((rewardCard) => {
      const card = cardMap.get(Number(rewardCard.cardId));
      if (!card) {
        throw new Error(`奖励卡片不存在: ${rewardCard.cardId}`);
      }
      if (!this.cardSupportsRarity(card, rewardCard.rarity)) {
        throw new Error(`奖励卡片稀有度无效: ${card.card_name}`);
      }
    });
  }

  async grantRewards(
    manager: EntityManager,
    user: User,
    rewards: RedeemRewards,
    pointContext?: PointLedgerContext,
  ) {
    const userRepository = manager.getRepository(User);
    const inventoryRepository = manager.getRepository(UserInventory);

    if (rewards.points > 0) {
      if (this.pointLedgerService && pointContext) {
        await this.pointLedgerService.applyChange(
          manager,
          user,
          rewards.points,
          pointContext,
        );
      } else {
        user.point = (user.point || 0) + rewards.points;
        await userRepository.save(user);
      }
    }

    for (const item of rewards.items) {
      await this.grantInventoryItem(inventoryRepository, user, item);
    }
    await this.grantRewardCards(manager, user, rewards.cards || []);
  }

  private async grantInventoryItem(
    inventoryRepository: Repository<UserInventory>,
    user: User,
    item: RedeemRewardItem,
  ) {
    if (!user.id) {
      throw new Error("用户记录缺少ID，无法发放物品");
    }

    let inventory = await inventoryRepository.findOne({
      where: { user_id: user.id, item_id: item.itemId },
      lock: { mode: "pessimistic_write" },
    });
    if (!inventory) {
      inventory = inventoryRepository.create({
        user_id: user.id,
        item_id: item.itemId,
        num: item.num,
      });
    } else {
      inventory.num += item.num;
    }
    await inventoryRepository.save(inventory);
  }

  private async grantRewardCards(
    manager: EntityManager,
    user: User,
    cards: RedeemRewardCard[],
  ) {
    if (!cards.length) {
      return;
    }
    await this.assertRewardCardsAvailable(
      manager.getRepository(CardItem),
      cards,
    );
    const userCardRepository = manager.getRepository(UserCard);
    const userRepository = manager.getRepository(User);
    const userCards: UserCard[] = [];
    const rarityCounts: Record<string, number> = {};

    cards.forEach((rewardCard) => {
      const count = Number(rewardCard.num || 0);
      for (let index = 0; index < count; index += 1) {
        const potential = this.rollPotential(rewardCard.rarity);
        userCards.push(
          userCardRepository.create({
            uid: user.uid,
            card_id: String(rewardCard.cardId),
            card_level: rewardCard.rarity,
            can_sell: true,
            can_lottery: true,
            card_uuid: randomUUID(),
            delete_flag: false,
            potential_bp: potential.potentialBp,
            potential_grade: potential.potentialGrade,
          }),
        );
      }
      rarityCounts[rewardCard.rarity] =
        (rarityCounts[rewardCard.rarity] || 0) + count;
    });

    if (userCards.length > 0) {
      await userCardRepository.save(userCards);
    }
    this.applyUserRarityCounts(user, rarityCounts);
    await userRepository.save(user);
  }

  private applyUserRarityCounts(user: User, counts: Record<string, number>) {
    user.card_count_n = (user.card_count_n || 0) + (counts.N || 0);
    user.card_count_r = (user.card_count_r || 0) + (counts.R || 0);
    user.card_count_sr = (user.card_count_sr || 0) + (counts.SR || 0);
    user.card_count_ssr = (user.card_count_ssr || 0) + (counts.SSR || 0);
    user.card_count_ur = (user.card_count_ur || 0) + (counts.UR || 0);
  }

  private cardSupportsRarity(card: CardItem, rarity: string) {
    return String(card.card_level || "")
      .split(",")
      .map((item) => item.trim().toUpperCase())
      .includes(
        String(rarity || "")
          .trim()
          .toUpperCase(),
      );
  }

  private isRarity(value: string) {
    return ["N", "R", "SR", "SSR", "UR"].includes(value);
  }

  private rollPotential(rarity: string) {
    const range = getPotentialRange(rarity);
    const potentialBp = randomInt(range.min, range.max + 1);
    return {
      potentialBp,
      potentialGrade: getPotentialGrade(potentialBp),
    };
  }
}
