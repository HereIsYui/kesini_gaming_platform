import {
  PveBattleSimulator,
  type PveBattleCard,
} from "../src/pve/pve-battle-simulator";

const BOSS_HP_BASE = 50000;
const BOSS_HP_PER_LEVEL = 20000;
const BOSS_ATTEMPTS = 3;
const CHEST_THRESHOLDS = [100, 300, 600];

type Scenario = {
  label: string;
  members: number;
  cardPower: number;
};

const scenarios: Scenario[] = [
  { label: "D1-1人", members: 1, cardPower: 500 },
  { label: "D1-3人", members: 3, cardPower: 500 },
  { label: "D1-10人", members: 10, cardPower: 500 },
  { label: "D3-1人", members: 1, cardPower: 1200 },
  { label: "D3-3人", members: 3, cardPower: 1200 },
  { label: "D3-10人", members: 10, cardPower: 1200 },
  { label: "D7-1人", members: 1, cardPower: 2400 },
  { label: "D7-3人", members: 3, cardPower: 2400 },
  { label: "D7-10人", members: 10, cardPower: 2400 },
];

function createCards(power: number): PveBattleCard[] {
  return [
    {
      cardName: "attack",
      battleRole: "attack",
      power,
      basePower: power,
      potentialPower: 0,
    },
    {
      cardName: "guard",
      battleRole: "guard",
      power,
      basePower: power,
      potentialPower: 0,
    },
    {
      cardName: "support",
      battleRole: "support",
      power,
      basePower: power,
      potentialPower: 0,
    },
  ];
}

function runScenario(scenario: Scenario) {
  const simulator = new PveBattleSimulator();
  const bossLevel = 1;
  const maxHp = BOSS_HP_BASE + bossLevel * BOSS_HP_PER_LEVEL;
  let hp = maxHp;
  let totalDamage = 0;
  let attempts = 0;

  for (let member = 0; member < scenario.members; member += 1) {
    for (let attempt = 0; attempt < BOSS_ATTEMPTS; attempt += 1) {
      if (hp <= 0) {
        break;
      }
      const before = hp;
      const battle = simulator.simulate({
        cards: createCards(scenario.cardPower),
        enemyPower: Math.max(1000, bossLevel * 2400),
        battleConfig: {
          traits: [],
          enemyHp: hp,
          enemyAttack: 260 + bossLevel * 180,
          roundLimit: 8,
          boss: true,
        },
      });
      hp = Math.max(0, Math.round(battle.report.enemyHp));
      totalDamage += before - hp;
      attempts += 1;
    }
  }

  const activity = scenario.members * 10 + attempts * 20;
  return {
    label: scenario.label,
    members: scenario.members,
    cardPower: scenario.cardPower,
    attempts,
    maxHp,
    totalDamage,
    remainingHp: hp,
    defeated: hp <= 0,
    defeatedRate: hp <= 0 ? 1 : 0,
    activity,
    chests: CHEST_THRESHOLDS.filter((threshold) => activity >= threshold),
  };
}

console.log(JSON.stringify(scenarios.map(runScenario), null, 2));
