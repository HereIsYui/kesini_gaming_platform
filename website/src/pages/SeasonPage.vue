<script setup lang="ts">
import { useAppContext } from "../composables/useAppContext";

const {
  CalendarDays,
  Gift,
  History,
  LoaderCircle,
  RefreshCw,
  Store,
  Trophy,
  RouterLink,
  formatDate,
  formatRewards,
  currentUser,
  seasonOverview,
  seasonShopCounts,
  busy,
  isAuthed,
  activeSection,
  activeSeason,
  seasonPoints,
  seasonShopItems,
  seasonPointRecords,
  seasonLeaderboardRows,
  seasonRankText,
  publicPlayerName,
  publicProfileRoute,
  loadSeasonOverview,
  buySeasonShopItem,
  pointChangeClass,
  formatPointChange,
  seasonPointSourceLabel,
  leaderboardInitial,
  leaderboardRankLabel,
} = useAppContext() as Record<string, any>;
</script>

<template>
<section
  v-if="activeSection === 'season'"
  class="panel season-panel"
  data-section="season"
>
  <div class="section-head">
    <div>
      <p class="eyebrow">赛季远征</p>
      <h2>{{ activeSeason?.name || "当前赛季" }}</h2>
    </div>
    <div class="section-actions">
      <button
        class="secondary-action compact"
        type="button"
        :disabled="busy.season"
        @click="loadSeasonOverview"
      >
        <RefreshCw :size="16" :class="{ spin: busy.season }" />
        刷新
      </button>
    </div>
  </div>

  <div v-if="!isAuthed" class="empty-state">
    <CalendarDays :size="30" />
    <strong>登录后查看赛季</strong>
    <span>任务可得赛季积分</span>
  </div>
  <div
    v-else-if="busy.season && !seasonOverview"
    class="skeleton-grid season-skeleton"
  >
    <span v-for="item in 6" :key="item"></span>
  </div>
  <div v-else-if="!activeSeason" class="empty-state">
    <CalendarDays :size="30" />
    <strong>暂无开放赛季</strong>
    <span>新的赛季开放后会出现在这里。</span>
  </div>
  <div v-else class="season-content">
    <div class="season-hero">
      <div>
        <span class="type-pill">赛季进行中</span>
        <h3>{{ activeSeason.name }}</h3>
        <p>
          {{
            activeSeason.description ||
            "完成每日与周常任务，积累赛季积分。"
          }}
        </p>
        <small>
          {{ formatDate(activeSeason.startsAt) }} 至
          {{ formatDate(activeSeason.endsAt) }}
        </small>
      </div>
      <div class="season-score">
        <span>我的排名</span>
        <strong>{{ seasonRankText }}</strong>
        <small>累计 {{ seasonPoints.earned }} 赛季积分</small>
      </div>
    </div>

    <div class="season-summary">
      <article>
        <small>累计获得</small>
        <strong>{{ seasonPoints.earned }}</strong>
      </article>
      <article>
        <small>可用余额</small>
        <strong>{{ seasonPoints.balance }}</strong>
      </article>
      <article>
        <small>商店兑换项</small>
        <strong>{{ seasonShopItems.length }}</strong>
      </article>
      <article>
        <small>排行人数</small>
        <strong>{{ seasonLeaderboardRows.length }}</strong>
      </article>
    </div>

    <section class="season-block">
      <div class="section-subhead">
        <div>
          <p class="eyebrow">活动排行</p>
          <h3>赛季积分榜</h3>
        </div>
        <Trophy :size="22" />
      </div>
      <div v-if="seasonLeaderboardRows.length === 0" class="empty-mini">
        暂无排行记录
      </div>
      <div v-else class="season-rank-list">
        <RouterLink
          v-for="entry in seasonLeaderboardRows.slice(0, 10)"
          :key="entry.uid"
          class="season-rank-row"
          :class="{ mine: entry.uid === currentUser?.uid }"
          :to="publicProfileRoute(entry)"
        >
          <b>{{ leaderboardRankLabel(entry.rank) }}</b>
          <img
            v-if="entry.avatar"
            :src="entry.avatar"
            :alt="publicPlayerName(entry.nickname, entry.uid)"
          />
          <span v-else class="avatar-fallback small">
            {{ leaderboardInitial(entry) }}
          </span>
          <div>
            <strong>{{
              publicPlayerName(entry.nickname, entry.uid)
            }}</strong>
            <span>赛季积分</span>
          </div>
          <em>{{ entry.value }} 积分</em>
        </RouterLink>
      </div>
    </section>

    <section class="season-block">
      <div class="section-subhead">
        <div>
          <p class="eyebrow">赛季商店</p>
          <h3>积分兑换</h3>
        </div>
        <Store :size="22" />
      </div>
      <div v-if="seasonShopItems.length === 0" class="empty-mini">
        暂无可兑换奖励
      </div>
      <div v-else class="season-shop-grid">
        <article v-for="item in seasonShopItems" :key="item.id">
          <header>
            <div>
              <strong>{{ item.name }}</strong>
              <span>{{ item.description || "赛季限定兑换奖励" }}</span>
            </div>
            <b>{{ item.costPoints }} 积分</b>
          </header>
          <dl>
            <div>
              <dt>奖励</dt>
              <dd>{{ formatRewards(item.rewards) }}</dd>
            </div>
            <div>
              <dt>库存</dt>
              <dd>
                {{
                  item.remaining === null || item.remaining === undefined
                    ? "不限库存"
                    : `剩余 ${item.remaining}`
                }}
              </dd>
            </div>
            <div>
              <dt>限兑</dt>
              <dd>
                {{
                  item.userLimit
                    ? `${item.usedByUser || 0}/${item.userLimit}`
                    : "不限"
                }}
              </dd>
            </div>
          </dl>
          <div class="season-shop-actions">
            <input
              v-model.number="seasonShopCounts[item.id]"
              type="number"
              min="1"
              max="99"
              placeholder="1"
            />
            <button
              class="primary-action"
              type="button"
              :disabled="busy.seasonShop || !item.canBuy"
              @click="buySeasonShopItem(item)"
            >
              <LoaderCircle
                v-if="busy.seasonShop"
                :size="17"
                class="spin"
              />
              <Gift v-else :size="17" />
              {{
                item.canBuy
                  ? "兑换"
                  : item.unavailableReason || "不可兑换"
              }}
            </button>
          </div>
        </article>
      </div>
    </section>

    <section class="season-block">
      <div class="section-subhead">
        <div>
          <p class="eyebrow">积分记录</p>
          <h3>最近变动</h3>
        </div>
        <History :size="22" />
      </div>
      <div v-if="seasonPointRecords.length === 0" class="empty-mini">
        暂无赛季积分记录
      </div>
      <div v-else class="season-record-list">
        <article
          v-for="record in seasonPointRecords"
          :key="record.id"
          :class="pointChangeClass(record.changeAmount)"
        >
          <div>
            <strong>{{ record.title }}</strong>
            <span>
              {{ seasonPointSourceLabel(record.sourceType) }} ·
              {{ formatDate(record.createdAt) }}
            </span>
          </div>
          <b>{{ formatPointChange(record.changeAmount) }}</b>
        </article>
      </div>
    </section>
  </div>
</section>
</template>
