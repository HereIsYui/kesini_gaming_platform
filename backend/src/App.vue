<template>
  <main v-if="!token" class="login-screen">
    <el-card class="login-panel">
      <div class="brand-mark large">
        <el-icon><MagicStick /></el-icon>
      </div>
      <p class="eyebrow">{{ siteConfig.websiteTitle }}</p>
      <h1>{{ siteConfig.adminTitle }}</h1>
      <p class="login-copy">使用 OpenID 或已有 JWT 登录后台。</p>

      <el-form label-position="top" class="login-form">
        <el-form-item label="API 地址">
          <el-input v-model="apiBaseInput" />
        </el-form-item>
        <el-button type="primary" :loading="loginLoading" @click="startLogin">
          使用 OpenID 登录
        </el-button>
      </el-form>

      <el-divider>本地调试 Token</el-divider>
      <el-form label-position="top" class="login-form">
        <el-form-item label="粘贴已有 JWT">
          <el-input v-model="manualToken" type="textarea" :rows="4" />
        </el-form-item>
        <el-button @click="useManualToken">使用 Token 进入</el-button>
      </el-form>

      <el-alert v-if="authError" :title="authError" type="error" show-icon />
    </el-card>
  </main>

  <main v-else-if="!admin" class="login-screen">
    <section class="login-panel checking-panel">
      <div class="brand-mark large">
        <el-icon><Lock /></el-icon>
      </div>
      <p class="eyebrow">权限校验</p>
      <h1>正在验证后台权限</h1>
      <p>正在确认当前账号是否具备后台管理权限。</p>
    </section>
  </main>

  <el-container v-else class="app-shell">
    <el-aside class="sidebar" width="236px">
      <SidebarBrand />
      <el-scrollbar class="sidebar-menu-scroll">
        <el-menu
          :default-active="active"
          class="admin-menu"
          @select="setRoute($event as PageKey)"
        >
          <el-menu-item-group
            v-for="group in pagesByGroup"
            :key="group.group"
            :title="group.group"
          >
            <el-menu-item
              v-for="page in group.pages"
              :key="page.key"
              :index="page.key"
            >
              <el-icon><component :is="page.icon" /></el-icon>
              <span>{{ page.label }}</span>
            </el-menu-item>
          </el-menu-item-group>
        </el-menu>
      </el-scrollbar>
    </el-aside>

    <el-container class="main">
      <el-header class="topbar">
        <div class="topbar-title">
          <p class="eyebrow">{{ activePage.group }}</p>
          <h1>{{ activePage.label }}</h1>
          <span>{{ activePage.description }}</span>
        </div>
        <div class="top-actions">
          <el-dropdown
            v-if="admin?.user"
            trigger="click"
            popper-class="login-status-dropdown"
            @command="handleUserCommand"
          >
            <button class="login-status" type="button">
              <img
                v-if="getOpenidAvatar(admin.user)"
                :src="getOpenidAvatar(admin.user)"
                :alt="getOpenidDisplayName(admin.user)"
              />
              <span v-else class="login-avatar-fallback">
                {{ getOpenidInitial(admin.user) }}
              </span>
              <div class="login-status-text">
                <strong>{{ getOpenidDisplayName(admin.user) }}</strong>
                <span>已登录 · UID {{ admin.user.uid }}</span>
              </div>
              <el-icon class="login-status-arrow"><ArrowDown /></el-icon>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="logout" :icon="SwitchButton">
                  退出登录
                </el-dropdown-item>
                <el-dropdown-item
                  command="toggle-theme"
                  :icon="theme === 'light' ? Moon : Sunny"
                >
                  {{ theme === "light" ? "切换为暗色模式" : "切换为亮色模式" }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <el-main class="content">
        <DashboardPage
          v-if="active === 'dashboard'"
          :data="dashboardData || undefined"
          :loading="dashboardLoading"
          :error="dashboardError"
          @reload="loadDashboard"
        />

        <AdminTable
          v-else-if="active === 'pools'"
          title="卡池管理"
          endpoint="/admin/pools"
          :fields="poolFields"
          editable
          creatable
          deletable
          detail-fetchable
          search-placeholder="搜索卡池名称或描述"
        >
          <template #cell="{ field, row, reload }">
            <el-switch
              v-if="field.key === 'enabled'"
              :model-value="row.enabled !== false"
              active-text="上线"
              inactive-text="下线"
              :loading="togglingPoolId === Number(row.id)"
              @change="togglePoolEnabled(row, Boolean($event), reload)"
            />
            <el-tag
              v-else-if="field.key === 'card_type'"
              :type="getPoolTypeTagType(row.card_type)"
            >
              {{ getPoolTypeLabel(row.card_type) }}
            </el-tag>
            <el-tag
              v-else-if="field.key === 'gacha_config_mode'"
              :type="
                String(row.gacha_config_mode) === '卡池配置'
                  ? 'success'
                  : 'info'
              "
            >
              {{ row.gacha_config_mode || "默认配置" }}
            </el-tag>
            <span v-else>{{
              formatFieldValue(field, getValue(row, field.key))
            }}</span>
          </template>
          <template #actions="{ row }">
            <el-button
              size="small"
              type="primary"
              plain
              :loading="loadingPoolId === Number(row.id)"
              @click="openPoolGacha(row)"
            >
              抽卡配置
            </el-button>
          </template>
        </AdminTable>

        <AdminTable
          v-else-if="active === 'cards'"
          title="卡片管理"
          endpoint="/admin/cards"
          :fields="cardFields"
          :pool-filter-options="adminOptions?.pools || []"
          :item-options="itemOptions"
          editable
          creatable
          deletable
          detail-fetchable
          enable-rarity-filter
          search-placeholder="搜索卡片名称"
        >
          <template #actions="{ row, reload }">
            <el-button
              size="small"
              type="success"
              plain
              @click="openCardMedia(row, reload)"
            >
              卡面
            </el-button>
          </template>
        </AdminTable>

        <AdminTable
          v-else-if="active === 'drop-items'"
          title="物品管理"
          endpoint="/admin/drop-items"
          :fields="dropFields"
          editable
          creatable
          deletable
          detail-fetchable
          search-placeholder="搜索物品名称或说明"
        />

        <AdminTable
          v-else-if="active === 'users'"
          title="用户管理"
          endpoint="/admin/users"
          :fields="userFields"
          editable
          detail-fetchable
          search-placeholder="搜索 UID、用户名或昵称"
        />

        <AdminTable
          v-else-if="active === 'histories'"
          title="抽卡历史"
          endpoint="/admin/histories"
          :fields="historyFields"
          keyword-param="uid"
          enable-rarity-filter
          search-placeholder="按 UID 查询"
        />

        <AdminTable
          v-else-if="active === 'inventories'"
          title="背包管理"
          endpoint="/admin/inventories"
          :fields="inventoryFields"
          editable
          keyword-param="uid"
          search-placeholder="按 UID 查询"
        />

        <AdminTable
          v-else-if="active === 'pity'"
          title="保底状态"
          endpoint="/admin/pity"
          :fields="pityFields"
          :pool-filter-options="adminOptions?.pools || []"
          editable
          keyword-param="uid"
          search-placeholder="按 UID 查询"
        >
          <template #cell="{ field, row }">
            <div v-if="field.key === 'uid'" class="identity-cell">
              <strong>{{ row.userName || "未知用户" }}</strong>
              <span>UID {{ row.uid || "-" }}</span>
            </div>
            <div v-else-if="field.key === 'poolName'" class="identity-cell">
              <strong>{{
                row.poolName || `卡池 #${row.pool_id || "-"}`
              }}</strong>
              <span>ID {{ row.pool_id || "-" }}</span>
            </div>
            <el-tag
              v-else-if="field.key === 'gacha_config_mode'"
              :type="
                String(row.gacha_config_mode) === '卡池配置'
                  ? 'success'
                  : 'info'
              "
            >
              {{ row.gacha_config_mode || "默认配置" }}
            </el-tag>
            <PityProgress
              v-else-if="field.key === 'pity_overview'"
              :row="row"
            />
            <span v-else>{{
              formatFieldValue(field, getValue(row, field.key))
            }}</span>
          </template>
        </AdminTable>

        <AdminTable
          v-else-if="active === 'redeem-codes'"
          title="兑换码"
          endpoint="/admin/redeem-codes"
          :fields="redeemCodeFields"
          :item-options="itemOptions"
          :card-options="adminOptions?.cards || []"
          editable
          creatable
          deletable
          detail-fetchable
          search-placeholder="搜索兑换码或名称"
        />

        <AdminTable
          v-else-if="active === 'redeem-usages'"
          title="兑换记录"
          endpoint="/admin/redeem-usages"
          :fields="redeemUsageFields"
          keyword-param="uid"
          search-placeholder="按 UID 查询"
        />

        <AdminTable
          v-else-if="active === 'exchange-shop'"
          title="兑换商店"
          endpoint="/admin/exchange-items"
          :fields="exchangeItemFields"
          :item-options="itemOptions"
          editable
          creatable
          deletable
          detail-fetchable
          search-placeholder="搜索兑换项"
        />

        <AdminTable
          v-else-if="active === 'exchange-usages'"
          title="兑换商店记录"
          endpoint="/admin/exchange-usages"
          :fields="exchangeUsageFields"
          keyword-param="uid"
          search-placeholder="按 UID 查询"
        />

        <AdminTable
          v-else-if="active === 'announcements'"
          title="公告栏"
          endpoint="/admin/announcements"
          :fields="announcementFields"
          editable
          creatable
          deletable
          detail-fetchable
          search-placeholder="搜索标题或内容"
        />

        <ConfigPanel
          v-else-if="active === 'launch-activity-config'"
          title="开服活动"
          description="配置登录可领取的开服福利、活动批次和奖励内容。"
          endpoint="/admin/config/launch-activity"
          :fields="launchActivityFields"
          :item-options="itemOptions"
        />

        <AdminTable
          v-else-if="active === 'launch-activity-claims'"
          title="活动领取记录"
          endpoint="/admin/launch-activity-claims"
          :fields="launchActivityClaimFields"
          keyword-param="uid"
          search-placeholder="按 UID 查询"
        />

        <AdminTable
          v-else-if="active === 'achievements'"
          title="成就配置"
          endpoint="/admin/achievements"
          :fields="achievementFields"
          :item-options="itemOptions"
          editable
          creatable
          deletable
          detail-fetchable
          search-placeholder="搜索成就名称或编码"
        />

        <AdminTable
          v-else-if="active === 'user-achievements'"
          title="成就记录"
          endpoint="/admin/user-achievements"
          :fields="userAchievementFields"
          keyword-param="uid"
          search-placeholder="按 UID 查询"
        />

        <AdminTable
          v-else-if="active === 'seasons'"
          title="赛季配置"
          endpoint="/admin/seasons"
          :fields="seasonFields"
          editable
          creatable
          deletable
          detail-fetchable
          search-placeholder="搜索赛季名称或编码"
        >
          <template #cell="{ field, row }">
            <el-tag
              v-if="field.key === 'enabled'"
              :type="row.enabled !== false ? 'success' : 'info'"
            >
              {{ row.enabled !== false ? "上线" : "下线" }}
            </el-tag>
            <el-tag
              v-else-if="field.key === 'shop_enabled'"
              :type="row.shop_enabled !== false ? 'success' : 'info'"
            >
              {{ row.shop_enabled !== false ? "商店开启" : "商店关闭" }}
            </el-tag>
            <el-tag
              v-else-if="field.key === 'leaderboard_enabled'"
              :type="row.leaderboard_enabled !== false ? 'success' : 'info'"
            >
              {{ row.leaderboard_enabled !== false ? "排行开启" : "排行关闭" }}
            </el-tag>
            <span v-else>{{
              formatFieldValue(field, getValue(row, field.key))
            }}</span>
          </template>
        </AdminTable>

        <AdminTable
          v-else-if="active === 'season-shop-items'"
          title="赛季商店"
          endpoint="/admin/season-shop-items"
          :fields="seasonShopItemFields"
          :item-options="itemOptions"
          :card-options="adminOptions?.cards || []"
          editable
          creatable
          deletable
          detail-fetchable
          search-placeholder="搜索兑换项或赛季编码"
        >
          <template #cell="{ field, row }">
            <el-tag
              v-if="field.key === 'enabled'"
              :type="row.enabled !== false ? 'success' : 'info'"
            >
              {{ row.enabled !== false ? "上架" : "下架" }}
            </el-tag>
            <span v-else>{{
              formatFieldValue(field, getValue(row, field.key))
            }}</span>
          </template>
        </AdminTable>

        <AdminTable
          v-else-if="active === 'season-point-records'"
          title="赛季积分记录"
          endpoint="/admin/season-point-records"
          :fields="seasonPointRecordFields"
          keyword-param="uid"
          search-placeholder="按 UID 查询"
        />

        <AdminTable
          v-else-if="active === 'season-shop-usages'"
          title="赛季兑换记录"
          endpoint="/admin/season-shop-usages"
          :fields="seasonShopUsageFields"
          keyword-param="uid"
          search-placeholder="按 UID 查询"
        />

        <AdminTable
          v-else-if="active === 'pve-stages'"
          title="PVE 关卡"
          endpoint="/admin/pve-stages"
          :fields="pveStageFields"
          :item-options="itemOptions"
          :card-options="adminOptions?.cards || []"
          editable
          creatable
          deletable
          detail-fetchable
          search-placeholder="搜索关卡名称或说明"
        >
          <template #cell="{ field, row }">
            <el-tag
              v-if="field.key === 'enabled'"
              :type="row.enabled !== false ? 'success' : 'info'"
            >
              {{ row.enabled !== false ? "上线" : "下线" }}
            </el-tag>
            <span v-else>{{
              formatFieldValue(field, getValue(row, field.key))
            }}</span>
          </template>
        </AdminTable>

        <AdminTable
          v-else-if="active === 'pve-records'"
          title="PVE 挑战记录"
          endpoint="/admin/pve-records"
          :fields="pveRecordFields"
          keyword-param="uid"
          search-placeholder="按 UID 查询"
        >
          <template #cell="{ field, row }">
            <el-tag
              v-if="field.key === 'success'"
              :type="row.success === true ? 'success' : 'danger'"
            >
              {{ row.success === true ? "胜利" : "失败" }}
            </el-tag>
            <span v-else>{{
              formatFieldValue(field, getValue(row, field.key))
            }}</span>
          </template>
        </AdminTable>

        <ConfigPanel
          v-else-if="active === 'trade-config'"
          title="交易配置"
          description="配置交易开关、手续费率和价格区间。"
          endpoint="/admin/config/trade"
          :fields="tradeConfigFields"
        />

        <ConfigPanel
          v-else-if="active === 'shop-recycle-config'"
          title="商店回收"
          description="配置回收开关和各稀有度价格。"
          endpoint="/admin/config/shop-recycle"
          :fields="shopRecycleConfigFields"
        />

        <ConfigPanel
          v-else-if="active === 'decompose-config'"
          title="分解配置"
          description="配置各稀有度卡片分解后的默认碎片与数量范围。"
          endpoint="/admin/config/decompose"
          :fields="decomposeConfigFields"
          :item-options="itemOptions"
        />

        <AdminTable
          v-else-if="active === 'trade-listings'"
          title="交易挂单"
          endpoint="/admin/trade-listings"
          :fields="tradeListingFields"
          detail-fetchable
          keyword-param="uid"
          search-placeholder="按 UID 或卡片搜索"
        />

        <AdminTable
          v-else-if="active === 'trade-records'"
          title="交易记录"
          endpoint="/admin/trade-records"
          :fields="tradeRecordFields"
          detail-fetchable
          keyword-param="uid"
          search-placeholder="按 UID 或卡片搜索"
        />

        <ConfigPanel
          v-else-if="active === 'recharge-config'"
          title="充值配置"
          description="配置鱼排扣分充值开关、比例、范围和密钥。"
          endpoint="/admin/config/recharge"
          :fields="rechargeConfigFields"
        />

        <AdminTable
          v-else-if="active === 'recharge-records'"
          title="充值记录"
          endpoint="/admin/recharge-records"
          :fields="rechargeRecordFields"
          detail-fetchable
          keyword-param="uid"
          search-placeholder="按 UID 查询"
        />

        <GachaConfigPage
          v-else-if="active === 'gacha-config'"
          :options="adminOptions || undefined"
        />

        <ConfigPanel
          v-else-if="active === 'site-config'"
          title="站点配置"
          description="配置玩家站和后台管理台的浏览器标题与页面品牌标题。"
          endpoint="/admin/config/site"
          :fields="siteConfigFields"
          @saved="loadSiteConfig"
        />
      </el-main>
    </el-container>
  </el-container>

  <GachaConfigDialog
    v-if="editingPoolGacha"
    v-model="poolGachaVisible"
    mode="pool"
    :pool-key="String(editingPoolGacha.poolId)"
    :pool-name="editingPoolGacha.poolName"
    :config="editingPoolGacha.config"
    :default-config="editingPoolGacha.defaultConfig"
    :options="adminOptions"
    @save="savePoolGacha"
  />

  <el-dialog
    v-model="cardMediaVisible"
    title="卡面"
    width="520px"
    class="admin-dialog"
  >
    <div class="card-media-dialog">
      <div class="image-upload-preview card-media-preview">
        <video
          v-if="isMediaVideo(cardMediaValue)"
          :src="assetUrl(cardMediaValue)"
          muted
          loop
          autoplay
          playsinline
        />
        <img
          v-else-if="assetUrl(cardMediaValue)"
          :src="assetUrl(cardMediaValue)"
          alt="卡面"
        />
        <span v-else>未配置</span>
      </div>
      <el-form label-position="top" class="card-media-link-form">
        <el-form-item label="图片链接">
          <el-input
            v-model="cardMediaValue"
            clearable
            placeholder="https://..."
          />
        </el-form-item>
      </el-form>
      <div class="image-upload-actions">
        <label class="image-upload-button">
          上传
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
            :disabled="cardMediaUploading"
            @change="handleCardMediaUpload"
          />
        </label>
        <el-button plain @click="clearCardMedia">清空</el-button>
      </div>
    </div>
    <template #footer>
      <el-button @click="cardMediaVisible = false">取消</el-button>
      <el-button
        type="primary"
        :loading="cardMediaSaving"
        @click="saveCardMedia"
      >
        保存
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, ref, watch } from "vue";
import { ElButton, ElMessage } from "element-plus";
import {
  ArrowDown,
  Collection,
  Coin,
  DataAnalysis,
  EditPen,
  Files,
  Goods,
  Histogram,
  Lock,
  MagicStick,
  Medal,
  Moon,
  Present,
  Setting,
  Shop,
  Sunny,
  SwitchButton,
  Ticket,
  User,
  Wallet,
} from "@element-plus/icons-vue";
import {
  achievementFields,
  announcementFields,
  createCardFields,
  createSeasonShopItemFields,
  decomposeConfigFields,
  defaultPageKey,
  dropFields,
  exchangeItemFields,
  exchangeUsageFields,
  historyFields,
  inventoryFields,
  launchActivityClaimFields,
  launchActivityFields,
  navGroups,
  pageKeys,
  pityFields,
  poolFields,
  pveRecordFields,
  pveStageFields,
  rechargeConfigFields,
  rechargeRecordFields,
  redeemCodeFields,
  redeemUsageFields,
  routeAliases,
  seasonFields,
  seasonPointRecordFields,
  seasonShopUsageFields,
  shopRecycleConfigFields,
  siteConfigFields,
  tradeConfigFields,
  tradeListingFields,
  tradeRecordFields,
  userAchievementFields,
  userFields,
} from "./constants";
import type { NavGroup, PageKey } from "./constants";
import {
  clearToken,
  getApiBase,
  getToken,
  request,
  setApiBase,
  setToken,
  toQuery,
} from "./api";
import type {
  AdminMeResponse,
  AdminOptions,
  DashboardData,
  GachaConfigData,
  GachaPoolConfig,
  PoolGachaConfigDetail,
  SelectOption,
  SiteConfig,
} from "./types";
import {
  formatFieldValue,
  getGachaSourceText,
  getPoolGachaModalConfig,
  getPoolTypeLabel,
  getPoolTypeTagType,
  getProbabilityTotal,
  getValue,
  summarizePityConfig,
  summarizeUpConfig,
  formatDate,
} from "./utils";
import AdminTable from "./components/AdminTable.vue";
import ConfigPanel from "./components/ConfigPanel.vue";
import GachaConfigDialog from "./components/GachaConfigDialog.vue";
import PityProgress from "./components/PityProgress.vue";

