<template>
  <div>
    <div class="panel-card plain-card">
      <div class="panel-header">
        <div>
          <p class="eyebrow">系统配置</p>
          <h2>默认抽卡配置</h2>
        </div>
        <button class="link-button" type="button" @click="load">
          {{ loading ? "加载中" : "刷新" }}
        </button>
      </div>

      <div v-if="error" class="state-box error">{{ error }}</div>
      <div v-else-if="editableDefaultConfig" class="config-summary-grid">
        <div class="summary-item">
          <span>配置来源</span>
          <strong>{{ getGachaSourceText(editableDefaultConfig) }}</strong>
        </div>
        <div class="summary-item">
          <span>星穹币消耗</span>
          <strong>
            单抽 {{ editableDefaultConfig.drawCosts?.once ?? 10 }} / 十连
            {{ editableDefaultConfig.drawCosts?.ten ?? 100 }}
          </strong>
        </div>
        <div class="summary-item">
          <span>概率合计</span>
          <strong>
            {{
              (
                getProbabilityTotal(editableDefaultConfig.rarityProbabilities) *
                100
              ).toFixed(2)
            }}%
          </strong>
        </div>
        <div class="summary-item">
          <span>UP</span>
          <strong>{{ summarizeUpConfig(editableDefaultConfig.upCards) }}</strong>
        </div>
        <div class="summary-item">
          <span>保底</span>
          <strong>
            {{ summarizePityConfig(editableDefaultConfig.pitySystem) }}
          </strong>
        </div>
        <div class="summary-item">
          <span>更新时间</span>
          <strong>
            {{
              editableDefaultConfig.updatedAt
                ? formatDate(editableDefaultConfig.updatedAt)
                : "-"
            }}
          </strong>
        </div>
      </div>
      <div v-else class="state-box">暂无默认配置</div>

      <div class="config-actions">
        <el-button
          class="config-edit-button"
          type="primary"
          :icon="EditPen"
          @click="dialogVisible = true"
        >
          编辑配置
        </el-button>
      </div>
    </div>

    <GachaConfigDialog
      v-if="editableDefaultConfig"
      v-model="dialogVisible"
      mode="default"
      pool-key="0"
      :config="editableDefaultConfig"
      :default-config="fallbackConfig"
      pool-name="全局默认配置"
      :options="options || null"
      @save="save"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ElButton } from "element-plus/es/components/button/index";
import { ElMessage } from "element-plus/es/components/message/index";
import { EditPen } from "@element-plus/icons-vue";
import GachaConfigDialog from "../components/GachaConfigDialog.vue";
import { request } from "../api";
import type { AdminOptions, GachaConfigData, GachaPoolConfig } from "../types";
import {
  formatDate,
  getGachaSourceText,
  getProbabilityTotal,
  summarizePityConfig,
  summarizeUpConfig,
} from "../utils";

defineProps<{
  options?: AdminOptions | null;
}>();

const data = ref<GachaConfigData | null>(null);
const loading = ref(false);
const error = ref("");
const dialogVisible = ref(false);

const defaultConfig = computed(
  () => data.value?.defaultConfig || data.value?.pools?.["0"],
);
const fallbackConfig = computed(
  () => data.value?.fallbackConfig || data.value?.defaults?.["0"],
);
const editableDefaultConfig = computed<GachaPoolConfig>(
  () =>
    defaultConfig.value ||
    fallbackConfig.value || {
      poolId: 0,
      enabled: true,
      scope: "fallback",
    },
);

async function load() {
  loading.value = true;
  error.value = "";
  try {
    data.value = await request<GachaConfigData>("/admin/config/gacha");
  } catch (err) {
    error.value = err instanceof Error ? err.message : "加载失败";
  } finally {
    loading.value = false;
  }
}

async function save(poolId: number, values: GachaPoolConfig) {
  const { poolId: _poolId, source, scope, updatedAt, ...payload } = values;
  void _poolId;
  void source;
  void scope;
  void updatedAt;
  try {
    await request(`/admin/config/gacha/${poolId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    ElMessage.success("默认抽卡配置已保存");
    dialogVisible.value = false;
    await load();
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : "保存失败");
  }
}

onMounted(load);
</script>
