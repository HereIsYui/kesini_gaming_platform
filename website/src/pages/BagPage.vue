<script setup lang="ts">
import { useAppContext } from "../composables/useAppContext";

const {
  LoaderCircle,
  Package,
  Sparkles,
  UserRound,
  cardMediaUrl,
  hasCardMedia,
  hideBrokenCardMedia,
  isCardVideo,
  cardTypeLabel,
  itemTypeLabel,
  poolTypeLabel,
  rarityClass,
  rarityOrder,
  pools,
  userCards,
  rarityFilter,
  poolFilter,
  bagNewOnly,
  bulkDecomposeRarities,
  bulkDecomposePreview,
  busy,
  isAuthed,
  activeSection,
  inventoryItems,
  bagHasMore,
  bagLoadedCount,
  bulkDecomposeSelectedRarities,
  bulkDecomposeSelectedLabel,
  bulkDecomposePreviewTotal,
  bulkDecomposeReservedCount,
  resetUserCards,
  toggleBagNewOnly,
  loadMoreUserCards,
  cardIntroText,
  openBagCardDetail,
  toggleBulkDecomposeRarity,
  loadBulkDecomposePreview,
  bulkDecomposeCards,
  isNewCard,
} = useAppContext() as Record<string, any>;
</script>

<template>
<section
  v-if="activeSection === 'bag'"
  class="collection-grid bag-layout"
  data-section="bag"