type Theme = "light" | "dark";

const handledOpenidCallbacks = new Set<string>();
const token = ref(getToken());
const admin = ref<AdminMeResponse | null>(null);
const adminOptions = ref<AdminOptions | null>(null);
const authError = ref("");
const apiBaseInput = ref(getApiBase());
const manualToken = ref("");
const loginLoading = ref(false);
const siteConfig = ref<SiteConfig>({
  websiteTitle: "Kesini 抽卡站",
  adminTitle: "Kesini 后台管理",
});
const theme = ref<Theme>(
  (localStorage.getItem("kesini_theme") as Theme) || "light",
);
const active = ref(readHashRoute().key);
const dashboardData = ref<DashboardData | null>(null);
const dashboardLoading = ref(false);
const dashboardError = ref("");
const togglingPoolId = ref<number | null>(null);
const loadingPoolId = ref<number | null>(null);
const poolGachaVisible = ref(false);
const editingPoolGacha = ref<{
  poolId: number;
  poolName: string;
  config: GachaPoolConfig;
  defaultConfig: GachaPoolConfig;
} | null>(null);
const cardMediaVisible = ref(false);
const cardMediaSaving = ref(false);
const cardMediaUploading = ref(false);
const cardMediaRow = ref<Record<string, any> | null>(null);
const cardMediaValue = ref("");
const cardMediaReload = ref<(() => void) | null>(null);

