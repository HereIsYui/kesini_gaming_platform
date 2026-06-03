import { computed, ref } from "vue";
import { request } from "../api";
import type {
  ClaimMessageRewardResponse,
  PlayerMessage,
  PlayerMessagesResponse,
} from "../types";
import { formatRewards } from "../utils/format";
import type { FeedbackType } from "./useFeedback";

type UsePlayerMessagesOptions = {
  isAuthed: () => boolean;
  isActive: () => boolean;
  setMessagesBusy: (value: boolean) => void;
  notify: (type: FeedbackType, text: string) => void;
  getErrorMessage: (error: unknown) => string;
  refreshRewardState: () => Promise<unknown>;
};

export function usePlayerMessages(options: UsePlayerMessagesOptions) {
  const playerMessages = ref<PlayerMessage[]>([]);
  const playerMessagesError = ref("");
  const messageClaimBusy = ref<number | null>(null);

  const unreadMessageCount = computed(
    () => playerMessages.value.filter((item) => !item.read).length,
  );

  function resetPlayerMessages() {
    playerMessages.value = [];
    playerMessagesError.value = "";
    messageClaimBusy.value = null;
  }

  async function loadMessages(showError = options.isActive()) {
    if (!options.isAuthed()) {
      playerMessages.value = [];
      playerMessagesError.value = "";
      return;
    }
    options.setMessagesBusy(true);
    playerMessagesError.value = "";
    try {
      const data = await request<PlayerMessagesResponse>("/messages");
      playerMessages.value = data.list || [];
    } catch (error) {
      playerMessages.value = [];
      playerMessagesError.value = options.getErrorMessage(error);
      if (showError) {
        options.notify("error", playerMessagesError.value);
      }
    } finally {
      options.setMessagesBusy(false);
    }
  }

  async function markMessageRead(message: PlayerMessage) {
    if (message.read) {
      return;
    }
    try {
      await request(`/messages/${message.id}/read`, { method: "POST" });
      playerMessages.value = playerMessages.value.map((item) =>
        item.id === message.id ? { ...item, read: true } : item,
      );
    } catch (error) {
      options.notify("error", options.getErrorMessage(error));
    }
  }

  async function claimMessageReward(message: PlayerMessage) {
    if (!message.hasReward || message.claimed || messageClaimBusy.value) {
      return;
    }
    messageClaimBusy.value = message.id;
    try {
      const data = await request<ClaimMessageRewardResponse>(
        `/messages/${message.id}/claim`,
        { method: "POST" },
      );
      playerMessages.value = playerMessages.value.map((item) =>
        item.id === message.id ? { ...item, read: true, claimed: true } : item,
      );
      await options.refreshRewardState();
      options.notify("success", `领取成功：${formatRewards(data.rewards)}`);
    } catch (error) {
      options.notify("error", options.getErrorMessage(error));
    } finally {
      messageClaimBusy.value = null;
    }
  }

  return {
    playerMessages,
    playerMessagesError,
    messageClaimBusy,
    unreadMessageCount,
    resetPlayerMessages,
    loadMessages,
    markMessageRead,
    claimMessageReward,
  };
}
