import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

describe("PVE 200 关导入脚本", () => {
  const repoRoot = resolve(__dirname, "../../..");
  const scriptPath = resolve(repoRoot, "database/sql/pve_stages_200.sql");
  const starCorePatchPath = resolve(
    repoRoot,
    "database/sql/pve_stage_star_core_reward_patch.sql",
  );
  const deprecatedScriptPath = resolve(
    repoRoot,
    "database/sql/deprecated/pve_stages_1000.deprecated.sql",
  );
  const oldScriptPath = resolve(repoRoot, "database/sql/pve_stages_1000.sql");

  it("只保留 200 关主线脚本并归档旧脚本", () => {
    expect(existsSync(scriptPath)).toBe(true);
    expect(existsSync(oldScriptPath)).toBe(false);
    expect(existsSync(deprecatedScriptPath)).toBe(true);
    expect(readFileSync(deprecatedScriptPath, "utf8")).toContain("废弃勿执行");
  });

  it("脚本包含章节数量和 Boss 规则", () => {
    const sql = readFileSync(scriptPath, "utf8");

    expect(sql).not.toContain("WITH RECURSIVE");
    expect(sql).toContain("CREATE TEMPORARY TABLE `_kesini_pve_stage_seq`");
    expect(sql).toContain(
      "WHERE ones.n + tens.n * 10 + hundreds.n * 100 + 1 <= 200",
    );
    expect(sql).toContain("CEIL(n / 10) AS chapter");
    expect(sql).toContain("((n - 1) % 10) + 1 AS stage_no");
    expect(sql).toContain("WHEN n = 200 THEN 'final'");
    expect(sql).toContain("WHEN n IN (60, 120, 180) THEN 'major'");
    expect(sql).toContain("WHEN stage_no = 10 THEN 'minor'");
    expect(sql).toContain("WHEN n = 200 THEN 'Yui'");
    expect(sql).toContain("WHEN n = 200 THEN 26000");
    expect(sql).not.toContain("星核结晶");
    expect(sql).not.toContain("SET @star_core_item_id");
    expect(sql).not.toContain("star_core_reward");
    expect(sql).toContain("WHERE `name` LIKE '星域远征 %'");
    expect(sql).toContain("WHERE `name` LIKE '星域远征 %' AND `delete_flag` = 0");
  });

  it("星核奖励使用原地更新脚本", () => {
    expect(existsSync(starCorePatchPath)).toBe(true);

    const sql = readFileSync(starCorePatchPath, "utf8");

    expect(sql).toContain("不重建 pve_stage，不改变关卡 id");
    expect(sql).toContain("CREATE TEMPORARY TABLE `_kesini_pve_star_core_targets`");
    expect(sql).toContain("UPDATE `pve_stage` AS s");
    expect(sql).toContain("((s.`chapter` - 1) * 10 + s.`stage_no`)");
    expect(sql).toContain("星核结晶");
    expect(sql).toContain("(60, 80)");
    expect(sql).toContain("(120, 100)");
    expect(sql).toContain("(180, 120)");
    expect(sql).toContain("(200, 150)");
  });
});
