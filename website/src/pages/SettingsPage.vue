<script setup lang="ts">
import { useAppContext } from "../composables/useAppContext";

const {
  Settings,
  Sparkles,
  Trophy,
  themeMode,
  playerPrefs,
  achievementNoticesEnabled,
  motionModeLabel,
  achievementNoticeLabel,
  activeSection,
  setThemeMode,
  setMotionMode,
  setAchievementNotices,
  resetPlayerPreferences,
} = useAppContext() as Record<string, any>;
</script>

<template>
<section
  v-if="activeSection === 'settings'"
  class="panel settings-panel"
  data-section="settings"
>
  <div class="section-head">
    <div>
      <p class="eyebrow">设置</p>
      <h2>偏好</h2>
    </div>
    <button
      class="secondary-action compact"
      type="button"
      @click="resetPlayerPreferences"
    >
      恢复
    </button>
  </div>

  <div class="settings-grid">
    <article class="settings-card">
      <header>
        <Settings :size="18" />
        <div>
          <strong>主题</strong>
          <span>下次保留</span>
        </div>
      </header>
      <div class="settings-segment">
        <button
          type="button"
          :class="{ active: themeMode === 'dark' }"
          @click="setThemeMode('dark')"
        >
          暗色
        </button>
        <button
          type="button"
          :class="{ active: themeMode === 'light' }"
          @click="setThemeMode('light')"
        >
          白色
        </button>
      </div>
    </article>

    <article class="settings-card">
      <header>
        <Sparkles :size="18" />
        <div>
          <strong>动效</strong>
          <span>当前 {{ motionModeLabel }}</span>
        </div>
      </header>
      <div class="settings-segment">
        <button
          type="button"
          :class="{ active: playerPrefs.motionMode === 'full' }"
          @click="setMotionMode('full')"
        >
          完整
        </button>
        <button
          type="button"
          :class="{ active: playerPrefs.motionMode === 'reduced' }"
          @click="setMotionMode('reduced')"
        >
          减少
        </button>
      </div>
    </article>

    <article class="settings-card">
      <header>
        <Trophy :size="18" />
        <div>
          <strong>成就提醒</strong>
          <span>当前 {{ achievementNoticeLabel }}</span>
        </div>
      </header>
      <div class="settings-segment">
        <button
          type="button"
          :class="{ active: achievementNoticesEnabled }"
          @click="setAchievementNotices(true)"
        >
          开启
        </button>
        <button
          type="button"
          :class="{ active: !achievementNoticesEnabled }"
          @click="setAchievementNotices(false)"
        >
          关闭
        </button>
      </div>
    </article>
  </div>
</section>
</template>
