<script setup lang="ts">
import { useAppContext } from "../composables/useAppContext";

const {
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  RefreshCw,
  Swords,
  Trophy,
  UserRound,
  formatDate,
  formatRewards,
  pveOverview,
  pveStagePage,
  pveStageTotalPages,
  pveStageTotal,
  pveRecords,
  pveRecordPage,
  pveRecordTotalPages,
  busy,
  isAuthed,
  activeSection,
  pveStages,
  pveFormation,
  pveRecentRecords,
  pveClearedCount,
  loadPveRecords,
  refreshPve,
  challengePveStage,
  changePveStagePage,
  changePveRecordPage,
  pvePowerPercent,
  pveStageLevelLabel,
} = useAppContext() as Record<string, any>;
</script>

<template>
<section
  v-if="activeSection === 'pve'"
  class="panel pve-panel"
  data-section="pve"
>
  <div class="section-head">
    <div>
      <p class="eyebrow">轻量关卡</p>
      <h2>星港挑战</h2>
    </div>
    <div class="section-actions">
      <button
        class="secondary-action compact"
        type="button"
        :disabled="busy.pve || busy.pveRecords"
        @click="refreshPve"
      >
        <RefreshCw
          :size="16"
          :class="{ spin: busy.pve || busy.pveRecords }"
        />
        刷新
      </button>
    </div>
  </div>

  <div v-if="!isAuthed" class="empty-state">
    <UserRound :size="30" />
    <strong>登录后挑战关卡</strong>
    <span>配置阵容后挑战</span>
  </div>
  <div v-else-if="busy.pve && !pveOverview" class="skeleton-grid">
    <span v-for="item in 4" :key="item"></span>
  </div>
  <template v-else>
    <div class="pve-summary">
      <article>
        <small>阵容战力</small>
        <strong>{{ pveFormation.totalPower }}</strong>
      </article>
      <article>
        <small>上阵卡片</small>
        <strong
          >{{ pveFormation.filledCount }} /
          {{ pveFormation.slotCount }}</strong
        >
      </article>
      <article>
        <small>开放关卡</small>
        <strong>{{ pveStageTotal }}</strong>
      </article>
      <article>
        <small>本页胜场</small>
        <strong>{{ pveClearedCount }}</strong>
      </article>
    </div>

    <div v-if="pveStages.length === 0" class="empty-state">
      <Trophy :size="30" />
      <strong>暂无开放关卡</strong>
      <span>稍后再来查看新的挑战。</span>
    </div>
    <div v-else class="pve-stage-grid">
      <article
        v-for="stage in pveStages"
        :key="stage.id"
        class="pve-stage-card"
      >
        <header>
          <span>{{ pveStageLevelLabel(stage) }}</span>
          <b>{{ stage.remainingAttempts }}/{{ stage.dailyLimit }} 次</b>
        </header>
        <h3>{{ stage.name }}</h3>
        <p>{{ stage.description || "完成挑战即可获得胜利奖励。" }}</p>

        <div
          class="pve-power-meter"
          :style="{ '--progress': `${pvePowerPercent(stage)}%` }"
        >
          <div>
            <span>我方 {{ pveFormation.totalPower }}</span>
            <span>敌方 {{ stage.enemyPower }}</span>
          </div>
          <i></i>
        </div>

        <dl class="pve-stage-meta">
          <div>
            <dt>推荐战力</dt>
            <dd>{{ stage.recommendedPower }}</dd>
          </div>
          <div>
            <dt>胜利奖励</dt>
            <dd>{{ formatRewards(stage.rewards) }}</dd>
          </div>
        </dl>

        <button
          class="primary-action wide"
          type="button"
          :disabled="busy.pveChallenge || !stage.canChallenge"
          @click="challengePveStage(stage)"
        >
          <LoaderCircle
            v-if="busy.pveChallenge"
            :size="17"
            class="spin"
          />
          <Swords v-else :size="17" />
          {{
            stage.canChallenge
              ? "挑战"
              : stage.unavailableReason || "不可挑战"
          }}
        </button>
      </article>
    </div>
    <div v-if="pveOverview && pveStageTotalPages > 1" class="pager">
      <button
        class="secondary-action compact"
        type="button"
        :disabled="pveStagePage <= 1 || busy.pve"
        @click="changePveStagePage(-1)"
      >
        <ChevronLeft :size="15" />
        上一页
      </button>
      <span>第 {{ pveStagePage }} / {{ pveStageTotalPages }} 页</span>
      <button
        class="secondary-action compact"
        type="button"
        :disabled="pveStagePage >= pveStageTotalPages || busy.pve"
        @click="changePveStagePage(1)"
      >
        下一页
        <ChevronRight :size="15" />
      </button>
    </div>

    <div class="pve-record-panel">
      <div class="section-subhead">
        <div>
          <p class="eyebrow">挑战记录</p>
          <h3>最近结算</h3>
        </div>
        <button
          class="secondary-action compact"
          type="button"
          :disabled="busy.pveRecords"
          @click="loadPveRecords(1)"
        >
          <RefreshCw :size="15" :class="{ spin: busy.pveRecords }" />
          更新
        </button>
      </div>
      <div v-if="busy.pveRecords && !pveRecords" class="skeleton-grid">
        <span v-for="item in 3" :key="item"></span>
      </div>
      <div v-else-if="pveRecentRecords.length === 0" class="empty-mini">
        暂无挑战记录
      </div>
      <div v-else class="pve-record-list">
        <article
          v-for="record in pveRecentRecords"
          :key="record.id"
          :class="{ success: record.success }"
        >
          <div>
            <strong>{{ record.stageName }}</strong>
            <span
              >{{ record.success ? "胜利" : "失败" }} ·
              {{ formatDate(record.createdAt) }}</span
            >
          </div>
          <small
            >战力 {{ record.formationPower }} /
            {{ record.enemyPower }}</small
          >
          <b>{{
            record.success
              ? formatRewards(record.rewards || undefined)
              : "未获得奖励"
          }}</b>
        </article>
      </div>
      <div v-if="pveRecords" class="pager">
        <button
          class="secondary-action compact"
          type="button"
          :disabled="pveRecordPage <= 1 || busy.pveRecords"
          @click="changePveRecordPage(-1)"
        >
          <ChevronLeft :size="15" />
          上一页
        </button>
        <span>第 {{ pveRecordPage }} / {{ pveRecordTotalPages }} 页</span>
        <button
          class="secondary-action compact"
          type="button"
          :disabled="
            pveRecordPage >= pveRecordTotalPages || busy.pveRecords
          "
          @click="changePveRecordPage(1)"
        >
          下一页
          <ChevronRight :size="15" />
        </button>
      </div>
    </div>
  </template>
</section>
</template>
