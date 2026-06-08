import { computed, ref } from "vue";
import { request, toQuery } from "../api";
import type {
  CardRarity,
  FormationOverview,
  PveChallengeRecord,
  PveChallengeResult,
  PveOverview,
  PveRecordsResponse,
  PveSweepResult,
  PveStage,
  UserCardsResponse,
} from "../types";
import type { FeedbackType } from "./useFeedback";

type SilentLoadOptions = {
  silent?: boolean;
};

type PveBattlePhase = "idle" | "fighting" | "result";

type PveBattleResult = {
  stageId: number;
  success: boolean;
  rewards: PveChallengeResult["rewards"];
  formationPower: number;
  enemyPower: number;
};

type PveBattleHp = {
  stageId: number | null;
  player: number;
  enemy: number;
};

type UseFormationPveOptions = {
  isAuthed: () => boolean;
  getActiveSection: () => string;
  isFormationBusy: () => boolean;
  setFormationBusy: (value: boolean) => void;
  setFormationCandidatesBusy: (value: boolean) => void;
  setPveBusy: (value: boolean) => void;
  setPveRecordsBusy: (value: boolean) => void;
  setPveChallengeBusy: (value: boolean) => void;
  notify: (type: FeedbackType, text: string) => void;
  getErrorMessage: (error: unknown) => string;
  candidateUuid: (card: UserCardsResponse["list"][number]) => string;
  syncChallengePoint: (point?: number | null) => void;
  refreshChallengeRewards: () => Promise<unknown>;
};