const itemOptions = computed<SelectOption[]>(
  () => adminOptions.value?.dropItems || [],
);
const cardFields = computed(() => {
  const fields = createCardFields(adminOptions.value?.pools || []);
  const dropItemField = fields.find((field) => field.key === "drop_item");
  if (dropItemField) {
    dropItemField.options = [
      {
        label: adminOptions.value?.defaultFragmentItem
          ? `使用默认碎片：${adminOptions.value.defaultFragmentItem.label}`
          : "使用默认碎片（未配置）",
        value: "",
        disabled: !adminOptions.value?.defaultFragmentItem,
      },
      ...(adminOptions.value?.dropItems || [])
        .filter((item) => item.type === 0 && item.disabled !== true)
        .map((item) => ({ ...item, value: String(item.value) })),
    ];
  }
  return fields;
});
const seasonShopItemFields = computed(() =>
  createSeasonShopItemFields(adminOptions.value?.seasons || []),
);

const pageDefinitions = computed(
  () =>
    [
      {
        key: "dashboard",
        label: "总览",
        description: "查看关键运营指标、稀有度分布和最近抽卡动态。",
        group: "工作台",
        icon: DataAnalysis,
      },
      {
        key: "pools",
        label: "卡池管理",
        description: "维护卡池基础信息、上线状态和单独抽卡配置。",
        group: "内容配置",
        icon: Collection,
      },
      {
        key: "cards",
        label: "卡片管理",
        description: "维护卡片信息、稀有度和分解产出碎片。",
        group: "内容配置",
        icon: MagicStick,
      },
      {
        key: "drop-items",
        label: "物品管理",
        description: "维护碎片、普通道具和活动道具。",
        group: "内容配置",
        icon: Goods,
      },
      {
        key: "users",
        label: "用户管理",
        description: "查看用户资料、星穹币和管理员状态。",
        group: "玩家资产",
        icon: User,
      },
      {
        key: "histories",
        label: "抽卡历史",
        description: "按 UID 和稀有度追踪玩家抽卡记录。",
        group: "玩家资产",
        icon: Files,
      },
      {
        key: "inventories",
        label: "背包管理",
        description: "查看和调整玩家背包物品库存。",
        group: "玩家资产",
        icon: Wallet,
      },
      {
        key: "pity",
        label: "保底状态",
        description: "维护玩家在各卡池中的保底计数。",
        group: "玩家资产",
        icon: Histogram,
      },
      {
        key: "redeem-codes",
        label: "兑换码",
        description: "创建礼包码，维护库存、有效期和奖励规则。",
        group: "运营工具",
        icon: Present,
      },
      {
        key: "redeem-usages",
        label: "兑换记录",
        description: "查看玩家兑换码领取记录和奖励快照。",
        group: "运营工具",
        icon: Files,
      },
      {
        key: "exchange-shop",
        label: "兑换商店",
        description: "配置物品消耗、奖励内容、库存和限兑规则。",
        group: "运营工具",
        icon: Shop,
      },
      {
        key: "exchange-usages",
        label: "兑换商店记录",
        description: "查看兑换商店领取记录、消耗和奖励快照。",
        group: "运营工具",
        icon: Files,
      },
      {
        key: "announcements",
        label: "公告栏",
        description: "维护玩家站展示公告。",
        group: "运营工具",
        icon: Files,
      },
      {
        key: "launch-activity-config",
        label: "开服活动",
        description: "配置登录可领取的开服福利。",
        group: "运营工具",
        icon: Present,
      },
      {
        key: "launch-activity-claims",
        label: "活动领取记录",
        description: "查看玩家开服福利领取批次、时间和奖励快照。",
        group: "运营工具",
        icon: Files,
      },
      {
        key: "achievements",
        label: "成就配置",
        description: "配置成就目标、奖励和上线状态。",
        group: "运营工具",
        icon: Medal,
      },
      {
        key: "user-achievements",
        label: "成就记录",
        description: "查看玩家成就进度、达成时间和通知状态。",
        group: "运营工具",
        icon: Files,
      },
      {
        key: "seasons",
        label: "赛季配置",
        description: "配置赛季周期、商店和活动排行开关。",
        group: "运营工具",
        icon: Medal,
      },
      {
        key: "season-shop-items",
        label: "赛季商店",
        description: "配置赛季积分兑换项、库存、限兑和奖励。",
        group: "运营工具",
        icon: Shop,
      },
      {
        key: "season-point-records",
        label: "赛季积分记录",
        description: "查看玩家赛季积分获取与消耗流水。",
        group: "运营工具",
        icon: Files,
      },
      {
        key: "season-shop-usages",
        label: "赛季兑换记录",
        description: "查看赛季商店兑换数量和奖励快照。",
        group: "运营工具",
        icon: Files,
      },
      {
        key: "pve-stages",
        label: "PVE 关卡",
        description: "配置轻量关卡、战力门槛、每日次数和胜利奖励。",
        group: "运营工具",
        icon: MagicStick,
      },
      {
        key: "pve-records",
        label: "PVE 记录",
        description: "查看玩家关卡挑战结果、阵容战力和奖励快照。",
        group: "运营工具",
        icon: Files,
      },
      {
        key: "trade-config",
        label: "交易配置",
        description: "配置交易开关、手续费率和价格区间。",
        group: "交易与支付",
        icon: Setting,
      },
      {
        key: "shop-recycle-config",
        label: "商店回收",
        description: "配置卡片回收开关和稀有度价格。",
        group: "交易与支付",
        icon: Shop,
      },
      {
        key: "decompose-config",
        label: "分解配置",
        description: "配置各稀有度卡片分解后的默认碎片产出。",
        group: "系统配置",
        icon: Setting,
      },
      {
        key: "trade-listings",
        label: "交易挂单",
        description: "审计匿名交易挂单状态和卡片流转。",
        group: "交易与支付",
        icon: Ticket,
      },
      {
        key: "trade-records",
        label: "交易记录",
        description: "查看交易成交记录、手续费和买卖双方审计信息。",
        group: "交易与支付",
        icon: Files,
      },
      {
        key: "recharge-config",
        label: "充值配置",
        description: "配置鱼排扣分充值开关、范围和密钥。",
        group: "交易与支付",
        icon: Setting,
      },
      {
        key: "recharge-records",
        label: "充值记录",
        description: "追踪鱼排扣分充值请求和星穹币入账状态。",
        group: "交易与支付",
        icon: Coin,
      },
      {
        key: "gacha-config",
        label: "默认抽卡配置",
        description: "维护未设置单独配置卡池继承的默认概率、UP、保底和价格。",
        group: "系统配置",
        icon: Setting,
      },
      {
        key: "site-config",
        label: "站点配置",
        description: "配置玩家站和后台管理台的页面标题与品牌标题。",
        group: "系统配置",
        icon: Setting,
      },
    ] satisfies Array<{
      key: PageKey;
      label: string;
      description: string;
      group: NavGroup;
      icon: any;
    }>,
);

