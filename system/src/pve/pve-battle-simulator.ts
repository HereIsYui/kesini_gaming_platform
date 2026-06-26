import { normalizeBattleRole, type BattleRole } from "src/card/cultivation";

export type PveTrait =
  | "high_attack"
  | "thick_hp"
  | "dodge"
  | "shield"
  | "berserk"
  | "lockdown";

export type PveBossType = "none" | "minor" | "major" | "final";

export interface PveBattleCard {
  uuid?: string;
  cardId?: number;
  cardName?: string;
  cardLevel?: string;
  battleRole?: BattleRole | string;
  power?: number;
  basePower?: number;
  potentialPower?: number;
  potentialGrade?: string;
}

export interface PveBattleConfig {
  traits?: string[];
  enemyHp?: number;
  enemyAttack?: number;
  roundLimit?: number;
  boss?: boolean;
}

export interface PveBattleEvent {
  round: number;
  type: "player_attack" | "enemy_attack" | "support_heal";
  value: number;
}

export interface PveBattleReport {
  roundLimit: number;
  rounds: number;
  playerMaxHp: number;
  playerHp: number;
  enemyMaxHp: number;
  enemyHp: number;
  events: PveBattleEvent[];
}

export interface PveBattleResult {
  success: boolean;
  stars: number;
  report: PveBattleReport;
  formationSnapshot: {
    totalPower: number;
    attackPower: number;
    guardPower: number;
    supportPower: number;
    controlPower: number;
    cards: PveBattleCard[];
  };
}

export const PVE_TRAIT_LABELS: Record<PveTrait, string> = {
  high_attack: "高攻",
  thick_hp: "厚血",
  dodge: "闪避",
  shield: "护盾",
  berserk: "狂暴",
  lockdown: "封锁",
};

const PVE_TRAITS = Object.keys(PVE_TRAIT_LABELS) as PveTrait[];

export class PveBattleSimulator {
  simulate(input: {
    cards: PveBattleCard[];
    enemyPower: number;
    battleConfig?: PveBattleConfig | null;
  }): PveBattleResult {
    const enemyPower = Math.max(1, Math.floor(Number(input.enemyPower || 1)));
    const cards = (input.cards || []).filter(
      (card) => Number(card.power || 0) > 0,
    );
    const formationSnapshot = this.buildFormationSnapshot(cards, enemyPower);
    const traits = normalizePveTraits(input.battleConfig?.traits);
    const roundLimit = this.normalizeRoundLimit(input.battleConfig?.roundLimit);
    const playerMaxHp = Math.max(
      1,
      Math.round(
        formationSnapshot.totalPower * 1.6 + formationSnapshot.guardPower * 1.2,
      ),
    );
    const playerAttack = Math.max(
      1,
      Math.round(
        formationSnapshot.attackPower + formationSnapshot.totalPower * 0.22,
      ),
    );
    const roundHeal = Math.max(
      0,
      Math.round(formationSnapshot.supportPower * 0.18),
    );
    const enemyMaxHp = this.buildEnemyHp(
      enemyPower,
      input.battleConfig,
      traits,
    );
    const enemyBaseAttack = this.buildEnemyAttack(
      enemyPower,
      input.battleConfig,
      traits,
    );
    const enemyDamageReduce = Math.min(
      0.22,
      (formationSnapshot.controlPower / enemyPower) * 0.08,
    );
    const dodgePenalty =
      traits.includes("dodge") &&
      formationSnapshot.controlPower < enemyPower * 0.25
        ? 0.15
        : 0;
    const healMultiplier = traits.includes("lockdown") ? 0.6 : 1;
    let playerHp = playerMaxHp;
    let enemyHp = enemyMaxHp;
    let rounds = 0;
    const events: PveBattleEvent[] = [];

    for (let round = 1; round <= roundLimit; round += 1) {
      rounds = round;
      const shieldPenalty = traits.includes("shield") && round <= 2 ? 0.3 : 0;
      const playerDamage = Math.max(
        1,
        Math.round(playerAttack * (1 - dodgePenalty) * (1 - shieldPenalty)),
      );
      enemyHp = Math.max(0, enemyHp - playerDamage);
      events.push({ round, type: "player_attack", value: playerDamage });
      if (enemyHp <= 0) {
        break;
      }

      const berserkMultiplier =
        traits.includes("berserk") && round >= 4 ? 1 + (round - 3) * 0.12 : 1;
      const enemyDamage = Math.max(
        1,
        Math.round(
          enemyBaseAttack * berserkMultiplier * (1 - enemyDamageReduce),
        ),
      );
      playerHp = Math.max(0, playerHp - enemyDamage);
      events.push({ round, type: "enemy_attack", value: enemyDamage });
      if (playerHp <= 0) {
        break;
      }

      const heal = Math.max(0, Math.round(roundHeal * healMultiplier));
      if (heal > 0 && playerHp < playerMaxHp) {
        const appliedHeal = Math.min(heal, playerMaxHp - playerHp);
        playerHp += appliedHeal;
        events.push({ round, type: "support_heal", value: appliedHeal });
      }
    }

    const success =
      enemyHp <= 0 ||
      (playerHp > 0 &&
        rounds >= roundLimit &&
        playerHp / playerMaxHp > enemyHp / enemyMaxHp);
    const stars = this.calculateStars(success, playerHp, playerMaxHp, rounds);
    return {
      success,
      stars,
      report: {
        roundLimit,
        rounds,
        playerMaxHp,
        playerHp: Math.max(0, Math.round(playerHp)),
        enemyMaxHp,
        enemyHp: Math.max(0, Math.round(enemyHp)),
        events,
      },
      formationSnapshot,
    };
  }

