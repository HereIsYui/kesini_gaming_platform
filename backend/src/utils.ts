import {
  booleanOptions,
  poolTypeOptions,
  rarityOptions,
} from "./constants";
import type {
  ExchangeCostItem,
  FieldConfig,
  GachaPoolConfig,
  RedeemRewards,
  SelectOption,
} from "./types";

export type AnyRecord = Record<string, any>;

export interface GachaFormState extends GachaPoolConfig {
  poolId: number;
  enabled: boolean;
  rarityProbabilities: Record<string, number>;
  drawCosts: {
    once: number;
    ten: number;
  };
  upCards: {
    enabled: boolean;
    cardIds: number[];
    upRate: number;
  };
  pitySystem: {
    enabled: boolean;
    softPity: {
      count: number;
      guaranteedRarity: string;
    };
    hardPity: {
      count: number;
      guaranteedRarity: string;
    };
  };
}

export function getValue(row: AnyRecord, path: string) {
  return path.split(".").reduce((value, key) => value?.[key], row);
}

export function setValue(row: AnyRecord, key: string, value: unknown) {
  row[key] = value;
}

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null));
}

export function getFieldOptions(field: FieldConfig) {
  return field.type === "boolean"
    ? field.options || booleanOptions
    : field.options || [];
}

export function getOptionLabel(
  options: SelectOption[] | undefined,
  value: unknown,
  fallback = "-",
) {
  const matched = (options || []).find(
    (option) => String(option.value) === String(value),
  );
  return matched?.label || fallback;
}

export function formatFieldValue(field: FieldConfig, value: unknown) {
  const matched = getFieldOptions(field).find(
    (option) => String(option.value) === String(value),
  );
  if (matched) {
    return matched.label;
  }
  return formatValue(value);
}

export function formatValue(value: unknown): string {
  if (value === true) {
    return "是";
  }
  if (value === false) {
    return "否";
  }
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  if (Array.isArray(value)) {
    return value.length ? `${value.length} 项` : "-";
  }
  if (typeof value === "object") {
    if (isRewards(value)) {
      return formatRewards(value);
    }
    const record = value as AnyRecord;
    const name =
      record.name ||
      record.nickname ||
      record.uid ||
      record.card_name ||
      record.pool_name ||
      record.drop_name;
    return name ? String(name) : JSON.stringify(value);
  }
  if (typeof value === "string" && value.includes("T")) {
    return formatDate(value);
  }
  return String(value);
}

export function isRewards(value: unknown): value is RedeemRewards {
  const record = value as RedeemRewards | undefined;
  return Boolean(record && ("points" in record || "items" in record));
}