const activePage = computed(
  () =>
    pageDefinitions.value.find((page) => page.key === active.value) ||
    pageDefinitions.value[0],
);
const pagesByGroup = computed(() =>
  navGroups
    .map((group) => ({
      group,
      pages: pageDefinitions.value.filter((page) => page.group === group),
    }))
    .filter((item) => item.pages.length > 0),
);

function readHashRoute(): { key: PageKey; shouldReplace: boolean } {
  const raw = window.location.hash.replace(/^#/, "");
  if (pageKeys.includes(raw as PageKey)) {
    return { key: raw as PageKey, shouldReplace: false };
  }
  if (routeAliases[raw]) {
    return { key: routeAliases[raw], shouldReplace: true };
  }
  return { key: defaultPageKey, shouldReplace: true };
}

function replaceHashRoute(key: PageKey) {
  window.history.replaceState(
    {},
    "",
    `${window.location.pathname}${window.location.search}#${key}`,
  );
}

function setRoute(key: PageKey) {
  active.value = key;
  if (window.location.hash.replace(/^#/, "") !== key) {
    window.location.hash = key;
  }
}

function syncFromHash() {
  const next = readHashRoute();
  if (next.shouldReplace) {
    replaceHashRoute(next.key);
  }
  active.value = next.key;
}

async function loadAdmin() {
  if (!token.value) {
    admin.value = null;
    return;
  }
  authError.value = "";
  try {
    const data = await request<AdminMeResponse>("/admin/me");
    if (data.user?.is_admin !== true) {
      throw new Error("当前账号没有后台管理权限");
    }
    admin.value = data;
    adminOptions.value = await request<AdminOptions>("/admin/options");
    if (active.value === "dashboard") {
      loadDashboard();
    }
  } catch (err) {
    clearToken();
    token.value = "";
    admin.value = null;
    adminOptions.value = null;
    authError.value =
      err instanceof Error ? err.message : "当前账号没有后台管理权限";
  }
}

async function loadDashboard() {
  dashboardError.value = "";
  dashboardLoading.value = true;
  try {
    dashboardData.value = await request<DashboardData>("/admin/dashboard");
  } catch (err) {
    dashboardError.value = err instanceof Error ? err.message : "加载总览失败";
  } finally {
    dashboardLoading.value = false;
  }
}

async function loadSiteConfig() {
  try {
    const data = await request<SiteConfig>("/apis/site-config");
    siteConfig.value = {
      websiteTitle: data.websiteTitle || "Kesini 抽卡站",
      adminTitle: data.adminTitle || "Kesini 后台管理",
    };
  } catch {
    siteConfig.value = {
      websiteTitle: "Kesini 抽卡站",
      adminTitle: "Kesini 后台管理",
    };
  }
}

async function handleOpenidCallback() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("openid.mode")) {
    return;
  }
  const callbackKey = window.location.search;
  if (handledOpenidCallbacks.has(callbackKey)) {
    return;
  }
  handledOpenidCallbacks.add(callbackKey);
  loginLoading.value = true;
  try {
    const data = await request<{ token: string; user: { is_admin?: boolean } }>(
      "/apis/login",
      {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(params.entries())),
      },
    );
    if (data.user?.is_admin !== true) {
      throw new Error("当前账号没有后台管理权限");
    }
    setToken(data.token);
    token.value = data.token;
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}#dashboard`,
    );
  } catch (err) {
    authError.value = err instanceof Error ? err.message : "登录失败";
  } finally {
    loginLoading.value = false;
  }
}

