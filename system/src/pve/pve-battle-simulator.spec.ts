import { PveBattleSimulator } from "./pve-battle-simulator";

describe("PveBattleSimulator", () => {
  const simulator = new PveBattleSimulator();

  it("控制阵容可以抵消闪避惩罚", () => {
    const withoutControl = simulator.simulate({
      enemyPower: 1000,
      battleConfig: {
        traits: ["dodge"],
        enemyHp: 30000,
        enemyAttack: 180,
        roundLimit: 8,
      },
      cards: [
        { cardName: "攻击", battleRole: "attack", power: 1000 },
        { cardName: "防护", battleRole: "guard", power: 1000 },
        { cardName: "支援", battleRole: "support", power: 1000 },
      ],
    });
    const withControl = simulator.simulate({
      enemyPower: 1000,
      battleConfig: {
        traits: ["dodge"],
        enemyHp: 30000,
        enemyAttack: 180,
        roundLimit: 8,
      },
      cards: [
        { cardName: "攻击", battleRole: "attack", power: 1000 },
        { cardName: "控制", battleRole: "control", power: 1000 },
        { cardName: "支援", battleRole: "support", power: 1000 },
      ],
    });

    expect(withControl.report.enemyHp).toBeLessThan(
      withoutControl.report.enemyHp,
    );
  });

  it("防护阵容在高攻关保留更多生命", () => {
    const noGuard = simulator.simulate({
      enemyPower: 1000,
      battleConfig: {
        traits: ["high_attack"],
        enemyHp: 2000,
        enemyAttack: 900,
        roundLimit: 8,
      },
      cards: [
        { cardName: "攻击", battleRole: "attack", power: 900 },
        { cardName: "攻击", battleRole: "attack", power: 900 },
        { cardName: "支援", battleRole: "support", power: 900 },
      ],
    });
    const withGuard = simulator.simulate({
      enemyPower: 1000,
      battleConfig: {
        traits: ["high_attack"],
        enemyHp: 2000,
        enemyAttack: 900,
        roundLimit: 8,
      },
      cards: [
        { cardName: "攻击", battleRole: "attack", power: 900 },
        { cardName: "防护", battleRole: "guard", power: 900 },
        { cardName: "支援", battleRole: "support", power: 900 },
      ],
    });

    expect(withGuard.report.playerHp).toBeGreaterThan(noGuard.report.playerHp);
  });
});
