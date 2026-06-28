import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

describe("PVE 200 关导入脚本", () => {
  const repoRoot = resolve(__dirname, "../../..");
  const scriptPath = resolve(repoRoot, "database/sql/pve_stages_200.sql");
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

    expect(sql).toContain("SELECT n + 1 FROM seq WHERE n < 200");
    expect(sql).toContain("CEIL(n / 10) AS chapter");
    expect(sql).toContain("((n - 1) % 10) + 1 AS stage_no");
    expect(sql).toContain("WHEN n = 200 THEN 'final'");
    expect(sql).toContain("WHEN n IN (60, 120, 180) THEN 'major'");
    expect(sql).toContain("WHEN stage_no = 10 THEN 'minor'");
    expect(sql).toContain("WHEN n = 200 THEN 'Yui'");
    expect(sql).toContain("WHEN n = 200 THEN 26000");
    expect(sql).toContain("WHERE `name` LIKE '星域远征 %'");
    expect(sql).toContain("WHERE `name` LIKE '星域远征 %' AND `delete_flag` = 0");
  });
});
