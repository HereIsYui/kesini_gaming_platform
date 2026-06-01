import { computed, ref, type Ref } from "vue";
import { request } from "../api";
import type { RechargeConfig, RechargePointsResponse } from "../types";
import type { FeedbackType } from "./useFeedback";

type RechargeFlowOptions = {
  rechargeConfig: Ref<RechargeConfig | null>;
  isAuthed: () => boolean;
  isBusy: () => boolean;
  setBusy: (busy: boolean) => void;
  notify: (type: FeedbackType, text: string) => void;
  getErrorMessage: (error: unknown) => string;
  loadPrivateData: () => Promise<void>;
};

export function useRechargeFlow(options: RechargeFlowOptions) {
  const rechargeModalOpen = ref(false);
  const rechargeAmount = ref(10);

  const rechargeRangeLabel = computed(() => {
    const config = options.rechargeConfig.value;
    if (!config) {
      return "充值配置同步中";
    }
    return `${config.minAmount} - ${config.maxAmount} 鱼排积分`;
  });

  const rechargeRatioLabel = computed(() => {
    const ratio = Number(options.rechargeConfig.value?.ratio || 1);
    return `1 鱼排积分 = ${ratio} 星穹币`;
  });

  const rechargeLocalAmount = computed(() => {
    const amount = Number(rechargeAmount.value || 0);
    const ratio = Number(options.rechargeConfig.value?.ratio || 1);
    if (!Number.isFinite(amount) || !Number.isFinite(ratio)) {
      return 0;
    }
    return Math.max(0, Math.floor(amount * ratio));
  });

  function createRechargeRequestId() {
    const random =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `website-${random}`;
  }

  function openRechargeModal() {
    const config = options.rechargeConfig.value;
    if (!options.isAuthed()) {
      options.notify("error", "请先登录");
      return;
    }
    if (!config?.enabled) {
      options.notify("error", "充值功能暂未开启");
      return;
    }
    if (!config.hasGoldFingerKey) {
      options.notify("error", "充值暂不可用");
      return;
    }
    rechargeAmount.value = Math.max(
      config.minAmount || 1,
      Math.min(config.maxAmount || 9999, rechargeAmount.value || 10),
    );
    rechargeModalOpen.value = true;
  }

  function closeRechargeModal() {
    if (!options.isBusy()) {
      rechargeModalOpen.value = false;
    }
  }

  async function submitRecharge() {
    if (!options.isAuthed()) {
      options.notify("error", "请先登录");
      return;
    }
    const config = options.rechargeConfig.value;
    const amount = Number(rechargeAmount.value);
    if (!config) {
      options.notify("error", "充值配置还未加载完成");
      return;
    }
    if (!Number.isInteger(amount) || amount <= 0) {
      options.notify("error", "扣除鱼排积分数量必须为正整数");
      return;
    }
    if (amount < config.minAmount || amount > config.maxAmount) {
      options.notify(
        "error",
        `扣除鱼排积分需在 ${config.minAmount}-${config.maxAmount} 之间`,
      );
      return;
    }

    options.setBusy(true);
    try {
      const data = await request<RechargePointsResponse>("/recharge/points", {
        method: "POST",
        body: JSON.stringify({
          amount,
          requestId: createRechargeRequestId(),
        }),
      });
      options.notify(
        "success",
        `充值成功：扣除鱼排积分 ${data.fishpiCost}，星穹币 ${data.pointBefore} → ${data.pointAfter}`,
      );
      rechargeModalOpen.value = false;
      await options.loadPrivateData();
    } catch (error) {
      options.notify("error", options.getErrorMessage(error));
    } finally {
      options.setBusy(false);
    }
  }

  return {
    rechargeModalOpen,
    rechargeAmount,
    rechargeRangeLabel,
    rechargeRatioLabel,
    rechargeLocalAmount,
    openRechargeModal,
    closeRechargeModal,
    submitRecharge,
  };
}
