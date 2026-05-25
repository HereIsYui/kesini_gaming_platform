import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SystemConfig } from "src/entity/systemConfig.entity";

export interface SiteConfigView {
  websiteTitle: string;
  adminTitle: string;
}

export const DEFAULT_SITE_CONFIG: SiteConfigView = {
  websiteTitle: "Kesini 抽卡站",
  adminTitle: "Kesini 后台管理",
};

const SITE_CONFIG_META: Record<keyof SiteConfigView, string> = {
  websiteTitle: "玩家站页面标题和品牌标题",
  adminTitle: "后台管理页面标题和品牌标题",
};

@Injectable()
export class SiteConfigService {
  constructor(
    @InjectRepository(SystemConfig)
    private readonly systemConfigRepository: Repository<SystemConfig>,
  ) {}

  async getSiteConfig(): Promise<SiteConfigView> {
    const rows = await this.systemConfigRepository.find({
      where: Object.keys(DEFAULT_SITE_CONFIG).map((key) => ({ key })),
    });
    const valueMap = new Map(rows.map((row) => [row.key, row.value]));
    return {
      websiteTitle: this.normalizeTitle(
        valueMap.get("websiteTitle"),
        DEFAULT_SITE_CONFIG.websiteTitle,
      ),
      adminTitle: this.normalizeTitle(
        valueMap.get("adminTitle"),
        DEFAULT_SITE_CONFIG.adminTitle,
      ),
    };
  }

  async updateSiteConfig(input: Partial<SiteConfigView>): Promise<SiteConfigView> {
    const next: SiteConfigView = {
      websiteTitle: this.normalizeTitle(
        input.websiteTitle,
        DEFAULT_SITE_CONFIG.websiteTitle,
      ),
      adminTitle: this.normalizeTitle(
        input.adminTitle,
        DEFAULT_SITE_CONFIG.adminTitle,
      ),
    };

    for (const key of Object.keys(next) as Array<keyof SiteConfigView>) {
      await this.saveValue(key, next[key], SITE_CONFIG_META[key]);
    }

    return this.getSiteConfig();
  }

  private normalizeTitle(value: unknown, fallback: string) {
    const title = String(value ?? "").trim();
    if (!title) {
      return fallback;
    }
    if (title.length > 80) {
      throw new Error("站点标题不能超过 80 个字符");
    }
    return title;
  }

  private async saveValue(key: keyof SiteConfigView, value: string, description: string) {
    let row = await this.systemConfigRepository.findOne({ where: { key } });
    if (!row) {
      row = this.systemConfigRepository.create({ key, value, description });
    } else {
      row.value = value;
      row.description = description;
    }
    await this.systemConfigRepository.save(row);
  }
}
