<template>
  <div class="reward-editor">
    <el-form-item v-if="mode !== 'costs'" label="奖励星穹币">
      <el-input-number v-model="localRewards.points" :min="0" :step="1" />
    </el-form-item>

    <div class="reward-row-header">
      <span>{{ mode === "costs" ? "消耗物品" : "奖励物品" }}</span>
      <el-button type="primary" plain size="small" @click="addItem">添加物品</el-button>
    </div>

    <div v-if="items.length" class="reward-row-list">
        <div v-for="(item, index) in items" :key="index" class="reward-row">
          <el-select
          :model-value="item.itemId"
          filterable
          clearable
          placeholder="选择物品"
          class="reward-item-select"
          @update:model-value="updateItem(index, { itemId: Number($event || 0) })"
        >
          <el-option
            v-for="option in itemOptions"
            :key="String(option.value)"
            :label="option.label"
            :value="Number(option.value)"
            :disabled="option.disabled"
          />
        </el-select>
        <el-input-number
          :model-value="item.num"
          :min="1"
          :step="1"
          @update:model-value="updateItem(index, { num: Number($event || 1) })"
        />
        <el-button type="danger" plain @click="removeItem(index)">删除</el-button>
      </div>
    </div>
    <el-empty v-else description="暂未配置物品" :image-size="60" />

    <template v-if="allowCards">
      <div class="reward-row-header">
        <span>奖励卡片</span>
        <el-button type="primary" plain size="small" @click="addCard">添加卡片</el-button>
      </div>

      <div v-if="cards.length" class="reward-row-list">
        <div v-for="(card, index) in cards" :key="index" class="reward-row reward-card-row">
          <el-select
            :model-value="card.cardId"
            filterable
            clearable
            placeholder="选择卡片"
            class="reward-item-select"
            @update:model-value="updateCardId(index, Number($event || 0))"
          >
            <el-option
              v-for="option in cardOptions"
              :key="String(option.value)"
              :label="option.label"
              :value="Number(option.value)"
              :disabled="option.disabled"
            />
          </el-select>
          <el-select
            :model-value="card.rarity"
            placeholder="稀有度"
            class="reward-rarity-select"
            @update:model-value="updateCard(index, { rarity: String($event || 'N') })"
          >
            <el-option
              v-for="rarity in getCardRarityOptions(card.cardId)"
              :key="rarity"
              :label="rarity"
              :value="rarity"
            />
          </el-select>
          <el-input-number
            :model-value="card.num"
            :min="1"
            :step="1"
            @update:model-value="updateCard(index, { num: Number($event || 1) })"
          />
          <el-button type="danger" plain @click="removeCard(index)">删除</el-button>
        </div>
      </div>
      <el-empty v-else description="暂未配置卡片" :image-size="60" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { ElButton } from "element-plus/es/components/button/index";
import { ElEmpty } from "element-plus/es/components/empty/index";
import { ElFormItem } from "element-plus/es/components/form/index";
import { ElInputNumber } from "element-plus/es/components/input-number/index";
import {
  ElOption,
  ElSelect,
} from "element-plus/es/components/select/index";
import type { ExchangeCostItem, RedeemRewards, SelectOption } from "../types";

const props = withDefaults(defineProps<{
  modelValue: RedeemRewards | ExchangeCostItem[] | null | undefined;
  itemOptions: SelectOption[];
  cardOptions?: SelectOption[];
  mode?: "rewards" | "costs";
  allowCards?: boolean;
}>(), {
  cardOptions: () => [],
  mode: "rewards",
  allowCards: false,
});

const emit = defineEmits<{
  (event: "update:modelValue", value: RedeemRewards | ExchangeCostItem[]): void;
}>();

const mode = computed(() => props.mode);

const localRewards = computed<RedeemRewards>({
  get() {
    if (mode.value === "costs") {
      return { points: 0, items: [] };
    }
    const value = props.modelValue as RedeemRewards | undefined;
    return {
      points: Number(value?.points || 0),
      items: Array.isArray(value?.items)
        ? value.items.map((item) => ({
            itemId: Number(item.itemId),
            num: Number(item.num || 1),
          }))
        : [],
      cards: Array.isArray(value?.cards)
        ? value.cards.map((card) => ({
            cardId: Number(card.cardId),
            rarity: String(card.rarity || "").toUpperCase(),
            num: Number(card.num || 1),
          }))
        : [],
    };
  },
  set(value) {
    emit("update:modelValue", value);
  },
});

const items = computed<Array<{ itemId: number; num: number }>>({
  get() {
    if (mode.value === "costs") {
      return Array.isArray(props.modelValue)
        ? (props.modelValue as ExchangeCostItem[]).map((item) => ({
            itemId: Number(item.itemId),
            num: Number(item.num || 1),
          }))
        : [];
    }
    return localRewards.value.items;
  },
  set(value) {
    if (mode.value === "costs") {
      emit("update:modelValue", value);
      return;
    }
    localRewards.value = {
      ...localRewards.value,
      items: value,
    };
  },
});

const cards = computed<Array<{ cardId: number; rarity: string; num: number }>>({
  get() {
    if (mode.value === "costs") {
      return [];
    }
    return localRewards.value.cards || [];
  },
  set(value) {
    localRewards.value = {
      ...localRewards.value,
      cards: value,
    };
  },
});

function addItem() {
  items.value = [...items.value, { itemId: 0, num: 1 }];
}

function updateItem(
  index: number,
  patch: Partial<{ itemId: number; num: number }>,
) {
  items.value = items.value.map((item, currentIndex) =>
    currentIndex === index ? { ...item, ...patch } : item,
  );
}

function removeItem(index: number) {
  items.value = items.value.filter((_, currentIndex) => currentIndex !== index);
}

function addCard() {
  const firstOption = props.cardOptions?.find((option) => !option.disabled);
  const cardId = Number(firstOption?.value || 0);
  cards.value = [
    ...cards.value,
    {
      cardId,
      rarity: getCardRarityOptions(cardId)[0] || "N",
      num: 1,
    },
  ];
}

function removeCard(index: number) {
  cards.value = cards.value.filter((_, currentIndex) => currentIndex !== index);
}

function updateCard(
  index: number,
  patch: Partial<{ cardId: number; rarity: string; num: number }>,
) {
  cards.value = cards.value.map((card, currentIndex) =>
    currentIndex === index ? { ...card, ...patch } : card,
  );
}

function updateCardId(index: number, cardId: number) {
  const current = cards.value[index];
  const rarities = getCardRarityOptions(cardId);
  updateCard(index, {
    cardId,
    rarity: rarities.includes(current?.rarity)
      ? current.rarity
      : rarities[0] || "N",
  });
}

function getCardRarityOptions(cardId: number) {
  const option = props.cardOptions?.find(
    (item) => Number(item.value) === Number(cardId),
  ) as (SelectOption & { rarity?: string }) | undefined;
  const rarities = String(option?.rarity || "N")
    .split(",")
    .map((rarity) => rarity.trim().toUpperCase())
    .filter((rarity) => ["N", "R", "SR", "SSR", "UR"].includes(rarity));
  return rarities.length ? rarities : ["N"];
}
</script>
