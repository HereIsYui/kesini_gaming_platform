<script setup lang="ts">
import { useAppContext } from "../composables/useAppContext";

const {
  Coins,
  LoaderCircle,
  RefreshCw,
  Store,
  formatDate,
  formatRewards,
  shopProducts,
  shopCounts,
  busy,
  isAuthed,
  activeSection,
  loadShopProducts,
  buyShopProduct,
} = useAppContext() as Record<string, any>;
</script>

<template>
  <section
    v-if="activeSection === 'shop'"
    class="shop-page-panel panel"
    data-section="shop"
  >
    <div class="section-head">
      <div>
        <p class="eyebrow">商城</p>
        <h2>商品</h2>
      </div>
      <div class="section-actions">
        <button
          class="secondary-action compact"
          type="button"
          :disabled="busy.mall"
          @click="loadShopProducts"
        >
          <RefreshCw :size="16" :class="{ spin: busy.mall }" />
          刷新
        </button>
      </div>
    </div>

    <div v-if="!isAuthed" class="empty-state">
      <Store :size="30" />
      <strong>登录后查看</strong>
      <span>商城</span>
    </div>
    <div
      v-else-if="busy.mall && shopProducts.length === 0"
      class="skeleton-grid"
    >
      <span v-for="item in 4" :key="item"></span>
    </div>
    <div v-else-if="shopProducts.length === 0" class="empty-state">
      <Store :size="30" />
      <strong>暂无商品</strong>
      <span>稍后再来</span>
    </div>
    <div v-else class="shop-grid">
      <article
        v-for="item in shopProducts"
        :key="item.id"
        class="shop-card mall-card"
      >
        <div class="shop-card-head">
          <div>
            <h3>{{ item.name }}</h3>
            <p>{{ item.description || "限时商品" }}</p>
          </div>
          <span>{{
            item.remaining === null || item.remaining === undefined
              ? "不限"
              : `库存 ${item.remaining}`
          }}</span>
        </div>
        <dl>
          <div>
            <dt>价格</dt>
            <dd>
              <Coins :size="14" />
              {{ item.price }} {{ item.currencyLabel }}
            </dd>
          </div>
          <div>
            <dt>奖励</dt>
            <dd>{{ formatRewards(item.rewards) }}</dd>
          </div>
          <div>
            <dt>限购</dt>
            <dd>
              {{
                item.userLimit
                  ? `${item.usedByUser || 0}/${item.userLimit}`
                  : "不限"
              }}
            </dd>
          </div>
          <div>
            <dt>时间</dt>
            <dd>
              {{ formatDate(item.startsAt) }} 至
              {{ formatDate(item.endsAt) }}
            </dd>
          </div>
        </dl>
        <div class="shop-actions">
          <input
            v-model.number="shopCounts[item.id]"
            type="number"
            min="1"
            max="99"
            placeholder="1"
          />
          <button
            class="primary-action"
            type="button"
            :disabled="busy.mall || item.canBuy === false"
            @click="buyShopProduct(item)"
          >
            <LoaderCircle v-if="busy.mall" :size="18" class="spin" />
            <Store v-else :size="18" />
            {{
              item.canBuy === false
                ? item.unavailableReason || "不可买"
                : "购买"
            }}
          </button>
        </div>
      </article>
    </div>
  </section>
</template>
