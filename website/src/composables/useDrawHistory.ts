import { computed, ref } from "vue";
import { request, toQuery } from "../api";
import type { DrawHistoryRecord, DrawHistoryResponse } from "../types";
import { cardTypeLabel } from "../utils/format";
import type { FeedbackType } from "./useFeedback";

type DrawHistoryOptions = {
  isAuthed: () => boolean;
  setBusy: (busy: boolean) => void;
  notify: (type: FeedbackType, text: string) => void;
  getErrorMessage: (error: unknown) => string;
  getPoolName: (poolId?: number | null) => string;
};

export function useDrawHistory(options: DrawHistoryOptions) {
  const drawHistory = ref<DrawHistoryResponse | null>(null);
  const drawHistoryOpen = ref(false);
  const drawHistoryPage = ref(1);

  const drawHistoryRows = computed<DrawHistoryRecord[]>(
    () => drawHistory.value?.list || [],
  );
  const drawHistoryTotalPages = computed(
    () => drawHistory.value?.totalPages || 1,
  );

  async function loadDrawHistory(page = drawHistoryPage.value) {
    if (!options.isAuthed()) {
      return;
    }
    options.setBusy(true);
    try {
      const data = await request<DrawHistoryResponse>(
        `/card/history${toQuery({ page, pageSize: 10 })}`,
      );
      drawHistory.value = data;
      drawHistoryPage.value = data.page || page;
    } catch (error) {
      options.notify("error", options.getErrorMessage(error));
    } finally {
      options.setBusy(false);
    }
  }

  async function openDrawHistory() {
    if (!options.isAuthed()) {
      options.notify("error", "请先登录");
      return;
    }
    drawHistoryOpen.value = true;
    drawHistoryPage.value = 1;
    await loadDrawHistory(1);
  }

  function closeDrawHistory() {
    drawHistoryOpen.value = false;
  }

  function changeDrawHistoryPage(delta: number) {
    const next = Math.min(
      Math.max(1, drawHistoryPage.value + delta),
      drawHistoryTotalPages.value,
    );
    if (next === drawHistoryPage.value) {
      return;
    }
    void loadDrawHistory(next);
  }

  function drawHistoryDetailMeta(detail: DrawHistoryRecord["details"][number]) {
    const poolName = options.getPoolName(detail.poolId);
    if (poolName) {
      return poolName;
    }
    if (detail.cardType !== undefined && detail.cardType !== null) {
      return cardTypeLabel(detail.cardType);
    }
    return "抽卡记录";
  }

  function resetDrawHistory() {
    drawHistory.value = null;
    drawHistoryOpen.value = false;
    drawHistoryPage.value = 1;
  }

  return {
    drawHistory,
    drawHistoryOpen,
    drawHistoryPage,
    drawHistoryRows,
    drawHistoryTotalPages,
    loadDrawHistory,
    openDrawHistory,
    closeDrawHistory,
    changeDrawHistoryPage,
    drawHistoryDetailMeta,
    resetDrawHistory,
  };
}
