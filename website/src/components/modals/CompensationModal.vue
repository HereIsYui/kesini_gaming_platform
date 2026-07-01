<script setup lang="ts">
import { Gift, LoaderCircle } from "@lucide/vue";
import type { CompensationStatusResponse } from "../../types";

const props = defineProps<{
  open: boolean;
  compensation: CompensationStatusResponse | null;
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
      v-if="props.open && props.compensation?.available"
      class="result-modal-backdrop"
      role="presentation"
      @click.self="emit('close')"
    >
      <section
        class="trade-listing-modal launch-activity-modal"
        role="dialog"
        aria-modal="true"
        aria-label="充值补偿"
      >
        <header class="result-modal-head">
          <div>
            <p class="eyebrow">补偿</p>
            <h2>{{ props.compensation.title || "充值补偿" }}</h2>
            <span>+{{ props.compensation.totalAmount || 0 }} 星穹币</span>
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
          <div class="launch-reward-card">
            <span>本次补偿</span>
            <strong>+{{ props.compensation.totalAmount || 0 }}</strong>
            <small>领取后到账</small>
          </div>
          <div class="launch-reward-grid">
            <article v-if="Number(props.compensation.rechargeAmount || 0) > 0">
              <span>充值</span>
              <strong>+{{ props.compensation.rechargeAmount || 0 }}</strong>
            </article>
            <article v-if="Number(props.compensation.monthlyAmount || 0) > 0">
              <span>月卡</span>
              <strong>+{{ props.compensation.monthlyAmount || 0 }}</strong>
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
            稍后
          </button>
          <button
            class="primary-action golden"
            type="button"
            :disabled="props.loading"
            @click="emit('claim')"
          >
            <LoaderCircle v-if="props.loading" :size="18" class="spin" />
            <Gift v-else :size="18" />
            领取
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