export function useFormationPve(options: UseFormationPveOptions) {
  const formation = ref<FormationOverview | null>(null);
  const formationCandidates = ref<UserCardsResponse["list"]>([]);
  const formationPickerOpen = ref(false);
  const formationEditingPosition = ref<number | null>(null);
  const formationCandidateKeyword = ref("");
  const formationCandidateRarity = ref<CardRarity | "">("");
  const formationCandidatePool = ref<number | "">("");
  const formationCandidateAvailableOnly = ref(false);
  const pveOverview = ref<PveOverview | null>(null);
  const pveStagePage = ref(1);
  const pveStageTotalPages = ref(1);
  const pveStageTotal = ref(0);
  const pveRecords = ref<PveRecordsResponse | null>(null);
  const pveRecordPage = ref(1);
  const pveRecordTotalPages = ref(1);
  const pveSweepResult = ref<PveSweepResult | null>(null);
  const pveBattleStageId = ref<number | null>(null);
  const pveBattlePhase = ref<PveBattlePhase>("idle");
  const pveBattleResult = ref<PveBattleResult | null>(null);
  const pveBattleDraining = ref(false);
  const pveBattleHp = ref<PveBattleHp>({
    stageId: null,
    player: 100,
    enemy: 100,
  });

  const formationSlots = computed(() => {
    const slotCount = formation.value?.slotCount || 3;
    return Array.from({ length: slotCount }, (_, index) => {
      const position = index + 1;
      return (
        formation.value?.slots.find((slot) => slot.position === position) || {
          position,
          card: null,
        }
      );
    });
  });
  const formationFilledCount = computed(
    () => formationSlots.value.filter((slot) => slot.card).length,
  );
  const formationCurrentUuids = computed(
    () =>
      new Set(
        formationSlots.value
          .map((slot) => slot.card?.uuid)
          .filter((uuid): uuid is string => Boolean(uuid)),
      ),
  );
  const formationEditingSlot = computed(() =>
    formationSlots.value.find(
      (slot) => slot.position === formationEditingPosition.value,
    ),
  );
  const filteredFormationCandidates = computed(() => {
    const keyword = formationCandidateKeyword.value.trim().toLowerCase();
    const rarity = formationCandidateRarity.value;
    const poolId = Number(formationCandidatePool.value || 0);
    return formationCandidates.value.filter((card) => {
      if (
        keyword &&
        !String(card.cardName || "").toLowerCase().includes(keyword)
      ) {
        return false;
      }
      if (rarity && card.cardLevel !== rarity) {
        return false;
      }
      if (poolId && Number(card.poolId || 0) !== poolId) {
        return false;
      }
      if (
        formationCandidateAvailableOnly.value &&
        !isFormationCandidateAvailable(card)
      ) {
        return false;
      }
      return true;
    });
  });
  const pveStages = computed<PveStage[]>(() => pveOverview.value?.list || []);
  const pveFormation = computed(
    () =>
      pveOverview.value?.formation || {
        slotCount: formation.value?.slotCount || 3,
        filledCount: formationFilledCount.value,
        totalPower: formation.value?.totalPower || 0,
      },
  );
  const pveRecentRecords = computed<PveChallengeRecord[]>(
    () => pveRecords.value?.list || [],
  );
  const pveClearedCount = computed(
    () => pveRecentRecords.value.filter((record) => record.success).length,
  );

  function resetFormationCandidateFilters() {
    formationCandidateKeyword.value = "";
    formationCandidateRarity.value = "";
    formationCandidatePool.value = "";
    formationCandidateAvailableOnly.value = false;
  }

  function clearPveBattle() {
    pveBattleStageId.value = null;
    pveBattlePhase.value = "idle";
    pveBattleResult.value = null;
    pveBattleDraining.value = false;
    pveBattleHp.value = {
      stageId: null,
      player: 100,
      enemy: 100,
    };
  }

  function clearPveSweep() {
    pveSweepResult.value = null;
  }

  function resetFormationPve() {
    formation.value = null;
    formationCandidates.value = [];
    formationPickerOpen.value = false;
    formationEditingPosition.value = null;
    resetFormationCandidateFilters();
    pveOverview.value = null;
    pveStagePage.value = 1;
    pveStageTotalPages.value = 1;
    pveStageTotal.value = 0;
    pveRecords.value = null;
    pveRecordPage.value = 1;
    pveRecordTotalPages.value = 1;
    clearPveBattle();
    clearPveSweep();
  }

  async function loadFormation(loadOptions: SilentLoadOptions = {}) {
    if (!options.isAuthed()) {
      return;
    }
    if (!loadOptions.silent) {
      options.setFormationBusy(true);
    }
    try {
      formation.value = await request<FormationOverview>("/formation");
    } catch (error) {
      if (options.getActiveSection() === "formation") {
        options.notify("error", options.getErrorMessage(error));
      }
    } finally {
      if (!loadOptions.silent) {
        options.setFormationBusy(false);
      }
    }
  }

  async function loadFormationCandidates() {
    if (!options.isAuthed()) {
      formationCandidates.value = [];
      return;
    }
    options.setFormationCandidatesBusy(true);
    try {
      const pageSize = 100;
      const candidates: UserCardsResponse["list"] = [];
      let page = 1;
      let totalPages = 1;
      do {
        const data = await request<UserCardsResponse>(
          `/card/user/cards${toQuery({
            grouped: false,
            page,
            pageSize,
          })}`,
        );
        candidates.push(...(data.list || []));
        totalPages = Math.max(1, Number(data.totalPages || 1));
        page += 1;
      } while (page <= totalPages);
      formationCandidates.value = candidates;
    } catch (error) {
      formationCandidates.value = [];
      options.notify("error", options.getErrorMessage(error));
    } finally {
      options.setFormationCandidatesBusy(false);
    }
  }

  async function openFormationPicker(position: number) {
    if (!options.isAuthed()) {
      options.notify("error", "请先登录");
      return;
    }
    formationEditingPosition.value = position;
    resetFormationCandidateFilters();
    formationPickerOpen.value = true;
    await loadFormationCandidates();
  }

  function closeFormationPicker() {
    if (options.isFormationBusy()) {
      return;
    }
    formationPickerOpen.value = false;
    formationEditingPosition.value = null;
  }

  function isFormationCandidateSelected(
    card: UserCardsResponse["list"][number],
  ) {
    const uuid = options.candidateUuid(card);
    return Boolean(uuid && formationCurrentUuids.value.has(uuid));
  }

  function isFormationCandidateAvailable(
    card: UserCardsResponse["list"][number],
  ) {
    return Boolean(
      options.candidateUuid(card) &&
        !card.isListed &&
        !isFormationCandidateSelected(card),
    );
  }

  async function saveFormationSlot(position: number, cardUuid: string | null) {
    if (!options.isAuthed()) {
      options.notify("error", "请先登录");
      return;
    }
    const slots = formationSlots.value.map((slot) => ({
      position: slot.position,
      cardUuid: slot.position === position ? cardUuid : slot.card?.uuid || null,
    }));
    options.setFormationBusy(true);
    try {
      formation.value = await request<FormationOverview>("/formation", {
        method: "PUT",
        body: JSON.stringify({ slots }),
      });
      options.notify("success", cardUuid ? "卡片已上阵" : "阵容位置已清空");
      formationPickerOpen.value = false;
      formationEditingPosition.value = null;
      if (pveOverview.value) {
        clearPveBattle();
        await loadPveStages();
      }
    } catch (error) {
      options.notify("error", options.getErrorMessage(error));
    } finally {
      options.setFormationBusy(false);
    }
  }

  async function loadPveStages(
    page = pveStagePage.value,
    loadOptions: { focus?: string } = {},
  ) {
    if (!options.isAuthed()) {
      return;
    }
    options.setPveBusy(true);
    try {
      const data = await request<PveOverview>(
        `/pve/stages${toQuery({
          page,
          pageSize: 12,
          focus: loadOptions.focus,
        })}`,
      );
      pveOverview.value = data;
      pveStagePage.value = data.page || page;
      pveStageTotalPages.value = data.totalPages || 1;
      pveStageTotal.value = data.total ?? data.list?.length ?? 0;
    } catch (error) {
      if (options.getActiveSection() === "pve") {
        options.notify("error", options.getErrorMessage(error));
      }
    } finally {
      options.setPveBusy(false);
    }
  }

  async function loadPveRecords(page = pveRecordPage.value) {
    if (!options.isAuthed()) {
      return;
    }
    options.setPveRecordsBusy(true);
    try {
      const data = await request<PveRecordsResponse>(
        `/pve/records${toQuery({ page, pageSize: 6 })}`,
      );
      pveRecords.value = data;
      pveRecordPage.value = data.page || page;
      pveRecordTotalPages.value = data.totalPages || 1;
    } catch (error) {
      if (options.getActiveSection() === "pve") {
        options.notify("error", options.getErrorMessage(error));
      }
    } finally {
      options.setPveRecordsBusy(false);
    }
  }

  async function refreshPve() {
    clearPveBattle();
    clearPveSweep();
    await Promise.all([
      loadPveStages(pveStagePage.value, { focus: "nextUncleared" }),
      loadPveRecords(),
    ]);
  }

  function waitForBattleAnimation() {
    return new Promise((resolve) => window.setTimeout(resolve, 1000));
  }

  function waitForBattleFrame() {
    return new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => resolve());
      });
    });
  }

  function waitForBattleHpDrain() {
    return new Promise((resolve) => window.setTimeout(resolve, 1250));
  }

  function battleHpTarget(result: PveBattleResult) {
    return result.success
      ? {
          player: battleSurvivorHpPercent(
            result.formationPower,
            result.enemyPower,
          ),
          enemy: 0,
        }
      : {
          player: 0,
          enemy: battleSurvivorHpPercent(
            result.enemyPower,
            result.formationPower,
          ),
        };
  }

  async function challengePveStage(stage: PveStage) {
    if (!options.isAuthed()) {
      options.notify("error", "请先登录");
      return;
    }
    if (!stage.canChallenge) {
      options.notify("info", stage.unavailableReason || "当前无法挑战");
      return;
    }
    pveBattleStageId.value = Number(stage.id);
    pveBattlePhase.value = "fighting";
    pveBattleResult.value = null;
    pveBattleDraining.value = false;
    pveBattleHp.value = {
      stageId: Number(stage.id),
      player: 100,
      enemy: 100,
    };
    const animationDone = waitForBattleAnimation();
    options.setPveChallengeBusy(true);
    try {
      const data = await request<PveChallengeResult>(
        `/pve/stages/${stage.id}/challenge`,
        { method: "POST" },
      );
      await animationDone;
      options.syncChallengePoint(data.pointAfter);
      pveBattleStageId.value = Number(stage.id);
      pveBattlePhase.value = "result";
      const result = {
        stageId: Number(stage.id),
        success: data.success,
        rewards: data.rewards || null,
        formationPower: data.formationPower,
        enemyPower: data.enemyPower,
      };
      pveBattleResult.value = result;
      pveBattleDraining.value = false;
      pveBattleHp.value = {
        stageId: Number(stage.id),
        player: 100,
        enemy: 100,
      };
      await waitForBattleFrame();
      pveBattleDraining.value = true;
      pveBattleHp.value = {
        stageId: Number(stage.id),
        ...battleHpTarget(result),
      };
      options.notify(
        data.success ? "success" : "info",
        data.success ? "胜利" : "失败",
      );
      await waitForBattleHpDrain();
      pveBattleDraining.value = false;
      await Promise.all([
        loadPveStages(pveStagePage.value),
        loadPveRecords(1),
        options.refreshChallengeRewards(),
      ]);
    } catch (error) {
      await animationDone;
      clearPveBattle();
      options.notify("error", options.getErrorMessage(error));
    } finally {
      options.setPveChallengeBusy(false);
    }
  }

  async function sweepPveStages() {
    if (!options.isAuthed()) {
      options.notify("error", "请先登录");
      return;
    }
    const stageIds = pveStages.value
      .filter((stage) => stage.cleared && stage.remainingAttempts > 0)
      .map((stage) => stage.id);
    if (stageIds.length === 0) {
      options.notify("info", "暂无可扫荡");
      return;
    }
    options.setPveChallengeBusy(true);
    try {
      const data = await request<PveSweepResult>("/pve/sweep", {
        method: "POST",
        body: JSON.stringify({ stageIds }),
      });
      pveSweepResult.value = data;
      options.syncChallengePoint(data.pointAfter);
      options.notify(
        "success",
        `扫荡${data.swept}关${data.skipped.length > 0 ? `，跳过${data.skipped.length}关` : ""}`,
      );
      await Promise.all([
        loadPveStages(pveStagePage.value),
        loadPveRecords(1),
        options.refreshChallengeRewards(),
      ]);
    } catch (error) {
      options.notify("error", options.getErrorMessage(error));
    } finally {
      options.setPveChallengeBusy(false);
    }
  }

  function changePveRecordPage(delta: number) {
    const next = Math.min(
      Math.max(1, pveRecordPage.value + delta),
      pveRecordTotalPages.value,
    );
    if (next === pveRecordPage.value) {
      return;
    }
    void loadPveRecords(next);
  }

  function changePveStagePage(delta: number) {
    const next = Math.min(
      Math.max(1, pveStagePage.value + delta),
      pveStageTotalPages.value,
    );
    if (next === pveStagePage.value) {
      return;
    }
    clearPveBattle();
    void loadPveStages(next);
  }

  function pvePowerPercent(stage: PveStage) {
    const enemyPower = Math.max(1, Number(stage.enemyPower || 0));
    return Math.max(
      0,
      Math.min(
        100,
        Math.round((pveFormation.value.totalPower / enemyPower) * 100),
      ),
    );
  }

  function battleSurvivorHpPercent(winnerPower: number, loserPower: number) {
    const winner = Math.max(1, Number(winnerPower || 0));
    const loser = Math.max(1, Number(loserPower || 0));
    const percent = Math.round((winner / (winner + loser)) * 100);
    return Math.max(35, Math.min(96, percent));
  }

  function pveBattlePlayerHpPercent(stage: PveStage) {
    if (pveBattlePlayerHpDraining(stage)) {
      return 100;
    }
    return pveBattleHp.value.stageId === Number(stage.id)
      ? pveBattleHp.value.player
      : 100;
  }

  function pveBattleEnemyHpPercent(stage: PveStage) {
    if (pveBattleEnemyHpDraining(stage)) {
      return 100;
    }
    return pveBattleHp.value.stageId === Number(stage.id)
      ? pveBattleHp.value.enemy
      : 100;
  }

  function pveBattlePlayerHpDraining(stage: PveStage) {
    return Boolean(
      pveBattleDraining.value &&
        pveBattleResult.value &&
        pveBattleResult.value.stageId === Number(stage.id) &&
        !pveBattleResult.value.success,
    );
  }

  function pveBattleEnemyHpDraining(stage: PveStage) {
    return Boolean(
      pveBattleDraining.value &&
        pveBattleResult.value &&
        pveBattleResult.value.stageId === Number(stage.id) &&
        pveBattleResult.value.success,
    );
  }

  function pveStageLevelLabel(stage: PveStage) {
    const power = Number(stage.enemyPower || 0);
    if (power >= 5000) {
      return "高危";
    }
    if (power >= 2000) {
      return "精英";
    }
    return "巡逻";
  }

  const pveSweepableStages = computed(() =>
    pveStages.value.filter(
      (stage) => stage.cleared && stage.remainingAttempts > 0,
    ),
  );
  const pveSweepableCount = computed(() => pveSweepableStages.value.length);

  return {
    formation,
    formationCandidates,
    formationPickerOpen,
    formationEditingPosition,
    formationCandidateKeyword,
    formationCandidateRarity,
    formationCandidatePool,
    formationCandidateAvailableOnly,
    pveOverview,
    pveStagePage,
    pveStageTotalPages,
    pveStageTotal,
    pveRecords,
    pveRecordPage,
    pveRecordTotalPages,
    pveSweepResult,
    pveBattleStageId,
    pveBattlePhase,
    pveBattleResult,
    pveBattleDraining,
    formationSlots,
    formationFilledCount,
    formationCurrentUuids,
    formationEditingSlot,
    filteredFormationCandidates,
    pveStages,
    pveFormation,
    pveRecentRecords,
    pveClearedCount,
    pveSweepableStages,
    pveSweepableCount,
    clearPveBattle,
    clearPveSweep,
    resetFormationPve,
    loadFormation,
    loadFormationCandidates,
    openFormationPicker,
    closeFormationPicker,
    isFormationCandidateSelected,
    isFormationCandidateAvailable,
    resetFormationCandidateFilters,
    saveFormationSlot,
    loadPveStages,
    loadPveRecords,
    refreshPve,
    sweepPveStages,
    challengePveStage,
    changePveStagePage,
    changePveRecordPage,
    pvePowerPercent,
    pveBattlePlayerHpPercent,
    pveBattleEnemyHpPercent,
    pveBattlePlayerHpDraining,
    pveBattleEnemyHpDraining,
    pveStageLevelLabel,
  };
}
