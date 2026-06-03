<script setup lang="ts">
import { ShieldCheck } from "@lucide/vue";
import type { ConfirmDialogTarget } from "./types";

const props = defineProps<{
  target: ConfirmDialogTarget | null;
}>();

const emit = defineEmits<{
  settle: [confirmed: boolean];
}>();

function actionClass(target: ConfirmDialogTarget) {
  return target.variant === "danger" ? "danger-action" : "primary-action";
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.target"
      class="result-modal-backdrop confirm-modal-backdrop"
      role="presentation"
      @click.self="emit('settle', false)"
    >
      <section
        class="confirm-modal"
        role="dialog"
        aria-modal="true"
        :aria-label="props.target.title"
      >
        <div class="confirm-modal-icon">
          <component :is="props.target.icon || ShieldCheck" :size="22" />
        </div>
        <div class="confirm-modal-body">
          <h2>{{ props.target.title }}</h2>
          <p v-if="props.target.message">{{ props.target.message }}</p>
          <ul v-if="props.target.details?.length">
            <li v-for="detail in props.target.details" :key="detail">
              {{ detail }}
            </li>
          </ul>
        </div>
        <footer class="result-modal-actions confirm-modal-actions">
          <button
            class="secondary-action"
            type="button"
            @click="emit('settle', false)"
          >
            {{ props.target.cancelText || "取消" }}
          </button>
          <button
            :class="actionClass(props.target)"
            type="button"
            @click="emit('settle', true)"
          >
            {{ props.target.confirmText || "确认" }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
