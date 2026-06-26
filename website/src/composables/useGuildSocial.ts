import { LogOut } from "@lucide/vue";
import { computed, ref, type Component } from "vue";
import { request } from "../api";
import type {
  CreateGuildRequest,
  GuildBossChallengeResult,
  GuildJoinMode,
  GuildMember,
  GuildMessage,
  GuildMessagesResponse,
  GuildOverviewResponse,
  GuildRewardResult,
  GuildSummary,
  SaveGuildAnnouncementRequest,
  SaveGuildSettingsRequest,
  SendGuildMessageRequest,
} from "../types";
import type { FeedbackType } from "./useFeedback";

const GUILD_MESSAGE_LIST_LIMIT = 30;

type GuildConfirmTarget = {
  title: string;
  message?: string;
  details?: string[];
  confirmText?: string;
  cancelText?: string;
  variant?: "primary" | "danger";
  icon?: Component;
};

type UseGuildSocialOptions = {
  isAuthed: () => boolean;
  isActive: () => boolean;
  setGuildBusy: (value: boolean) => void;
  setGuildMessagesBusy: (value: boolean) => void;
  setGuildSendingBusy: (value: boolean) => void;
  notify: (type: FeedbackType, text: string) => void;
  getErrorMessage: (error: unknown) => string;
  askConfirm: (target: GuildConfirmTarget) => Promise<boolean>;
  publicPlayerName: (
    nickname?: string | null,
    uid?: string | null,
    fallback?: string,
  ) => string;
};

