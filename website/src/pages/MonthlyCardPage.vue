<script setup lang="ts">
import { computed, onMounted } from "vue";
import { CalendarDays, Gem, RefreshCw, ShieldCheck } from "@lucide/vue";
import { useAppContext } from "../composables/useAppContext";
import type { GameVipStatus, MonthlyCardStatusCard } from "../types";

const {
  activeSection,
  isAuthed,
  monthlyCardStatus,
  monthlyCardError,
  fishpiPoint,
  busy,
  formatDate,
  loadMonthlyCardStatus,
  purchaseMonthlyCard,
} = useAppContext() as Record<string, any>;

type CurrentMonthlyCardView = {
  label: string;
  expiry: string;
  tier: number;
  permanent: boolean;
  sourcePriority: number;
};

const monthlyCards = computed<MonthlyCardStatusCard[]>(
  () => monthlyCardStatus.value?.cards || [],
);
const monthlyConfig = computed(() => monthlyCardStatus.value?.config || null);
const monthlyGameVip = computed<GameVipStatus | null>(
  () => monthlyCardStatus.value?.gameVip || fishpiPoint.value?.gameVip || null,
);
const currentVipLabel = computed(
  () => monthlyGameVip.value?.label || "未同步",
);
const currentMonthlyCard = computed<CurrentMonthlyCardView | null>(() => {
  const badgeTier = Math.max(
    Number(monthlyCardStatus.value?.gameVip?.sourceTiers?.badge || 0),
    Number(fishpiPoint.value?.gameVip?.sourceTiers?.badge || 0),
  );
  const candidates = monthlyCards.value
    .filter((card) => card.active || card.permanent)
    .map((card) => ({
      label: card.label,
      expiry: expiryLabel(card),
      tier: Number(card.vipLevel || 0),
      permanent: card.permanent === true,
      sourcePriority: 1,
    }));

  if (badgeTier >= 3) {
    candidates.push({
      label: badgeTier >= 4 ? "小冰白金VIP" : "小冰VIP",
      expiry: "永久",
      tier: badgeTier,
      permanent: true,
      sourcePriority: 2,
    });
  }

  return (
    candidates.sort((left, right) => {
      const levelDiff = right.tier - left.tier;
      if (levelDiff !== 0) {
        return levelDiff;
      }
      const permanentDiff = Number(right.permanent) - Number(left.permanent);
      if (permanentDiff !== 0) {
        return permanentDiff;
      }
      return right.sourcePriority - left.sourcePriority;
    })[0] || null
  );
});
const currentMonthlyCardLabel = computed(
  () => currentMonthlyCard.value?.label || "未开通",
);
const monthlyCardExpiryLabel = computed(() =>
  currentMonthlyCard.value?.expiry || "未开通",
);

onMounted(() => {
  if (isAuthed.value && activeSection.value === "monthlyCard") {
    loadMonthlyCardStatus();
  }
});

function priceLabel(card: MonthlyCardStatusCard) {
  return card.price > 0 ? `${card.price} 鱼排积分` : "未配置";
}

function expiryLabel(card: MonthlyCardStatusCard) {
  if (card.permanent) {
    return "永久";
  }
  if (card.active && card.expiresAt) {
    return formatDate(card.expiresAt);
  }
  return "未开通";
}

function benefitRows(card: MonthlyCardStatusCard) {
  return [
    `VIP${card.vipLevel}`,
    card.vipLevel >= 4 ? "扫荡 50 次" : "扫荡 20 次",
    card.vipLevel >= 4 ? "礼包 VIP4" : "礼包 VIP3",
  ];
}
</script>

<template>
<section
  v-if="activeSection === 'monthlyCard'"
  class="panel monthly-card-panel"
  data-section="monthly-card"
>
  <div class="section-head">
    <div>
      <p class="eyebrow">月卡</p>
      <h2>月卡</h2>
    </div>
    <div class="section-actions">
      <button
        class="secondary-action compact"
        type="button"
        :disabled="busy.monthlyCard"
        @click="loadMonthlyCardStatus(true)"
      >
        <RefreshCw :size="16" :class="{ spin: busy.monthlyCard }" />
        刷新
      </button>
    </div>
  </div>

  <div v-if="!isAuthed" class="empty-state">
    <Gem :size="30" />
    <strong>登录后查看月卡</strong>
    <span>月卡状态在这里</span>
  </div>

  <div v-else class="monthly-card-content">
    <div class="monthly-card-summary">
      <article>
        <small>当前月卡</small>
        <strong>{{ currentMonthlyCardLabel }}</strong>
      </article>
      <article>
        <small>到期时间</small>
        <strong>{{ monthlyCardExpiryLabel }}</strong>
      </article>
      <article>
        <small>当前VIP</small>
        <strong>{{ currentVipLabel }}</strong>
      </article>
    </div>

    <div
      v-if="busy.monthlyCard && monthlyCards.length === 0"
      class="skeleton-grid monthly-card-skeleton"
    >
      <span v-for="item in 2" :key="item"></span>
    </div>

    <div v-else-if="monthlyCards.length === 0" class="empty-state">
      <Gem :size="30" />
      <strong>暂无月卡</strong>
      <span>{{ monthlyCardError || "配置未同步" }}</span>
    </div>

    <div v-else class="monthly-card-grid">
      <article
        v-for="card in monthlyCards"
        :key="card.cardType"
        class="monthly-card"
        :class="{ active: card.active || card.permanent }"
      >
        <header>
          <span class="monthly-card-icon">
            <Gem v-if="card.cardType === 'platinum'" :size="22" />
            <ShieldCheck v-else :size="22" />
          </span>
          <div>
            <strong>{{ card.label }}</strong>
            <small>{{ card.statusLabel }}</small>
          </div>
        </header>

        <div class="monthly-card-price">
          <strong>{{ priceLabel(card) }}</strong>
          <span>{{ card.durationDays }} 天</span>
        </div>

        <div class="monthly-card-expire">
          <CalendarDays :size="16" />
          <span>{{ expiryLabel(card) }}</span>
        </div>

        <div class="monthly-card-benefits">
          <span v-for="benefit in benefitRows(card)" :key="benefit">
            {{ benefit }}
          </span>
        </div>

        <button
          class="primary-action compact"
          type="button"
          :disabled="
            busy.monthlyCard ||
            !monthlyConfig?.enabled ||
            !card.enabled ||
            card.price <= 0
          "
          @click="purchaseMonthlyCard(card.cardType)"
        >
          {{ card.actionLabel }}
        </button>
      </article>
    </div>
  </div>
</section>
</template>
