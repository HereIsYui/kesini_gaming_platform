import { computed, ref } from "vue";
import type { CardRarity, GachaResult } from "../types";
import { normalizeRarity, rarityOrder, rarityRank } from "../utils/rarity";
import type { FeedbackType } from "./useFeedback";

type DrawResultsOptions = {
  notify: (type: FeedbackType, text: string) => void;
};

export type DrawPhase = "idle" | "charging" | "burst";

const DRAW_RESULTS_KEY = "kesini_website_last_results";

export function useDrawResults(options: DrawResultsOptions) {
  const lastResults = ref<GachaResult[]>(getStoredDrawResults());
  const resultModalOpen = ref(false);
  const drawPhase = ref<DrawPhase>("idle");

  const bestResult = computed(() => {
    return [...lastResults.value].sort(
      (a, b) => (rarityRank[b.rarity] || 0) - (rarityRank[a.rarity] || 0),
    )[0];
  });
  const resultSummary = computed(() => {
    const counts = rarityOrder.reduce(
      (result, rarity) => ({ ...result, [rarity]: 0 }),
      {} as Record<CardRarity, number>,
    );
    lastResults.value.forEach((item) => {
      const rarity = normalizeRarity(item.rarity);
      counts[rarity] += 1;
    });
    return counts;
  });
  const drawPhaseText = computed(() => {
    if (drawPhase.value === "charging") {
      return "星轨充能中";
    }
    if (drawPhase.value === "burst") {
      return "星门已开启";
    }
    return bestResult.value
      ? `${bestResult.value.rarity} 级信号已锁定`
      : "选择卡池后抽取";
  });
  const resultModalTitle = computed(() =>
    lastResults.value.length > 1 ? "十连回响" : "星轨回应",
  );
  const resultModalSubtitle = computed(() => {
    if (lastResults.value.length === 0) {
      return "暂无抽卡结果";
    }
    const best = bestResult.value;
    return best
      ? `${lastResults.value.length} 次抽取完成，最高稀有度 ${best.rarity}`
      : `${lastResults.value.length} 次抽取完成`;
  });

  function setDrawResults(results: GachaResult[]) {
    lastResults.value = results;
    setStoredDrawResults(results);
  }

  function clearDrawResults() {
    lastResults.value = [];
    resultModalOpen.value = false;
    localStorage.removeItem(DRAW_RESULTS_KEY);
  }

  function openLastResults() {
    if (lastResults.value.length === 0) {
      options.notify("info", "暂无可查看的抽卡结果");
      return;
    }
    resultModalOpen.value = true;
  }

  function closeResultModal() {
    resultModalOpen.value = false;
  }

  function getStoredDrawResults(): GachaResult[] {
    const raw = localStorage.getItem(DRAW_RESULTS_KEY);
    if (!raw) {
      return [];
    }
    try {
      const value = JSON.parse(raw);
      return Array.isArray(value) ? value : [];
    } catch {
      localStorage.removeItem(DRAW_RESULTS_KEY);
      return [];
    }
  }

  function setStoredDrawResults(results: GachaResult[]) {
    localStorage.setItem(DRAW_RESULTS_KEY, JSON.stringify(results));
  }

  return {
    lastResults,
    resultModalOpen,
    drawPhase,
    bestResult,
    resultSummary,
    drawPhaseText,
    resultModalTitle,
    resultModalSubtitle,
    setDrawResults,
    clearDrawResults,
    openLastResults,
    closeResultModal,
  };
}
