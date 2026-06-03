import { computed, ref } from "vue";
import { request, toQuery } from "../api";
import type {
  PlayerProfileResponse,
  SaveShowcaseRequest,
  UserCardsResponse,
  UserProfile,
} from "../types";
import { rarityOrder } from "../utils/rarity";
import type { FeedbackType } from "./useFeedback";

type SilentLoadOptions = {
  silent?: boolean;
};

type PublicProfileUserLike = {
  publicId?: string | null;
  public_id?: string | null;
  uid?: string | null;
};

type UsePlayerProfileOptions = {
  isAuthed: () => boolean;
  getActiveSection: () => string;
  getRouteName: () => unknown;
  getRoutePublicId: () => string;
  getCurrentUser: () => UserProfile | null;
  setProfileBusy: (value: boolean) => void;
  setProfileCandidatesBusy: (value: boolean) => void;
  setProfileSavingBusy: (value: boolean) => void;
  isProfileSavingBusy: () => boolean;
  notify: (type: FeedbackType, text: string) => void;
  getErrorMessage: (error: unknown) => string;
  publicPlayerName: (
    nickname?: string | null,
    uid?: string | null,
    fallback?: string,
  ) => string;
  publicProfileParam: (user?: PublicProfileUserLike | null) => string;
  candidateUuid: (card: UserCardsResponse["list"][number]) => string;
};

