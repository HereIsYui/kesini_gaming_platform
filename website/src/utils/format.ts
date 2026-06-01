export function poolTypeLabel(type?: number) {
  return ["常驻", "活动", "限定"][Number(type || 0)] || "卡池";
}

export function cardTypeLabel(type?: number) {
  return ["普通", "限定", "纪念", "活动", "隐藏"][Number(type || 0)] || "卡片";
}

export function itemTypeLabel(type?: number) {
  return (
    ["卡片碎片", "虚拟星穹币", "普通道具", "其他"][Number(type || 0)] || "物品"
  );
}

export function tradeStatusLabel(status?: string) {
  const labels: Record<string, string> = {
    active: "交易中",
    sold: "已成交",
    cancelled: "已取消",
  };
  return labels[String(status || "")] || "未知";
}

export function tradeRoleLabel(role?: string) {
  return role === "seller" ? "卖出" : "买入";
}

export function formatPercent(value?: number) {
  return `${(Number(value || 0) * 100).toFixed(2)}%`;
}

export function formatDate(value?: string | null) {
  if (!value) {
    return "不限";
  }
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type RewardSummary = {
  points?: number;
  items?: Array<{ itemName?: string; itemId: number; num: number }>;
  cards?: Array<{
    cardName?: string;
    cardId: number;
    rarity: string;
    num: number;
  }>;
};

export function formatRewards(rewards?: RewardSummary) {
  if (!rewards) {
    return "无奖励";
  }
  const parts = [];
  if (Number(rewards.points || 0) > 0) {
    parts.push(`${rewards.points} 星穹币`);
  }
  rewards.items?.forEach((item) => {
    parts.push(`${item.itemName || `物品 ${item.itemId}`} x${item.num}`);
  });
  rewards.cards?.forEach((card) => {
    parts.push(
      `${card.cardName || `卡片 ${card.cardId}`} ${card.rarity} x${card.num}`,
    );
  });
  return parts.length > 0 ? parts.join("，") : "无奖励";
}

export function formatFragmentSummary(
  fragments?: Array<{ itemName?: string; itemId: number; count: number }>,
) {
  if (!fragments || fragments.length === 0) {
    return "无碎片";
  }
  return fragments
    .map((item) => `${item.itemName || `物品 ${item.itemId}`} x${item.count}`)
    .join("，");
}

export function formatCosts(
  costs?: Array<{ itemName?: string; itemId: number; num: number }>,
) {
  if (!costs || costs.length === 0) {
    return "无消耗";
  }
  return costs
    .map((item) => `${item.itemName || `物品 ${item.itemId}`} x${item.num}`)
    .join("，");
}
