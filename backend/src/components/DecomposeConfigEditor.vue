<template>
  <div class="decompose-config-editor">
    <el-table :data="rows" border>
      <el-table-column prop="rarity" label="卡片等级" width="100" />
      <el-table-column label="产出碎片">
        <template #default="{ row }">
          <div class="drop-list">
            <div
              v-for="(drop, index) in row.drops"
              :key="`${row.rarity}-${index}`"
              class="drop-row"
            >
              <el-select
                :model-value="drop.itemId"
                filterable
                placeholder="沿用卡片或默认碎片"
                class="drop-item-select"
                @update:model-value="
                  updateDrop(toRarity(row.rarity), Number(index), {
                    itemId: Number($event || 0),
                  })
                "
              >
                <el-option label="沿用卡片配置 / 默认碎片" :value="0" />
                <el-option
                  v-for="item in fragmentOptions"
                  :key="String(item.value)"
                  :label="item.label"
                  :value="Number(item.value)"
                  :disabled="item.disabled"
                />
              </el-select>
              <el-input-number
                :model-value="drop.min"
                :min="1"
                :step="1"
                controls-position="right"
                class="drop-count-input"
                @update:model-value="
                  updateDrop(toRarity(row.rarity), Number(index), {
                    min: Number($event || 1),
                  })
                "
              />
              <span class="drop-count-separator">至</span>
              <el-input-number
                :model-value="drop.max"
                :min="drop.min || 1"
                :step="1"
                controls-position="right"
                class="drop-count-input"
                @update:model-value="
                  updateDrop(toRarity(row.rarity), Number(index), {
                    max: Number($event || drop.min || 1),
                  })
                "
              />
              <el-button
                :icon="Delete"
                circle
                plain
                type="danger"
                :disabled="row.drops.length <= 1"
                aria-label="删除碎片产出"
                @click="removeDrop(toRarity(row.rarity), Number(index))"
              />
            </div>
            <el-button
              :icon="Plus"
              plain
              type="primary"
              class="add-drop-button"
              @click="addDrop(toRarity(row.rarity))"
            >
              添加碎片
            </el-button>
          </div>
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
import { ElButton } from "element-plus/es/components/button/index";
import { ElInputNumber } from "element-plus/es/components/input-number/index";
import {
  ElOption,
  ElSelect,
} from "element-plus/es/components/select/index";
import {
  ElTable,
  ElTableColumn,
} from "element-plus/es/components/table/index";
import { Delete, Plus } from "@element-plus/icons-vue";
import type { SelectOption } from "../types";

type Rarity = "N" | "R" | "SR" | "SSR";
type DecomposeDrop = {
  itemId: number;
  min: number;
  max: number;
};
type DecomposeRule = {
  drops: DecomposeDrop[];
};
type LegacyDecomposeRule = Partial<DecomposeRule & DecomposeDrop>;
type DecomposeConfigValue = Partial<Record<Rarity, LegacyDecomposeRule>>;

const rarities: Rarity[] = ["N", "R", "SR", "SSR"];
const defaults: Record<Rarity, DecomposeRule> = {
  N: { drops: [{ itemId: 0, min: 1, max: 10 }] },
  R: { drops: [{ itemId: 0, min: 10, max: 20 }] },
  SR: { drops: [{ itemId: 0, min: 20, max: 40 }] },
  SSR: { drops: [{ itemId: 0, min: 40, max: 80 }] },
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
  (event: "update:modelValue", value: Record<Rarity, DecomposeRule>): void;
}>();

const fragmentOptions = computed(() =>
  props.itemOptions.filter((item) => Number((item as any).type || 0) === 0),
);

const rows = computed(() =>
  rarities.map((rarity) => ({
    rarity,
    drops: normalizeRule(rarity, props.modelValue[rarity]).drops,
  })),
);

function toRarity(value: unknown): Rarity {
  return rarities.includes(value as Rarity) ? (value as Rarity) : "N";
}

function normalizeRule(rarity: Rarity, input?: LegacyDecomposeRule): DecomposeRule {
  const fallback = defaults[rarity];
  const rawDrops =
    Array.isArray(input?.drops) && input.drops.length > 0
      ? input.drops
      : input && ("itemId" in input || "min" in input || "max" in input)
        ? [input]
        : fallback.drops;
  return {
    drops: rawDrops.map((drop, index) =>
      normalizeDrop(drop, fallback.drops[index] || fallback.drops[0]),
    ),
  };
}

function normalizeDrop(input: Partial<DecomposeDrop>, fallback: DecomposeDrop) {
  const min = normalizePositiveInteger(input?.min, fallback.min);
  const max = Math.max(min, normalizePositiveInteger(input?.max, fallback.max));
  return {
    itemId: normalizeNonNegativeInteger(input?.itemId, fallback.itemId),
    min,
    max,
  };
}

function updateDrop(rarity: Rarity, index: number, patch: Partial<DecomposeDrop>) {
  updateRule(rarity, (drops) =>
    drops.map((drop, currentIndex) =>
      currentIndex === index ? normalizeDrop({ ...drop, ...patch }, drop) : drop,
    ),
  );
}

function addDrop(rarity: Rarity) {
  updateRule(rarity, (drops) => [...drops, { itemId: 0, min: 1, max: 1 }]);
}

function removeDrop(rarity: Rarity, index: number) {
  updateRule(rarity, (drops) =>
    drops.length <= 1 ? drops : drops.filter((_, currentIndex) => currentIndex !== index),
  );
}

function updateRule(
  rarity: Rarity,
  updater: (drops: DecomposeDrop[]) => DecomposeDrop[],
) {
  const nextRules = rarities.reduce(
    (result, item) => {
      const current = normalizeRule(item, props.modelValue[item]);
      result[item] = {
        drops:
          item === rarity
            ? updater(current.drops).map((drop) => normalizeDrop(drop, drop))
            : current.drops,
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

<style scoped>
.drop-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.drop-row {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) 120px auto 120px 36px;
  align-items: center;
  gap: 8px;
}

.drop-item-select {
  width: 100%;
}

.drop-count-input {
  width: 120px;
}

.drop-count-separator {
  color: #64748b;
  font-size: 13px;
}

.add-drop-button {
  align-self: flex-start;
}

@media (max-width: 900px) {
  .drop-row {
    grid-template-columns: 1fr 1fr auto 1fr 36px;
  }

  .drop-item-select {
    grid-column: 1 / -1;
  }
}
</style>
