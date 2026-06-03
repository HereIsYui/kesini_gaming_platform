import { computed, ref } from "vue";
import { request, toQuery } from "../api";
import type {
  CardRarity,
  InventoryItem,
  PoolInfo,
  UserCardsResponse,
} from "../types";

export const BAG_PAGE_SIZE = 24;

type LoadUserCardsOptions = {
  append?: boolean;
  preserveLoaded?: boolean;
  silent?: boolean;
};

type UseCardCollectionOptions = {
  isAuthed: () => boolean;
  isAssetsBusy: () => boolean;
  isCardsMoreBusy: () => boolean;
  getActivePoolId: () => number | null;
  getPools: () => PoolInfo[];
  setAssetsBusy: (value: boolean) => void;
  setCardsMoreBusy: (value: boolean) => void;
};

export function useCardCollection(options: UseCardCollectionOptions) {
  const userCards = ref<UserCardsResponse | null>(null);
  const rarityFilter = ref<CardRarity | "">("");
  const poolFilter = ref<number | "">("");
  const bagNewOnly = ref(false);
  const cardPage = ref(1);

  const inventoryItems = computed<InventoryItem[]>(
    () => userCards.value?.dropItems || [],
  );
  const totalPages = computed(() => userCards.value?.totalPages || 1);
  const bagHasMore = computed(
    () => Boolean(userCards.value) && cardPage.value < totalPages.value,
  );
  const bagLoadedCount = computed(() => userCards.value?.list.length || 0);

  function ensureBagPoolFilter() {
    const pools = options.getPools();
    const poolId = options.getActivePoolId() || pools[0]?.id || null;
    if (!poolFilter.value && poolId) {
      poolFilter.value = poolId;
    }
    if (
      poolFilter.value &&
      !pools.some((pool) => pool.id === Number(poolFilter.value))
    ) {
      poolFilter.value = poolId || "";
    }
  }

  async function loadUserCards(loadOptions: LoadUserCardsOptions = {}) {
    if (!options.isAuthed()) {
      return;
    }
    ensureBagPoolFilter();
    const append = loadOptions.append === true;
    const preserveLoaded = !append && loadOptions.preserveLoaded === true;
    const silent = !append && loadOptions.silent === true;
    if (
      append &&
      (options.isAssetsBusy() || options.isCardsMoreBusy() || !bagHasMore.value)
    ) {
      return;
    }
    if (!poolFilter.value) {
      userCards.value = {
        list: [],
        dropItems: [],
        total: 0,
        page: 1,
        pageSize: BAG_PAGE_SIZE,
        totalPages: 0,
      };
      cardPage.value = 1;
      return;
    }
    const requestedRarity = rarityFilter.value;
    const requestedPoolId = poolFilter.value;
    const requestedNewOnly = bagNewOnly.value;
    const requestedPages = Math.max(1, cardPage.value || 1);
    const page = append ? cardPage.value + 1 : 1;
    const pageSize = preserveLoaded
      ? Math.max(BAG_PAGE_SIZE, requestedPages * BAG_PAGE_SIZE)
      : BAG_PAGE_SIZE;
    if (append) {
      options.setCardsMoreBusy(true);
    } else if (!silent) {
      options.setAssetsBusy(true);
    }
    try {
      const data = await request<UserCardsResponse>(
        `/card/user/cards${toQuery({
          rarity: requestedRarity,
          poolId: requestedPoolId,
          grouped: true,
          newOnly: requestedNewOnly ? true : "",
          page,
          pageSize,
        })}`,
      );
      if (
        requestedRarity !== rarityFilter.value ||
        requestedPoolId !== poolFilter.value ||
        requestedNewOnly !== bagNewOnly.value
      ) {
        return;
      }
      if (append && userCards.value) {
        userCards.value = {
          ...data,
          list: [...userCards.value.list, ...data.list],
          dropItems: data.dropItems,
        };
      } else if (preserveLoaded) {
        const restoredTotalPages = Math.max(
          1,
          Math.ceil(Number(data.total || 0) / BAG_PAGE_SIZE),
        );
        const restoredPage = Math.min(requestedPages, restoredTotalPages);
        userCards.value = {
          ...data,
          page: restoredPage,
          pageSize: BAG_PAGE_SIZE,
          totalPages: restoredTotalPages,
        };
      } else {
        userCards.value = data;
      }
      cardPage.value = userCards.value?.page || data.page || page;
    } finally {
      if (append) {
        options.setCardsMoreBusy(false);
      } else if (!silent) {
        options.setAssetsBusy(false);
      }
    }
  }

  function resetUserCards() {
    cardPage.value = 1;
    userCards.value = null;
    void loadUserCards();
  }

  function toggleBagNewOnly() {
    bagNewOnly.value = !bagNewOnly.value;
    resetUserCards();
  }

  function loadMoreUserCards() {
    void loadUserCards({ append: true });
  }

  return {
    userCards,
    rarityFilter,
    poolFilter,
    bagNewOnly,
    cardPage,
    inventoryItems,
    totalPages,
    bagHasMore,
    bagLoadedCount,
    ensureBagPoolFilter,
    loadUserCards,
    resetUserCards,
    toggleBagNewOnly,
    loadMoreUserCards,
  };
}
