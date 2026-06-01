<template>
  <section class="recharge-stats-panel">
    <div class="panel-header recharge-stats-title">
      <div>
        <p class="eyebrow">充值统计</p>
        <h2>数据概览</h2>
      </div>
      <button
        class="link-button"
        type="button"
        :disabled="loading"
        @click="$emit('reload')"
      >
        {{ loading ? "加载中" : "刷新" }}
      </button>
    </div>

    <div v-if="error" class="state-box error">{{ error }}</div>
    <div v-else-if="loading && !stats" class="state-box">加载中</div>
    <template v-else-if="stats">
      <div class="stat-grid recharge-stat-grid">
        <div v-for="item in statItems" :key="item.label" class="stat-card">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
      </div>

      <div class="recharge-stats-grid">
        <div class="plain-card recharge-mini-panel">
          <p class="eyebrow">状态</p>
          <div class="status-list">
            <div
              v-for="item in statusItems"
              :key="item.label"
              class="status-item"
            >
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>
        </div>

        <div class="plain-card recharge-mini-panel">
          <p class="eyebrow">近7日</p>
          <div class="recharge-trend-list">
            <div
              v-for="item in stats.daily"
              :key="item.date"
              class="recharge-trend-row"
            >
              <span>{{ formatShortDate(item.date) }}</span>
              <div class="recharge-trend-meter">
                <i :style="{ width: getTrendWidth(item.amount) }"></i>
              </div>
              <strong>{{ formatNumber(item.amount) }}</strong>
            </div>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { RechargeStatsResponse } from "../types";

const props = defineProps<{
  stats: RechargeStatsResponse | null;
  loading: boolean;
  error: string;
}>();

defineEmits<{
  reload: [];
}>();

const statItems = computed(() => {
  const stats = props.stats;
  if (!stats) {
    return [];
  }
  return [
    { label: "累计到账", value: formatNumber(stats.summary.total.amount) },
    { label: "累计笔数", value: formatNumber(stats.summary.total.count) },
    { label: "今日到账", value: formatNumber(stats.summary.today.amount) },
    { label: "近7日", value: formatNumber(stats.summary.last7Days.amount) },
    { label: "近30日", value: formatNumber(stats.summary.last30Days.amount) },
    {
      label: "鱼排扣除",
      value: formatNumber(stats.summary.total.fishpiCost),
    },
  ];
});

const statusItems = computed(() => {
  const stats = props.stats;
  if (!stats) {
    return [];
  }
  return [
    { label: "成功", value: formatNumber(stats.statusCounts.success) },
    { label: "待处理", value: formatNumber(stats.statusCounts.pending) },
    { label: "已失败", value: formatNumber(stats.statusCounts.failed) },
    { label: "入账失败", value: formatNumber(stats.statusCounts.local_failed) },
  ];
});

const trendMax = computed(() =>
  Math.max(...(props.stats?.daily || []).map((item) => item.amount), 0),
);

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString("zh-CN");
}

function formatShortDate(value: string) {
  const parts = value.split("-");
  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : value;
}

function getTrendWidth(value: number) {
  if (trendMax.value <= 0 || value <= 0) {
    return "0%";
  }
  return `${Math.max(6, Math.round((value / trendMax.value) * 100))}%`;
}
</script>
