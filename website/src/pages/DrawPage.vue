<script setup lang="ts">
import { useAppContext } from "../composables/useAppContext";

const {
  Coins,
  Gift,
  History,
  LoaderCircle,
  LogIn,
  Package,
  ShieldCheck,
  Sparkles,
  Ticket,
  UserRound,
  WandSparkles,
  formatDate,
  formatRewards,
  poolTypeLabel,
  rarityClass,
  manualToken,
  manualLoginEnabled,
  currentUser,
  pools,
  activePoolId,
  stats,
  fishpiPoint,
  fishpiPointError,
  rechargeConfig,
  dailySignIn,
  lastResults,
  callbackBusy,
  drawPhase,
  busy,
  isAuthed,
  activeSection,
  playerDisplayName,
  playerInitial,
  playerStatusLabel,
  fishpiPointLabel,
  launchActivityInfo,
  hasLaunchActivityReward,
  dailySignInWeek,
  dailySignInCycleDay,
  dailySignInRewardPoints,
  selectedPool,
  selectedDrawCosts,
  selectedPityPercent,
  selectedPityText,
  rechargeRangeLabel,
  bestResult,
  drawPhaseText,
  loginWithOpenId,
  applyManualToken,
  openPoolDetail,
  openDrawHistory,
  openRechargeModal,
  openLaunchActivityModal,
  claimDailySignIn,
  performDraw,
  openLastResults,
} = useAppContext() as Record<string, any>;
</script>

<template>
<section
  v-if="activeSection === 'draw'"
  class="hero-grid"
  data-section="draw"