>
  <div class="panel collection-panel">
    <div class="section-head">
      <div>
        <p class="eyebrow">玩家背包</p>
        <h2>卡片与物品</h2>
      </div>
      <div class="filter-row">
        <select v-model="rarityFilter" @change="resetUserCards">
          <option value="">全部稀有度</option>
          <option
            v-for="rarity in rarityOrder"
            :key="rarity"
            :value="rarity"
          >
            {{ rarity }}
          </option>
        </select>
        <select v-model="poolFilter" @change="resetUserCards">
          <option v-for="pool in pools" :key="pool.id" :value="pool.id">
            {{ pool.pool_name }}
          </option>
        </select>
        <button
          class="secondary-action compact filter-toggle"
          :class="{ active: bagNewOnly }"
          type="button"
          :aria-pressed="bagNewOnly"
          @click="toggleBagNewOnly"
        >
          <Sparkles :size="15" />
          新卡
        </button>
        <div
          class="bulk-decompose-control"
          @mouseenter="loadBulkDecomposePreview"
          @focusin="loadBulkDecomposePreview"
        >
          <button
            class="danger-action bulk-decompose-trigger"
            type="button"
            :disabled="
              busy.assets ||
              !isAuthed ||
              bulkDecomposeSelectedRarities.length === 0
            "
            @click="bulkDecomposeCards"
          >
            <LoaderCircle
              v-if="busy.bulkDecompose"
              :size="16"
              class="spin"
            />
            <Package v-else :size="16" />
            一键分解
          </button>
          <div
            class="bulk-decompose-popover"
            role="group"
            aria-label="一键分解等级选择"
          >
            <div class="bulk-popover-head">
              <strong>分解等级</strong>
              <small>{{ bulkDecomposeSelectedLabel }}</small>
            </div>
            <div class="bulk-switch-list">
              <div
                v-for="rarity in rarityOrder"
                :key="rarity"
                class="bulk-switch-row"
                :class="{ disabled: rarity === 'UR' }"
              >
                <span>{{ rarity }}</span>
                <button
                  class="switch-toggle"
                  type="button"
                  role="switch"
                  :aria-label="`一键分解 ${rarity}`"
                  :aria-checked="bulkDecomposeRarities[rarity]"
                  :disabled="rarity === 'UR' || busy.bulkDecompose"
                  @click="toggleBulkDecomposeRarity(rarity)"
                >
                  <i></i>
                </button>
              </div>
            </div>
            <div class="bulk-preview-line">
              <span>可分解</span>
              <strong>
                {{
                  busy.bulkDecomposePreview
                    ? "同步中"
                    : `${bulkDecomposePreviewTotal} 张`
                }}
              </strong>
            </div>
            <div
              v-if="bulkDecomposePreview?.skippedListed"
              class="bulk-preview-line muted"
            >
              <span>挂售跳过</span>
              <strong>{{ bulkDecomposePreview.skippedListed }} 张</strong>
            </div>
            <div
              v-if="bulkDecomposePreview?.skippedLocked"
              class="bulk-preview-line muted"
            >
              <span>锁定跳过</span>
              <strong>{{ bulkDecomposePreview.skippedLocked }} 张</strong>
            </div>
            <div
              v-if="bulkDecomposeReservedCount"
              class="bulk-preview-line muted"
            >
              <span>默认保留</span>
              <strong>{{ bulkDecomposeReservedCount }} 张</strong>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="isAuthed" class="inventory-strip" aria-label="物品库存">
      <template v-if="inventoryItems.length">
        <article
          v-for="item in inventoryItems"
          :key="item.id"
          class="inventory-chip"
          :title="item.desc || item.name"
        >
          <strong>{{ item.name }}</strong>
          <span>{{ itemTypeLabel(item.type) }}</span>
          <b>x{{ item.num }}</b>
        </article>
      </template>
      <span v-else class="inventory-empty-chip">暂无物品</span>
    </div>

    <div v-if="!isAuthed" class="empty-state">
      <UserRound :size="30" />
      <strong>登录后查看背包</strong>
      <span>登录后同步收藏</span>
    </div>
    <div v-else-if="busy.assets" class="skeleton-grid">
      <span v-for="item in 6" :key="item"></span>
    </div>
    <div v-else-if="!userCards?.list.length" class="empty-state">
      <Package :size="30" />
      <strong>{{ bagNewOnly ? "暂无新卡" : "暂无卡片" }}</strong>
      <span>{{
        bagNewOnly ? "最近获得会显示" : "抽卡后加入背包"
      }}</span>
    </div>
    <div v-else class="owned-grid">
      <article
        v-for="(card, index) in userCards.list"
        :key="`${card.cardId || card.id}-${card.cardLevel}`"
        class="result-card owned-card clickable-card-area"
        :class="[
          rarityClass(card.cardLevel),
          {
            'is-stacked': Number(card.count || 1) > 1,
          },
        ]"
        :style="{ '--delay': `${Math.min(Number(index) * 24, 260)}ms` }"
        role="button"
        tabindex="0"
        @click="openBagCardDetail(card)"
        @keydown.enter.prevent="openBagCardDetail(card)"
        @keydown.space.prevent="openBagCardDetail(card)"
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
              <div class="owned-card-top-right">
                <span
                  v-if="isNewCard(card)"
                  class="new-card-badge"
                  aria-label="新获得"
                >
                  NEW
                </span>
                <span class="card-type-pill">{{
                  cardTypeLabel(card.cardType)
                }}</span>
                <span
                  v-if="Number(card.count || 1) > 1"
                  class="card-stack-count"
                >
                  x{{ card.count }}
                </span>
              </div>
            </div>
          </div>
          <div class="card-content">
            <h3 class="card-name">{{ card.cardName }}</h3>
            <p>{{ cardIntroText(card.cardDesc) }}</p>
            <div class="tag-row">
              <span class="cultivation-pill">
                Lv.{{ card.cultivationLevel || 1 }}
              </span>
              <span>战力 {{ card.power || 0 }}</span>
              <span>{{
                poolTypeLabel(
                  pools.find((pool: any) => pool.id === card.poolId)
                    ?.card_type,
                )
              }}</span>
              <span v-if="card.listedCount"
                >挂售 {{ card.listedCount }}</span
              >
              <span v-if="card.lockedCount || card.locked">
                已锁定 {{ card.lockedCount || 1 }}
              </span>
            </div>
          </div>
        </div>
      </article>
    </div>

    <div v-if="bagLoadedCount" class="load-more-row">
      <button
        v-if="bagHasMore"
        class="secondary-action"
        type="button"
        :disabled="busy.cardsMore"
        @click="loadMoreUserCards"
      >
        <LoaderCircle v-if="busy.cardsMore" :size="16" class="spin" />
        {{ busy.cardsMore ? "加载中" : "加载" }}
      </button>
      <span v-else class="load-more-done">已全部</span>
    </div>
  </div>
</section>
</template>
