<script setup lang="ts">
import { useAppContext } from "../composables/useAppContext";

const {
  ChevronLeft,
  ChevronRight,
  History,
  RefreshCw,
  Store,
  cardMediaUrl,
  hasCardMedia,
  hideBrokenCardMedia,
  isCardVideo,
  formatDate,
  formatPercent,
  tradeRoleLabel,
  tradeStatusLabel,
  rarityClass,
  rarityOrder,
  pools,
  stats,
  tradeListings,
  myTradeListings,
  tradeRecords,
  tradeConfig,
  tradePage,
  myTradePage,
  tradeRecordPage,
  tradeTab,
  tradeRarityFilter,
  tradePoolFilter,
  tradeCardNameFilter,
  tradeSort,
  tradeMinPrice,
  tradeMaxPrice,
  busy,
  isAuthed,
  activeSection,
  tradeTotalPages,
  myTradeTotalPages,
  tradeRecordTotalPages,
  loadTradeData,
  loadTradeListings,
  cardIntroText,
  openTradeListingDetail,
  cancelTradeListing,
  buyTradeListing,
  changeTradePage,
} = useAppContext() as Record<string, any>;

// 防抖搜索，避免频繁请求
let debounceTimer: number | null = null;
function debouncedLoadTradeListings() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = window.setTimeout(() => {
    loadTradeListings();
  }, 300);
}
</script>

<template>
<section
  v-if="activeSection === 'trade'"
  class="panel trade-panel"
  data-section="trade"
