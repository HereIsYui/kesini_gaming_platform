<script setup lang="ts">
defineProps<{
  feedback: { type: "success" | "error" | "info"; text: string } | null;
}>();
</script>

<template>
  <div v-if="feedback" class="toast" :class="feedback.type" role="status">
    {{ feedback.text }}
  </div>
</template>