export function formatRewards(rewards: RedeemRewards | undefined) {
  if (!rewards) {
    return "-";
  }
  const parts: string[] = [];
  if (Number(rewards.points || 0) > 0) {
    parts.push(`星穹币 ${rewards.points}`);
  }
  const items = Array.isArray(rewards.items) ? rewards.items : [];
  if (items.length) {
    parts.push(
      items
        .map((item) => `${item.itemName || `物品#${item.itemId}`} x${item.num}`)
        .join("，"),
    );
  }
  const cards = Array.isArray(rewards.cards) ? rewards.cards : [];
  if (cards.length) {
    parts.push(
      cards
        .map(
          (card) =>
            `${card.cardName || `卡片#${card.cardId}`} ${card.rarity} x${card.num}`,
        )
        .join("，"),
    );
  }
  return parts.join("；") || "未配置";
}

export function formatCosts(costs: ExchangeCostItem[] | undefined) {
  const items = Array.isArray(costs) ? costs : [];
  if (!items.length) {
    return "未配置";
  }
  return items
    .map((item) => `${item.itemName || `物品#${item.itemId}`} x${item.num}`)
    .join("，");
}

export function formatDate(value: unknown) {
  if (!value) {
    return "-";
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString();
}

export function toDateTimeLocal(value: unknown) {
  if (!value) {
    return "";
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

export function fromDateTimeLocal(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export function formatPercent(value: unknown) {
  const number = Number(value || 0);
  return `${(number * 100).toFixed(number < 0.01 && number > 0 ? 2 : 1)}%`;
}

export function getProbabilityTotal(probabilities?: Record<string, number>) {
  return rarityOptions.reduce(
    (sum, option) => sum + Number(probabilities?.[String(option.value)] || 0),
    0,
  );
}

export function normalizeRarityProbabilities(
  probabilities: Record<string, number> = {},
) {
  return Object.fromEntries(
    rarityOptions.map((option) => {
      const rarity = String(option.value);
      return [rarity, Number(probabilities[rarity] || 0)];
    }),
  );
}

export function summarizeUpConfig(upCards?: GachaPoolConfig["upCards"]) {
  if (!upCards || upCards.enabled !== true) {
    return "未开启";
  }
  const cardCount = upCards.cardIds?.length || 0;
  return `已开启 · ${formatPercent(upCards.upRate || 0)} · ${
    cardCount ? `${cardCount} 张卡` : "未选卡"
  }`;
}

export function summarizePityConfig(pitySystem?: GachaPoolConfig["pitySystem"]) {
  if (!pitySystem || pitySystem.enabled === false) {
    return "未开启";
  }
  const soft = pitySystem.softPity
    ? `软 ${pitySystem.softPity.count || "-"} 抽保 ${
        pitySystem.softPity.guaranteedRarity || "-"
      }`
    : "软保底未配";
  const hard = pitySystem.hardPity
    ? `硬 ${pitySystem.hardPity.count || "-"} 抽保 ${
        pitySystem.hardPity.guaranteedRarity || "-"
      }`
    : "硬保底未配";
  return `${soft} / ${hard}`;
}

export function getGachaSourceText(config?: GachaPoolConfig) {
  if (!config) {
    return "-";
  }
  if (config.scope === "pool" && config.enabled !== false) {
    return "卡池配置";
  }
  if (config.scope === "global" && config.enabled !== false) {
    return "默认配置";
  }
  if (config.source === "database" && config.enabled !== false) {
    return "数据库配置";
  }
  return "代码兜底";
}

export function createGachaFormState(
  poolKey: string,
  config: GachaPoolConfig,
): GachaFormState {
  return {
    poolId: Number(config.poolId || poolKey),
    enabled: config.enabled !== false,
    rarityProbabilities: {
      N: Number(config.rarityProbabilities?.N ?? 0.5025),
      R: Number(config.rarityProbabilities?.R ?? 0.3025),
      SR: Number(config.rarityProbabilities?.SR ?? 0.15),
      SSR: Number(config.rarityProbabilities?.SSR ?? 0.045),
      UR: Number(config.rarityProbabilities?.UR ?? 0),
    },
    drawCosts: {
      once: Number(config.drawCosts?.once || 10),
      ten: Number(config.drawCosts?.ten || 100),
    },
    upCards: {
      enabled: config.upCards?.enabled === true,
      cardIds: config.upCards?.cardIds || [],
      upRate: Number(config.upCards?.upRate || 0),
    },
    pitySystem: {
      enabled: config.pitySystem?.enabled !== false,
      softPity: {
        count: Number(config.pitySystem?.softPity?.count || 10),
        guaranteedRarity: config.pitySystem?.softPity?.guaranteedRarity || "SR",
      },
      hardPity: {
        count: Number(config.pitySystem?.hardPity?.count || 90),
        guaranteedRarity:
          config.pitySystem?.hardPity?.guaranteedRarity || "SSR",
      },
    },
  };
}

export function getPoolGachaModalConfig(
  poolId: number,
  detail: {
    effective: GachaPoolConfig;
    individualConfig?: GachaPoolConfig | null;
    hasIndividualConfig?: boolean;
  },
): GachaPoolConfig {
  if (detail.hasIndividualConfig && detail.individualConfig) {
    return {
      ...detail.individualConfig,
      enabled: true,
      poolId,
    };
  }
  return {
    ...detail.effective,
    enabled: false,
    poolId,
  };
}

export function getPoolTypeLabel(value: unknown) {
  return getOptionLabel(poolTypeOptions, value, `类型 ${String(value ?? "-")}`);
}

export function getPoolTypeTagType(value: unknown) {
  const map: Record<string, "primary" | "success" | "warning" | "info"> = {
    "0": "primary",
    "1": "warning",
    "2": "success",
    "3": "info",
  };
  return map[String(value)] || "info";
}

export function parseFormJson(value: unknown) {
  if (!value) {
    return null;
  }
  if (typeof value === "object") {
    return value;
  }
  const text = String(value).trim();
  if (!text) {
    return null;
  }
  return JSON.parse(text);
}

export function exportRowsToCsv(
  title: string,
  rows: AnyRecord[],
  fields: FieldConfig[],
) {
  const headers = fields.map((field) => field.label);
  const lines = rows.map((row) =>
    fields
      .map((field) => escapeCsv(formatValue(getValue(row, field.key))))
      .join(","),
  );
  const csv = [headers.map(escapeCsv).join(","), ...lines].join("\n");
  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}
