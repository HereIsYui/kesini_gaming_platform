<template>
  <el-dialog
    :model-value="modelValue"
    :title="mode === 'default' ? '默认抽卡配置' : `${poolName || '卡池'}抽卡配置`"
    width="980px"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-tabs v-model="activeTab">
      <el-tab-pane label="基础价格" name="base">
        <el-form label-position="top" class="dialog-form">
          <el-form-item v-if="mode === 'pool'" label="配置方式" class="full-width">
            <el-radio-group v-model="values.enabled">
              <el-radio-button :value="true">启用卡池配置</el-radio-button>
              <el-radio-button :value="false">继承默认配置</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <template v-if="!isInherited">
            <el-form-item label="单抽消耗">
              <el-input-number v-model="values.drawCosts.once" :min="1" :step="1" />
            </el-form-item>
            <el-form-item label="十连消耗">
              <el-input-number v-model="values.drawCosts.ten" :min="1" :step="1" />
            </el-form-item>
          </template>
          <el-alert
            v-else
            title="当前卡池继承默认抽卡配置，保存后不会写入单独配置。"
            type="info"
            show-icon
          />
        </el-form>
      </el-tab-pane>

      <el-tab-pane label="稀有度概率" name="probability">
        <el-alert
          v-if="isInherited"
          title="继承默认配置时无需编辑概率。"
          type="info"
          show-icon
        />
        <template v-else>
          <div class="template-row">
            <el-button
              v-for="template in probabilityTemplates"
              :key="template.label"
              size="small"
              @click="applyTemplate(template.values)"
            >
              {{ template.label }}
            </el-button>
            <el-button size="small" @click="normalizeProbabilities">自动归一化</el-button>
          </div>
          <el-form label-position="top" class="probability-grid">
            <el-form-item v-for="option in rarityOptions" :key="String(option.value)" :label="`${option.label} 概率`">
              <el-input-number
                :model-value="toPercent(values.rarityProbabilities[String(option.value)])"
                :min="0"
                :max="100"
                :step="0.01"
                @update:model-value="setProbability(String(option.value), Number($event || 0))"
              />
            </el-form-item>
          </el-form>
          <el-tag :type="probabilityValid ? 'success' : 'danger'">
            当前合计 {{ probabilityPercent.toFixed(2) }}%
          </el-tag>
        </template>
      </el-tab-pane>

      <el-tab-pane label="UP 配置" name="up">
        <el-alert
          v-if="isInherited"
          title="继承默认配置时无需编辑 UP。"
          type="info"
          show-icon
        />
        <el-form v-else label-position="top" class="dialog-form">
          <el-form-item label="UP 状态">
            <el-switch v-model="values.upCards.enabled" active-text="开启" inactive-text="关闭" />
          </el-form-item>
          <el-form-item label="UP 概率">
            <el-input-number
              :model-value="toPercent(values.upCards.upRate)"
              :min="0"
              :max="100"
              :step="0.01"
              @update:model-value="values.upCards.upRate = Number($event || 0) / 100"
            />
          </el-form-item>
          <el-form-item label="UP 卡片" class="full-width">
            <el-select
              v-model="values.upCards.cardIds"
              multiple
              filterable
              clearable
              placeholder="选择 UP 卡片"
            >
              <el-option
                v-for="card in cardOptions"
                :key="String(card.value)"
                :label="`${card.label} · ${card.rarity || '-'} · #${card.value}`"
                :value="Number(card.value)"
              />
            </el-select>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <el-tab-pane label="保底配置" name="pity">
        <el-alert
          v-if="isInherited"
          title="继承默认配置时无需编辑保底。"
          type="info"
          show-icon
        />
        <el-form v-else label-position="top" class="dialog-form">
          <el-form-item label="保底状态">
            <el-switch v-model="values.pitySystem.enabled" active-text="开启" inactive-text="关闭" />
          </el-form-item>
          <el-form-item label="软保底次数">
            <el-input-number v-model="values.pitySystem.softPity.count" :min="1" :step="1" />
          </el-form-item>
          <el-form-item label="软保底稀有度">
            <el-select v-model="values.pitySystem.softPity.guaranteedRarity">
              <el-option v-for="option in rarityOptions" :key="String(option.value)" :label="option.label" :value="String(option.value)" />
            </el-select>
          </el-form-item>
          <el-form-item label="硬保底次数">
            <el-input-number v-model="values.pitySystem.hardPity.count" :min="1" :step="1" />
          </el-form-item>
          <el-form-item label="硬保底稀有度">
            <el-select v-model="values.pitySystem.hardPity.guaranteedRarity">
              <el-option v-for="option in rarityOptions" :key="String(option.value)" :label="option.label" :value="String(option.value)" />
            </el-select>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <el-tab-pane label="保存预览" name="preview">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="配置效果">
            {{ saveEffect }}
          </el-descriptions-item>
          <el-descriptions-item label="价格">
            单抽 {{ values.drawCosts.once }} / 十连 {{ values.drawCosts.ten }}
          </el-descriptions-item>
          <el-descriptions-item label="概率合计">
            {{ probabilityPercent.toFixed(2) }}%
          </el-descriptions-item>
          <el-descriptions-item label="UP">
            {{ values.upCards.enabled ? `开启，${values.upCards.cardIds.length} 张卡` : "未开启" }}
          </el-descriptions-item>
        </el-descriptions>
      </el-tab-pane>
    </el-tabs>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="saving" @click="save">保存配置</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { probabilityTemplates, rarityOptions } from "../constants";
