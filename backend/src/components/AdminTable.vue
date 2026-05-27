<template>
  <el-card class="panel-card">
    <template #header>
      <div class="panel-header">
        <div>
          <p class="eyebrow">数据列表</p>
          <h2>{{ title }}</h2>
        </div>
        <div class="panel-actions">
          <el-button type="info" plain :icon="Refresh" :loading="loading" @click="load">刷新</el-button>
          <el-button type="info" plain :icon="Download" @click="exportCurrentPage">导出当前页</el-button>
          <el-button v-if="creatable" type="primary" @click="openCreate">
            新增
          </el-button>
        </div>
      </div>
    </template>

    <div class="table-toolbar">
      <el-input
        v-model="keyword"
        clearable
        :placeholder="searchPlaceholder || '搜索关键字'"
        class="toolbar-input"
        @keyup.enter="reloadFromFirstPage"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
      <el-select
        v-if="enableRarityFilter"
        v-model="rarity"
        clearable
        placeholder="稀有度"
        class="toolbar-select"
        @change="reloadFromFirstPage"
      >
        <el-option
          v-for="option in rarityOptions"
          :key="String(option.value)"
          :label="option.label"
          :value="String(option.value)"
        />
      </el-select>
      <el-select
        v-if="poolFilterOptions.length"
        v-model="poolId"
        clearable
        filterable
        placeholder="卡池"
        class="toolbar-select"
        @change="reloadFromFirstPage"
      >
        <el-option
          v-for="option in poolFilterOptions"
          :key="String(option.value)"
          :label="option.label"
          :value="String(option.value)"
        />
      </el-select>
      <el-button type="primary" @click="reloadFromFirstPage">查询</el-button>
      <el-button plain @click="resetFilters">重置</el-button>
    </div>

    <el-alert v-if="error" :title="error" type="error" show-icon />

    <el-table
      v-loading="loading"
      :data="rows"
      border
      stripe
      class="admin-table"
      empty-text="暂无数据"
    >
      <el-table-column
        v-for="field in tableFields"
        :key="field.key"
        :label="field.label"
        :min-width="field.minWidth || 150"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          <slot name="cell" :field="field" :row="row" :reload="load">
            <div v-if="field.type === 'imageUpload'" class="table-image-cell">
              <video
                v-if="isMediaVideo(getValue(row, field.key))"
                :src="assetUrl(getValue(row, field.key))"
                muted
                loop
                autoplay
                playsinline
              />
              <img
                v-else-if="assetUrl(getValue(row, field.key))"
                :src="assetUrl(getValue(row, field.key))"
                alt="卡面素材"
              />
              <span v-else>未配置</span>
            </div>
            <UserIdentity
              v-else-if="field.identity"
              :uid="toIdentityValue(getValue(row, field.identity.uidKey))"
              :name="toIdentityValue(field.identity.nameKey ? getValue(row, field.identity.nameKey) : '')"
              :fallback="field.identity.fallback"
            />
            <span v-else>{{ formatFieldValue(field, getValue(row, field.key)) }}</span>
          </slot>
        </template>
      </el-table-column>
      <el-table-column label="操作" fixed="right" width="260">
        <template #default="{ row }">
          <div class="row-actions">
            <el-button type="info" plain size="small" @click="openDetail(row)">详情</el-button>
            <el-button v-if="editable" type="primary" plain size="small" @click="openEdit(row)">
              编辑
            </el-button>
            <slot name="actions" :row="row" :reload="load" />
            <el-button
              v-if="deletable"
              size="small"
              type="danger"
              plain
              @click="deleteItem(row)"
            >
              删除
            </el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-row">
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="data?.total || 0"
        layout="total, prev, pager, next"
        @current-change="load"
      />
    </div>
  </el-card>

  <el-dialog
    v-model="formVisible"
    :title="editing ? `编辑${title}` : `新增${title}`"
    width="760px"
    destroy-on-close
  >
    <el-form label-position="top" class="dialog-form">
      <template v-for="field in editableFields" :key="field.key">
        <el-form-item :label="field.label" :class="{ 'full-width': field.fullWidth }">
          <el-input
            v-if="!field.type || field.type === 'text'"
            v-model="formValues[field.key]"
            :placeholder="field.placeholder"
          />
          <el-input
            v-else-if="field.type === 'textarea'"
            v-model="formValues[field.key]"
            type="textarea"
            :rows="4"
            :placeholder="field.placeholder"
          />
          <el-input-number
            v-else-if="field.type === 'number'"
            v-model="formValues[field.key]"
            :step="1"
          />
          <el-switch
            v-else-if="field.type === 'boolean'"
            v-model="formValues[field.key]"
            active-text="开启"
            inactive-text="关闭"
          />
          <el-select
            v-else-if="field.type === 'select'"
            v-model="formValues[field.key]"
            filterable
            clearable
            :placeholder="field.placeholder || '请选择'"
          >
            <el-option
              v-for="option in getFieldOptions(field)"
              :key="String(option.value)"
              :label="option.label"
              :value="option.value"
              :disabled="option.disabled"
            />
          </el-select>
          <el-checkbox-group
            v-else-if="field.type === 'multiSelect'"
            v-model="formValues[field.key]"
          >
            <el-checkbox
              v-for="option in getFieldOptions(field)"
              :key="String(option.value)"
              :label="String(option.value)"
              :disabled="option.disabled"
            >
              {{ option.label }}
            </el-checkbox>
          </el-checkbox-group>
          <el-date-picker
            v-else-if="field.type === 'datetime'"
            v-model="formValues[field.key]"
            type="datetime"
            value-format="YYYY-MM-DDTHH:mm:ss.SSS[Z]"
            placeholder="选择时间"
          />
          <el-input
            v-else-if="field.type === 'json'"
            v-model="formValues[field.key]"
            type="textarea"
            :rows="5"
            placeholder="填写 JSON"
          />
          <div v-else-if="field.type === 'imageUpload'" class="image-upload-field">
            <div class="image-upload-preview">
              <video
                v-if="isMediaVideo(formValues[field.key])"
                :src="assetUrl(formValues[field.key])"
                muted
                loop
                autoplay
                playsinline
              />
              <img
                v-else-if="assetUrl(formValues[field.key])"
                :src="assetUrl(formValues[field.key])"
                alt="卡面素材"
              />
              <span v-else>未配置</span>
            </div>
            <div class="image-upload-actions">
              <label class="image-upload-button">
                上传
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                  :disabled="imageUploading"
                  @change="handleImageUpload(field, $event)"
                />
              </label>
              <el-button size="small" plain @click="clearImageField(field.key)">
                清空
              </el-button>
            </div>
          </div>
          <RewardEditor
            v-else-if="field.type === 'rewards'"
            v-model="formValues[field.key]"
            :item-options="itemOptions"
            :card-options="cardOptions"
            :allow-cards="field.allowCardRewards === true"
          />
          <RewardEditor
            v-else-if="field.type === 'costs'"
            v-model="formValues[field.key]"
            mode="costs"
            :item-options="itemOptions"
          />
          <small v-if="field.helper" class="form-help">{{ field.helper }}</small>
        </el-form-item>
      </template>
    </el-form>
    <template #footer>
      <el-button @click="formVisible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="saveForm">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="detailVisible" :title="`${title}详情`" width="720px">
    <el-descriptions :column="1" border>
      <el-descriptions-item
        v-for="field in detailFields"
        :key="field.key"
        :label="field.label"
      >
        <div v-if="field.type === 'imageUpload'" class="detail-image-cell">
          <video
            v-if="isMediaVideo(getValue(detail || {}, field.key))"
            :src="assetUrl(getValue(detail || {}, field.key))"
            muted
            loop
            autoplay
            playsinline
          />
          <img
            v-else-if="assetUrl(getValue(detail || {}, field.key))"
            :src="assetUrl(getValue(detail || {}, field.key))"
            alt="卡面素材"
          />
          <span v-else>未配置</span>
        </div>
        <template v-else>
          {{ formatFieldValue(field, getValue(detail || {}, field.key)) }}
        </template>
      </el-descriptions-item>
    </el-descriptions>
    <pre class="detail-json">{{ detail }}</pre>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Download, Refresh, Search } from "@element-plus/icons-vue";
