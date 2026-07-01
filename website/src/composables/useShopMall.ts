import { reactive, ref } from "vue";
import { request } from "../api";
import type { ShopBuyResponse, ShopProduct } from "../types";
import type { FeedbackType } from "./useFeedback";

type ShopMallOptions = {
  isAuthed: () => boolean;
  setBusy: (busy: boolean) => void;
  notify: (type: FeedbackType, text: string) => void;
  getErrorMessage: (error: unknown) => string;
  syncCurrentPoint: (point?: number | null) => void;
  refreshAfterBuy: (data: ShopBuyResponse) => Promise<void>;
};

export function useShopMall(options: ShopMallOptions) {
  const shopProducts = ref<ShopProduct[]>([]);
  const shopCounts = reactive<Record<number, number>>({});

  async function loadShopProducts() {
    if (!options.isAuthed()) {
      return;
    }
    options.setBusy(true);
    try {
      shopProducts.value = await request<ShopProduct[]>("/shop/products");
    } finally {
      options.setBusy(false);
    }
  }

  async function buyShopProduct(product: ShopProduct) {
    const count = Math.max(1, Math.min(99, Number(shopCounts[product.id] || 1)));
    shopCounts[product.id] = count;
    options.setBusy(true);
    try {
      const data = await request<ShopBuyResponse>(
        `/shop/products/${product.id}/buy`,
        {
          method: "POST",
          body: JSON.stringify({
            count,
            requestId: crypto.randomUUID(),
          }),
        },
      );
      if (typeof data.pointAfter === "number") {
        options.syncCurrentPoint(data.pointAfter);
      }
      options.notify("success", "已购买");
      await options.refreshAfterBuy(data);
    } catch (error) {
      options.notify("error", options.getErrorMessage(error));
    } finally {
      options.setBusy(false);
    }
  }

  function clearShopProducts() {
    shopProducts.value = [];
    Object.keys(shopCounts).forEach((key) => {
      delete shopCounts[Number(key)];
    });
  }

  return {
    shopProducts,
    shopCounts,
    loadShopProducts,
    buyShopProduct,
    clearShopProducts,
  };
}
