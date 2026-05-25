import {
  DEFAULT_SITE_CONFIG,
  SiteConfigService,
} from "./site-config.service";

function createRepository(initialRows: Array<Record<string, any>> = []) {
  const rows = [...initialRows];
  return {
    rows,
    find: jest.fn(async () => rows),
    findOne: jest.fn(async ({ where }: { where: { key: string } }) =>
      rows.find((row) => row.key === where.key) || null,
    ),
    create: jest.fn((value) => value),
    save: jest.fn(async (row) => {
      const index = rows.findIndex((item) => item.key === row.key);
      if (index >= 0) {
        rows[index] = row;
      } else {
        rows.push(row);
      }
      return row;
    }),
  };
}

describe("SiteConfigService", () => {
  it("没有配置时返回默认站点标题", async () => {
    const repository = createRepository();
    const service = new SiteConfigService(repository as any);

    await expect(service.getSiteConfig()).resolves.toEqual(DEFAULT_SITE_CONFIG);
  });

  it("保存站点标题时会裁剪空白并持久化", async () => {
    const repository = createRepository();
    const service = new SiteConfigService(repository as any);

    await expect(
      service.updateSiteConfig({
        websiteTitle: "  鱼排人物抽卡站  ",
        adminTitle: "  运营后台  ",
      }),
    ).resolves.toEqual({
      websiteTitle: "鱼排人物抽卡站",
      adminTitle: "运营后台",
    });
    expect(repository.save).toHaveBeenCalledTimes(2);
  });

  it("空标题会回退默认值", async () => {
    const repository = createRepository();
    const service = new SiteConfigService(repository as any);

    await expect(
      service.updateSiteConfig({ websiteTitle: "", adminTitle: "" }),
    ).resolves.toEqual(DEFAULT_SITE_CONFIG);
  });
});
