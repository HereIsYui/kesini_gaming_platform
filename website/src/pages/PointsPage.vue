<script setup lang="ts">
import { useAppContext } from "../composables/useAppContext";

const {
  ChevronLeft,
  ChevronRight,
  Coins,
  RefreshCw,
  formatDate,
  stats,
  pointRecords,
  pointRecordPage,
  pointRecordTypeFilter,
  pointRecordSourceFilter,
  pointRecordTotalPages,
  busy,
  isAuthed,
  activeSection,
  pointLedgerRows,
  pointIncomeTotal,
  pointExpenseTotal,
  pointNetTotal,
  pointSourceOptions,
  loadPointRecords,
  changePointPage,
  pointChangeClass,
  formatPointChange,
  pointMetadataSummary,
} = useAppContext() as Record<string, any>;
</script>

<template>
<section
  v-if="activeSection === 'points'"
  class="panel points-panel"
  data-section="points"
>
  <div class="section-head">
    <div>
      <p class="eyebrow">星穹币流水</p>
      <h2>星穹币变化记录</h2>
    </div>
    <div class="section-actions">
      <button
        class="secondary-action compact"
        type="button"
        :disabled="busy.points"
        @click="loadPointRecords"
      >
        <RefreshCw :size="16" :class="{ spin: busy.points }" />
        刷新
      </button>
    </div>
  </div>

  <div v-if="!isAuthed" class="empty-state">
    <Coins :size="30" />
    <strong>登录后查看星穹币流水</strong>
    <span>收支记录在这里</span>
  </div>
  <div v-else class="points-content">
    <div class="points-overview">
      <article>
        <small>当前余额</small>
        <strong>{{
          pointRecords?.currentPoint ?? stats?.point ?? 0
        }}</strong>
      </article>
      <article class="income">
        <small>本页收入</small>
        <strong>+{{ pointIncomeTotal }}</strong>
      </article>
      <article class="expense">
        <small>本页支出</small>
        <strong>-{{ pointExpenseTotal }}</strong>
      </article>
      <article :class="pointNetTotal >= 0 ? 'income' : 'expense'">
        <small>本页净变动</small>
        <strong>{{ formatPointChange(pointNetTotal) }}</strong>
      </article>
    </div>

    <div class="filter-row point-filter-row">
      <select
        v-model="pointRecordTypeFilter"
        @change="
          pointRecordPage = 1;
          loadPointRecords();
        "
      >
        <option value="all">全部收支</option>
        <option value="income">只看收入</option>
        <option value="expense">只看支出</option>
      </select>
      <select
        v-model="pointRecordSourceFilter"
        @change="
          pointRecordPage = 1;
          loadPointRecords();
        "
      >
        <option
          v-for="option in pointSourceOptions"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>
    </div>

    <div
      v-if="busy.points && !pointRecords"
      class="skeleton-grid points-skeleton"
    >
      <span v-for="item in 6" :key="item"></span>
    </div>
    <div v-else-if="pointLedgerRows.length === 0" class="empty-state">
      <Coins :size="30" />
      <strong>暂无星穹币流水</strong>
      <span>暂无收支记录</span>
    </div>
    <div v-else class="point-ledger-list">
      <article
        v-for="record in pointLedgerRows"
        :key="record.id"
        class="point-ledger-card"
        :class="pointChangeClass(record.changeAmount)"
      >
        <div class="point-ledger-main">
          <div class="point-ledger-head">
            <span>{{ record.sourceLabel }}</span>
            <time>{{ formatDate(record.createdAt) }}</time>
          </div>
          <strong>{{ record.title }}</strong>
          <small>{{ pointMetadataSummary(record) }}</small>
        </div>
        <div class="point-ledger-amount">
          <strong>{{ formatPointChange(record.changeAmount) }}</strong>
          <span>{{ record.pointBefore }} → {{ record.pointAfter }}</span>
        </div>
      </article>
    </div>

    <div
      v-if="pointRecords && pointRecords.total > pointRecords.pageSize"
      class="pager"
    >
      <button
        type="button"
        :disabled="pointRecordPage <= 1"
        @click="changePointPage(-1)"
      >
        <ChevronLeft :size="16" />
        上一页
      </button>
      <span
        >第 {{ pointRecordPage }} / {{ pointRecordTotalPages }} 页</span
      >
      <button
        type="button"
        :disabled="pointRecordPage >= pointRecordTotalPages"
        @click="changePointPage(1)"
      >
        下一页
        <ChevronRight :size="16" />
      </button>
    </div>
  </div>
</section>
</template>
