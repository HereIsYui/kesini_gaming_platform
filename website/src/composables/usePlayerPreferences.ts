import { computed, ref, watch } from "vue";

export type ThemeMode = "dark" | "light";
export type MotionMode = "full" | "reduced";

export type PlayerPreferences = {
  motionMode: MotionMode;
  achievementNotices: boolean;
};

const THEME_KEY = "kesini_website_theme";
const PLAYER_PREFS_KEY = "kesini_player_preferences";
const DEFAULT_PLAYER_PREFS: PlayerPreferences = {
  motionMode: "full",
  achievementNotices: true,
};

function getStoredThemeMode(): ThemeMode {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === "light" ? "light" : "dark";
}

function getStoredPlayerPreferences(): PlayerPreferences {
  const raw = localStorage.getItem(PLAYER_PREFS_KEY);
  if (!raw) {
    return { ...DEFAULT_PLAYER_PREFS };
  }
  try {
    const value = JSON.parse(raw) as Partial<PlayerPreferences>;
    return {
      motionMode:
        value.motionMode === "reduced" || value.motionMode === "full"
          ? value.motionMode
          : DEFAULT_PLAYER_PREFS.motionMode,
      achievementNotices:
        typeof value.achievementNotices === "boolean"
          ? value.achievementNotices
          : DEFAULT_PLAYER_PREFS.achievementNotices,
    };
  } catch {
    localStorage.removeItem(PLAYER_PREFS_KEY);
    return { ...DEFAULT_PLAYER_PREFS };
  }
}

export function usePlayerPreferences(options: {
  onAchievementNoticesDisabled?: () => void;
  onReset?: () => void;
} = {}) {
  const themeMode = ref<ThemeMode>(getStoredThemeMode());
  const playerPrefs = ref<PlayerPreferences>(getStoredPlayerPreferences());
  const achievementNoticesEnabled = computed(
    () => playerPrefs.value.achievementNotices,
  );
  const motionModeLabel = computed(() =>
    playerPrefs.value.motionMode === "reduced" ? "减少" : "完整",
  );
  const achievementNoticeLabel = computed(() =>
    achievementNoticesEnabled.value ? "开启" : "关闭",
  );

  function toggleThemeMode() {
    themeMode.value = themeMode.value === "dark" ? "light" : "dark";
  }

  function setThemeMode(mode: ThemeMode) {
    themeMode.value = mode;
  }

  function setMotionMode(mode: MotionMode) {
    playerPrefs.value = { ...playerPrefs.value, motionMode: mode };
  }

  function setAchievementNotices(enabled: boolean) {
    playerPrefs.value = { ...playerPrefs.value, achievementNotices: enabled };
    if (!enabled) {
      options.onAchievementNoticesDisabled?.();
    }
  }

  function resetPlayerPreferences() {
    playerPrefs.value = { ...DEFAULT_PLAYER_PREFS };
    options.onReset?.();
  }

  watch(
    themeMode,
    (mode) => {
      document.documentElement.dataset.theme = mode;
      localStorage.setItem(THEME_KEY, mode);
    },
    { immediate: true },
  );

  watch(
    playerPrefs,
    (prefs) => {
      document.documentElement.dataset.motion = prefs.motionMode;
      localStorage.setItem(PLAYER_PREFS_KEY, JSON.stringify(prefs));
    },
    { immediate: true, deep: true },
  );

  return {
    themeMode,
    playerPrefs,
    achievementNoticesEnabled,
    motionModeLabel,
    achievementNoticeLabel,
    toggleThemeMode,
    setThemeMode,
    setMotionMode,
    setAchievementNotices,
    resetPlayerPreferences,
  };
}
