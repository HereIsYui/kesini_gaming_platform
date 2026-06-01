import { computed, ref } from "vue";
import { request } from "../api";
import type { Announcement, AnnouncementListResponse } from "../types";
import { getStoredNumberSet, persistNumberSet } from "../utils/storage";

const ANNOUNCEMENT_READ_KEY = "kesini_announcement_read";
const ANNOUNCEMENT_CLOSED_KEY = "kesini_announcement_closed";

export function useAnnouncements() {
  const announcements = ref<AnnouncementListResponse["list"]>([]);
  const announcementReadIds = ref<Set<number>>(
    getStoredNumberSet(ANNOUNCEMENT_READ_KEY),
  );
  const announcementClosedIds = ref<Set<number>>(
    getStoredNumberSet(ANNOUNCEMENT_CLOSED_KEY),
  );
  const announcementModalOpen = ref(false);
  const selectedAnnouncement = ref<Announcement | null>(null);

  const activeAnnouncements = computed(() =>
    announcements.value.filter((item) => item.active !== false),
  );
  const visibleAnnouncements = computed(() =>
    activeAnnouncements.value
      .filter((item) => !announcementClosedIds.value.has(item.id))
      .slice(0, 2),
  );
  const unreadAnnouncementCount = computed(
    () =>
      announcements.value.filter((item) => !announcementReadIds.value.has(item.id))
        .length,
  );

  async function loadAnnouncements() {
    const data = await request<AnnouncementListResponse>("/announcements").catch(
      () => ({ list: [] }),
    );
    announcements.value = data.list || [];
  }

  function announcementSummary(content: string) {
    const text = String(content || "").trim();
    return text.length > 36 ? `${text.slice(0, 36)}…` : text;
  }

  function isAnnouncementRead(item: Announcement) {
    return announcementReadIds.value.has(item.id);
  }

  function markAnnouncementRead(item: Announcement) {
    if (announcementReadIds.value.has(item.id)) {
      return;
    }
    const next = new Set(announcementReadIds.value);
    next.add(item.id);
    announcementReadIds.value = next;
    persistNumberSet(ANNOUNCEMENT_READ_KEY, next);
  }

  function closeAnnouncement(item: Announcement) {
    markAnnouncementRead(item);
    const next = new Set(announcementClosedIds.value);
    next.add(item.id);
    announcementClosedIds.value = next;
    persistNumberSet(ANNOUNCEMENT_CLOSED_KEY, next);
  }

  function openAnnouncementList() {
    selectedAnnouncement.value = null;
    announcementModalOpen.value = true;
  }

  function openAnnouncementDetail(item: Announcement) {
    selectedAnnouncement.value = item;
    markAnnouncementRead(item);
    announcementModalOpen.value = true;
  }

  function closeAnnouncementModal() {
    announcementModalOpen.value = false;
    selectedAnnouncement.value = null;
  }

  return {
    announcements,
    announcementReadIds,
    announcementClosedIds,
    announcementModalOpen,
    selectedAnnouncement,
    activeAnnouncements,
    visibleAnnouncements,
    unreadAnnouncementCount,
    loadAnnouncements,
    announcementSummary,
    isAnnouncementRead,
    markAnnouncementRead,
    closeAnnouncement,
    openAnnouncementList,
    openAnnouncementDetail,
    closeAnnouncementModal,
  };
}
