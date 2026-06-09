<script setup lang="ts">
import { LoaderCircle, LogIn, LogOut, Moon, RefreshCw, Sparkles, Sun, UserRound } from "@lucide/vue";
import { RouterLink } from "vue-router";
import type { SectionItem, SectionKey } from "../../constants/navigation";
import type { UserProfile } from "../../types";

const props = defineProps<{
  siteTitle: string;
  appVersion: string;
  primaryNavItems: readonly SectionItem[];
  accountMenuItems: readonly SectionItem[];
  activeSection: SectionKey;
  themeMode: "dark" | "light";
  refreshBusy: boolean;
  authBusy: boolean;
  callbackBusy: boolean;
  isAuthed: boolean;
  currentUser: UserProfile | null;
  playerDisplayName: string;
  playerInitial: string;
  playerStatusLabel: string;
  triggerPoint: number;
  accountPoint: number;
  fishpiPointLabel: string;
  fishpiPointMuted: boolean;
  gameVipLabel: string;
  gameVipMuted: boolean;
  vipDailyCanClaim: boolean;
  vipDailyClaimBusy: boolean;
  userMenuOpen: boolean;
  userMenuHoverPaused: boolean;
  unreadMessageCount: number;
}>();

const emit = defineEmits<{
  "toggle-theme": [];
  refresh: [];
  "toggle-user-menu": [];
  "close-user-menu": [];
  "collapse-user-menu": [];
  "reset-user-menu-hover": [];
  login: [];
  logout: [];
  "claim-vip-daily": [];
}>();
</script>

<template>
  <header class="topbar">
    <RouterLink class="brand" :to="{ name: 'draw' }">
      <span class="brand-mark"><Sparkles :size="20" /></span>
      <span>
        <strong>{{ props.siteTitle }}</strong>
        <small>星穹调度台 · v{{ props.appVersion }}</small>
      </span>
    </RouterLink>

    <nav class="desktop-nav" aria-label="页面导航">
      <RouterLink
        v-for="item in props.primaryNavItems"
        :key="item.key"
        :to="{ name: item.key }"
        :class="{ active: props.activeSection === item.key }"
      >
        <component :is="item.icon" :size="16" />
        <span>{{ item.label }}</span>
      </RouterLink>
    </nav>

    <div class="top-actions">
      <button
        class="icon-button ghost theme-toggle"
        type="button"
        title="切换主题"
        aria-label="切换主题"
        @click="emit('toggle-theme')"
      >
        <Sun v-if="props.themeMode === 'dark'" :size="17" />
        <Moon v-else :size="17" />
        <span>{{ props.themeMode === "dark" ? "白色" : "暗色" }}</span>
      </button>
      <button
        class="icon-button"
        type="button"
        :disabled="props.refreshBusy"
        @click="emit('refresh')"
      >
        <RefreshCw :size="17" :class="{ spin: props.refreshBusy }" />
        <span>刷新</span>
      </button>
      <div
        class="user-menu-wrap"
        :class="{
          open: props.userMenuOpen,
          'hover-paused': props.userMenuHoverPaused,
        }"
        @keydown.escape="emit('collapse-user-menu')"
        @mouseleave="emit('reset-user-menu-hover')"
      >
        <button
          class="user-menu-trigger"
          type="button"
          :aria-expanded="props.userMenuOpen"
          aria-haspopup="true"
          :aria-label="props.isAuthed ? '玩家菜单' : '登录菜单'"
          @click="emit('toggle-user-menu')"
        >
          <span class="user-menu-avatar">
            <img
              v-if="props.isAuthed && props.currentUser?.avatar"
              :src="props.currentUser.avatar"
              :alt="props.playerDisplayName"
            />
            <span v-else-if="props.isAuthed">{{ props.playerInitial }}</span>
            <LogIn v-else :size="17" />
          </span>
          <span class="user-menu-trigger-text">
            <strong>{{ props.isAuthed ? props.playerDisplayName : "登录" }}</strong>
            <small v-if="props.isAuthed">{{ props.triggerPoint }} 星穹币</small>
          </span>
        </button>

        <div class="user-menu-panel" role="menu">
          <template v-if="props.isAuthed">
            <div class="user-menu-head">
              <span class="user-menu-avatar large">
                <img
                  v-if="props.currentUser?.avatar"
                  :src="props.currentUser.avatar"
                  :alt="props.playerDisplayName"
                />
                <span v-else>{{ props.playerInitial }}</span>
              </span>
              <div>
                <strong>{{ props.playerDisplayName }}</strong>
                <small>{{ props.playerStatusLabel }}</small>
              </div>
            </div>
            <div class="user-menu-balances">
              <div class="user-menu-balance">
                <span>星穹币</span>
                <strong>{{ props.accountPoint }}</strong>
              </div>
              <div class="user-menu-balance">
                <span>鱼排积分</span>
                <strong :class="{ muted: props.fishpiPointMuted }">
                  {{ props.fishpiPointLabel }}
                </strong>
              </div>
              <div class="user-menu-balance">
                <span>游戏VIP</span>
                <div class="user-menu-vip-line">
                  <strong :class="{ muted: props.gameVipMuted }">
                    {{ props.gameVipLabel }}
                  </strong>
                  <button
                    v-if="props.vipDailyCanClaim"
                    class="user-menu-mini-action"
                    type="button"
                    :disabled="props.vipDailyClaimBusy"
                    @click.stop="emit('claim-vip-daily')"
                  >
                    领取
                  </button>
                </div>
              </div>
            </div>
            <nav class="user-menu-shortcuts" aria-label="快捷入口">
              <RouterLink
                v-for="item in props.accountMenuItems"
                :key="item.key"
                class="user-menu-link"
                :to="{ name: item.key }"
                :class="{ active: props.activeSection === item.key }"
                role="menuitem"
                @click="emit('close-user-menu')"
              >
                <component :is="item.icon" :size="16" />
                {{ item.label }}
                <span
                  v-if="item.key === 'messages' && props.unreadMessageCount > 0"
                  class="user-menu-badge"
                >
                  {{ props.unreadMessageCount }}
                </span>
              </RouterLink>
            </nav>
            <button
              class="user-menu-link danger"
              type="button"
              role="menuitem"
              @click="emit('logout')"
            >
              <LogOut :size="16" />
              退出登录
            </button>
          </template>
          <template v-else>
            <div class="user-menu-head guest">
              <span class="user-menu-avatar large">
                <UserRound :size="22" />
              </span>
              <div>
                <strong>登录</strong>
                <small>同步资产</small>
              </div>
            </div>
            <div class="guest-login-actions">
              <button
                class="primary-action wide"
                type="button"
                :disabled="props.authBusy || props.callbackBusy"
                @click="emit('login')"
              >
                <LoaderCircle
                  v-if="props.authBusy || props.callbackBusy"
                  :size="18"
                  class="spin"
                />
                <LogIn v-else :size="18" />
                登录
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>
  </header>
</template>