>
  <div class="panel draw-panel">
    <div class="panel-heading">
      <div>
        <p class="eyebrow">当前卡池</p>
        <h1>{{ selectedPool?.pool_name || "等待同步" }}</h1>
      </div>
      <div class="pool-heading-actions">
        <span class="type-pill">{{
          poolTypeLabel(selectedPool?.card_type)
        }}</span>
        <button
          class="secondary-action compact"
          type="button"
          :disabled="!activePoolId || busy.public"
          @click="openPoolDetail"
        >
          <Package :size="16" />
          图鉴
        </button>
      </div>
    </div>

    <p class="pool-desc">
      {{ selectedPool?.card_desc || "选择卡池抽取" }}
    </p>

    <div class="pool-strip" aria-label="卡池列表">
      <button
        v-for="pool in pools"
        :key="pool.id"
        type="button"
        class="pool-chip"
        :class="{ active: activePoolId === pool.id }"
        @click="activePoolId = pool.id"
      >
        <span>{{ pool.pool_name }}</span>
        <small>{{ poolTypeLabel(pool.card_type) }} · 消耗见操作区</small>
      </button>
      <div v-if="!busy.public && pools.length === 0" class="empty-inline">
        暂无可用卡池
      </div>
    </div>

    <div class="summon-stage">
      <div
        class="summon-core"
        :class="{
          drawing: busy.drawing,
          'summon-charging': drawPhase === 'charging',
          'summon-burst': drawPhase === 'burst',
        }"
      >
        <div class="orbit orbit-one"></div>
        <div class="orbit orbit-two"></div>
        <div class="summon-flare"></div>
        <WandSparkles :size="44" />
        <strong
          class="card-name summon-card-name"
          :class="bestResult ? rarityClass(bestResult.rarity) : ''"
        >
          {{ bestResult?.cardName || "星轨待命" }}
        </strong>
        <span>{{ drawPhaseText }}</span>
      </div>

      <div class="draw-actions">
        <div class="cost-board">
          <div>
            <span>星穹币余额</span>
            <strong>{{
              isAuthed ? (stats?.point ?? 0) : "未登录"
            }}</strong>
          </div>
          <div>
            <span>单抽</span>
            <strong>{{ selectedDrawCosts.once }} 星穹币</strong>
          </div>
          <div>
            <span>十连</span>
            <strong>{{ selectedDrawCosts.ten }} 星穹币</strong>
          </div>
        </div>
        <div
          v-if="isAuthed"
          class="pity-progress-card"
          :style="{ '--pity-progress': `${selectedPityPercent}%` }"
        >
          <div>
            <span>保底进度</span>
            <strong>{{ selectedPityText }}</strong>
          </div>
          <i aria-hidden="true"></i>
        </div>
        <button
          class="primary-action"
          type="button"
          :disabled="busy.drawing"
          @click="performDraw('once')"
        >
          <Sparkles :size="18" />
          单抽 · {{ selectedDrawCosts.once }} 星穹币
        </button>
        <button
          class="primary-action golden"
          type="button"
          :disabled="busy.drawing"
          @click="performDraw('ten')"
        >
          <Ticket :size="18" />
          十连 · {{ selectedDrawCosts.ten }} 星穹币
        </button>
        <button
          class="secondary-action wide"
          type="button"
          :disabled="busy.drawing || lastResults.length === 0"
          @click="openLastResults"
        >
          <Sparkles :size="18" />
          查看上次结果
        </button>
      </div>
    </div>
  </div>

  <aside class="panel auth-panel identity-card">
    <div v-if="isAuthed" class="player-profile">
      <div class="player-avatar">
        <img
          v-if="currentUser?.avatar"
          :src="currentUser.avatar"
          :alt="playerDisplayName"
        />
        <span v-else>{{ playerInitial }}</span>
      </div>
      <div class="player-info">
        <p class="eyebrow">玩家身份</p>
        <h2>{{ playerDisplayName }}</h2>
        <span>{{ playerStatusLabel }}</span>
      </div>
      <span class="status-pill online">
        <span class="status-dot online"></span>
        在线
      </span>
    </div>

    <div v-else class="identity-login-head">
      <div class="player-avatar guest">
        <UserRound :size="28" />
      </div>
      <div>
        <p class="eyebrow">玩家身份</p>
        <h2>登录后同步资产</h2>
        <span>抽卡、交易、收藏</span>
      </div>
    </div>

    <div v-if="isAuthed" class="point-card">
      <div class="point-card-head">
        <span>资产余额</span>
        <div class="point-card-actions">
          <span
            class="fishpi-point-hint"
            :class="{ muted: fishpiPointError && !fishpiPoint }"
          >
            鱼排积分 <b>{{ fishpiPointLabel }}</b>
          </span>
          <button
            class="recharge-trigger"
            type="button"
            :disabled="busy.recharge || rechargeConfig?.enabled === false"
            @click="openRechargeModal"
          >
            <Coins :size="15" />
            充值
          </button>
        </div>
      </div>
      <div class="point-card-metrics">
        <div>
          <span>星穹币</span>
          <strong>{{ stats?.point || 0 }}</strong>
        </div>
      </div>
      <small>
        当前卡池 {{ selectedPool?.pool_name || "未选择" }} · 充值
        {{ rechargeRangeLabel }}
      </small>
    </div>

    <div v-if="isAuthed" class="sign-in-card">
      <div class="sign-in-main">
        <div>
          <span>每日签到</span>
          <strong>第 {{ dailySignInCycleDay }} 天</strong>
        </div>
        <b>+{{ dailySignInRewardPoints }}</b>
      </div>
      <div class="sign-in-week" aria-label="七日签到">
        <span
          v-for="day in dailySignInWeek"
          :key="day.day"
          class="sign-in-day"
          :class="{
            signed: day.signed,
            current: day.current,
            bonus: day.rewardPoints >= 100,
          }"
        >
          {{ day.rewardPoints >= 100 ? "100" : day.day }}
        </span>
      </div>
      <button
        class="primary-action compact sign-in-action"
        type="button"
        :disabled="busy.signIn || dailySignIn?.signedToday"
        @click="claimDailySignIn"
      >
        <LoaderCircle v-if="busy.signIn" :size="15" class="spin" />
        {{ dailySignIn?.signedToday ? "已签" : "签到" }}
      </button>
    </div>

    <div v-if="hasLaunchActivityReward" class="launch-activity-callout">
      <div>
        <span>开服福利待领取</span>
        <strong>{{ launchActivityInfo?.name || "开服福利" }}</strong>
        <small>{{ formatRewards(launchActivityInfo?.rewards) }}</small>
      </div>
      <button
        class="secondary-action compact"
        type="button"
        :disabled="busy.launchActivity"
        @click="openLaunchActivityModal"
      >
        <Gift :size="15" />
        领取
      </button>
    </div>

    <div v-if="isAuthed" class="player-metrics">
      <article>
        <small>累计抽数</small>
        <strong>{{ stats?.totalDraws || 0 }}</strong>
      </article>
      <article>
        <small>UR 收藏</small>
        <strong>{{ stats?.cardCounts?.UR || 0 }}</strong>
      </article>
      <article>
        <small>SSR 收藏</small>
        <strong>{{ stats?.cardCounts?.SSR || 0 }}</strong>
      </article>
    </div>

    <div v-if="isAuthed" class="identity-status-list">
      <div>
        <span>最近最高结果</span>
        <strong>{{
          bestResult
            ? `${bestResult.rarity} · ${bestResult.cardName}`
            : "暂无抽卡结果"
        }}</strong>
      </div>
      <div>
        <span>资产状态</span>
        <strong>已同步当前星穹币、背包与收藏</strong>
      </div>
    </div>

    <div v-if="!isAuthed" class="login-stack">
      <button
        class="primary-action wide"
        type="button"
        :disabled="busy.auth || callbackBusy"
        @click="loginWithOpenId"
      >
        <LoaderCircle
          v-if="busy.auth || callbackBusy"
          :size="18"
          class="spin"
        />
        <LogIn v-else :size="18" />
        登录
      </button>
      <label v-if="manualLoginEnabled" class="token-box debug-token-box">
        <span>登录口令</span>
        <textarea v-model="manualToken" placeholder="粘贴口令"></textarea>
      </label>
      <button
        v-if="manualLoginEnabled"
        class="secondary-action wide"
        type="button"
        @click="applyManualToken"
      >
        <ShieldCheck :size="18" />
        进入
      </button>
    </div>
  </aside>
</section>

<section v-if="activeSection === 'draw'" class="panel recent-panel">
  <div class="section-head">
    <div>
      <p class="eyebrow">最近记录</p>
      <h2>抽卡脉冲</h2>
    </div>
    <button
      class="secondary-action compact"
      type="button"
      :disabled="!isAuthed || busy.drawHistory"
      @click="openDrawHistory"
    >
      <History :size="16" />
      查看全部
    </button>
  </div>
  <div v-if="!stats?.recentDraws?.length" class="empty-mini">
    暂无最近抽卡记录
  </div>
  <div v-else class="recent-list">
    <article
      v-for="(record, index) in stats.recentDraws"
      :key="`${record.createdAt}-${index}`"
    >
      <strong>{{ record.count }} 抽</strong>
      <span>{{ record.cardLevels.join(" / ") || "未记录稀有度" }}</span>
      <time>{{ formatDate(record.createdAt) }}</time>
    </article>
  </div>
</section>
</template>
