<script setup lang="ts">
import { Gift, LoaderCircle } from "@lucide/vue";
import type { LaunchActivityInfo } from "../../types";
import { formatDate, formatRewards } from "../../utils/format";

const props = defineProps<{
  open: boolean;
  activity: LaunchActivityInfo | null;
  loading: boolean;
}>();

const emit = defineEmits<{
  close: [];
  claim: [];
}>();
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.open && props.activity"
      class="result-modal-backdrop"
      role="presentation"
      @click.self="emit('close')"
    >
      <section
        class="trade-listing-modal launch-activity-modal"
        role="dialog"
        aria-modal="true"
        aria-label="开服福利"
      >
        <header class="result-modal-head">
          <div>
            <p class="eyebrow">开服福利</p>
            <h2>{{ props.activity.name }}</h2>
            <span>
              {{ formatDate(props.activity.startsAt) }} 至
              {{ formatDate(props.activity.endsAt) }}
            </span>
          </div>
          <button
            class="modal-close"
            type="button"
            :disabled="props.loading"
            @click="emit('close')"
          >
            关闭
          </button>
        </header>
        <div class="trade-listing-body launch-activity-body">
          <p class="launch-activity-desc">
            {{ props.activity.description || "登录可领一次" }}
          </p>
          <div class="launch-reward-card">
            <span>本次奖励</span>
            <strong>{{ formatRewards(props.activity.rewards) }}</strong>
            <small>领取后刷新资产</small>
          </div>
          <div class="launch-reward-grid">
            <article v-if="Number(props.activity.rewards.points || 0) > 0">
              <span>星穹币</span>
              <strong>{{ props.activity.rewards.points }}</strong>
            </article>
            <article
              v-for="item in props.activity.rewards.items"
              :key="`${item.itemId}-${item.num}`"
            >
              <span>{{ item.itemName || `物品 ${item.itemId}` }}</span>
              <strong>x{{ item.num }}</strong>
            </article>
          </div>
        </div>
        <footer class="result-modal-actions">
          <button
            class="secondary-action"
            type="button"
            :disabled="props.loading"
            @click="emit('close')"
          >
            稍后领取
          </button>
          <button
            class="primary-action golden"
            type="button"
            :disabled="props.loading"
            @click="emit('claim')"
          >
            <LoaderCircle v-if="props.loading" :size="18" class="spin" />
            <Gift v-else :size="18" />
            立即领取
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
