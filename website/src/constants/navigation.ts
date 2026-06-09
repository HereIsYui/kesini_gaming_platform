import {
  Boxes,
  CalendarDays,
  Coins,
  Gift,
  Gem,
  ListChecks,
  Mail,
  Package,
  Settings,
  ShieldCheck,
  Sparkles,
  Store,
  Swords,
  Trophy,
  UserRound,
  UsersRound,
} from "@lucide/vue";

export const sectionItems = [
  { key: "draw", label: "抽卡", icon: Sparkles },
  { key: "profile", label: "主页", icon: UserRound },
  { key: "messages", label: "消息", icon: Mail },
  { key: "settings", label: "设置", icon: Settings },
  { key: "friends", label: "好友", icon: UsersRound },
  { key: "guild", label: "公会", icon: UsersRound },
  { key: "bag", label: "背包", icon: Boxes },
  { key: "formation", label: "阵容", icon: Swords },
  { key: "pve", label: "关卡", icon: Trophy },
  { key: "synthesize", label: "图鉴", icon: Package },
  { key: "points", label: "星穹币", icon: Coins },
  { key: "monthlyCard", label: "月卡", icon: Gem },
  { key: "leaderboard", label: "排行", icon: Trophy },
  { key: "tasks", label: "任务", icon: ListChecks },
  { key: "season", label: "赛季", icon: CalendarDays },
  { key: "achievements", label: "成就", icon: ShieldCheck },
  { key: "trade", label: "交易", icon: Store },
  { key: "redeem", label: "兑换", icon: Gift },
] as const;

export type SectionItem = (typeof sectionItems)[number];
export type SectionKey = SectionItem["key"];

export const sectionItemMap = new Map<SectionKey, SectionItem>(
  sectionItems.map((item) => [item.key, item]),
);

export const primaryNavSectionKeys = [
  "draw",
  "pve",
  "synthesize",
  "season",
  "leaderboard",
  "guild",
] as const satisfies readonly SectionKey[];

export const primaryNavItems = primaryNavSectionKeys
  .map((key) => sectionItemMap.get(key))
  .filter((item): item is SectionItem => Boolean(item));

export const accountMenuSectionKeys = [
  "profile",
  "messages",
  "settings",
  "friends",
  "bag",
  "formation",
  "tasks",
  "achievements",
  "points",
  "monthlyCard",
  "trade",
  "redeem",
] as const satisfies readonly SectionKey[];

export const accountMenuItems = accountMenuSectionKeys
  .map((key) => sectionItemMap.get(key))
  .filter((item): item is SectionItem => Boolean(item));
