import { computed, ref } from "vue";
import {
  clearToken,
  getStoredUser,
  getToken,
  request,
  setStoredUser,
  setToken,
  toQuery,
} from "../api";
import type { FeedbackType } from "./useFeedback";
import type { LoginResponse, LoginUrlResponse, UserProfile } from "../types";

type AuthSessionOptions = {
  notify: (type: FeedbackType, text: string) => void;
  getErrorMessage: (error: unknown) => string;
  setAuthBusy: (busy: boolean) => void;
  loadPrivateData: () => Promise<void>;
};

export function useAuthSession(options: AuthSessionOptions) {
  const userMenuOpen = ref(false);
  const userMenuHoverPaused = ref(false);
  const manualToken = ref("");
  const manualLoginEnabled =
    import.meta.env.DEV ||
    isEnabledFlag(import.meta.env.VITE_ENABLE_MANUAL_LOGIN) ||
    isEnabledFlag(window.__KESINI_CONFIG__?.ENABLE_MANUAL_LOGIN);
  const token = ref(getToken());
  const currentUser = ref<UserProfile | null>(getStoredUser<UserProfile>());
  const callbackBusy = ref(false);
  const isAuthed = computed(() => Boolean(token.value));

  function toggleUserMenu() {
    userMenuHoverPaused.value = false;
    userMenuOpen.value = !userMenuOpen.value;
  }

  function closeUserMenu(event?: Event) {
    userMenuOpen.value = false;
    userMenuHoverPaused.value = true;
    if (event?.currentTarget instanceof HTMLElement) {
      event.currentTarget.blur();
    }
  }

  function resetUserMenuHover() {
    userMenuHoverPaused.value = false;
  }

  async function handleOpenIdCallback() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("openid.mode")) {
      return;
    }

    const callbackKey = `kesini_website_openid:${params.get("openid.response_nonce") || params.get("openid.sig") || window.location.search}`;
    if (sessionStorage.getItem(callbackKey)) {
      return;
    }

    sessionStorage.setItem(callbackKey, "1");
    callbackBusy.value = true;
    try {
      const payload = Object.fromEntries(params.entries());
      const data = await request<LoginResponse>("/apis/login", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setToken(data.token);
      setStoredUser(data.user);
      token.value = data.token;
      currentUser.value = data.user;
      options.notify("success", "登录成功，欢迎回来");
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (error) {
      sessionStorage.removeItem(callbackKey);
      options.notify("error", options.getErrorMessage(error));
    } finally {
      callbackBusy.value = false;
    }
  }

  async function loginWithOpenId() {
    options.setAuthBusy(true);
    try {
      const oauthOrigin = window.location.origin;
      const returnToUrl = new URL(window.location.pathname, oauthOrigin);
      const data = await request<LoginUrlResponse>(
        `/apis/login-url${toQuery({
          returnTo: returnToUrl.toString(),
          realm: oauthOrigin,
        })}`,
      );
      window.location.href = data.url;
    } catch (error) {
      options.notify("error", options.getErrorMessage(error));
    } finally {
      options.setAuthBusy(false);
    }
  }

  async function applyManualToken() {
    if (!manualLoginEnabled) {
      options.notify("error", "暂不可用");
      return;
    }
    const value = manualToken.value.trim();
    if (!value) {
      options.notify("error", "请输入口令");
      return;
    }
    setToken(value);
    token.value = value;
    currentUser.value = null;
    options.notify("info", "正在加载资产");
    await options.loadPrivateData();
    userMenuOpen.value = false;
  }

  function clearAuthSession() {
    userMenuOpen.value = false;
    clearToken();
    token.value = "";
    currentUser.value = null;
  }

  function isEnabledFlag(value: unknown): boolean {
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value !== "string") {
      return false;
    }
    return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
  }

  return {
    userMenuOpen,
    userMenuHoverPaused,
    manualToken,
    manualLoginEnabled,
    token,
    currentUser,
    callbackBusy,
    isAuthed,
    toggleUserMenu,
    closeUserMenu,
    resetUserMenuHover,
    handleOpenIdCallback,
    loginWithOpenId,
    applyManualToken,
    clearAuthSession,
  };
}