async function startLogin() {
  loginLoading.value = true;
  authError.value = "";
  try {
    setApiBase(apiBaseInput.value);
    const returnTo = `${window.location.origin}${window.location.pathname}`;
    const data = await request<{ url: string }>(
      `/apis/login-url${toQuery({ returnTo, realm: window.location.origin })}`,
    );
    window.location.href = data.url;
  } catch (err) {
    authError.value = err instanceof Error ? err.message : "获取登录地址失败";
  } finally {
    loginLoading.value = false;
  }
}

function useManualToken() {
  if (!manualToken.value.trim()) {
    authError.value = "请先粘贴 JWT";
    return;
  }
  setToken(manualToken.value.trim());
  token.value = manualToken.value.trim();
}

function toggleTheme() {
  theme.value = theme.value === "light" ? "dark" : "light";
}

function logout() {
  clearToken();
  token.value = "";
  admin.value = null;
  adminOptions.value = null;
}

function handleUserCommand(command: string | number | object) {
  if (command === "logout") {
    logout();
    return;
  }
  if (command === "toggle-theme") {
    toggleTheme();
  }
}

function getOpenidDisplayName(user: AdminMeResponse["user"]) {
  if (!user) {
    return "后台账号";
  }
  return String(user.nickname || user.name || user.uid || "后台账号");
}