import { getApiBase, request, toQuery } from "../api";
import { rarityOptions } from "../constants";
import type { FieldConfig, PageResult, SelectOption } from "../types";
import {
  cloneJson,
  exportRowsToCsv,
  formatFieldValue,
  getFieldOptions,
  getValue,
  parseFormJson,
} from "../utils";
import RewardEditor from "./RewardEditor.vue";
import UserIdentity from "./UserIdentity.vue";

const props = withDefaults(
  defineProps<{
    title: string;
    endpoint: string;
    fields: FieldConfig[];
    editable?: boolean;
    creatable?: boolean;
    deletable?: boolean;
    detailFetchable?: boolean;
    searchPlaceholder?: string;
    keywordParam?: string;
    enableRarityFilter?: boolean;
    poolFilterOptions?: SelectOption[];
    itemOptions?: SelectOption[];
    cardOptions?: SelectOption[];
  }>(),
  {
    keywordParam: "keyword",
    poolFilterOptions: () => [],
    itemOptions: () => [],
    cardOptions: () => [],
  },
);

defineExpose({ load });

const page = ref(1);
const pageSize = ref(20);
const keyword = ref("");
const rarity = ref("");
const poolId = ref("");
const data = ref<PageResult<Record<string, any>> | null>(null);
const error = ref("");
const loading = ref(false);
const saving = ref(false);
const imageUploading = ref(false);
const editing = ref<Record<string, any> | null>(null);
const formVisible = ref(false);
const formValues = ref<Record<string, any>>({});
const imageTouched = ref<Record<string, boolean>>({});
const detail = ref<Record<string, any> | null>(null);
const detailVisible = ref(false);

