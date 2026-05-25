<template>
  <div class="pity-progress">
    <div v-if="!pitySystem" class="pity-empty">未读取到保底配置</div>
    <div v-else-if="pitySystem.enabled === false" class="pity-empty">当前卡池未开启保底</div>
    <template v-else-if="rules.length">
      <div v-for="rule in rules" :key="rule.key" class="pity-rule">
        <div class="pity-rule-head">
          <span>
            <strong>{{ rule.label }}</strong>
            {{ rule.rarity }} 保底
          </span>
          <span :class="['pity-rule-state', { ready: rule.remaining <= 1 }]">
            {{ getStateText(rule.remaining) }}
          </span>
        </div>
        <div class="pity-meter" :title="`已垫 ${rule.current} / ${rule.count} 抽`">
          <span :style="{ width: `${rule.percent}%` }"></span>
        </div>
        <div class="pity-rule-meta">
          已垫 {{ rule.current }} / {{ rule.count }} 抽
        </div>
      </div>
    </template>
    <div v-else class="pity-empty">当前卡池未配置具体保底规则</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { GachaPoolConfig } from "../types";

const rarityRanks = ["N", "R", "SR", "SSR", "UR"];

const props = defineProps<{
  row: Record<string, any>;
}>();

const pitySystem = computed(() => props.row.pitySystem as GachaPoolConfig["pitySystem"] | null | undefined);

const rules = computed(() => {
  const config = pitySystem.value;
  if (!config || config.enabled === false) {
    return [];
  }
  return [
    buildRule("hard", "硬保底", config.hardPity),
    buildRule("soft", "软保底", config.softPity),
  ].filter(Boolean) as Array<{
    key: string;
    label: string;
    rarity: string;
    count: number;
    current: number;
    remaining: number;
    percent: number;
  }>;
});

function buildRule(
  key: string,
  label: string,
  rule: { count?: number; guaranteedRarity?: string } | undefined,
) {
  const count = Number(rule?.count || 0);
  const rarity = String(rule?.guaranteedRarity || "");
  if (!count || !rarity) {
    return null;
  }
  const current = getCounter(rarity);
  const remaining = Math.max(0, count - current);
  return {
    key,
    label,
    rarity,
    count,
    current,
    remaining,
    percent: Math.min(100, Math.max(0, (current / count) * 100)),
  };
}

function getCounter(rarity: string) {
  const rank = rarityRanks.indexOf(rarity);
  if (rank >= rarityRanks.indexOf("UR")) {
    return Number(props.row.draws_since_ur || 0);
  }
  if (rank >= rarityRanks.indexOf("SSR")) {
    return Number(props.row.draws_since_ssr || 0);
  }
  return Number(props.row.draws_since_sr || 0);
}

function getStateText(remaining: number) {
  if (remaining <= 0) {
    return "已满足";
  }
  if (remaining === 1) {
    return "下抽触发";
  }
  return `还差 ${remaining} 抽`;
}
</script>