function getOpenidAvatar(user: AdminMeResponse["user"]) {
  const avatar = user?.avatar;
  return typeof avatar === "string" && avatar.trim() ? avatar.trim() : "";
}

function getOpenidInitial(user: AdminMeResponse["user"]) {
  return getOpenidDisplayName(user).trim().slice(0, 1).toUpperCase() || "K";
}

async function togglePoolEnabled(
  row: Record<string, any>,
  enabled: boolean,
  reload: () => void,
) {
  const poolId = Number(row.id);
  togglingPoolId.value = poolId;
  try {
    await request(`/admin/pools/${poolId}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    });
    ElMessage.success(enabled ? "卡池已上线" : "卡池已下线");
    reload();
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : "切换卡池状态失败");
  } finally {
    togglingPoolId.value = null;
  }
}

async function openPoolGacha(row: Record<string, any>) {
  const poolId = Number(row.id);
  loadingPoolId.value = poolId;
  try {
    const pool = await request<Record<string, any>>(`/admin/pools/${poolId}`);
    const detail = pool.gachaConfig as PoolGachaConfigDetail | undefined;
    if (!detail) {
      throw new Error("卡池抽卡配置详情缺失");
    }
    editingPoolGacha.value = {
      poolId,
      poolName: String(pool.pool_name || row.pool_name || `卡池 #${poolId}`),
      config: getPoolGachaModalConfig(poolId, detail),
      defaultConfig: detail.defaultConfig,
    };
    poolGachaVisible.value = true;
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : "读取抽卡配置失败");
  } finally {
    loadingPoolId.value = null;
  }
}