export function usePlayerProfile(options: UsePlayerProfileOptions) {
  const playerProfile = ref<PlayerProfileResponse | null>(null);
  const profileCandidates = ref<UserCardsResponse["list"]>([]);
  const profilePickerOpen = ref(false);
  const profileSelectedUuids = ref<string[]>([]);

  const isPublicProfileRoute = computed(
    () => options.getRouteName() === "publicProfile",
  );
  const profileRouteId = computed(() =>
    isPublicProfileRoute.value ? options.getRoutePublicId() : "",
  );
  const profileDisplayName = computed(() =>
    options.publicPlayerName(
      playerProfile.value?.user.nickname,
      playerProfile.value?.user.uid,
      "玩家主页",
    ),
  );
  const profileOwnerUid = computed(() =>
    String(playerProfile.value?.user.uid || "").trim(),
  );
  const profileOwnerPublicId = computed(() =>
    options.publicProfileParam(playerProfile.value?.user),
  );
  const currentUserPublicId = computed(() =>
    options.publicProfileParam(options.getCurrentUser()),
  );
  const profileActionTarget = computed(
    () => profileOwnerPublicId.value || profileOwnerUid.value,
  );
  const profileInitial = computed(() =>
    String(profileDisplayName.value || "?").trim().slice(0, 1).toUpperCase(),
  );
  const profileCanEdit = computed(() => {
    if (!options.isAuthed()) {
      return false;
    }
    const currentUid = String(options.getCurrentUser()?.uid || "").trim();
    if (profileOwnerUid.value && currentUid) {
      return profileOwnerUid.value === currentUid;
    }
    return Boolean(
      profileOwnerPublicId.value &&
        currentUserPublicId.value &&
        profileOwnerPublicId.value === currentUserPublicId.value,
    );
  });
  const profileShareUrl = computed(() => {
    const profileId = options.publicProfileParam(
      playerProfile.value?.user || options.getCurrentUser(),
    );
    return profileId
      ? `${window.location.origin}/u/${encodeURIComponent(profileId)}`
      : "";
  });
  const profileCardCountRows = computed(() =>
    rarityOrder.map((rarity) => ({
      rarity,
      count: playerProfile.value?.user.cardCounts?.[rarity] || 0,
    })),
  );
  const profileShowcase = computed(() => playerProfile.value?.showcase || []);
  const profileFormation = computed(
    () =>
      playerProfile.value?.formation || {
        slotCount: 3,
        filledCount: 0,
        totalPower: 0,
      },
  );
  const profileSelectedSet = computed(() => new Set(profileSelectedUuids.value));

  function resetProfile() {
    playerProfile.value = null;
    profileCandidates.value = [];
    profilePickerOpen.value = false;
    profileSelectedUuids.value = [];
  }

  function shouldRefreshOwnProfile() {
    return Boolean(playerProfile.value) && !isPublicProfileRoute.value;
  }

  async function loadPlayerProfile(loadOptions: SilentLoadOptions = {}) {
    if (isPublicProfileRoute.value && !profileRouteId.value) {
      playerProfile.value = null;
      return;
    }
    if (!isPublicProfileRoute.value && !options.isAuthed()) {
      playerProfile.value = null;
      return;
    }

    if (!loadOptions.silent) {
      options.setProfileBusy(true);
    }
    try {
      playerProfile.value = await request<PlayerProfileResponse>(
        isPublicProfileRoute.value
          ? `/profile/${encodeURIComponent(profileRouteId.value)}`
          : "/profile/me",
      );
    } catch (error) {
      playerProfile.value = null;
      if (options.getActiveSection() === "profile") {
        options.notify("error", options.getErrorMessage(error));
      }
    } finally {
      if (!loadOptions.silent) {
        options.setProfileBusy(false);
      }
    }
  }

  async function loadProfileCandidates() {
    if (!options.isAuthed()) {
      profileCandidates.value = [];
      return;
    }
    options.setProfileCandidatesBusy(true);
    try {
      const data = await request<UserCardsResponse>(
        `/card/user/cards${toQuery({
          grouped: false,
          page: 1,
          pageSize: 100,
        })}`,
      );
      profileCandidates.value = data.list || [];
    } catch (error) {
      profileCandidates.value = [];
      options.notify("error", options.getErrorMessage(error));
    } finally {
      options.setProfileCandidatesBusy(false);
    }
  }

  async function openProfilePicker() {
    if (!profileCanEdit.value) {
      options.notify("error", "请先登录");
      return;
    }
    profileSelectedUuids.value = profileShowcase.value.map((card) => card.uuid);
    profilePickerOpen.value = true;
    await loadProfileCandidates();
  }

  function closeProfilePicker() {
    if (options.isProfileSavingBusy()) {
      return;
    }
    profilePickerOpen.value = false;
    profileSelectedUuids.value = [];
  }

  function isProfileCandidateSelected(card: UserCardsResponse["list"][number]) {
    const uuid = options.candidateUuid(card);
    return Boolean(uuid && profileSelectedSet.value.has(uuid));
  }

  function toggleProfileCandidate(card: UserCardsResponse["list"][number]) {
    const uuid = options.candidateUuid(card);
    if (!uuid) {
      return;
    }
    if (profileSelectedSet.value.has(uuid)) {
      profileSelectedUuids.value = profileSelectedUuids.value.filter(
        (item) => item !== uuid,
      );
      return;
    }
    if (profileSelectedUuids.value.length >= 6) {
      options.notify("info", "最多 6 张");
      return;
    }
    profileSelectedUuids.value = [...profileSelectedUuids.value, uuid];
  }

  async function saveProfileShowcase() {
    if (!profileCanEdit.value) {
      options.notify("error", "请先登录");
      return;
    }
    options.setProfileSavingBusy(true);
    try {
      const payload: SaveShowcaseRequest = {
        cardUuids: [...profileSelectedUuids.value],
      };
      playerProfile.value = await request<PlayerProfileResponse>(
        "/profile/showcase",
        {
          method: "PUT",
          body: JSON.stringify(payload),
        },
      );
      profilePickerOpen.value = false;
      options.notify("success", "展示已保存");
    } catch (error) {
      options.notify("error", options.getErrorMessage(error));
    } finally {
      options.setProfileSavingBusy(false);
    }
  }

  async function copyProfileLink() {
    if (!profileShareUrl.value) {
      return;
    }
    try {
      await navigator.clipboard.writeText(profileShareUrl.value);
      options.notify("success", "链接已复制");
    } catch {
      options.notify("error", "复制失败");
    }
  }

  return {
    playerProfile,
    profileCandidates,
    profilePickerOpen,
    profileSelectedUuids,
    isPublicProfileRoute,
    profileRouteId,
    profileDisplayName,
    profileOwnerUid,
    profileOwnerPublicId,
    currentUserPublicId,
    profileActionTarget,
    profileInitial,
    profileCanEdit,
    profileShareUrl,
    profileCardCountRows,
    profileShowcase,
    profileFormation,
    profileSelectedSet,
    resetProfile,
    shouldRefreshOwnProfile,
    loadPlayerProfile,
    loadProfileCandidates,
    openProfilePicker,
    closeProfilePicker,
    isProfileCandidateSelected,
    toggleProfileCandidate,
    saveProfileShowcase,
    copyProfileLink,
  };
}
