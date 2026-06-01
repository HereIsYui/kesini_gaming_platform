import { computed, ref } from "vue";
import { request, toQuery } from "../api";
import type {
  CardItem,
  CardRarity,
  PoolInfo,
  RechargeConfig,
  SiteConfig,
  UserCatalogResponse,
} from "../types";
import { parseCardRarities, rarityOrder } from "../utils/rarity";

type SilentLoadOptions = {
  silent?: boolean;
};

type PoolCatalogCard = {
  card: CardItem;
  rarities: CardRarity[];
};

type PublicDataOptions = {
  isAuthed: () => boolean;
  setPublicBusy: (busy: boolean) => void;
  setCatalogBusy: (busy: boolean) => void;
  loadAnnouncements: () => Promise<void>;
  ensureBagPoolFilter: () => void;
  notifyError: (error: unknown) => void;
  notifyErrorText: (text: string) => void;
};

export function usePublicData(options: PublicDataOptions) {
  const siteConfig = ref<SiteConfig>({
    websiteTitle: "Kesini 抽卡站",
    adminTitle: "Kesini 运营台",
  });
  const pools = ref<PoolInfo[]>([]);
  const activePoolId = ref<number | null>(null);
  const poolCards = ref<CardItem[]>([]);
  const catalogItems = ref<UserCatalogResponse | null>(null);
  const catalogError = ref("");
  const poolDetailOpen = ref(false);
  const poolDetailLoading = ref(false);
  const poolDetailError = ref("");
  const poolDetailPool = ref<PoolInfo | null>(null);
  const poolDetailCards = ref<CardItem[]>([]);
  const rechargeConfig = ref<RechargeConfig | null>(null);

  const selectedPool = computed(() =>
    pools.value.find((pool) => pool.id === activePoolId.value),
  );
  const selectedDrawCosts = computed(
    () => selectedPool.value?.drawCosts || { once: 10, ten: 100 },
  );
  const poolDetailProbabilityRows = computed(() => {
    const probabilities =
      poolDetailPool.value?.rarityProbabilities ||
      selectedPool.value?.rarityProbabilities ||
      {};
    return rarityOrder.map((rarity) => {
      const value = Number(probabilities[rarity] || 0);
      return {
        rarity,
        value,
        percent: Math.max(0, Math.min(100, value * 100)),
      };
    });
  });
  const poolDetailCatalogCards = computed<PoolCatalogCard[]>(() =>
    poolDetailCards.value.map((card) => ({
      card,
      rarities: parseCardRarities(card.card_level),
    })),
  );

  function poolSortOrder(pool: PoolInfo) {
    const value = Number(pool.sortOrder ?? pool.sort_order ?? 0);
    return Number.isFinite(value) ? value : 0;
  }

  function sortPools(list: PoolInfo[]) {
    return [...list].sort(
      (a, b) => poolSortOrder(a) - poolSortOrder(b) || a.id - b.id,
    );
  }

  async function loadPublicData() {
    options.setPublicBusy(true);
    try {
      const [list, recharge] = await Promise.all([
        request<PoolInfo[]>("/card/pools"),
        request<RechargeConfig>("/recharge/config").catch(() => null),
        options.loadAnnouncements(),
      ]);
      pools.value = sortPools(list || []);
      rechargeConfig.value = recharge;
      if (!activePoolId.value && pools.value.length > 0) {
        activePoolId.value = pools.value[0].id;
      }
      options.ensureBagPoolFilter();
      await loadPoolCards();
    } catch (error) {
      options.notifyError(error);
    } finally {
      options.setPublicBusy(false);
    }
  }

  async function loadSiteConfig() {
    try {
      const data = await request<SiteConfig>("/apis/site-config");
      siteConfig.value = {
        websiteTitle: data.websiteTitle || "Kesini 抽卡站",
        adminTitle: data.adminTitle || "Kesini 运营台",
      };
    } catch {
      siteConfig.value = {
        websiteTitle: "Kesini 抽卡站",
        adminTitle: "Kesini 运营台",
      };
    }
    document.title = siteConfig.value.websiteTitle;
  }

  async function loadPoolCards() {
    if (!activePoolId.value) {
      poolCards.value = [];
      return;
    }
    try {
      poolCards.value = await request<CardItem[]>(
        `/card/pool/${activePoolId.value}/cards`,
      );
    } catch {
      poolCards.value = [];
    }
  }

  async function loadUserCatalog(loadOptions: SilentLoadOptions = {}) {
    catalogError.value = "";
    if (!activePoolId.value || !options.isAuthed()) {
      catalogItems.value = null;
      return;
    }
    if (!loadOptions.silent) {
      options.setCatalogBusy(true);
    }
    try {
      catalogItems.value = await request<UserCatalogResponse>(
        `/card/user/catalog${toQuery({ poolId: activePoolId.value })}`,
      );
    } catch (error) {
      catalogItems.value = null;
      catalogError.value = getErrorMessage(error);
    } finally {
      if (!loadOptions.silent) {
        options.setCatalogBusy(false);
      }
    }
  }

  async function openPoolDetail() {
    const poolId = activePoolId.value;
    if (!poolId) {
      options.notifyErrorText("请先选择一个卡池");
      return;
    }
    poolDetailOpen.value = true;
    poolDetailLoading.value = true;
    poolDetailError.value = "";
    poolDetailPool.value = selectedPool.value || null;
    poolDetailCards.value = poolCards.value;
    try {
      const [pool, cards] = await Promise.all([
        request<PoolInfo>(`/card/pool/${poolId}`),
        request<CardItem[]>(`/card/pool/${poolId}/cards`),
      ]);
      poolDetailPool.value = pool;
      poolDetailCards.value = cards || [];
    } catch (error) {
      poolDetailError.value = getErrorMessage(error);
    } finally {
      poolDetailLoading.value = false;
    }
  }

  function closePoolDetail() {
    poolDetailOpen.value = false;
  }

  function getPoolName(poolId?: number | null) {
    return (
      pools.value.find((pool) => pool.id === Number(poolId))?.pool_name || ""
    );
  }

  function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "操作失败";
  }

  return {
    siteConfig,
    pools,
    activePoolId,
    poolCards,
    catalogItems,
    catalogError,
    poolDetailOpen,
    poolDetailLoading,
    poolDetailError,
    poolDetailPool,
    poolDetailCards,
    rechargeConfig,
    selectedPool,
    selectedDrawCosts,
    poolDetailProbabilityRows,
    poolDetailCatalogCards,
    poolSortOrder,
    sortPools,
    loadPublicData,
    loadSiteConfig,
    loadPoolCards,
    loadUserCatalog,
    openPoolDetail,
    closePoolDetail,
    getPoolName,
  };
}
