import { reactive, ref } from "vue";
import { request } from "../api";
import type {
  ExchangeClaimResponse,
  ExchangeShopItem,
  RedeemClaimResponse,
} from "../types";
import { formatRewards } from "../utils/format";
import type { FeedbackType } from "./useFeedback";

type RedeemShopOptions = {
  isAuthed: () => boolean;
  setRedeemBusy: (busy: boolean) => void;
  setShopBusy: (busy: boolean) => void;
  notify: (type: FeedbackType, text: string) => void;
  getErrorMessage: (error: unknown) => string;
  loadPrivateData: () => Promise<void>;
};

export function useRedeemShop(options: RedeemShopOptions) {
  const exchangeItems = ref<ExchangeShopItem[]>([]);
  const redeemCode = ref("");
  const exchangeCounts = reactive<Record<number, number>>({});

  async function loadExchangeItems() {
    if (!options.isAuthed()) {
      return;
    }
    options.setShopBusy(true);
    try {
      exchangeItems.value = await request<ExchangeShopItem[]>("/exchange/items");
    } finally {
      options.setShopBusy(false);
    }
  }

  async function claimRedeemCode() {
    const code = redeemCode.value.trim();
    if (!code) {
      options.notify("error", "请输入兑换码");
      return;
    }
    options.setRedeemBusy(true);
    try {
      const data = await request<RedeemClaimResponse>("/redeem/claim", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      options.notify("success", `兑换成功：${formatRewards(data.rewards)}`);
      redeemCode.value = "";
      await options.loadPrivateData();
    } catch (error) {
      options.notify("error", options.getErrorMessage(error));
    } finally {
      options.setRedeemBusy(false);
    }
  }

  async function claimExchange(item: ExchangeShopItem) {
    const count = Math.max(1, Math.min(99, Number(exchangeCounts[item.id] || 1)));
    exchangeCounts[item.id] = count;
    options.setShopBusy(true);
    try {
      const data = await request<ExchangeClaimResponse>(
        `/exchange/items/${item.id}/claim`,
        {
          method: "POST",
          body: JSON.stringify({ count }),
        },
      );
      options.notify("success", `兑换成功：${formatRewards(data.rewards)}`);
      await options.loadPrivateData();
    } catch (error) {
      options.notify("error", options.getErrorMessage(error));
    } finally {
      options.setShopBusy(false);
    }
  }

  function clearExchangeItems() {
    exchangeItems.value = [];
  }

  return {
    exchangeItems,
    redeemCode,
    exchangeCounts,
    loadExchangeItems,
    claimRedeemCode,
    claimExchange,
    clearExchangeItems,
  };
}