const rows = computed(() => data.value?.list || []);
const tableFields = computed(() =>
  props.fields.filter((field) => !field.tableHidden),
);
const editableFields = computed(() =>
  props.fields.filter((field) => !field.readonly && !field.formHidden),
);
const detailFields = computed(() =>
  props.fields.filter((field) => !field.detailHidden),
);

function buildFilters() {
  return {
    page: page.value,
    pageSize: pageSize.value,
    [props.keywordParam]: keyword.value,
    rarity: rarity.value,
    poolId: poolId.value,
  };
}

async function load() {
  error.value = "";
  loading.value = true;
  try {
    data.value = await request<PageResult<Record<string, any>>>(
      `${props.endpoint}${toQuery(buildFilters())}`,
    );
  } catch (err) {
    error.value = err instanceof Error ? err.message : "加载失败";
  } finally {
    loading.value = false;
  }
}

function reloadFromFirstPage() {
  page.value = 1;
  load();
}

function resetFilters() {
  keyword.value = "";
  rarity.value = "";
  poolId.value = "";
  reloadFromFirstPage();
}

function createDefaultForm(row?: Record<string, any>) {
  return Object.fromEntries(
    editableFields.value.map((field) => {
      const raw = row ? getValue(row, field.key) : field.defaultValue;
      if (field.type === "multiSelect") {
        return [
          field.key,
          Array.isArray(raw)
            ? raw.map(String)
            : String(raw || "")
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
        ];
      }
      if (field.type === "json") {
        return [
          field.key,
          raw && typeof raw === "object" ? JSON.stringify(raw, null, 2) : "",
        ];
      }
      if (field.type === "rewards") {
        return [
          field.key,
          cloneJson(raw || { points: 0, items: [], cards: [] }),
        ];
      }
      if (field.type === "costs") {
        return [field.key, cloneJson(raw || [])];
      }
      if (field.type === "boolean") {
        return [field.key, raw === undefined ? Boolean(field.defaultValue) : raw !== false];
      }
      return [field.key, raw ?? ""];
    }),
  );
}

function openCreate() {
  editing.value = null;
  imageTouched.value = {};
  formValues.value = createDefaultForm();
  formVisible.value = true;
}

function openEdit(row: Record<string, any>) {
  editing.value = row;
  imageTouched.value = {};
  formValues.value = createDefaultForm(row);
  formVisible.value = true;
}