async function savePoolGacha(poolId: number, values: GachaPoolConfig) {
  const { poolId: _poolId, source, scope, updatedAt, ...payload } = values;
  void source;
  void scope;
  void updatedAt;
  try {
    await request(`/admin/config/gacha/${poolId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    ElMessage.success(
      values.enabled === false ? "已改为继承默认配置" : "已保存卡池配置",
    );
    poolGachaVisible.value = false;
    editingPoolGacha.value = null;
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : "保存抽卡配置失败");
  }
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

function openCardMedia(row: Record<string, any>, reload: () => void) {
  cardMediaRow.value = row;
  cardMediaValue.value = String(row.card_image || "");
  cardMediaReload.value = reload;
  cardMediaVisible.value = true;
}

function clearCardMedia() {
  cardMediaValue.value = "";
}

function normalizeCardMediaValue(value: unknown) {
  return String(value || "").trim();
}

function validateCardMediaValue(value: string) {
  if (!value) {
    return "";
  }
  if (value.length > 500) {
    throw new Error("链接过长");
  }
  if (!/^(https?:\/\/|\/file\/)/i.test(value)) {
    throw new Error("链接格式不对");
  }
  return value;
}

async function handleCardMediaUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) {
    return;
  }
  const isImage = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
  const isVideo = ["video/mp4", "video/webm"].includes(file.type);
  if (!isImage && !isVideo) {
    ElMessage.error("仅支持 JPG、PNG、WEBP、MP4、WEBM");
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

  cardMediaUploading.value = true;
  try {
    const body = new FormData();
    body.append("file", file);
    const result = await request<{ url: string }>("/admin/uploads/card-image", {
      method: "POST",
      body,
    });
    cardMediaValue.value = result.url;
    ElMessage.success("已上传");
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : "上传失败");
  } finally {
    cardMediaUploading.value = false;
  }
}

async function saveCardMedia() {
  const row = cardMediaRow.value;
  if (!row?.id) {
    return;
  }
  cardMediaSaving.value = true;
  try {
    const cardImage = validateCardMediaValue(
      normalizeCardMediaValue(cardMediaValue.value),
    );
    cardMediaValue.value = cardImage;
    await request(`/admin/cards/${row.id}`, {
      method: "PATCH",
      body: JSON.stringify({ card_image: cardImage }),
    });
    ElMessage.success("已保存");
    cardMediaVisible.value = false;
    cardMediaReload.value?.();
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : "保存失败");
  } finally {
    cardMediaSaving.value = false;
  }
}

watch(token, loadAdmin, { immediate: true });
watch(
  theme,
  (nextTheme) => {
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    document.body.setAttribute(
      "theme-mode",
      nextTheme === "dark" ? "dark" : "light",
    );
    localStorage.setItem("kesini_theme", nextTheme);
  },
  { immediate: true },
);
watch(active, (next) => {
  if (next === "dashboard" && admin.value) {
    loadDashboard();
  }
});
watch(
  () => siteConfig.value.adminTitle,
  (title) => {
    document.title = title || "Kesini 后台管理";
  },
  { immediate: true },
);

onMounted(() => {
  syncFromHash();
  window.addEventListener("hashchange", syncFromHash);
  loadSiteConfig();
  handleOpenidCallback();
});

const SidebarBrand = defineComponent({
  name: "SidebarBrand",
  setup() {
    return () =>
      h("div", { class: "sidebar-header" }, [
        h("div", { class: "brand" }, [
          h("div", { class: "brand-mark" }, [h(MagicStick)]),
          h("div", [
            h("strong", siteConfig.value.adminTitle || "Kesini 后台管理"),
            h("span", "运营控制台"),
          ]),
        ]),
        h("span", { class: "sidebar-pill" }, "Admin"),
      ]);
  },
});

const DashboardPage = defineComponent({
  name: "DashboardPage",
  props: {
    data: { type: Object, default: null },
    loading: { type: Boolean, default: false },
    error: { type: String, default: "" },
  },
  emits: ["reload"],
  setup(props, { emit }) {
    return () =>
      h("div", { class: "dashboard-page" }, [
        h(
          "div",
          { class: "stat-grid" },
          Object.entries(
            (props.data as DashboardData | null)?.counters || {},
          ).map(([key, value]) =>
            h("div", { class: "stat-card", key }, [
              h("span", counterLabel(key)),
              h("strong", String(value)),
            ]),
          ),
        ),
        h("div", { class: "dashboard-grid" }, [
          h("div", { class: "dashboard-main" }, [
            props.error
              ? h("div", { class: "state-box error" }, props.error)
              : props.loading
                ? h("div", { class: "state-box" }, "正在加载总览...")
                : h("div", { class: "panel-card plain-card" }, [
                    h("div", { class: "panel-header" }, [
                      h("div", [
                        h("p", { class: "eyebrow" }, "最近动态"),
                        h("h2", "抽卡记录"),
                      ]),
                      h(
                        "button",
                        { class: "link-button", onClick: () => emit("reload") },
                        "刷新",
                      ),
                    ]),
                    h(
                      "div",
                      { class: "activity-list" },
                      (
                        (props.data as DashboardData | null)?.recentHistories ||
                        []
                      ).length
                        ? (
                            (props.data as DashboardData | null)
                              ?.recentHistories || []
                          ).map((item, index) =>
                            h("div", { class: "activity-item", key: index }, [
                              h("div", { class: "activity-user" }, [
                                h(
                                  "strong",
                                  String(item.userName || "未知用户"),
                                ),
                                h("span", `UID ${String(item.uid || "-")}`),
                              ]),
                              h("div", { class: "activity-detail" }, [
                                h("strong", `${String(item.count || 0)} 抽`),
                                h("span", String(item.card_levels || "-")),
                                h(
                                  "time",
                                  item.createdAt
                                    ? formatDate(item.createdAt)
                                    : "-",
                                ),
                              ]),
                            ]),
                          )
                        : [
                            h(
                              "div",
                              { class: "state-box compact" },
                              "暂无抽卡记录",
                            ),
                          ],
                    ),
                  ]),
          ]),
          h("div", { class: "side-stack" }, [
            h("div", { class: "panel-card plain-card" }, [
              h("p", { class: "eyebrow" }, "运营状态"),
              h("h2", "数据已同步"),
              h("div", { class: "status-list" }, [
                statusItem("统计口径", "全量数据"),
                statusItem(
                  "最近记录",
                  `${((props.data as DashboardData | null)?.recentHistories || []).length} 条`,
                ),
                statusItem("刷新方式", "手动刷新"),
              ]),
            ]),
            h("div", { class: "panel-card plain-card" }, [
              h("p", { class: "eyebrow" }, "稀有度库存"),
              ...Object.entries(
                (props.data as DashboardData | null)?.rarityTotals || {},
              ).map(([key, value]) =>
                h("div", { class: "rarity-row", key }, [
                  h("span", key),
                  h("strong", String(value)),
                ]),
              ),
            ]),
          ]),
        ]),
      ]);
  },
});

const GachaConfigPage = defineComponent({
  name: "GachaConfigPage",
  props: {
    options: { type: Object, default: null },
  },
  setup(props) {
    const data = ref<GachaConfigData | null>(null);
    const loading = ref(false);
    const error = ref("");
    const dialogVisible = ref(false);
    const load = async () => {
      loading.value = true;
      error.value = "";
      try {
        data.value = await request<GachaConfigData>("/admin/config/gacha");
      } catch (err) {
        error.value = err instanceof Error ? err.message : "加载失败";
      } finally {
        loading.value = false;
      }
    };
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
    const save = async (poolId: number, values: GachaPoolConfig) => {
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
    };
    onMounted(load);
    return () =>
      h("div", [
        h("div", { class: "panel-card plain-card" }, [
          h("div", { class: "panel-header" }, [
            h("div", [
              h("p", { class: "eyebrow" }, "系统配置"),
              h("h2", "默认抽卡配置"),
            ]),
            h(
              "button",
              { class: "link-button", onClick: load },
              loading.value ? "加载中" : "刷新",
            ),
          ]),
          error.value
            ? h("div", { class: "state-box error" }, error.value)
            : editableDefaultConfig.value
              ? h("div", { class: "config-summary-grid" }, [
                  summaryItem(
                    "配置来源",
                    getGachaSourceText(editableDefaultConfig.value),
                  ),
                  summaryItem(
                    "星穹币消耗",
                    `单抽 ${editableDefaultConfig.value.drawCosts?.once ?? 10} / 十连 ${editableDefaultConfig.value.drawCosts?.ten ?? 100}`,
                  ),
                  summaryItem(
                    "概率合计",
                    `${(getProbabilityTotal(editableDefaultConfig.value.rarityProbabilities) * 100).toFixed(2)}%`,
                  ),
                  summaryItem(
                    "UP",
                    summarizeUpConfig(editableDefaultConfig.value.upCards),
                  ),
                  summaryItem(
                    "保底",
                    summarizePityConfig(editableDefaultConfig.value.pitySystem),
                  ),
                  summaryItem(
                    "更新时间",
                    editableDefaultConfig.value.updatedAt
                      ? formatDate(editableDefaultConfig.value.updatedAt)
                      : "-",
                  ),
                ])
              : h(
                  "div",
                  { class: "state-box" },
                  "暂无默认配置，保存后会写入 pool_id=0。",
                ),
          h("div", { class: "config-actions" }, [
            h(
              ElButton,
              {
                class: "config-edit-button",
                type: "primary",
                icon: EditPen,
                onClick: () => (dialogVisible.value = true),
              },
              () => "编辑默认配置",
            ),
          ]),
        ]),
        editableDefaultConfig.value
          ? h(GachaConfigDialog, {
              modelValue: dialogVisible.value,
              "onUpdate:modelValue": (value: boolean) =>
                (dialogVisible.value = value),
              mode: "default",
              poolKey: "0",
              config: editableDefaultConfig.value,
              defaultConfig: fallbackConfig.value,
              poolName: "全局默认配置",
              options: props.options as AdminOptions | null,
              onSave: save,
            })
          : null,
      ]);
  },
});

function counterLabel(key: string) {
  const labels: Record<string, string> = {
    userCount: "用户",
    cardCount: "卡片",
    poolCount: "卡池",
    dropItemCount: "物品",
    totalDraws: "总抽数",
  };
  return labels[key] || key;
}

function summaryItem(label: string, value: string) {
  return h("div", { class: "summary-item" }, [
    h("span", label),
    h("strong", value),
  ]);
}

function statusItem(label: string, value: string) {
  return h("div", { class: "status-item" }, [
    h("span", label),
    h("strong", value),
  ]);
}
</script>
