<template>
  <div class="dashboard-page">
    <div class="stat-grid">
      <div v-for="[key, value] in counterEntries" :key="key" class="stat-card">
        <span>{{ counterLabel(key) }}</span>
        <strong>{{ value }}</strong>
      </div>
    </div>

    <div class="dashboard-grid">
      <div class="dashboard-main">
        <div v-if="error" class="state-box error">{{ error }}</div>
        <div v-else-if="loading" class="state-box">正在加载总览...</div>
        <div v-else class="panel-card plain-card">
          <div class="panel-header">
            <div>
              <p class="eyebrow">最近动态</p>
              <h2>抽卡记录</h2>
            </div>
            <button class="link-button" type="button" @click="emit('reload')">
              刷新
            </button>
          </div>
          <div class="activity-list">
            <div
              v-for="(item, index) in recentHistories"
              :key="index"
              class="activity-item"
            >
              <div class="activity-user">
                <strong>{{ item.userName || "未知用户" }}</strong>
                <span>账号 {{ item.uid || "-" }}</span>
              </div>
              <div class="activity-detail">
                <strong>{{ item.count || 0 }} 抽</strong>
                <span>{{ item.card_levels || "-" }}</span>
                <time>{{ item.createdAt ? formatDate(item.createdAt) : "-" }}</time>
              </div>
            </div>
            <div v-if="recentHistories.length === 0" class="state-box compact">
              暂无抽卡记录
            </div>
          </div>
        </div>
      </div>

      <div class="side-stack">
        <div class="panel-card plain-card">
          <p class="eyebrow">运营状态</p>
          <h2>数据已同步</h2>
          <div class="status-list">
            <div class="status-item">
              <span>统计口径</span>
              <strong>全量数据</strong>
            </div>
            <div class="status-item">
              <span>最近记录</span>
              <strong>{{ recentHistories.length }} 条</strong>
            </div>
            <div class="status-item">
              <span>刷新方式</span>
              <strong>手动刷新</strong>
            </div>
          </div>
        </div>
        <div class="panel-card plain-card">
          <p class="eyebrow">稀有度库存</p>
          <div
            v-for="[key, value] in rarityEntries"
            :key="key"
            class="rarity-row"
          >
            <span>{{ key }}</span>
            <strong>{{ value }}</strong>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { DashboardData } from "../types";
import { formatDate } from "../utils";

const props = withDefaults(
  defineProps<{
    data?: DashboardData | null;
    loading?: boolean;
    error?: string;
  }>(),
  {
    data: null,
    loading: false,
    error: "",
  },
);

const emit = defineEmits<{
  reload: [];
}>();

const counterEntries = computed(() =>
  Object.entries(props.data?.counters || {}),
);
const rarityEntries = computed(() =>
  Object.entries(props.data?.rarityTotals || {}),
);
const recentHistories = computed(() => props.data?.recentHistories || []);

function counterLabel(key: string) {
  const labels: Record<string, string> = {
    userCount: "用户",
    cardCount: "卡片",
    poolCount: "卡池",
    dropItemCount: "物品",
    totalDraws: "总抽数",
  };
  return labels[key] || key;
}
</script>
