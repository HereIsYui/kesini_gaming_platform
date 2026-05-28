import { Injectable } from "@nestjs/common";
import { DataSource, EntityManager, In } from "typeorm";
import { calculateCultivationPower, getCultivationLevel } from "src/card/cultivation";
import { CardItem } from "src/entity/card.entity";
import { TradeListing } from "src/entity/tradeListing.entity";
import { UserCard } from "src/entity/userCard.entity";
import { UserFormationSlot } from "src/entity/userFormationSlot.entity";
import type { CardRarity } from "src/types/api";

const FORMATION_SLOT_COUNT = 3;
const RARITY_ORDER: CardRarity[] = ["N", "R", "SR", "SSR", "UR"];

export interface FormationSlotInput {
  position: number;
  cardUuid?: string | null;
}

@Injectable()
export class FormationService {
  constructor(private readonly dataSource: DataSource) {}

  async getFormation(uid: string) {
    return this.buildFormation(this.dataSource, uid);
  }

  async saveFormation(uid: string, slots: FormationSlotInput[]) {
    const normalizedSlots = this.normalizeSlots(slots);
    const cardUuids = normalizedSlots
      .map((slot) => slot.cardUuid)
      .filter((uuid): uuid is string => Boolean(uuid));
    if (new Set(cardUuids).size !== cardUuids.length) {
      throw new Error("同一张卡片不能重复上阵");
    }

    return this.dataSource.transaction(async (manager) => {
      if (cardUuids.length > 0) {
        await this.assertCardsCanJoinFormation(manager, uid, cardUuids);
      }

      const repository = manager.getRepository(UserFormationSlot);
      await repository.delete({ uid });
      const records = normalizedSlots
        .filter((slot) => slot.cardUuid)
        .map((slot) =>
          repository.create({
            uid,
            position: slot.position,
            card_uuid: slot.cardUuid!,
          }),
        );
      if (records.length > 0) {
        await repository.save(records);
      }
      return this.buildFormation(manager, uid);
    });
  }

  private async buildFormation(manager: DataSource | EntityManager, uid: string) {
    const slotRepository = manager.getRepository(UserFormationSlot);
    const slots = await slotRepository.find({
      where: { uid },
      order: { position: "ASC" },
    });
    const cardUuids = slots.map((slot) => slot.card_uuid).filter(Boolean);
    const userCards =
      cardUuids.length > 0
        ? await manager.getRepository(UserCard).find({
            where: { uid, card_uuid: In(cardUuids), delete_flag: false },
          })
        : [];
    const activeListings = await this.findActiveListings(manager, cardUuids);
    const activeListingSet = new Set(
      activeListings.map((listing) => listing.card_uuid),
    );
    const validUserCards = userCards.filter(
      (card) => !activeListingSet.has(card.card_uuid),
    );
    const cardIds = [
      ...new Set(validUserCards.map((userCard) => Number(userCard.card_id))),
    ].filter((cardId) => Number.isInteger(cardId) && cardId > 0);
    const cards =
      cardIds.length > 0
        ? await manager.getRepository(CardItem).find({ where: { id: In(cardIds) } })
        : [];
    const cardMap = new Map(cards.map((card) => [card.id, card]));
    const userCardMap = new Map(
      validUserCards.map((userCard) => [userCard.card_uuid, userCard]),
    );

    let totalPower = 0;
    const resultSlots = this.positions().map((position) => {
      const slot = slots.find((item) => item.position === position);
      const userCard = slot ? userCardMap.get(slot.card_uuid) : null;
      const card = userCard ? cardMap.get(Number(userCard.card_id)) : null;
      const view = userCard && card ? this.toFormationCard(userCard, card) : null;
      if (view) {
        totalPower += view.power;
      }
      return {
        position,
        card: view,
      };
    });

    return {
      slotCount: FORMATION_SLOT_COUNT,
      totalPower,
      slots: resultSlots,
    };
  }

  private async assertCardsCanJoinFormation(
    manager: EntityManager,
    uid: string,
    cardUuids: string[],
  ) {
    const userCards = await manager.getRepository(UserCard).find({
      where: { uid, card_uuid: In(cardUuids), delete_flag: false },
      lock: { mode: "pessimistic_write" },
    });
    if (userCards.length !== cardUuids.length) {
      throw new Error("阵容中包含无效卡片");
    }
    const activeListings = await this.findActiveListings(manager, cardUuids);
    if (activeListings.length > 0) {
      throw new Error("挂售中的卡片不能上阵");
    }
  }

  private toFormationCard(userCard: UserCard, card: CardItem) {
    const rarity = this.getEffectiveUserCardRarity(userCard, card);
    const level = getCultivationLevel(userCard);
    return {
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

  private normalizeSlots(slots: FormationSlotInput[]) {
    if (!Array.isArray(slots)) {
      throw new Error("阵容参数无效");
    }
    const positionSet = new Set<number>();
    const map = new Map<number, string | null>();
    slots.forEach((slot) => {
      const position = Number(slot?.position);
      if (!Number.isInteger(position) || !this.positions().includes(position)) {
        throw new Error("阵容位置无效");
      }
      if (positionSet.has(position)) {
        throw new Error("阵容位置重复");
      }
      positionSet.add(position);
      const cardUuid = String(slot?.cardUuid || "").trim();
      map.set(position, cardUuid || null);
    });
    return this.positions().map((position) => ({
      position,
      cardUuid: map.get(position) || null,
    }));
  }

  private async findActiveListings(
    manager: DataSource | EntityManager,
    cardUuids: string[],
  ) {
    const uniqueCardUuids = [...new Set(cardUuids.filter(Boolean))];
    if (uniqueCardUuids.length === 0) {
      return [];
    }
    return manager.getRepository(TradeListing).find({
      where: { card_uuid: In(uniqueCardUuids), status: "active" },
    });
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

  private positions() {
    return Array.from({ length: FORMATION_SLOT_COUNT }, (_, index) => index + 1);
  }
}
