<script setup lang="ts">
import { Coins, LoaderCircle } from "@lucide/vue";
import type { RechargeConfig } from "../../types";

const props = defineProps<{
  open: boolean;
  loading: boolean;
  amount: number;
  config: RechargeConfig | null;
  rangeLabel: string;
  ratioLabel: string;
  localAmount: number;
}>();

const emit = defineEmits<{
  close: [];
  submit: [];
  "update:amount": [amount: number];
}>();

function updateAmount(event: Event) {
  const target = event.target as HTMLInputElement | null;
  emit("update:amount", Number(target?.value || 0));
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.open"
      class="result-modal-backdrop"
      role="presentation"
      @click.self="emit('close')"
    >
      <section
        class="trade-listing-modal recharge-modal"
        role="dialog"
        aria-modal="true"
        aria-label="星穹币充值"
      >
        <header class="result-modal-head">
          <div>
            <p class="eyebrow">星穹币充值</p>
            <h2>扣鱼排积分换星穹币</h2>
            <span>{{ props.ratioLabel }}</span>
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
        <div class="trade-listing-body recharge-modal-body">
          <label class="redeem-input">
            <span>扣除鱼排积分</span>
            <input
              :value="props.amount"
              type="number"
              :min="props.config?.minAmount || 1"
              :max="props.config?.maxAmount || 9999"
              step="1"
              placeholder="输入要扣除的鱼排积分"
              @input="updateAmount"
              @keyup.enter="emit('submit')"
            />
          </label>
          <dl>
            <div>
              <dt>充值范围</dt>
              <dd>{{ props.rangeLabel }}</dd>
            </div>
            <div>
              <dt>将扣除鱼排积分</dt>
              <dd>{{ props.amount || 0 }}</dd>
            </div>
            <div>
              <dt>到账星穹币</dt>
              <dd>{{ props.localAmount }}</dd>
            </div>
            <div>
              <dt>说明</dt>
              <dd>完成后到账</dd>
            </div>
          </dl>
        </div>
        <footer class="result-modal-actions">
          <button
            class="secondary-action"
            type="button"
            :disabled="props.loading"
            @click="emit('close')"
          >
            取消
          </button>
          <button
            class="primary-action"
            type="button"
            :disabled="props.loading"
            @click="emit('submit')"
          >
            <LoaderCircle v-if="props.loading" :size="18" class="spin" />
            <Coins v-else :size="18" />
            确认
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
