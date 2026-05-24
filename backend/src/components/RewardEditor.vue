<template>
  <div class="reward-editor">
    <el-form-item v-if="mode !== 'costs'" label="奖励星穹币">
      <el-input-number v-model="localRewards.points" :min="0" :step="1" />
    </el-form-item>

    <div class="reward-row-header">
      <span>{{ mode === "costs" ? "消耗物品" : "奖励物品" }}</span>
      <el-button size="small" @click="addItem">添加物品</el-button>
    </div>

    <div v-if="items.length" class="reward-row-list">
      <div v-for="(item, index) in items" :key="index" class="reward-row">
        <el-select
          v-model="item.itemId"
          filterable
          clearable
          placeholder="选择物品"
          class="reward-item-select"
        >
          <el-option
            v-for="option in itemOptions"
            :key="String(option.value)"
            :label="option.label"
            :value="Number(option.value)"
            :disabled="option.disabled"
          />
        </el-select>
        <el-input-number v-model="item.num" :min="1" :step="1" />
        <el-button type="danger" plain @click="removeItem(index)">删除</el-button>
      </div>
    </div>
    <el-empty v-else description="暂未配置物品" :image-size="60" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ExchangeCostItem, RedeemRewards, SelectOption } from "../types";

const props = defineProps<{
  modelValue: RedeemRewards | ExchangeCostItem[] | null | undefined;
  itemOptions: SelectOption[];
  mode?: "rewards" | "costs";
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: RedeemRewards | ExchangeCostItem[]): void;
}>();

const mode = computed(() => props.mode || "rewards");

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

function addItem() {
  items.value = [...items.value, { itemId: 0, num: 1 }];
}

function removeItem(index: number) {
  items.value = items.value.filter((_, currentIndex) => currentIndex !== index);
}
</script>
