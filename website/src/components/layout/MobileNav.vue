<script setup lang="ts">
import { RouterLink } from "vue-router";
import type { SectionItem, SectionKey } from "../../constants/navigation";

const props = defineProps<{
  items: readonly SectionItem[];
  activeSection: SectionKey;
}>();
</script>

<template>
  <nav class="mobile-nav" aria-label="移动端导航">
    <RouterLink
      v-for="item in props.items"
      :key="item.key"
      :to="{ name: item.key }"
      :class="{ active: props.activeSection === item.key }"
    >
      <component :is="item.icon" :size="18" />
      <span>{{ item.label }}</span>
    </RouterLink>
  </nav>
</template>