>
  <div class="section-head">
    <div>
      <p class="eyebrow">匿名交易</p>
      <h2>卡片交易市场</h2>
    </div>
    <div class="section-actions">
      <button
        class="secondary-action compact"
        type="button"
        :disabled="busy.trade"
        @click="loadTradeData"
      >
        <RefreshCw :size="16" :class="{ spin: busy.trade }" />
        刷新
      </button>
    </div>
  </div>

  <div v-if="!isAuthed" class="empty-state">
    <Store :size="30" />
    <strong>登录后进入交易市场</strong>
    <span>市场匿名展示，成交后入背包。</span>
  </div>
  <div v-else class="trade-content">
    <div class="trade-config-strip">
      <article>
        <small>交易状态</small>
        <strong>{{ tradeConfig.enabled ? "已开启" : "已关闭" }}</strong>
      </article>
      <article>
        <small>手续费</small>
        <strong>{{ formatPercent(tradeConfig.feeRate) }}</strong>
      </article>
      <article>
        <small>价格范围</small>
        <strong
          >{{ tradeConfig.minPrice }} - {{ tradeConfig.maxPrice }}</strong
        >
      </article>
      <article>
        <small>我的星穹币</small>
        <strong>{{ stats?.point || 0 }}</strong>
      </article>
    </div>

    <div class="trade-tabs" role="tablist" aria-label="交易分区">
      <button
        type="button"
        :class="{ active: tradeTab === 'market' }"
        @click="tradeTab = 'market'"
      >
        市场
      </button>
      <button
        type="button"
        :class="{ active: tradeTab === 'mine' }"
        @click="tradeTab = 'mine'"
      >
        我的挂售
      </button>
      <button
        type="button"
        :class="{ active: tradeTab === 'records' }"
        @click="tradeTab = 'records'"
      >
        成交记录
      </button>
    </div>

    <div v-if="tradeTab === 'market'" class="trade-section">
      <div class="filter-row trade-filter-row">
        <div class="search-box">
          <input
            v-model="tradeCardNameFilter"
            type="search"
            placeholder="搜索卡名"
            class="trade-search-input"
            @input="
              tradePage = 1;
              debouncedLoadTradeListings();
            "
            @keyup.enter="
              tradePage = 1;
              loadTradeListings();
            "
          />
          <button
            type="button"
            class="search-button"
            @click="
              tradePage = 1;
              loadTradeListings();
            "
          >
            搜索
          </button>
        </div>
        <select
          v-model="tradeRarityFilter"
          @change="
            tradePage = 1;
            loadTradeListings();
          "
        >
          <option value="">全部稀有度</option>
          <option
            v-for="rarity in rarityOrder"
            :key="rarity"
            :value="rarity"
          >
            {{ rarity }}
          </option>
        </select>
        <select
          v-model="tradePoolFilter"
          @change="
            tradePage = 1;
            loadTradeListings();
          "
        >
          <option value="">全部卡池</option>
          <option v-for="pool in pools" :key="pool.id" :value="pool.id">
            {{ pool.pool_name }}
          </option>
        </select>
        <select
          v-model="tradeSort"
          @change="
            tradePage = 1;
            loadTradeListings();
          "
        >
          <option value="newest">最新上架</option>
          <option value="priceAsc">价格从低到高</option>
          <option value="priceDesc">价格从高到低</option>
        </select>
      </div>
      <div class="filter-row trade-filter-row">
        <input
          v-model="tradeMinPrice"
          type="number"
          min="0"
          placeholder="最低价"
          @change="
            tradePage = 1;
            loadTradeListings();
          "
        />
        <input
          v-model="tradeMaxPrice"
          type="number"
          min="0"
          placeholder="最高价"
          @change="
            tradePage = 1;
            loadTradeListings();
          "
        />
      </div>

      <div
        v-if="busy.trade && tradeListings.length === 0"
        class="skeleton-grid"
      >
        <span v-for="item in 6" :key="item"></span>
      </div>
      <div v-else-if="tradeListings.length === 0" class="empty-state">
        <Store :size="30" />
        <strong>暂无在售卡片</strong>
        <span>背包卡片可挂售</span>
      </div>
      <div v-else class="trade-grid">
        <article
          v-for="listing in tradeListings"
          :key="listing.id"
          class="trade-card"
          :class="rarityClass(listing.cardLevel)"
        >
          <div
            class="trade-card-art clickable-card-area"
            role="button"
            tabindex="0"
            @click="openTradeListingDetail(listing)"
            @keydown.enter.prevent="openTradeListingDetail(listing)"
            @keydown.space.prevent="openTradeListingDetail(listing)"
          >
            <div
              class="card-media-frame trade-media-frame"
              :class="{ 'has-media': hasCardMedia(listing.cardImage) }"
            >
              <video
                v-if="isCardVideo(listing.cardImage)"
                class="card-art-media"
                :src="cardMediaUrl(listing.cardImage)"
                muted
                loop
                autoplay
                playsinline
                @error="hideBrokenCardMedia"
              />
              <img
                v-else-if="cardMediaUrl(listing.cardImage)"
                class="card-art-media"
                :src="cardMediaUrl(listing.cardImage)"
                :alt="listing.cardName"
                @error="hideBrokenCardMedia"
              />
              <div class="card-sigil"></div>
              <span class="rarity-badge">{{ listing.cardLevel }}</span>
            </div>
            <strong class="card-name">{{ listing.cardName }}</strong>
            <small>{{ listing.poolName || "未知卡池" }}</small>
          </div>
          <div class="trade-card-body">
            <p>{{ cardIntroText(listing.cardDesc) }}</p>
            <button
              class="tag-action intro-inline-action"
              type="button"
              @click="openTradeListingDetail(listing)"
            >
              详情
            </button>
            <dl>
              <div>
                <dt>价格</dt>
                <dd class="trade-price-value">
                  {{ listing.price }} 星穹币
                </dd>
              </div>
              <div>
                <dt>卖家</dt>
                <dd>匿名玩家</dd>
              </div>
              <div>
                <dt>上架</dt>
                <dd>{{ formatDate(listing.createdAt) }}</dd>
              </div>
            </dl>
            <button
              class="primary-action wide"
              type="button"
              :disabled="
                busy.trade || listing.isMine || !tradeConfig.enabled
              "
              @click="buyTradeListing(listing)"
            >
              {{ listing.isMine ? "我的挂单" : "购买" }}
            </button>
          </div>
        </article>
      </div>
      <div class="pager">
        <button
          type="button"
          :disabled="tradePage <= 1"
          @click="changeTradePage('market', -1)"
        >
          <ChevronLeft :size="16" />
          上一页
        </button>
        <span>第 {{ tradePage }} / {{ tradeTotalPages }} 页</span>
        <button
          type="button"
          :disabled="tradePage >= tradeTotalPages"
          @click="changeTradePage('market', 1)"
        >
          下一页
          <ChevronRight :size="16" />
        </button>
      </div>
    </div>

    <div v-if="tradeTab === 'mine'" class="trade-section">
      <div v-if="myTradeListings.length === 0" class="empty-state">
        <Store :size="30" />
        <strong>暂无我的挂售</strong>
        <span>背包卡片可上架</span>
      </div>
      <div v-else class="trade-list">
        <article v-for="listing in myTradeListings" :key="listing.id">
          <div>
            <strong
              >{{ listing.cardName }} · {{ listing.cardLevel }}</strong
            >
            <span>{{ listing.poolName || "未知卡池" }}</span>
          </div>
          <b>{{ listing.price }} 星穹币</b>
          <span>{{ tradeStatusLabel(listing.status) }}</span>
          <button
            class="secondary-action"
            type="button"
            :disabled="busy.trade || listing.status !== 'active'"
            @click="cancelTradeListing(listing)"
          >
            取消挂售
          </button>
        </article>
      </div>
      <div class="pager">
        <button
          type="button"
          :disabled="myTradePage <= 1"
          @click="changeTradePage('mine', -1)"
        >
          上一页
        </button>
        <span>第 {{ myTradePage }} / {{ myTradeTotalPages }} 页</span>
        <button
          type="button"
          :disabled="myTradePage >= myTradeTotalPages"
          @click="changeTradePage('mine', 1)"
        >
          下一页
        </button>
      </div>
    </div>

    <div v-if="tradeTab === 'records'" class="trade-section">
      <div v-if="tradeRecords.length === 0" class="empty-state">
        <History :size="30" />
        <strong>暂无成交记录</strong>
        <span>成交后保留记录</span>
      </div>
      <div v-else class="trade-list">
        <article v-for="record in tradeRecords" :key="record.id">
          <div>
            <strong
              >{{ tradeRoleLabel(record.role) }} · {{ record.cardName }} ·
              {{ record.cardLevel }}</strong
            >
            <span>{{ record.poolName || "未知卡池" }}</span>
          </div>
          <b>{{ record.price }} 星穹币</b>
          <span v-if="record.role === 'seller'"
            >实收 {{ record.sellerIncome }}，手续费
            {{ record.feeAmount }}</span
          >
          <span v-else>成交 {{ formatDate(record.createdAt) }}</span>
        </article>
      </div>
      <div class="pager">
        <button
          type="button"
          :disabled="tradeRecordPage <= 1"
          @click="changeTradePage('records', -1)"
        >
          上一页
        </button>
        <span
          >第 {{ tradeRecordPage }} / {{ tradeRecordTotalPages }} 页</span
        >
        <button
          type="button"
          :disabled="tradeRecordPage >= tradeRecordTotalPages"
          @click="changeTradePage('records', 1)"
        >
          下一页
        </button>
      </div>
    </div>
  </div>
</section>
</template>
