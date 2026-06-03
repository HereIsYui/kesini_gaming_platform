import { LogOut } from "@lucide/vue";
import { computed, ref, type Component } from "vue";
import { request } from "../api";
import type {
  CreateGuildRequest,
  GuildMember,
  GuildMessage,
  GuildMessagesResponse,
  GuildOverviewResponse,
  GuildSummary,
  SaveGuildAnnouncementRequest,
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
    currentGuild.value?.role === "leader" ? "会长" : "成员",
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
    guildActionBusy.value = "";
  }

  function guildRoleName(role?: string | null) {
    return role === "leader" ? "会长" : "成员";
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
      guildAnnouncement.value =
        guildOverview.value.current?.guild.announcement || "";
      if (!guildOverview.value.current) {
        guildMessages.value = [];
        guildMessageError.value = "";
      }
    } catch (error) {
      guildOverview.value = null;
      guildError.value = options.getErrorMessage(error);
      guildAnnouncement.value = "";
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
      guildAnnouncement.value =
        guildOverview.value.current?.guild.announcement || "";
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
      guildAnnouncement.value =
        guildOverview.value.current?.guild.announcement || "";
      options.notify("success", "已加入");
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
      guildAnnouncement.value =
        guildOverview.value.current?.guild.announcement || "";
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

  return {
    guildOverview,
    guildError,
    guildMessages,
    guildMessageError,
    guildMessageText,
    guildName,
    guildDescription,
    guildAnnouncement,
    guildActionBusy,
    currentGuild,
    guildMembers,
    guildRows,
    guildRoleLabel,
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
    sendGuildMessage,
  };
}
