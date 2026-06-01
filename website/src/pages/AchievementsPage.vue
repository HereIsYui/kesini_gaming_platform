<script setup lang="ts">
import { useAppContext } from "../composables/useAppContext";

const {
  RefreshCw,
  ShieldCheck,
  Trophy,
  formatRewards,
  achievements,
  achievementStatusFilter,
  achievementCategoryFilter,
  achievementKeyword,
  busy,
  isAuthed,
  activeSection,
  achievementCategories,
  achievementGroups,
  achievementVisibleCount,
  achievementUnlockedCount,
  achievementProgressingCount,
  achievementCompletionPercent,
  loadAchievements,
  achievementProgressPercent,
  achievementProgressText,
  resetAchievementFilters,
  achievementScopeLabel,
} = useAppContext() as Record<string, any>;
</script>

<template>
<section
  v-if="activeSection === 'achievements'"
  class="panel achievement-panel"
  data-section="achievements"
>
  <div class="section-head">
    <div>
      <p class="eyebrow">成就图鉴</p>
      <h2>目标进度</h2>
    </div>
    <div class="section-actions">
      <button
        class="secondary-action compact"
        type="button"
        :disabled="busy.achievements"
        @click="loadAchievements"
      >
        <RefreshCw :size="16" :class="{ spin: busy.achievements }" />
        刷新
      </button>
    </div>
  </div>

  <div v-if="!isAuthed" class="empty-state">
    <ShieldCheck :size="30" />
    <strong>登录后查看成就</strong>
    <span>记录会累计进度</span>
  </div>
  <div
    v-else-if="busy.achievements && achievements.length === 0"
    class="skeleton-grid achievement-skeleton"
  >
    <span v-for="item in 6" :key="item"></span>
  </div>
  <div v-else-if="achievements.length === 0" class="empty-state">
    <Trophy :size="30" />
    <strong>暂无可见成就</strong>
    <span>新的目标开放后会出现在这里。</span>
  </div>
  <div v-else class="achievement-content">
    <div class="achievement-filter-bar">
      <div class="segmented-control">
        <button
          type="button"
          :class="{ active: achievementStatusFilter === 'all' }"
          @click="achievementStatusFilter = 'all'"
        >
          全部
        </button>
        <button
          type="button"
          :class="{ active: achievementStatusFilter === 'achieved' }"
          @click="achievementStatusFilter = 'achieved'"
        >
          已达成
        </button>
        <button
          type="button"
          :class="{ active: achievementStatusFilter === 'progressing' }"
          @click="achievementStatusFilter = 'progressing'"
        >
          进行中
        </button>
      </div>
      <select v-model="achievementCategoryFilter">
        <option value="">全部分类</option>
        <option
          v-for="category in achievementCategories"
          :key="category"
          :value="category"
        >
          {{ category }}
        </option>
      </select>
      <input
        v-model="achievementKeyword"
        type="search"
        placeholder="搜索成就"
      />
      <button
        class="secondary-action"
        type="button"
        @click="resetAchievementFilters"
      >
        重置
      </button>
    </div>

    <div class="achievement-summary">
      <article>
        <small>已达成</small>
        <strong>{{ achievementUnlockedCount }}</strong>
      </article>
      <article>
        <small>进行中</small>
        <strong>{{ achievementProgressingCount }}</strong>
      </article>
      <article>
        <small>完成度</small>
        <strong>{{ achievementCompletionPercent }}%</strong>
      </article>
    </div>

    <div v-if="achievementVisibleCount === 0" class="empty-state compact">
      <Trophy :size="26" />
      <strong>暂无匹配</strong>
      <span>换个条件试试</span>
    </div>
    <template v-else>
      <section
        v-for="group in achievementGroups"
        :key="group.category"
        class="achievement-group"
      >
        <div class="achievement-group-head">
          <h3>{{ group.category }}</h3>
          <span>{{ group.list.length }} 项</span>
        </div>
        <div class="achievement-grid">
          <article
            v-for="achievement in group.list"
            :key="achievement.id"
            class="achievement-card"
            :class="{ achieved: achievement.achieved }"
            :style="{
              '--progress': `${achievementProgressPercent(achievement)}%`,
            }"
          >
            <header>
              <span class="achievement-icon">
                <Trophy v-if="achievement.achieved" :size="17" />
                <ShieldCheck v-else :size="17" />
              </span>
              <div>
                <strong>{{ achievement.name }}</strong>
                <small>{{ achievement.targetLabel }}</small>
              </div>
              <b>{{ achievement.achieved ? "已达成" : "进行中" }}</b>
            </header>
            <p>
              {{ achievement.description || "完成目标后自动发放奖励。" }}
            </p>
            <div class="achievement-meta">
              <span>{{ achievementScopeLabel(achievement) }}</span>
              <span>{{ achievementProgressText(achievement) }}</span>
            </div>
            <div class="achievement-progress" aria-hidden="true">
              <i></i>
            </div>
            <footer>
              <span>奖励</span>
              <strong>{{ formatRewards(achievement.rewards) }}</strong>
            </footer>
          </article>
        </div>
      </section>
    </template>
  </div>
</section>
</template>
