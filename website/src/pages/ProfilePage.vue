<script setup lang="ts">
import { useAppContext } from "../composables/useAppContext";

const {
  LoaderCircle,
  Package,
  RefreshCw,
  Share2,
  UserRound,
  UsersRound,
  cardMediaUrl,
  hasCardMedia,
  hideBrokenCardMedia,
  isCardVideo,
  cardTypeLabel,
  rarityClass,
  playerProfile,
  busy,
  isAuthed,
  activeSection,
  isPublicProfileRoute,
  profileDisplayName,
  profileInitial,
  profileCanEdit,
  profileShareUrl,
  profileCardCountRows,
  profileShowcase,
  profileFormation,
  showProfileFriendAction,
  profileFriendActionLabel,
  profileFriendStatusLabel,
  profileFriendActionDisabled,
  loadPlayerProfile,
  openProfilePicker,
  copyProfileLink,
  handleProfileFriendAction,
  shortCardIntro,
  openShowcaseCardDetail,
} = useAppContext() as Record<string, any>;
</script>

<template>
<section
  v-if="activeSection === 'profile'"
  class="panel profile-panel"
  data-section="profile"
>
  <div class="section-head">
    <div>
      <p class="eyebrow">
        {{ profileCanEdit ? "我的主页" : "玩家主页" }}
      </p>
      <h2>{{ profileDisplayName }}</h2>
    </div>
    <div class="section-actions profile-actions">
      <button
        v-if="profileCanEdit"
        class="primary-action compact"
        type="button"
        :disabled="busy.profile || busy.profileCandidates"
        @click="openProfilePicker"
      >
        <Package :size="16" />
        编辑
      </button>
      <button
        v-if="showProfileFriendAction"
        class="primary-action compact"
        type="button"
        :disabled="profileFriendActionDisabled"
        @click="handleProfileFriendAction"
      >
        <UsersRound :size="16" />
        {{ profileFriendActionLabel }}
      </button>
      <button
        v-if="profileShareUrl"
        class="secondary-action compact"
        type="button"
        @click="copyProfileLink"
      >
        <Share2 :size="16" />
        复制
      </button>
      <button
        class="secondary-action compact"
        type="button"
        :disabled="busy.profile"
        @click="loadPlayerProfile()"
      >
        <RefreshCw :size="16" :class="{ spin: busy.profile }" />
        刷新
      </button>
    </div>
  </div>

  <div v-if="!isPublicProfileRoute && !isAuthed" class="empty-state">
    <UserRound :size="30" />
    <strong>登录后查看主页</strong>
    <span>展示卡片和战力。</span>
  </div>
  <div v-else-if="busy.profile && !playerProfile" class="empty-state">
    <LoaderCircle :size="30" class="spin" />
    <strong>正在读取主页</strong>
    <span>稍候片刻</span>
  </div>
  <div v-else-if="!playerProfile" class="empty-state">
    <UserRound :size="30" />
    <strong>暂无主页</strong>
    <span>玩家资料未找到。</span>
  </div>
  <template v-else>
    <div class="profile-hero">
      <div class="profile-avatar">
        <img
          v-if="playerProfile.user.avatar"
          :src="playerProfile.user.avatar"
          :alt="profileDisplayName"
        />
        <span v-else>{{ profileInitial }}</span>
      </div>
      <div>
        <p class="eyebrow">玩家名片</p>
        <h3>{{ profileDisplayName }}</h3>
        <span>{{ profileCanEdit ? "我的主页" : "公开主页" }}</span>
        <span v-if="profileFriendStatusLabel" class="profile-status-pill">
          {{ profileFriendStatusLabel }}
        </span>
      </div>
    </div>

    <div class="profile-summary">
      <article>
        <small>收藏</small>
        <strong>{{ playerProfile.user.totalCards }}</strong>
      </article>
      <article>
        <small>展示</small>
        <strong>{{ profileShowcase.length }}</strong>
      </article>
      <article>
        <small>阵容</small>
        <strong>{{ profileFormation.totalPower }}</strong>
      </article>
      <article>
        <small>上阵</small>
        <strong>
          {{ profileFormation.filledCount }}/{{
            profileFormation.slotCount
          }}
        </strong>
      </article>
    </div>

    <div class="profile-rarity-strip" aria-label="稀有度收藏">
      <span
        v-for="row in profileCardCountRows"
        :key="row.rarity"
        class="summary-pill"
        :class="rarityClass(row.rarity)"
      >
        {{ row.rarity }} {{ row.count }}
      </span>
    </div>

    <section class="profile-block">
      <div class="section-title-row">
        <div>
          <p class="eyebrow">展示墙</p>
          <h3>精选卡片</h3>
        </div>
      </div>
      <div
        v-if="profileShowcase.length === 0"
        class="empty-state compact"
      >
        <Package :size="26" />
        <strong>暂无展示</strong>
        <span>公开主页会展示精选卡片。</span>
      </div>
      <div v-else class="showcase-grid">
        <article
          v-for="card in profileShowcase"
          :key="card.uuid"
          class="result-card showcase-card clickable-card-area"
          :class="rarityClass(card.cardLevel)"
          role="button"
          tabindex="0"
          @click="openShowcaseCardDetail(card)"
          @keydown.enter.prevent="openShowcaseCardDetail(card)"
          @keydown.space.prevent="openShowcaseCardDetail(card)"
        >
          <div class="card-face">
            <div
              class="card-media-frame"
              :class="{ 'has-media': hasCardMedia(card.cardImage) }"
            >
              <video
                v-if="isCardVideo(card.cardImage)"
                class="card-art-media"
                :src="cardMediaUrl(card.cardImage)"
                muted
                loop
                autoplay
                playsinline
                @error="hideBrokenCardMedia"
              />
              <img
                v-else-if="cardMediaUrl(card.cardImage)"
                class="card-art-media"
                :src="cardMediaUrl(card.cardImage)"
                :alt="card.cardName"
                @error="hideBrokenCardMedia"
              />
              <div class="card-sigil"></div>
              <div class="result-card-top">
                <span class="rarity-badge">{{ card.cardLevel }}</span>
                <div class="card-top-right">
                  <span class="card-type-pill">
                    {{ cardTypeLabel(card.cardType) }}
                  </span>
                </div>
              </div>
            </div>
            <div class="card-content">
              <h3 class="card-name">{{ card.cardName }}</h3>
              <p>{{ shortCardIntro(card.cardDesc) }}</p>
              <div class="tag-row">
                <span>Lv.{{ card.cultivationLevel || 1 }}</span>
                <span>战力 {{ card.power || 0 }}</span>
              </div>
            </div>
          </div>
        </article>
      </div>
    </section>
  </template>
</section>
</template>
