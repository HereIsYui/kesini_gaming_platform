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
  guildLeaderboard,
  guildLeaderboardError,
  activeLeaderboardScope,
  activeLeaderboardMetric,
  busy,
  isAuthed,
  activeSection,
  activeLeaderboardTab,
  activeLeaderboardBoard,
  podiumEntries,
  leaderboardRows,
  guildPodiumEntries,
  guildLeaderboardListRows,
  publicPlayerName,
  publicProfileRoute,
  loadLeaderboard,
  leaderboardInitial,
  guildLeaderboardInitial,
  formatLeaderboardValue,
  formatGuildLeaderboardValue,
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
      <p class="eyebrow">排行</p>
      <h2>排行榜</h2>
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
    <strong>请先登录</strong>
    <span>登录后查看</span>
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
    <div class="leaderboard-scope" role="tablist" aria-label="排行">
      <button
        type="button"
        :class="{ active: activeLeaderboardScope === 'player' }"
        @click="activeLeaderboardScope = 'player'"
      >
        玩家
      </button>
      <button
        type="button"
        :class="{ active: activeLeaderboardScope === 'guild' }"
        @click="activeLeaderboardScope = 'guild'"
      >
        公会
      </button>
    </div>

    <template v-if="activeLeaderboardScope === 'player'">
      <div class="leaderboard-tabs" role="tablist" aria-label="玩家排行">
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
      <span>产生记录后自动更新。</span>
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
    </template>

    <template v-else>
      <div v-if="guildLeaderboard?.me" class="my-rank-card">
        <div>
          <small>公会排名</small>
          <strong>{{ leaderboardRankLabel(guildLeaderboard.me.rank) }}</strong>
        </div>
        <div>
          <small>总战力</small>
          <strong>{{ formatGuildLeaderboardValue(guildLeaderboard.me.value) }}</strong>
        </div>
        <span>{{ guildLeaderboard.me.name }}</span>
      </div>

      <div v-if="guildLeaderboardError" class="empty-state">
        <Trophy :size="30" />
        <strong>加载失败</strong>
        <span>{{ guildLeaderboardError }}</span>
      </div>
      <div v-else-if="!guildLeaderboard?.list.length" class="empty-state">
        <Trophy :size="30" />
        <strong>暂无公会</strong>
        <span>暂无排行</span>
      </div>
      <div v-else class="leaderboard-board">
        <div class="podium-grid">
          <article
            v-for="entry in guildPodiumEntries"
            :key="`guild-podium-${entry.id}`"
            class="podium-card"
            :class="`rank-${entry.rank}`"
          >
            <span class="rank-badge">{{
              leaderboardRankLabel(entry.rank)
            }}</span>
            <span class="avatar-fallback">{{
              guildLeaderboardInitial(entry)
            }}</span>
            <h3>{{ entry.name }}</h3>
            <p>总战力</p>
            <strong>{{ formatGuildLeaderboardValue(entry.value) }}</strong>
          </article>
        </div>

        <div v-if="guildLeaderboardListRows.length" class="leaderboard-list">
          <article
            v-for="entry in guildLeaderboardListRows"
            :key="`guild-${entry.id}`"
            class="leaderboard-row"
            :class="{ mine: entry.id === guildLeaderboard?.me?.id }"
          >
            <b>{{ leaderboardRankLabel(entry.rank) }}</b>
            <span class="avatar-fallback small">{{
              guildLeaderboardInitial(entry)
            }}</span>
            <div>
              <strong>{{ entry.name }}</strong>
              <span>Lv.{{ entry.level }} · {{ entry.memberCount }}/{{ entry.memberLimit }}</span>
            </div>
            <em>{{ formatGuildLeaderboardValue(entry.value) }}</em>
          </article>
        </div>
      </div>
    </template>

    <p class="leaderboard-time">
      更新时间：{{
        formatDate(
          activeLeaderboardScope === 'guild'
            ? guildLeaderboard?.generatedAt
            : leaderboard?.generatedAt,
        )
      }}
    </p>
  </div>
</section>
</template>
