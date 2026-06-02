<script setup lang="ts">
import type { Announcement } from "../../types";

defineProps<{
  announcements: Announcement[];
  visibleAnnouncements: Announcement[];
  unreadCount: number;
  summary: (content: string) => string;
  isRead: (item: Announcement) => boolean;
}>();

const emit = defineEmits<{
  (event: "openList"): void;
  (event: "openDetail", item: Announcement): void;
  (event: "close", item: Announcement): void;
}>();
</script>

<template>
  <section
    v-if="announcements.length > 0"
    class="announcement-strip"
    :class="{ compact: visibleAnnouncements.length === 0 }"
  >
    <div class="announcement-strip-head">
      <div>
        <p class="eyebrow">公告</p>
        <strong>{{ unreadCount > 0 ? `${unreadCount} 条未读` : "全部已读" }}</strong>
      </div>
      <button
        class="secondary-action compact"
        type="button"
        @click="emit('openList')"
      >
        全部
      </button>
    </div>
    <article
      v-for="item in visibleAnnouncements"
      :key="item.id"
      class="announcement-item"
      :class="{ read: isRead(item) }"
      @click="emit('openDetail', item)"
    >
      <div class="announcement-item-main">
        <strong>{{ item.title }}</strong>
        <span>{{ summary(item.content) }}</span>
      </div>
      <div class="announcement-item-actions">
        <span v-if="!isRead(item)" class="unread-dot"></span>
        <button type="button" @click.stop="emit('close', item)">
          关闭
        </button>
      </div>
    </article>
  </section>
</template>