function serializeForm() {
  return editableFields.value.reduce<Record<string, any>>((result, field) => {
    if (
      editing.value &&
      field.type === "imageUpload" &&
      !imageTouched.value[field.key]
    ) {
      const originalValue = getValue(editing.value, field.key);
      if (originalValue !== undefined) {
        result[field.key] = serializeFieldValue(field, originalValue);
      }
      return result;
    }
    result[field.key] = serializeFieldValue(field, formValues.value[field.key]);
    return result;
  }, {});
}

function serializeFieldValue(field: FieldConfig, value: unknown) {
  if (field.type === "multiSelect") {
    const selected = Array.isArray(value) ? value.map(String) : [];
    return selected.join(",");
  }
  if (field.type === "json") {
    return parseFormJson(value);
  }
  if (field.type === "datetime" || field.type === "number") {
    return value === "" || value === null || value === undefined ? null : value;
  }
  return value === "" || value === null || value === undefined ? "" : value;
}

function assetUrl(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  if (/^(https?:|data:|blob:)/i.test(raw)) {
    return raw;
  }
  return `${getApiBase()}${raw.startsWith("/") ? raw : `/${raw}`}`;
}

function isMediaVideo(value: unknown) {
  return /\.(mp4|webm)(?:[?#]|$)/i.test(String(value || "").trim());
}

function clearImageField(key: string) {
  formValues.value[key] = "";
  imageTouched.value[key] = true;
}

async function handleImageUpload(field: FieldConfig, event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) {
    return;
  }
  const isImage = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
  const isVideo = ["video/mp4", "video/webm"].includes(file.type);
  if (!isImage && !isVideo) {
    ElMessage.error("仅支持 JPG、PNG、WEBP、MP4、WEBM 文件");
    return;
  }
  if (isImage && file.size > 2 * 1024 * 1024) {
    ElMessage.error("图片不能超过2MB");
    return;
  }
  if (isVideo && file.size > 10 * 1024 * 1024) {
    ElMessage.error("视频不能超过10MB");
    return;
  }

  imageUploading.value = true;
  try {
    const body = new FormData();
    body.append("file", file);
    const result = await request<{ url: string }>(
      field.uploadEndpoint || "/admin/uploads/card-image",
      {
        method: "POST",
        body,
      },
    );
    formValues.value[field.key] = result.url;
    imageTouched.value[field.key] = true;
    ElMessage.success("已上传");
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : "上传失败");
  } finally {
    imageUploading.value = false;
  }
}

async function saveForm() {
  saving.value = true;
  try {
    const current = editing.value;
    await request(current ? `${props.endpoint}/${current.id}` : props.endpoint, {
      method: current ? "PATCH" : "POST",
      body: JSON.stringify(serializeForm()),
    });
    ElMessage.success(current ? "已保存修改" : "已新增记录");
    formVisible.value = false;
    await load();
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : "保存失败");
  } finally {
    saving.value = false;
  }
}

async function deleteItem(row: Record<string, any>) {
  try {
    await ElMessageBox.confirm(
      `确认删除 ${props.title} #${row.id}？删除后不可直接恢复。`,
      "删除确认",
      { type: "warning", confirmButtonText: "删除", cancelButtonText: "取消" },
    );
    await request(`${props.endpoint}/${row.id}`, { method: "DELETE" });
    ElMessage.success("已删除");
    await load();
  } catch (err) {
    if (err !== "cancel") {
      ElMessage.error(err instanceof Error ? err.message : "删除失败");
    }
  }
}

async function openDetail(row: Record<string, any>) {
  detail.value = row;
  detailVisible.value = true;
  if (!props.detailFetchable) {
    return;
  }
  try {
    detail.value = await request<Record<string, any>>(`${props.endpoint}/${row.id}`);
  } catch {
    detail.value = row;
  }
}

function exportCurrentPage() {
  exportRowsToCsv(props.title, rows.value, tableFields.value);
}

function toIdentityValue(value: unknown) {
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }
  if (value === null || value === undefined) {
    return null;
  }
  return String(value);
}

onMounted(load);
</script>
