<script setup lang="ts">
import { computed, onMounted } from "vue";
import { CalendarDays, Gem, RefreshCw, ShieldCheck } from "@lucide/vue";
import { useAppContext } from "../composables/useAppContext";
import { formatPercent, formatRewards } from "../utils/format";
import type {
  GameVipBenefitView,
  GameVipStatus,
  MonthlyCardStatusCard,
} from "../types";

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

type BenefitRow = {
  label: string;
  value: string;
};

const fallbackBenefitTiers: GameVipBenefitView[] = [
  {
    tier: 1,
    label: "VIP1",
    sweepLimit: 5,
    tradeFeeDiscount: 0.02,
    dailyRewards: {
      points: 10,
      items: [{ itemId: 0, itemName: "R碎片", num: 2 }],
    },
  },
  {
    tier: 2,
    label: "VIP2",
    sweepLimit: 10,
    tradeFeeDiscount: 0.04,
    dailyRewards: {
      points: 15,
      items: [
        { itemId: 0, itemName: "R碎片", num: 4 },
        { itemId: 0, itemName: "SR碎片", num: 1 },
      ],
    },
  },
  {
    tier: 3,
    label: "VIP3",
    sweepLimit: 20,
    tradeFeeDiscount: 0.06,
    dailyRewards: {
      points: 25,
      items: [{ itemId: 0, itemName: "SR碎片", num: 2 }],
    },
  },
  {
    tier: 4,
    label: "VIP4",
    sweepLimit: 50,
    tradeFeeDiscount: 0.08,
    dailyRewards: {
      points: 40,
      items: [
        { itemId: 0, itemName: "SR碎片", num: 3 },
        { itemId: 0, itemName: "SSR碎片", num: 1 },
      ],
    },
  },
];

const monthlyCards = computed<MonthlyCardStatusCard[]>(
  () => monthlyCardStatus.value?.cards || [],
);
const monthlyConfig = computed(() => monthlyCardStatus.value?.config || null);
const benefitTiers = computed<GameVipBenefitView[]>(
  () => {
    const apiTiers =
      monthlyCardStatus.value?.benefitTiers ||
      monthlyCardStatus.value?.config?.benefitTiers ||
      [];
    return apiTiers.length > 0 ? apiTiers : fallbackBenefitTiers;
  },
);
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

function benefitRows(card: MonthlyCardStatusCard): BenefitRow[] {
  const benefit = benefitForTier(card.vipLevel);
  return [
    {
      label: "礼包",
      value: benefit ? formatRewards(benefit.dailyRewards) : "每日礼包",
    },
    {
      label: "扫荡",
      value: `${benefit?.sweepLimit ?? (card.vipLevel >= 4 ? 50 : 20)} 次`,
    },
    {
      label: "手续费",
      value: feeDiscountLabel(benefit?.tradeFeeDiscount || 0),
    },
  ];
}

function benefitForTier(tier: number) {
  return benefitTiers.value.find((item) => Number(item.tier) === Number(tier));
}

function monthlyCardNameForTier(tier: number) {
  if (tier >= 4) {
    return "星耀月卡";
  }
  if (tier >= 3) {
    return "星穹月卡";
  }
  return "鱼排VIP";
}

function feeDiscountLabel(value: number) {
  return value > 0 ? `减 ${formatPercent(value)}` : "无";
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
          <div v-for="benefit in benefitRows(card)" :key="benefit.label">
            <span>{{ benefit.label }}</span>
            <strong>{{ benefit.value }}</strong>
          </div>
        </div>

        <button
          v-if="!card.permanent"
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

    <section v-if="benefitTiers.length > 0" class="monthly-benefit-panel">
      <header>
        <div>
          <small>福利</small>
          <strong>权益对比</strong>
        </div>
        <span>每日一次</span>
      </header>

      <div class="monthly-benefit-grid">
        <article
          v-for="tier in benefitTiers"
          :key="tier.tier"
          :class="{ featured: tier.tier >= 3 }"
        >
          <header>
            <strong>{{ tier.label }}</strong>
            <small>{{ monthlyCardNameForTier(tier.tier) }}</small>
          </header>
          <dl>
            <div>
              <dt>礼包</dt>
              <dd>{{ formatRewards(tier.dailyRewards) }}</dd>
            </div>
            <div>
              <dt>扫荡</dt>
              <dd>{{ tier.sweepLimit }} 次</dd>
            </div>
            <div>
              <dt>手续费</dt>
              <dd>{{ feeDiscountLabel(tier.tradeFeeDiscount) }}</dd>
            </div>
          </dl>
        </article>
      </div>
    </section>
  </div>
</section>
</template>