import type { AdminOptions, GachaPoolConfig } from "../types";
import {
  createGachaFormState,
  getProbabilityTotal,
  normalizeRarityProbabilities,
} from "../utils";

const props = defineProps<{
  modelValue: boolean;
  mode: "default" | "pool";
  poolKey: string;
  poolName?: string;
  config: GachaPoolConfig;
  defaultConfig?: GachaPoolConfig;
  options: AdminOptions | null;
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void;
  (event: "save", poolId: number, values: GachaPoolConfig): void;
}>();

const activeTab = ref("base");
const saving = ref(false);
const values = ref(createGachaFormState(props.poolKey, props.config));

watch(
  () => [props.poolKey, props.config, props.modelValue] as const,
  () => {
    if (props.modelValue) {
      values.value = createGachaFormState(props.poolKey, props.config);
      activeTab.value = "base";
    }
  },
  { deep: true },
);

const isInherited = computed(
  () => props.mode === "pool" && values.value.enabled === false,
);
const probabilityTotal = computed(() =>
  getProbabilityTotal(values.value.rarityProbabilities),
);
const probabilityPercent = computed(() => probabilityTotal.value * 100);
const probabilityValid = computed(
  () => Math.abs(probabilityTotal.value - 1) < 0.0001,
);
const cardOptions = computed(() =>
  (props.options?.cards || []).filter(
    (card) => props.mode === "default" || Number(card.pool) === values.value.poolId,
  ),
);
const saveEffect = computed(() => {
  if (props.mode === "default") {
    return values.value.enabled
      ? "保存为全局默认配置，未设置单独配置的卡池会继承它。"
      : "关闭全局默认配置，未设置单独配置的卡池会回退到代码兜底。";
  }
  return values.value.enabled
    ? "保存为当前卡池的单独配置。"
    : "关闭当前卡池的单独配置，改为继承默认配置。";
});

function toPercent(value: unknown) {
  return Number((Number(value || 0) * 100).toFixed(4));
}

function setProbability(rarity: string, percent: number) {
  values.value.rarityProbabilities[rarity] = percent / 100;
}

function applyTemplate(probabilities: Record<string, number>) {
  values.value.rarityProbabilities = normalizeRarityProbabilities(probabilities);
}

function normalizeProbabilities() {
  if (probabilityTotal.value <= 0) {
    ElMessage.error("当前概率合计为 0，无法归一化");
    return;
  }
  values.value.rarityProbabilities = normalizeRarityProbabilities(
    Object.fromEntries(
      rarityOptions.map((option) => {
        const rarity = String(option.value);
        return [
          rarity,
          Number(values.value.rarityProbabilities[rarity] || 0) /
            probabilityTotal.value,
        ];
      }),
    ),
  );
}

async function save() {
  if (!isInherited.value && !probabilityValid.value) {
    ElMessage.error(`稀有度概率合计必须为 100%，当前为 ${probabilityPercent.value.toFixed(2)}%`);
    return;
  }
  saving.value = true;
  try {
    emit("save", values.value.poolId, values.value);
  } finally {
    saving.value = false;
  }
}
</script>
