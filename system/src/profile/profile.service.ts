import { Injectable, Optional } from "@nestjs/common";
import { DataSource, EntityManager, In } from "typeorm";
import {
  calculateCultivationPower,
  getCultivationLevel,
} from "src/card/cultivation";
import { CardItem } from "src/entity/card.entity";
import { User } from "src/entity/user.entity";
import { UserCard } from "src/entity/userCard.entity";
import { UserShowcaseCard } from "src/entity/userShowcaseCard.entity";
import { FormationService } from "src/formation/formation.service";
import { SocialActivityService } from "src/social/social-activity.service";
import type { CardRarity } from "src/types/api";
import {
  ensureUserPublicId,
  getUserPublicId,
} from "src/utils/user-public-id";

const SHOWCASE_LIMIT = 6;
const RARITY_ORDER: CardRarity[] = ["N", "R", "SR", "SSR", "UR"];

@Injectable()
export class ProfileService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly formationService: FormationService,
    @Optional()
    private readonly socialActivityService?: SocialActivityService,
  ) {}

  async getProfile(uid: string) {
    const normalizedUid = this.normalizeUid(uid);
    const user = await this.findUser(this.dataSource, normalizedUid);
    return this.getProfileForUser(user);
  }

  async getPublicProfile(profileId: string) {
    const normalizedProfileId = this.normalizeUid(profileId);
    const user = await this.findUserByPublicIdOrUid(
      this.dataSource,
      normalizedProfileId,
    );
    return this.getProfileForUser(user);
  }

  private async getProfileForUser(user: User) {
    await ensureUserPublicId(this.dataSource.getRepository(User), user);
    const normalizedUid = user.uid;
    const [formation, showcase] = await Promise.all([
      this.formationService.getFormation(normalizedUid).catch(() => ({
        slotCount: 3,
        totalPower: 0,
        slots: [],
      })),
      this.getShowcaseCards(this.dataSource, normalizedUid),
    ]);

    return {
      user: this.toPublicUser(user),
      formation: {
        slotCount: formation.slotCount || 3,
        filledCount: (formation.slots || []).filter((slot) => slot.card).length,
        totalPower: formation.totalPower || 0,
      },
      showcase,
    };
  }

  async saveShowcase(uid: string, cardUuids: string[]) {
    const normalizedUid = this.normalizeUid(uid);
    const normalizedCardUuids = this.normalizeCardUuids(cardUuids);

    await this.dataSource.transaction(async (manager) => {
      await this.findUser(manager, normalizedUid);
      if (normalizedCardUuids.length > 0) {
        await this.assertCardsBelongToUser(
          manager,
          normalizedUid,
          normalizedCardUuids,
        );
      }

      const repository = manager.getRepository(UserShowcaseCard);
      await repository.delete({ uid: normalizedUid });
      const records = normalizedCardUuids.map((cardUuid, index) =>
        repository.create({
          uid: normalizedUid,
          card_uuid: cardUuid,
          position: index + 1,
        }),
      );
      if (records.length > 0) {
        await repository.save(records);
      }
      await this.socialActivityService?.recordActivity(
        {
          actorUid: normalizedUid,
          type: "showcase_updated",
          title: normalizedCardUuids.length ? "更新展示墙" : "清空展示墙",
          summary: normalizedCardUuids.length
            ? `展示 ${normalizedCardUuids.length} 张`
            : "展示已清空",
          metadata: { count: normalizedCardUuids.length },
        },
        manager,
      );
    });

    return this.getProfile(normalizedUid);
  }

  private normalizeUid(uid: string) {
    const value = String(uid || "").trim();
    if (!value) {
      throw new Error("玩家不存在");
    }
    return value;
  }

  private normalizeCardUuids(cardUuids: string[]) {
    if (!Array.isArray(cardUuids)) {
      throw new Error("展示卡片无效");
    }
    const normalized = cardUuids
      .map((uuid) => String(uuid || "").trim())
      .filter(Boolean);
    if (normalized.length > SHOWCASE_LIMIT) {
      throw new Error(`最多展示 ${SHOWCASE_LIMIT} 张卡片`);
    }
    if (new Set(normalized).size !== normalized.length) {
      throw new Error("展示卡片不能重复");
    }
    return normalized;
  }

  private async findUser(manager: DataSource | EntityManager, uid: string) {
    const user = await manager.getRepository(User).findOne({ where: { uid } });
    if (!user) {
      throw new Error("玩家不存在");
    }
    return user;
  }

  private async findUserByPublicIdOrUid(
    manager: DataSource | EntityManager,
    profileId: string,
  ) {
    const repository = manager.getRepository(User);
    const user =
      (await repository.findOne({ where: { public_id: profileId } })) ||
      (await repository.findOne({ where: { uid: profileId } }));
    if (!user) {
      throw new Error("玩家不存在");
    }
    return user;
  }

  private async assertCardsBelongToUser(
    manager: EntityManager,
    uid: string,
    cardUuids: string[],
  ) {
    const cards = await manager.getRepository(UserCard).find({
      where: {
        uid,
        card_uuid: In(cardUuids),
        delete_flag: false,
      },
      lock: { mode: "pessimistic_read" },
    });
    if (cards.length !== cardUuids.length) {
      throw new Error("展示墙包含无效卡片");
    }
  }

  private async getShowcaseCards(
    manager: DataSource | EntityManager,
    uid: string,
  ) {
    const showcaseRecords = await manager.getRepository(UserShowcaseCard).find({
      where: { uid },
      order: { position: "ASC" },
    });
    const cardUuids = showcaseRecords
      .map((record) => record.card_uuid)
      .filter(Boolean);
    if (cardUuids.length === 0) {
      return [];
    }

    const userCards = await manager.getRepository(UserCard).find({
      where: { uid, card_uuid: In(cardUuids), delete_flag: false },
    });
    const cardIds = [
      ...new Set(userCards.map((userCard) => Number(userCard.card_id))),
    ].filter((cardId) => Number.isInteger(cardId) && cardId > 0);
    const cards =
      cardIds.length > 0
        ? await manager.getRepository(CardItem).find({ where: { id: In(cardIds) } })
        : [];
    const userCardMap = new Map(
      userCards.map((userCard) => [userCard.card_uuid, userCard]),
    );
    const cardMap = new Map(cards.map((card) => [card.id, card]));

    return showcaseRecords
      .map((record) => {
        const userCard = userCardMap.get(record.card_uuid);
        const card = userCard ? cardMap.get(Number(userCard.card_id)) : null;
        if (!userCard || !card) {
          return null;
        }
        return this.toShowcaseCard(record, userCard, card);
      })
      .filter((item) => item !== null);
  }

  private toPublicUser(user: User) {
    const cardCounts = {
      N: Number(user.card_count_n || 0),
      R: Number(user.card_count_r || 0),
      SR: Number(user.card_count_sr || 0),
      SSR: Number(user.card_count_ssr || 0),
      UR: Number(user.card_count_ur || 0),
    };
    return {
      uid: user.uid,
      publicId: getUserPublicId(user),
      nickname: user.nickname || user.name || "玩家",
      avatar: user.avatar || "",
      cardCounts,
      totalCards: Object.values(cardCounts).reduce((sum, count) => sum + count, 0),
      createdAt: user.createdAt || null,
    };
  }

  private toShowcaseCard(
    showcase: UserShowcaseCard,
    userCard: UserCard,
    card: CardItem,
  ) {
    const rarity = this.getEffectiveUserCardRarity(userCard, card);
    const level = getCultivationLevel(userCard);
    return {
      position: showcase.position,
      uuid: userCard.card_uuid,
      cardId: Number(userCard.card_id),
      cardName: card.card_name,
      cardDesc: card.card_desc,
      cardImage: card.card_image || "",
      cardLevel: rarity,
      cardType: card.card_type,
      poolId: card.pool,
      cultivationLevel: level,
      power: calculateCultivationPower(rarity, level),
      locked: userCard.locked === true,
      obtainedAt: userCard.createdAt,
    };
  }

  private getEffectiveUserCardRarity(userCard: UserCard, card: CardItem) {
    const rarity = userCard.card_level || this.getHighestRarity(card.card_level);
    return this.normalizeRarity(rarity);
  }

  private getHighestRarity(cardLevel: string): CardRarity {
    const levels = String(cardLevel || "")
      .split(",")
      .map((item) => item.trim().toUpperCase())
      .filter((item): item is CardRarity =>
        RARITY_ORDER.includes(item as CardRarity),
      );
    if (levels.length === 0) {
      throw new Error("未知的卡片等级");
    }
    return levels.sort(
      (left, right) => RARITY_ORDER.indexOf(right) - RARITY_ORDER.indexOf(left),
    )[0];
  }

  private normalizeRarity(rarity: string): CardRarity {
    const normalized = String(rarity || "").trim().toUpperCase();
    if (!RARITY_ORDER.includes(normalized as CardRarity)) {
      throw new Error("稀有度参数无效");
    }
    return normalized as CardRarity;
  }
}