export function useGuildSocial(options: UseGuildSocialOptions) {
  const guildOverview = ref<GuildOverviewResponse | null>(null);
  const guildError = ref("");
  const guildMessages = ref<GuildMessage[]>([]);
  const guildMessageError = ref("");
  const guildMessageText = ref("");
  const guildName = ref("");
  const guildDescription = ref("");
  const guildAnnouncement = ref("");
  const guildSettingsDescription = ref("");
  const guildJoinMode = ref<GuildJoinMode>("open");
  const guildDonateAmount = ref<100 | 500 | 1000>(100);
  const guildActiveTab = ref("总览");
  const guildActionBusy = ref("");

  const currentGuild = computed(
    () => guildOverview.value?.current?.guild || null,
  );
  const guildMembers = computed<GuildMember[]>(
    () => guildOverview.value?.current?.members || [],
  );
  const guildRows = computed<GuildSummary[]>(
    () => guildOverview.value?.guilds || [],
  );
  const guildRoleLabel = computed(() =>
    guildRoleName(currentGuild.value?.role),
  );
  const guildCanManage = computed(() =>
    ["leader", "officer"].includes(String(currentGuild.value?.role || "")),
  );
  const guildCanEditSettings = computed(
    () => currentGuild.value?.role === "leader",
  );
  const guildTabs = computed(() => {
    const tabs = ["总览", "成员", "首领", "消息"];
    if (guildCanManage.value) {
      tabs.push("申请");
    }
    if (guildCanEditSettings.value) {
      tabs.push("设置");
    }
    return tabs;
  });
  const guildDailyStatus = computed(
    () => guildOverview.value?.current?.dailyStatus || null,
  );
  const guildActivityChests = computed(
    () => guildOverview.value?.current?.activityChests || [],
  );
  const guildBoss = computed(() => guildOverview.value?.current?.boss || null);
  const guildRequests = computed(
    () => guildOverview.value?.current?.requests || [],
  );
  const guildMessageRows = computed(() =>
    guildMessages.value
      .slice()
      .sort(
        (left, right) =>
          (Date.parse(right.createdAt || "") || 0) -
            (Date.parse(left.createdAt || "") || 0) ||
          Number(right.id || 0) - Number(left.id || 0),
      )
      .slice(0, GUILD_MESSAGE_LIST_LIMIT),
  );

  function resetGuild() {
    guildOverview.value = null;
    guildError.value = "";
    guildMessages.value = [];
    guildMessageError.value = "";
    guildMessageText.value = "";
    guildName.value = "";
    guildDescription.value = "";
    guildAnnouncement.value = "";
    guildSettingsDescription.value = "";
    guildJoinMode.value = "open";
    guildDonateAmount.value = 100;
    guildActiveTab.value = "总览";
    guildActionBusy.value = "";
  }

  function guildRoleName(role?: string | null) {
    if (role === "leader") {
      return "会长";
    }
    if (role === "officer") {
      return "副会长";
    }
    return "成员";
  }

  function guildMemberName(member: GuildMember) {
    return options.publicPlayerName(member.nickname, member.uid);
  }

  function guildMemberInitial(member: GuildMember) {
    return guildMemberName(member).slice(0, 1).toUpperCase();
  }

  function guildMessageSenderName(message: GuildMessage) {
    return options.publicPlayerName(message.sender.nickname, message.sender.uid);
  }

  function guildMessageInitial(message: GuildMessage) {
    return guildMessageSenderName(message).slice(0, 1).toUpperCase();
  }

  async function loadGuild(showError = options.isActive()) {
    if (!options.isAuthed()) {
      guildOverview.value = null;
      guildError.value = "";
      guildMessages.value = [];
      guildMessageError.value = "";
      return;
    }
    options.setGuildBusy(true);
    guildError.value = "";
    try {
      guildOverview.value = await request<GuildOverviewResponse>("/guilds/me");
      syncGuildForms();
      if (!guildTabs.value.includes(guildActiveTab.value)) {
        guildActiveTab.value = "总览";
      }
      if (!guildOverview.value.current) {
        guildMessages.value = [];
        guildMessageError.value = "";
      }
    } catch (error) {
      guildOverview.value = null;
      guildError.value = options.getErrorMessage(error);
      guildAnnouncement.value = "";
      guildSettingsDescription.value = "";
      if (showError) {
        options.notify("error", guildError.value);
      }
    } finally {
      options.setGuildBusy(false);
    }
  }

  async function loadGuildMessages(showError = options.isActive()) {
    if (!options.isAuthed() || !currentGuild.value) {
      guildMessages.value = [];
      guildMessageError.value = "";
      return;
    }
    options.setGuildMessagesBusy(true);
    guildMessageError.value = "";
    try {
      const data = await request<GuildMessagesResponse>(
        `/guilds/me/messages?limit=${GUILD_MESSAGE_LIST_LIMIT}`,
      );
      guildMessages.value = data.list || [];
    } catch (error) {
      guildMessages.value = [];
      guildMessageError.value = options.getErrorMessage(error);
      if (showError) {
        options.notify("error", guildMessageError.value);
      }
    } finally {
      options.setGuildMessagesBusy(false);
    }
  }

  async function refreshGuildSection(showError = options.isActive()) {
    await loadGuild(showError);
    if (currentGuild.value) {
      await loadGuildMessages(showError);
    }
  }

  async function createGuild() {
    const name = guildName.value.trim();
    const description = guildDescription.value.trim();
    if (!options.isAuthed()) {
      options.notify("error", "请先登录");
      return;
    }
    if (!name) {
      options.notify("error", "请输入公会名");
      return;
    }
    guildActionBusy.value = "create";
    try {
      const payload: CreateGuildRequest = { name, description };
      guildOverview.value = await request<GuildOverviewResponse>("/guilds", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      guildName.value = "";
      guildDescription.value = "";
      syncGuildForms();
      guildActiveTab.value = "总览";
      options.notify("success", "已创建");
      await loadGuildMessages(false);
    } catch (error) {
      options.notify("error", options.getErrorMessage(error));
    } finally {
      guildActionBusy.value = "";
    }
  }

  async function joinGuild(guildId: number) {
    guildActionBusy.value = `join:${guildId}`;
    try {
      guildOverview.value = await request<GuildOverviewResponse>(
        `/guilds/${guildId}/join`,
        { method: "POST" },
      );
      syncGuildForms();
      options.notify("success", guildOverview.value.current ? "已加入" : "已申请");
      await loadGuildMessages(false);
    } catch (error) {
      options.notify("error", options.getErrorMessage(error));
    } finally {
      guildActionBusy.value = "";
    }
  }

  async function leaveGuild() {
    if (!currentGuild.value) {
      return;
    }
    const confirmed = await options.askConfirm({
      title: "退出公会",
      message: "成员身份将移除",
      confirmText: "退出",
      variant: "danger",
      icon: LogOut,
    });
    if (!confirmed) {
      return;
    }
    guildActionBusy.value = "leave";
    try {
      guildOverview.value = await request<GuildOverviewResponse>("/guilds/me", {
        method: "DELETE",
      });
      guildMessages.value = [];
      guildMessageError.value = "";
      guildMessageText.value = "";
      guildAnnouncement.value = "";
      guildSettingsDescription.value = "";
      guildJoinMode.value = "open";
      guildActiveTab.value = "总览";
      options.notify("success", "已退出");
    } catch (error) {
      options.notify("error", options.getErrorMessage(error));
    } finally {
      guildActionBusy.value = "";
    }
  }

  async function saveGuildAnnouncement() {
    if (!currentGuild.value) {
      return;
    }
    guildActionBusy.value = "announcement";
    try {
      const payload: SaveGuildAnnouncementRequest = {
        announcement: guildAnnouncement.value.trim(),
      };
      guildOverview.value = await request<GuildOverviewResponse>(
        "/guilds/me/announcement",
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
      );
      syncGuildForms();
      options.notify("success", "已保存");
    } catch (error) {
      options.notify("error", options.getErrorMessage(error));
    } finally {
      guildActionBusy.value = "";
    }
  }

  async function sendGuildMessage() {
    const content = guildMessageText.value.trim();
    if (!content) {
      options.notify("error", "请输入消息");
      return;
    }
    options.setGuildSendingBusy(true);
    try {
      const payload: SendGuildMessageRequest = { content };
      const data = await request<GuildMessagesResponse>("/guilds/me/messages", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      guildMessages.value = data.list || [];
      guildMessageText.value = "";
      options.notify("success", "已发送");
    } catch (error) {
      options.notify("error", options.getErrorMessage(error));
    } finally {
      options.setGuildSendingBusy(false);
    }
  }

  async function saveGuildSettings() {
    if (!currentGuild.value) {
      return;
    }
    guildActionBusy.value = "settings";
    try {
      const payload: SaveGuildSettingsRequest = {
        description: guildSettingsDescription.value.trim(),
        announcement: guildAnnouncement.value.trim(),
        joinMode: guildJoinMode.value,
      };
      guildOverview.value = await request<GuildOverviewResponse>(
        "/guilds/me/settings",
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
      );
      syncGuildForms();
      options.notify("success", "已保存");
    } catch (error) {
      options.notify("error", options.getErrorMessage(error));
    } finally {
      guildActionBusy.value = "";
    }
  }

  async function checkInGuild() {
    await runOverviewAction("check-in", "/guilds/me/check-in", "已签到");
  }

  async function donateGuild(amount = guildDonateAmount.value) {
    guildActionBusy.value = "donate";
    try {
      guildOverview.value = await request<GuildOverviewResponse>(
        "/guilds/me/donate",
        {
          method: "POST",
          body: JSON.stringify({ amount }),
        },
      );
      syncGuildForms();
      options.notify("success", "已捐献");
    } catch (error) {
      options.notify("error", options.getErrorMessage(error));
    } finally {
      guildActionBusy.value = "";
    }
  }

  async function claimGuildChest(threshold: number) {
    guildActionBusy.value = `chest:${threshold}`;
    try {
      const data = await request<GuildRewardResult>(
        `/guilds/me/chests/${threshold}/claim`,
        { method: "POST" },
      );
      guildOverview.value = data.overview;
      syncGuildForms();
      options.notify("success", "已领取");
    } catch (error) {
      options.notify("error", options.getErrorMessage(error));
    } finally {
      guildActionBusy.value = "";
    }
  }

  async function challengeGuildBoss() {
    guildActionBusy.value = "boss";
    try {
      const data = await request<GuildBossChallengeResult>(
        "/guilds/me/boss/challenge",
        { method: "POST" },
      );
      guildOverview.value = data.overview;
      syncGuildForms();
      options.notify("success", `伤害 ${data.damage || 0}`);
    } catch (error) {
      options.notify("error", options.getErrorMessage(error));
    } finally {
      guildActionBusy.value = "";
    }
  }

  async function claimGuildBossReward() {
    guildActionBusy.value = "boss-claim";
    try {
      const data = await request<GuildRewardResult>("/guilds/me/boss/claim", {
        method: "POST",
      });
      guildOverview.value = data.overview;
      syncGuildForms();
      options.notify("success", "已领取");
    } catch (error) {
      options.notify("error", options.getErrorMessage(error));
    } finally {
      guildActionBusy.value = "";
    }
  }

  async function cancelGuildRequest(requestId: number) {
    guildActionBusy.value = `cancel:${requestId}`;
    try {
      guildOverview.value = await request<GuildOverviewResponse>(
        `/guilds/requests/${requestId}`,
        { method: "DELETE" },
      );
      syncGuildForms();
      options.notify("success", "已取消");
    } catch (error) {
      options.notify("error", options.getErrorMessage(error));
    } finally {
      guildActionBusy.value = "";
    }
  }

  async function approveGuildRequest(requestId: number) {
    await runOverviewAction(
      `approve:${requestId}`,
      `/guilds/requests/${requestId}/approve`,
      "已批准",
    );
  }

  async function rejectGuildRequest(requestId: number) {
    await runOverviewAction(
      `reject:${requestId}`,
      `/guilds/requests/${requestId}/reject`,
      "已拒绝",
    );
  }

  async function promoteGuildMember(uid: string) {
    await runOverviewAction("promote", `/guilds/members/${uid}/promote`, "已任命");
  }

  async function demoteGuildMember(uid: string) {
    await runOverviewAction("demote", `/guilds/members/${uid}/demote`, "已降职");
  }

  async function kickGuildMember(uid: string) {
    const confirmed = await options.askConfirm({
      title: "移出成员",
      message: "成员将离开公会",
      confirmText: "移出",
      variant: "danger",
      icon: LogOut,
    });
    if (!confirmed) {
      return;
    }
    await runOverviewAction("kick", `/guilds/members/${uid}/kick`, "已移出");
  }

  async function transferGuildLeader(uid: string) {
    const confirmed = await options.askConfirm({
      title: "转让会长",
      message: "会长身份将转移",
      confirmText: "转让",
      variant: "danger",
      icon: LogOut,
    });
    if (!confirmed) {
      return;
    }
    await runOverviewAction(
      "transfer",
      `/guilds/members/${uid}/transfer`,
      "已转让",
    );
  }

  async function runOverviewAction(
    busyKey: string,
    endpoint: string,
    successText: string,
  ) {
    guildActionBusy.value = busyKey;
    try {
      guildOverview.value = await request<GuildOverviewResponse>(endpoint, {
        method: "POST",
      });
      syncGuildForms();
      options.notify("success", successText);
    } catch (error) {
      options.notify("error", options.getErrorMessage(error));
    } finally {
      guildActionBusy.value = "";
    }
  }

  function syncGuildForms() {
    const guild = guildOverview.value?.current?.guild || null;
    guildAnnouncement.value = guild?.announcement || "";
    guildSettingsDescription.value = guild?.description || "";
    guildJoinMode.value = guild?.joinMode || "open";
  }

  return {
    guildOverview,
    guildError,
    guildMessages,
    guildMessageError,
    guildMessageText,
    guildName,
    guildDescription,
    guildAnnouncement,
    guildSettingsDescription,
    guildJoinMode,
    guildDonateAmount,
    guildActiveTab,
    guildActionBusy,
    currentGuild,
    guildMembers,
    guildRows,
    guildRoleLabel,
    guildCanManage,
    guildCanEditSettings,
    guildTabs,
    guildDailyStatus,
    guildActivityChests,
    guildBoss,
    guildRequests,
    guildMessageRows,
    resetGuild,
    guildRoleName,
    guildMemberName,
    guildMemberInitial,
    guildMessageSenderName,
    guildMessageInitial,
    loadGuild,
    loadGuildMessages,
    refreshGuildSection,
    createGuild,
    joinGuild,
    leaveGuild,
    saveGuildAnnouncement,
    saveGuildSettings,
    checkInGuild,
    donateGuild,
    claimGuildChest,
    challengeGuildBoss,
    claimGuildBossReward,
    cancelGuildRequest,
    approveGuildRequest,
    rejectGuildRequest,
    promoteGuildMember,
    demoteGuildMember,
    kickGuildMember,
    transferGuildLeader,
    sendGuildMessage,
  };
}
