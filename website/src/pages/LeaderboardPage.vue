<script setup lang="ts">
import { useAppContext } from "../composables/useAppContext";

const {
  RefreshCw,
  Trophy,
  RouterLink,
  formatDate,
  leaderboardTabs,
  leaderboard,
  leaderboardError,
  activeLeaderboardMetric,
  busy,
  isAuthed,
  activeSection,
  activeLeaderboardTab,
  activeLeaderboardBoard,
  podiumEntries,
  leaderboardRows,
  publicPlayerName,
  publicProfileRoute,
  loadLeaderboard,
  leaderboardInitial,
  formatLeaderboardValue,
  leaderboardRankLabel,
} = useAppContext() as Record<string, any>;
</script>

<template>
<section
  v-if="activeSection === 'leaderboard'"
  class="panel leaderboard-panel"
  data-section="leaderboard"
>
  <div class="section-head">
    <div>
      <p class="eyebrow">玩家排行</p>
      <h2>收藏榜单</h2>
    </div>
    <div class="section-actions">
      <button
        class="secondary-action compact"
        type="button"
        :disabled="busy.leaderboard"
        @click="loadLeaderboard"
      >
        <RefreshCw :size="16" :class="{ spin: busy.leaderboard }" />
        刷新
      </button>
    </div>
  </div>

  <div v-if="!isAuthed" class="empty-state">
    <Trophy :size="30" />
    <strong>登录后查看排行榜</strong>
    <span>按当前收藏排名</span>
  </div>
  <div
    v-else-if="busy.leaderboard && !leaderboard"
    class="skeleton-grid leaderboard-skeleton"
  >
    <span v-for="item in 6" :key="item"></span>
  </div>
  <div v-else-if="leaderboardError" class="empty-state">
    <Trophy :size="30" />
    <strong>排行榜加载失败</strong>
    <span>{{ leaderboardError }}</span>
    <button
      class="secondary-action"
      type="button"
      @click="loadLeaderboard"
    >
      重新加载
    </button>
  </div>
  <div v-else class="leaderboard-content">
    <div class="leaderboard-tabs" role="tablist" aria-label="排行榜类型">
      <button
        v-for="tab in leaderboardTabs"
        :key="tab.key"
        type="button"
        :class="{ active: activeLeaderboardMetric === tab.key }"
        @click="activeLeaderboardMetric = tab.key"
      >
        <strong>{{ tab.label }}</strong>
        <span>{{ tab.hint }}</span>
      </button>
    </div>

    <div v-if="activeLeaderboardBoard?.me" class="my-rank-card">
      <div>
        <small>我的排名</small>
        <strong>{{
          leaderboardRankLabel(activeLeaderboardBoard.me.rank)
        }}</strong>
      </div>
      <div>
        <small>{{ activeLeaderboardTab.label }}</small>
        <strong>{{
          formatLeaderboardValue(activeLeaderboardBoard.me.value)
        }}</strong>
      </div>
      <span>{{ activeLeaderboardTab.hint }}</span>
    </div>

    <div v-if="!activeLeaderboardBoard?.list.length" class="empty-state">
      <Trophy :size="30" />
      <strong>当前暂无上榜玩家</strong>
      <span>获得卡片后榜单会自动更新。</span>
    </div>
    <div v-else class="leaderboard-board">
      <div class="podium-grid">
        <RouterLink
          v-for="entry in podiumEntries"
          :key="`podium-${activeLeaderboardMetric}-${entry.uid}`"
          class="podium-card"
          :class="`rank-${entry.rank}`"
          :to="publicProfileRoute(entry)"
        >
          <span class="rank-badge">{{
            leaderboardRankLabel(entry.rank)
          }}</span>
          <img
            v-if="entry.avatar"
            :src="entry.avatar"
            :alt="publicPlayerName(entry.nickname, entry.uid)"
          />
          <span v-else class="avatar-fallback">{{
            leaderboardInitial(entry)
          }}</span>
          <h3>{{ publicPlayerName(entry.nickname, entry.uid) }}</h3>
          <p>{{ activeLeaderboardTab.label }}</p>
          <strong>{{ formatLeaderboardValue(entry.value) }}</strong>
        </RouterLink>
      </div>

      <div v-if="leaderboardRows.length" class="leaderboard-list">
        <RouterLink
          v-for="entry in leaderboardRows"
          :key="`${activeLeaderboardMetric}-${entry.uid}`"
          class="leaderboard-row"
          :class="{ mine: entry.uid === activeLeaderboardBoard?.me?.uid }"
          :to="publicProfileRoute(entry)"
        >
          <b>{{ leaderboardRankLabel(entry.rank) }}</b>
          <img
            v-if="entry.avatar"
            :src="entry.avatar"
            :alt="publicPlayerName(entry.nickname, entry.uid)"
          />
          <span v-else class="avatar-fallback small">{{
            leaderboardInitial(entry)
          }}</span>
          <div>
            <strong>{{
              publicPlayerName(entry.nickname, entry.uid)
            }}</strong>
            <span>{{ activeLeaderboardTab.label }}</span>
          </div>
          <em>{{ formatLeaderboardValue(entry.value) }}</em>
        </RouterLink>
      </div>
    </div>

    <p class="leaderboard-time">
      更新时间：{{ formatDate(leaderboard?.generatedAt) }}
    </p>
  </div>
</section>
</template>
