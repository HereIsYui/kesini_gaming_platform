import { computed, ref } from "vue";
import { request, toQuery } from "../api";
import type {
  PointLedgerRecord,
  PointLedgerRecordsResponse,
  PointLedgerSourceType,
} from "../types";
import type { FeedbackType } from "./useFeedback";

type PointsLedgerOptions = {
  isAuthed: () => boolean;
  isActive: () => boolean;
  setBusy: (busy: boolean) => void;
  notify: (type: FeedbackType, text: string) => void;
  getErrorMessage: (error: unknown) => string;
  syncCurrentPoint: (point: number) => void;
};

export function usePointsLedger(options: PointsLedgerOptions) {
  const pointRecords = ref<PointLedgerRecordsResponse | null>(null);
  const pointRecordPage = ref(1);
  const pointRecordTypeFilter = ref<"all" | "income" | "expense">("all");
  const pointRecordSourceFilter = ref<PointLedgerSourceType | "">("");
  const pointRecordTotalPages = ref(1);

  const pointLedgerRows = computed<PointLedgerRecord[]>(
    () => pointRecords.value?.list || [],
  );
  const pointIncomeTotal = computed(() =>
    pointLedgerRows.value
      .filter((record) => record.changeAmount > 0)
      .reduce((sum, record) => sum + record.changeAmount, 0),
  );
  const pointExpenseTotal = computed(() =>
    pointLedgerRows.value
      .filter((record) => record.changeAmount < 0)
      .reduce((sum, record) => sum + Math.abs(record.changeAmount), 0),
  );
  const pointNetTotal = computed(() =>
    pointLedgerRows.value.reduce((sum, record) => sum + record.changeAmount, 0),
  );

  async function loadPointRecords() {
    if (!options.isAuthed()) {
      return;
    }
    options.setBusy(true);
    try {
      const data = await request<PointLedgerRecordsResponse>(
        `/points/records${toQuery({
          page: pointRecordPage.value,
          pageSize: 20,
          type:
            pointRecordTypeFilter.value === "all"
              ? ""
              : pointRecordTypeFilter.value,
          sourceType: pointRecordSourceFilter.value,
        })}`,
      );
      pointRecords.value = data;
      pointRecordTotalPages.value = data.totalPages || 1;
      if (typeof data.currentPoint === "number") {
        options.syncCurrentPoint(data.currentPoint);
      }
    } catch (error) {
      if (options.isActive()) {
        options.notify("error", options.getErrorMessage(error));
      }
    } finally {
      options.setBusy(false);
    }
  }

  function changePointPage(delta: number) {
    const next = Math.min(
      Math.max(1, pointRecordPage.value + delta),
      pointRecordTotalPages.value,
    );
    if (next === pointRecordPage.value) {
      return;
    }
    pointRecordPage.value = next;
    void loadPointRecords();
  }

  function resetPointRecords() {
    pointRecords.value = null;
    pointRecordPage.value = 1;
  }

  return {
    pointRecords,
    pointRecordPage,
    pointRecordTypeFilter,
    pointRecordSourceFilter,
    pointRecordTotalPages,
    pointLedgerRows,
    pointIncomeTotal,
    pointExpenseTotal,
    pointNetTotal,
    pointSourceOptions,
    loadPointRecords,
    changePointPage,
    resetPointRecords,
    pointChangeClass,
    formatPointChange,
    pointMetadataSummary,
  };
}

export const pointSourceOptions = [
  { value: "", label: "全部来源" },
  { value: "draw_once", label: "单抽消耗" },
  { value: "draw_ten", label: "十连消耗" },
  { value: "recharge", label: "星穹币充值" },
  { value: "redeem_code", label: "兑换码奖励" },
  { value: "launch_activity", label: "开服福利" },
  { value: "daily_sign_in", label: "每日签到" },
  { value: "exchange_shop", label: "兑换商店" },
  { value: "achievement", label: "成就奖励" },
  { value: "task", label: "任务奖励" },
  { value: "pve", label: "关卡奖励" },
  { value: "trade_buy", label: "交易购买" },
  { value: "trade_sell", label: "交易出售" },
  { value: "shop_buy", label: "商城购买" },
  { value: "shop_reward", label: "商城奖励" },
  { value: "shop_recycle", label: "商店回收" },
  { value: "player_message", label: "消息奖励" },
  { value: "vip_daily", label: "VIP礼包" },
  { value: "guild_check_in", label: "公会签到" },
  { value: "guild_donate", label: "公会捐献" },
  { value: "guild_boss", label: "公会首领" },
  { value: "guild_chest", label: "公会活跃箱" },
  { value: "admin_adjust", label: "管理员调整" },
] as const;

export function pointChangeClass(amount: number) {
  return amount >= 0 ? "income" : "expense";
}

export function formatPointChange(amount: number) {
  return `${amount > 0 ? "+" : ""}${amount}`;
}

export function pointMetadataSummary(record: PointLedgerRecord) {
  const metadata = record.metadata || {};
  const meta = (key: string) => metadata[key];
  switch (record.sourceType) {
    case "draw_once":
    case "draw_ten":
      return `卡池 ${String(meta("poolName") || meta("poolId") || "-")} · ${String(
        meta("count") || 1,
      )} 次`;
    case "recharge":
      return `鱼排用户名 ${String(meta("fishpiUserName") || "-")} · 扣除 ${String(
        meta("fishpiCost") || Math.abs(record.changeAmount),
      )}`;
    case "redeem_code":
      return `兑换码 ${String(meta("code") || "-")}`;
    case "launch_activity":
      return `活动 ${String(meta("activityName") || meta("activityKey") || "-")}`;
    case "daily_sign_in":
      return `第 ${String(meta("cycleDay") || "-")} 天`;
    case "exchange_shop":
      return `兑换项 ${String(meta("exchangeItemName") || meta("exchangeItemId") || "-")} · ${String(
        meta("count") || 1,
      )} 次`;
    case "task":
      return `${String(meta("taskName") || meta("milestone") || "任务")} · ${String(
        meta("periodKey") || "-",
      )}`;
    case "pve":
      return `${String(meta("stageName") || "关卡")} · 战力 ${String(
        meta("formationPower") || "-",
      )}/${String(meta("enemyPower") || "-")}`;
    case "trade_buy":
      return `订单 #${String(meta("listingId") || record.sourceId || "-")} · 购买`;
    case "trade_sell":
      return `订单 #${String(meta("listingId") || record.sourceId || "-")} · 出售`;
    case "shop_buy":
    case "shop_reward":
      return `${String(meta("productName") || "商城")} · ${String(
        meta("count") || 1,
      )} 次`;
    case "shop_recycle":
      return `${String(meta("cardName") || "卡片")} · ${String(meta("count") || 1)} 张`;
    case "player_message":
      return String(meta("title") || record.title || "消息奖励");
    case "vip_daily":
      return `VIP${String(meta("vipLevel") || "-")} · ${String(
        meta("claimDate") || "-",
      )}`;
    case "guild_check_in":
      return String(meta("dateKey") || "-");
    case "guild_donate":
      return `捐献 ${String(meta("amount") || "-")}`;
    case "guild_boss":
      return String(meta("dateKey") || "首领");
    case "guild_chest":
      return `活跃 ${String(meta("threshold") || "-")}`;
    case "admin_adjust":
      return `${String(meta("pointBefore") ?? "-")} → ${String(
        meta("pointAfter") ?? "-",
      )}`;
    default:
      return record.title;
  }
}
