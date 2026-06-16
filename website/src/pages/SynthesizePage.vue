<script setup lang="ts">
import { useAppContext } from "../composables/useAppContext";

const {
  Package,
  cardMediaUrl,
  hasCardMedia,
  hideBrokenCardMedia,
  isCardVideo,
  cardTypeLabel,
  rarityClass,
  rarityOrder,
  pools,
  activePoolId,
  poolCards,
  catalogError,
  synthesisRarityFilter,
  collectionFilter,
  busy,
  activeSection,
  selectedPool,
  catalogCards,
  filteredSynthesisCards,
  synthesisAvailableCount,
  catalogCollectedCount,
  openCatalogCardDetail,
  synthesizeCard,
  goToTradePage,
} = useAppContext() as Record<string, any>;
</script>

<template>
<section
  v-if="activeSection === 'synthesize'"
  class="panel catalog-panel synthesize-panel"
  data-section="synthesize"
>
  <div class="section-head">
    <div>
      <p class="eyebrow">卡池图鉴</p>
      <h2>收集进度</h2>
    </div>
    <div class="filter-row">
      <select v-model="activePoolId">
        <option v-for="pool in pools" :key="pool.id" :value="pool.id">
          {{ pool.pool_name }}
        </option>
      </select>
      <select v-model="synthesisRarityFilter">
        <option value="">全部稀有度</option>
        <option
          v-for="rarity in rarityOrder"
          :key="rarity"
          :value="rarity"
        >
          {{ rarity }}
        </option>
      </select>
      <select v-model="collectionFilter">
        <option value="all">全部状态</option>
        <option value="collected">已收集</option>
        <option value="uncollected">未收集</option>
      </select>
      <button
        class="secondary-action"
        type="button"
        @click="
          synthesisRarityFilter = '';
          collectionFilter = 'all';
        "
      >
        重置
      </button>
    </div>
  </div>

  <div class="synthesis-overview">
    <article>
      <small>当前卡池</small>
      <strong>{{ selectedPool?.pool_name || "未选择" }}</strong>
    </article>
    <article>
      <small>已收集</small>
      <strong
        >{{ catalogCollectedCount }}/{{ catalogCards.length }}</strong
      >
    </article>
    <article>
      <small>可合成</small>
      <strong>{{ synthesisAvailableCount }}</strong>
    </article>
  </div>

  <div v-if="busy.catalog" class="skeleton-grid">
    <span v-for="item in 6" :key="item"></span>
  </div>
  <div v-else-if="catalogError" class="empty-state">
    <Package :size="30" />
    <strong>同步失败</strong>
    <span>{{ catalogError }}</span>
  </div>
  <div v-else-if="poolCards.length === 0" class="empty-state">
    <Package :size="30" />
    <strong>暂无图鉴</strong>
    <span>切换卡池查看</span>
  </div>
  <div
    v-else-if="filteredSynthesisCards.length === 0"
    class="empty-state"
  >
    <Package :size="30" />
    <strong>暂无匹配</strong>
    <span>调整筛选</span>
  </div>
  <div v-else class="catalog-grid synthesis-grid">
    <article
      v-for="(item, index) in filteredSynthesisCards"
      :key="item.key"
      class="result-card synthesis-card"
      :class="[
        rarityClass(item.rarity),
        { 'is-uncollected': !item.collected },
      ]"
      :style="{ '--delay': `${Math.min(Number(index) * 24, 260)}ms` }"
    >
      <div
        class="card-face clickable-card-area"
        role="button"
        tabindex="0"
        @click="openCatalogCardDetail(item)"
        @keydown.enter.prevent="openCatalogCardDetail(item)"
        @keydown.space.prevent="openCatalogCardDetail(item)"
      >
        <div
          class="card-media-frame"
          :class="{ 'has-media': hasCardMedia(item.card.card_image) }"
        >
          <video
            v-if="isCardVideo(item.card.card_image)"
            class="card-art-media"
            :src="cardMediaUrl(item.card.card_image)"
            muted
            loop
            autoplay
            playsinline
            @error="hideBrokenCardMedia"
          />
          <img
            v-else-if="cardMediaUrl(item.card.card_image)"
            class="card-art-media"
            :src="cardMediaUrl(item.card.card_image)"
            :alt="item.card.card_name"
            @error="hideBrokenCardMedia"
          />
          <div class="card-sigil"></div>
          <div class="result-card-top">
            <span class="rarity-badge">{{ item.rarity }}</span>
            <span class="card-type-pill">{{
              cardTypeLabel(item.card.card_type)
            }}</span>
          </div>
        </div>
        <div class="card-content">
          <h3 class="card-name">{{ item.card.card_name }}</h3>
          <div class="tag-row">
            <span>{{ item.collected ? "已收集" : "未收集" }}</span>
            <span v-if="!item.collected && item.rarity !== 'UR'">
              {{ item.fragmentCount }}/{{ item.requiredFragments }}
            </span>
          </div>
        </div>
      </div>
      <div v-if="!item.collected" class="synthesis-actions">
        <button
          class="secondary-action"
          type="button"
          :disabled="busy.catalog || !item.canSynthesize"
          @click.stop="synthesizeCard(item)"
        >
          {{
            item.canSynthesize
              ? "合成"
              : item.rarity === "UR"
                ? "不可合成"
                : "碎片不足"
          }}
        </button>
        <button
          class="primary-action compact"
          type="button"
          @click.stop="goToTradePage(item)"
        >
          去购买
        </button>
      </div>
      <span v-else class="catalog-owned-label">已收集</span>
    </article>
  </div>
</section>
</template>
