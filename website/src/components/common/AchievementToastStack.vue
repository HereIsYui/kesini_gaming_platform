<script setup lang="ts">
import { Trophy } from "@lucide/vue";
import type { AchievementNotification } from "../../types";
import { formatRewards } from "../../utils/format";

defineProps<{
  notices: AchievementNotification[];
}>();

defineEmits<{
  dismiss: [achievementId: number];
}>();
</script>

<template>
  <div v-if="notices.length" class="achievement-toast-stack" aria-live="polite">
    <article
      v-for="notice in notices"
      :key="notice.achievementId"
      class="achievement-toast"
      role="status"
    >
      <div class="achievement-toast-icon">
        <Trophy :size="18" />
      </div>
      <div class="achievement-toast-body">
        <span>成就达成</span>
        <strong>{{ notice.name }}</strong>
        <p>{{ notice.description || "奖励已发放到账户。" }}</p>
        <small>{{ formatRewards(notice.rewards) }}</small>
      </div>
      <button
        type="button"
        aria-label="关闭成就通知"
        @click="$emit('dismiss', notice.achievementId)"
      >
        ×
      </button>
    </article>
  </div>
</template>
