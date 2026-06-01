<script setup lang="ts">
import { useAppContext } from "../composables/useAppContext";

const {
  RefreshCw,
  Swords,
  UserRound,
  cardMediaUrl,
  hasCardMedia,
  hideBrokenCardMedia,
  isCardVideo,
  cardTypeLabel,
  formation,
  busy,
  isAuthed,
  activeSection,
  formationSlots,
  formationFilledCount,
  loadFormation,
  openFormationPicker,
  saveFormationSlot,
  cardIntroText,
  openFormationCardDetail,
  isNewCard,
} = useAppContext() as Record<string, any>;
</script>

<template>
<section
  v-if="activeSection === 'formation'"
  class="panel formation-panel"
  data-section="formation"
>
  <div class="section-head">
    <div>
      <p class="eyebrow">阵容编队</p>
      <h2>出战卡组</h2>
    </div>
    <div class="section-actions">
      <button
        class="secondary-action compact"
        type="button"
        :disabled="busy.formation"
        @click="loadFormation()"
      >
        <RefreshCw :size="16" :class="{ spin: busy.formation }" />
        刷新
      </button>
    </div>
  </div>

  <div v-if="!isAuthed" class="empty-state">
    <UserRound :size="30" />
    <strong>登录后配置阵容</strong>
    <span>选择已拥有的卡片组成出战卡组。</span>
  </div>
  <div v-else-if="busy.formation && !formation" class="skeleton-grid">
    <span v-for="item in 3" :key="item"></span>
  </div>
  <template v-else>
    <div class="formation-summary">
      <article>
        <small>总战力</small>
        <strong>{{ formation?.totalPower || 0 }}</strong>
      </article>
      <article>
        <small>上阵</small>
        <strong
          >{{ formationFilledCount }} /
          {{ formation?.slotCount || 3 }}</strong
        >
      </article>
      <article>
        <small>当前目标</small>
        <strong>编队成型</strong>
      </article>
    </div>

    <div class="formation-slot-grid">
      <article
        v-for="slot in formationSlots"
        :key="slot.position"
        class="formation-slot"
        :class="{ empty: !slot.card }"
      >
        <header>
          <span>位置 {{ slot.position }}</span>
          <b v-if="slot.card">战力 {{ slot.card.power }}</b>
          <b v-else>待上阵</b>
        </header>
        <template v-if="slot.card">
          <div
            class="formation-card-media clickable-card-area"
            :class="{ 'has-media': hasCardMedia(slot.card.cardImage) }"
            role="button"
            tabindex="0"
            @click="openFormationCardDetail(slot.card)"
            @keydown.enter.prevent="openFormationCardDetail(slot.card)"
            @keydown.space.prevent="openFormationCardDetail(slot.card)"
          >
            <video
              v-if="isCardVideo(slot.card.cardImage)"
              class="card-art-media"
              :src="cardMediaUrl(slot.card.cardImage)"
              muted
              loop
              autoplay
              playsinline
              @error="hideBrokenCardMedia"
            />
            <img
              v-else-if="cardMediaUrl(slot.card.cardImage)"
              class="card-art-media"
              :src="cardMediaUrl(slot.card.cardImage)"
              :alt="slot.card.cardName"
              @error="hideBrokenCardMedia"
            />
            <span class="rarity-badge">{{ slot.card.cardLevel }}</span>
            <span
              v-if="isNewCard(slot.card)"
              class="new-card-badge"
              aria-label="新获得"
            >
              NEW
            </span>
          </div>
          <div
            class="formation-card-body clickable-card-area"
            role="button"
            tabindex="0"
            @click="openFormationCardDetail(slot.card)"
            @keydown.enter.prevent="openFormationCardDetail(slot.card)"
            @keydown.space.prevent="openFormationCardDetail(slot.card)"
          >
            <h3>{{ slot.card.cardName }}</h3>
            <p>{{ cardIntroText(slot.card.cardDesc) }}</p>
            <div class="tag-row">
              <span>Lv.{{ slot.card.cultivationLevel || 1 }}</span>
              <span>{{ cardTypeLabel(slot.card.cardType) }}</span>
              <span v-if="slot.card.locked">已锁定</span>
            </div>
          </div>
          <footer>
            <button
              class="secondary-action compact"
              type="button"
              :disabled="busy.formation"
              @click="openFormationPicker(slot.position)"
            >
              <Swords :size="15" />
              更换
            </button>
            <button
              class="danger-action compact"
              type="button"
              :disabled="busy.formation"
              @click="saveFormationSlot(slot.position, null)"
            >
              移除
            </button>
          </footer>
        </template>
        <button
          v-else
          class="formation-empty-action"
          type="button"
          :disabled="busy.formation"
          @click="openFormationPicker(slot.position)"
        >
          <Swords :size="22" />
          <span>选择卡片</span>
        </button>
      </article>
    </div>
  </template>
</section>
</template>