  private buildFormationSnapshot(cards: PveBattleCard[], enemyPower: number) {
    const snapshot = {
      totalPower: 0,
      attackPower: 0,
      guardPower: 0,
      supportPower: 0,
      controlPower: 0,
      cards: cards.map((card) => ({
        ...card,
        battleRole: normalizeBattleRole(card.battleRole),
        power: Math.max(0, Math.round(Number(card.power || 0))),
      })),
    };
    snapshot.cards.forEach((card) => {
      const power = Math.max(0, Math.round(Number(card.power || 0)));
      snapshot.totalPower += power;
      const role = normalizeBattleRole(card.battleRole);
      if (role === "attack") {
        snapshot.attackPower += power;
      } else {
        snapshot.attackPower += power * 0.2;
      }
      if (role === "guard") {
        snapshot.guardPower += power;
      }
      if (role === "support") {
        snapshot.supportPower += power;
      }
      if (role === "control") {
        snapshot.controlPower += power;
      }
    });
    if (snapshot.totalPower <= 0) {
      snapshot.attackPower = Math.max(1, enemyPower * 0.1);
    }
    snapshot.attackPower = Math.round(snapshot.attackPower);
    snapshot.guardPower = Math.round(snapshot.guardPower);
    snapshot.supportPower = Math.round(snapshot.supportPower);
    snapshot.controlPower = Math.round(snapshot.controlPower);
    return snapshot;
  }

  private buildEnemyHp(
    enemyPower: number,
    config: PveBattleConfig | null | undefined,
    traits: PveTrait[],
  ) {
    const base =
      Number(config?.enemyHp || 0) > 0
        ? Number(config?.enemyHp)
        : enemyPower * 1.7;
    return Math.max(
      1,
      Math.round(base * (traits.includes("thick_hp") ? 1.3 : 1)),
    );
  }

  private buildEnemyAttack(
    enemyPower: number,
    config: PveBattleConfig | null | undefined,
    traits: PveTrait[],
  ) {
    const base =
      Number(config?.enemyAttack || 0) > 0
        ? Number(config?.enemyAttack)
        : enemyPower * 0.34;
    return Math.max(
      1,
      Math.round(base * (traits.includes("high_attack") ? 1.25 : 1)),
    );
  }

  private normalizeRoundLimit(value: unknown) {
    const limit = Number(value || 8);
    return Number.isInteger(limit) && limit > 0 ? Math.min(12, limit) : 8;
  }

  private calculateStars(
    success: boolean,
    playerHp: number,
    playerMaxHp: number,
    rounds: number,
  ) {
    if (!success) {
      return 0;
    }
    let stars = 1;
    if (playerHp / playerMaxHp >= 0.4) {
      stars += 1;
    }
    if (rounds <= 6) {
      stars += 1;
    }
    return stars;
  }
}

export function normalizePveTraits(value: unknown): PveTrait[] {
  const values = Array.isArray(value) ? value : [];
  return [...new Set(values.map((item) => String(item || "").trim()))].filter(
    (item): item is PveTrait => PVE_TRAITS.includes(item as PveTrait),
  );
}

export function pveTraitLabels(traits: unknown) {
  return normalizePveTraits(traits).map((trait) => PVE_TRAIT_LABELS[trait]);
}
