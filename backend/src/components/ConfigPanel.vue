<template>
  <el-card class="panel-card">
    <template #header>
      <div class="panel-header">
        <div>
          <p class="eyebrow">系统配置</p>
          <h2>{{ title }}</h2>
          <p v-if="description" class="panel-description">{{ description }}</p>
        </div>
        <el-button type="info" plain :icon="Refresh" :loading="loading" @click="load">刷新</el-button>
      </div>
    </template>

    <el-alert v-if="error" :title="error" type="error" show-icon />
    <el-form
      v-else
      v-loading="loading"
      label-position="top"
      class="dialog-form config-form"
    >
      <template v-for="field in fields" :key="field.key">
        <el-form-item :label="field.label" :class="{ 'full-width': field.fullWidth }">
          <el-input
            v-if="!field.type || field.type === 'text'"
            v-model="values[field.key]"
            :placeholder="field.placeholder"
          />
          <el-input
            v-else-if="field.type === 'textarea'"
            v-model="values[field.key]"
            type="textarea"
            :rows="4"
            :placeholder="field.placeholder"
          />
          <el-input-number
            v-else-if="field.type === 'number'"
            v-model="values[field.key]"
            :step="1"
          />
          <el-switch
            v-else-if="field.type === 'boolean'"
            v-model="values[field.key]"
            active-text="启用"
            inactive-text="停用"
          />
          <el-date-picker
            v-else-if="field.type === 'datetime'"
            v-model="values[field.key]"
            type="datetime"
            value-format="YYYY-MM-DDTHH:mm:ss.SSS[Z]"
            placeholder="选择时间"
          />
          <el-input
            v-else-if="field.type === 'json'"
            v-model="values[field.key]"
            type="textarea"
            :rows="5"
          />
          <RewardEditor
            v-else-if="field.type === 'rewards'"
            v-model="values[field.key]"
            :item-options="itemOptions"
          />
          <DecomposeConfigEditor
            v-else-if="field.type === 'decomposeConfig'"
            v-model="values[field.key]"
            :item-options="itemOptions"
          />
          <small v-if="field.helper" class="form-help">{{ field.helper }}</small>
        </el-form-item>
      </template>
    </el-form>

    <div class="config-actions">
      <el-button type="primary" :loading="saving" @click="save">保存配置</el-button>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElAlert } from "element-plus/es/components/alert/index";
import { ElButton } from "element-plus/es/components/button/index";
import { ElCard } from "element-plus/es/components/card/index";
import { ElDatePicker } from "element-plus/es/components/date-picker/index";
import { ElForm, ElFormItem } from "element-plus/es/components/form/index";
import { ElInput } from "element-plus/es/components/input/index";
import { ElInputNumber } from "element-plus/es/components/input-number/index";
import { ElMessage } from "element-plus/es/components/message/index";
import { ElSwitch } from "element-plus/es/components/switch/index";
import { Refresh } from "@element-plus/icons-vue";
import { request } from "../api";
import type { FieldConfig, SelectOption } from "../types";
import { cloneJson, parseFormJson } from "../utils";
import RewardEditor from "./RewardEditor.vue";
import DecomposeConfigEditor from "./DecomposeConfigEditor.vue";

const props = withDefaults(
  defineProps<{
    title: string;
    description?: string;
    endpoint: string;
    fields: FieldConfig[];
    itemOptions?: SelectOption[];
  }>(),
  {
    itemOptions: () => [],
  },
);
const emit = defineEmits<{
  (event: "saved"): void;
}>();

const values = ref<Record<string, any>>({});
const loading = ref(false);
const saving = ref(false);
const error = ref("");

function buildDefault(data: Record<string, any> | null) {
  values.value = Object.fromEntries(
    props.fields.map((field) => {
      const raw = data?.[field.key] ?? field.defaultValue;
      if (field.type === "json") {
        return [
          field.key,
          raw && typeof raw === "object" ? JSON.stringify(raw, null, 2) : "",
        ];
      }
      if (field.type === "rewards") {
        return [field.key, cloneJson(raw || { points: 0, items: [] })];
      }
      if (field.type === "decomposeConfig") {
        return [field.key, cloneJson(raw || {})];
      }
      if (field.type === "boolean") {
        return [field.key, raw === undefined ? Boolean(field.defaultValue) : raw !== false];
      }
      return [field.key, raw ?? ""];
    }),
  );
}

async function load() {
  error.value = "";
  loading.value = true;
  try {
    const data = await request<Record<string, any>>(props.endpoint);
    buildDefault(data);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "加载失败";
  } finally {
    loading.value = false;
  }
}

function serialize() {
  return props.fields.reduce<Record<string, any>>((result, field) => {
    result[field.key] = serializeFieldValue(field, values.value[field.key]);
    return result;
  }, {});
}

function serializeFieldValue(field: FieldConfig, value: unknown) {
  if (field.type === "json") {
    return parseFormJson(value);
  }
  if (field.type === "datetime" || field.type === "number") {
    return value === "" || value === null || value === undefined ? null : value;
  }
  return value === "" || value === null || value === undefined ? "" : value;
}

async function save() {
  saving.value = true;
  try {
    const next = await request<Record<string, any>>(props.endpoint, {
      method: "PATCH",
      body: JSON.stringify(serialize()),
    });
    buildDefault(next);
    ElMessage.success("配置已保存");
    emit("saved");
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : "保存失败");
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>
