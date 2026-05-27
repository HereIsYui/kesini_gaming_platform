<template>
  <div class="decompose-config-editor">
    <el-table :data="rows" border>
      <el-table-column prop="rarity" label="卡片等级" width="100" />
      <el-table-column label="产出碎片">
        <template #default="{ row }">
          <el-select
            :model-value="row.itemId"
            filterable
            placeholder="沿用卡片或默认碎片"
            @update:model-value="updateRule(row.rarity, { itemId: Number($event || 0) })"
          >
            <el-option label="沿用卡片配置 / 默认碎片" :value="0" />
            <el-option
              v-for="item in fragmentOptions"
              :key="item.value"
              :label="item.label"
              :value="Number(item.value)"
              :disabled="item.disabled"
            />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="最小数量" width="140">
        <template #default="{ row }">
          <el-input-number
            :model-value="row.min"
            :min="1"
            :step="1"
            @update:model-value="updateRule(row.rarity, { min: Number($event || 1) })"
          />
        </template>
      </el-table-column>
      <el-table-column label="最大数量" width="140">
        <template #default="{ row }">
          <el-input-number
            :model-value="row.max"
            :min="row.min || 1"
            :step="1"
            @update:model-value="updateRule(row.rarity, { max: Number($event || row.min || 1) })"
          />
        </template>
      </el-table-column>
    </el-table>
    <small class="form-help">
      未选择碎片时，分解会优先使用卡片自身的分解产出；没有卡片配置时使用默认碎片。
    </small>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { SelectOption } from "../types";

type Rarity = "N" | "R" | "SR" | "SSR";
type DecomposeRule = {
  itemId: number;
  min: number;
  max: number;
};
type DecomposeConfigValue = Partial<Record<Rarity, Partial<DecomposeRule>>>;

const rarities: Rarity[] = ["N", "R", "SR", "SSR"];
const defaults: Record<Rarity, DecomposeRule> = {
  N: { itemId: 0, min: 1, max: 10 },
  R: { itemId: 0, min: 10, max: 20 },
  SR: { itemId: 0, min: 20, max: 40 },
  SSR: { itemId: 0, min: 40, max: 80 },
};

const props = withDefaults(
  defineProps<{
    modelValue?: DecomposeConfigValue;
    itemOptions?: SelectOption[];
  }>(),
  {
    modelValue: () => ({}),
    itemOptions: () => [],
  },
);

const emit = defineEmits<{
  (event: "update:modelValue", value: DecomposeConfigValue): void;
}>();

const fragmentOptions = computed(() =>
  props.itemOptions.filter((item) => Number((item as any).type || 0) === 0),
);

const rows = computed(() =>
  rarities.map((rarity) => normalizeRule(rarity, props.modelValue[rarity])),
);

function normalizeRule(rarity: Rarity, input?: Partial<DecomposeRule>) {
  const fallback = defaults[rarity];
  const min = normalizePositiveInteger(input?.min, fallback.min);
  const max = Math.max(min, normalizePositiveInteger(input?.max, fallback.max));
  return {
    rarity,
    itemId: normalizeNonNegativeInteger(input?.itemId, fallback.itemId),
    min,
    max,
  };
}

function updateRule(rarity: Rarity, patch: Partial<DecomposeRule>) {
  const nextRules = rarities.reduce(
    (result, item) => {
      const current = normalizeRule(item, props.modelValue[item]);
      const next = item === rarity ? normalizeRule(item, { ...current, ...patch }) : current;
      result[item] = {
        itemId: next.itemId,
        min: next.min,
        max: next.max,
      };
      return result;
    },
    {} as Record<Rarity, DecomposeRule>,
  );
  emit("update:modelValue", nextRules);
}

function normalizePositiveInteger(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function normalizeNonNegativeInteger(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}
</script>
