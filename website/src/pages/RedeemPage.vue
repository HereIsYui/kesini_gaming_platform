<script setup lang="ts">
import { useAppContext } from "../composables/useAppContext";

const {
  Gift,
  LoaderCircle,
  RefreshCw,
  Store,
  formatCosts,
  formatDate,
  formatRewards,
  exchangeItems,
  redeemCode,
  exchangeCounts,
  busy,
  isAuthed,
  activeSection,
  loadExchangeItems,
  claimRedeemCode,
  claimExchange,
} = useAppContext() as Record<string, any>;
</script>

<template>
<section
  v-if="activeSection === 'redeem'"
  class="redeem-grid"
  data-section="redeem"
>
  <div class="panel redeem-panel">
    <div class="section-head">
      <div>
        <p class="eyebrow">兑换码</p>
        <h2>领取奖励</h2>
      </div>
      <Gift :size="24" />
    </div>
    <label class="redeem-input">
      <span>兑换码</span>
      <input
        v-model="redeemCode"
        type="text"
        placeholder="输入兑换码"
        @keyup.enter="claimRedeemCode"
      />
    </label>
    <button
      class="primary-action wide"
      type="button"
      :disabled="busy.redeem"
      @click="claimRedeemCode"
    >
      <LoaderCircle v-if="busy.redeem" :size="18" class="spin" />
      <Gift v-else :size="18" />
      立即兑换
    </button>
  </div>

  <div class="panel shop-panel">
    <div class="section-head">
      <div>
        <p class="eyebrow">兑换商店</p>
        <h2>物品消费</h2>
      </div>
      <div class="section-actions">
        <button
          class="secondary-action compact"
          type="button"
          :disabled="busy.shop"
          @click="loadExchangeItems"
        >
          <RefreshCw :size="16" :class="{ spin: busy.shop }" />
          刷新
        </button>
      </div>
    </div>

    <div v-if="!isAuthed" class="empty-state">
      <Store :size="30" />
      <strong>登录后查看商店</strong>
      <span>消耗物品换奖励</span>
    </div>
    <div
      v-else-if="busy.shop && exchangeItems.length === 0"
      class="skeleton-grid"
    >
      <span v-for="item in 4" :key="item"></span>
    </div>
    <div v-else-if="exchangeItems.length === 0" class="empty-state">
      <Store :size="30" />
      <strong>暂无可见兑换项</strong>
      <span>暂无兑换项</span>
    </div>
    <div v-else class="shop-grid">
      <article
        v-for="item in exchangeItems"
        :key="item.id"
        class="shop-card"
      >
        <div class="shop-card-head">
          <div>
            <h3>{{ item.name }}</h3>
            <p>{{ item.description || "暂无说明" }}</p>
          </div>
          <span>{{
            item.remaining === null || item.remaining === undefined
              ? "不限库存"
              : `剩余 ${item.remaining}`
          }}</span>
        </div>
        <dl>
          <div>
            <dt>消耗</dt>
            <dd>{{ formatCosts(item.costs) }}</dd>
          </div>
          <div>
            <dt>奖励</dt>
            <dd>{{ formatRewards(item.rewards) }}</dd>
          </div>
          <div>
            <dt>限兑</dt>
            <dd>
              {{
                item.user_limit
                  ? `${item.usedByUser || 0}/${item.user_limit}`
                  : "不限"
              }}
            </dd>
          </div>
          <div>
            <dt>时间</dt>
            <dd>
              {{ formatDate(item.starts_at) }} 至
              {{ formatDate(item.ends_at) }}
            </dd>
          </div>
        </dl>
        <div class="shop-actions">
          <input
            v-model.number="exchangeCounts[item.id]"
            type="number"
            min="1"
            max="99"
            placeholder="1"
          />
          <button
            class="primary-action"
            type="button"
            :disabled="busy.shop || item.canExchange === false"
            @click="claimExchange(item)"
          >
            {{
              item.canExchange === false
                ? item.unavailableReason || "不可兑换"
                : "兑换"
            }}
          </button>
        </div>
      </article>
    </div>
  </div>
</section>
</template>
