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
};

const monthlyCards = computed<MonthlyCardStatusCard[]>(
  () => monthlyCardStatus.value?.cards || [],
);
const monthlyConfig = computed(() => monthlyCardStatus.value?.config || null);
const monthlyGameVip = computed<GameVipStatus | null>(
  () => monthlyCardStatus.value?.gameVip || fishpiPoint.value?.gameVip || null,
);
const legacyVipStatus = computed(() => monthlyGameVip.value?.legacyVip || null);
const legacyVipTier = computed(() => {
  if (legacyVipStatus.value) {
    return Number(legacyVipStatus.value.tier || 0);
  }
  return Math.max(
    sourceTier(monthlyCardStatus.value?.gameVip, "badge"),
    sourceTier(fishpiPoint.value?.gameVip, "badge"),
  );
});
const currentMonthlyCard = computed<CurrentMonthlyCardView | null>(() => {
  const activeCard = monthlyCards.value
    .filter((card) => card.active)
    .sort(
      (left, right) =>
        Number(right.vipLevel || 0) - Number(left.vipLevel || 0),
    )[0];

  if (activeCard) {
    return {
      label: activeCard.label,
      expiry: activeCard.expiresAt ? formatDate(activeCard.expiresAt) : "生效中",
    };
  }

  const badgeTier = legacyVipTier.value;
  if (badgeTier >= 3) {
    return {
      label: badgeTier >= 4 ? "星耀月卡" : "星穹月卡",
      expiry: "永久",
    };
  }

  return null;
});
const currentMonthlyCardLabel = computed(
  () => currentMonthlyCard.value?.label || "未开通",
);
const monthlyCardExpiryLabel = computed(
  () => currentMonthlyCard.value?.expiry || "未开通",
);
const legacyVipLabel = computed(() => {
  if (legacyVipStatus.value) {
    return legacyVipStatus.value.label;
  }
  if (!monthlyGameVip.value) {
    return "未同步";
  }
  if (legacyVipTier.value >= 4) {
    return "小冰白金VIP";
  }
  if (legacyVipTier.value >= 3) {
    return "小冰VIP";
  }
  return "无";
});
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

function sourceTier(
  vip: GameVipStatus | null | undefined,
  source: "fishpi" | "badge" | "monthly_card",
) {
  return Number(vip?.sourceTiers?.[source] || 0);
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
        <small>历史权益</small>
        <strong
          :class="{ muted: legacyVipLabel === '无' || legacyVipLabel === '未同步' }"
        >
          {{ legacyVipLabel }}
        </strong>
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
