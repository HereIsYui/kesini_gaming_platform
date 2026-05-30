<template>
  <div class="identity-cell">
    <strong>{{ displayName }}</strong>
    <span>账号 {{ uidValue || "-" }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  uid?: string | number | null;
  name?: string | number | null;
  fallback?: string;
}>();

const uidValue = computed(() => String(props.uid ?? "").trim());
const displayName = computed(() => {
  const name = String(props.name ?? "").trim();
  if (name) {
    return name;
  }
  return (
    props.fallback || (uidValue.value ? `用户 ${uidValue.value}` : "未知用户")
  );
});
</script>
