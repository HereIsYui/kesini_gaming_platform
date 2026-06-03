import { computed, ref } from "vue";
import { request } from "../api";
import type {
  FriendRelationRecord,
  FriendsOverviewResponse,
  SendFriendRequestRequest,
  SocialActivityFeedResponse,
  SocialActivityRecord,
} from "../types";
import type { FeedbackType } from "./useFeedback";

type ProfileUserLike = {
  publicId?: string | null;
  public_id?: string | null;
  uid?: string | null;
};

type UseFriendsSocialOptions = {
  isAuthed: () => boolean;
  isActive: () => boolean;
  isPublicProfileRoute: () => boolean;
  isProfileEditable: () => boolean;
  isFriendsBusy: () => boolean;
  getProfileOwnerPublicId: () => string;
  getProfileOwnerUid: () => string;
  getProfileActionTarget: () => string;
  setFriendsBusy: (value: boolean) => void;
  setFriendFeedBusy: (value: boolean) => void;
  notify: (type: FeedbackType, text: string) => void;
  getErrorMessage: (error: unknown) => string;
  publicProfileParam: (user?: ProfileUserLike | null) => string;
  publicPlayerName: (
    nickname?: string | null,
    uid?: string | null,
    fallback?: string,
  ) => string;
};

export function useFriendsSocial(options: UseFriendsSocialOptions) {
  const friendsOverview = ref<FriendsOverviewResponse | null>(null);
  const friendsError = ref("");
  const friendFeed = ref<SocialActivityRecord[]>([]);
  const friendFeedError = ref("");
  const friendActionBusy = ref("");

  const friendRows = computed(() => friendsOverview.value?.friends || []);
  const incomingFriendRequests = computed(
    () => friendsOverview.value?.incoming || [],
  );
  const outgoingFriendRequests = computed(
    () => friendsOverview.value?.outgoing || [],
  );
  const profileFriendRelation = computed<FriendRelationRecord | null>(() => {
    const publicId = options.getProfileOwnerPublicId();
    const uid = options.getProfileOwnerUid();
    if (!publicId && !uid) {
      return null;
    }
    const matchesProfile = (item: FriendRelationRecord) => {
      const friendPublicId = options.publicProfileParam(item.user);
      if (publicId && friendPublicId) {
        return publicId === friendPublicId;
      }
      return Boolean(uid && item.user.uid === uid);
    };
    return (
      friendRows.value.find(matchesProfile) ||
      incomingFriendRequests.value.find(matchesProfile) ||
      outgoingFriendRequests.value.find(matchesProfile) ||
      null
    );
  });
  const isProfileFriendIncoming = computed(() =>
    incomingFriendRequests.value.some(
      (item) => item.id === profileFriendRelation.value?.id,
    ),
  );
  const isProfileFriendOutgoing = computed(() =>
    outgoingFriendRequests.value.some(
      (item) => item.id === profileFriendRelation.value?.id,
    ),
  );
  const showProfileFriendAction = computed(
    () =>
      Boolean(options.isAuthed()) &&
      Boolean(options.isPublicProfileRoute()) &&
      Boolean(options.getProfileActionTarget()) &&
      !options.isProfileEditable(),
  );
  const profileFriendActionLabel = computed(() => {
    const relation = profileFriendRelation.value;
    if (relation?.status === "accepted") {
      return "已添加";
    }
    if (relation?.status === "pending") {
      return isProfileFriendOutgoing.value ? "已申请" : "通过";
    }
    return "添加";
  });
  const profileFriendStatusLabel = computed(() => {
    if (!showProfileFriendAction.value) {
      return "";
    }
    if (friendsError.value && !friendsOverview.value) {
      return "";
    }
    if (options.isFriendsBusy() && !friendsOverview.value) {
      return "读取中";
    }
    const relation = profileFriendRelation.value;
    if (relation?.status === "accepted") {
      return "好友";
    }
    if (relation?.status === "pending") {
      return isProfileFriendIncoming.value ? "待通过" : "已申请";
    }
    return "未添加";
  });
  const profileFriendActionDisabled = computed(() => {
    const relation = profileFriendRelation.value;
    return (
      options.isFriendsBusy() ||
      friendActionBusy.value !== "" ||
      relation?.status === "accepted" ||
      isProfileFriendOutgoing.value
    );
  });

  function resetFriends() {
    friendsOverview.value = null;
    friendsError.value = "";
    friendFeed.value = [];
    friendFeedError.value = "";
    friendActionBusy.value = "";
  }

  function activityUserName(activity: SocialActivityRecord) {
    return options.publicPlayerName(activity.user.nickname, activity.user.uid);
  }

  function activityInitial(activity: SocialActivityRecord) {
    return activityUserName(activity).slice(0, 1).toUpperCase();
  }

  function shortActivityText(value?: string | null) {
    const text = String(value || "").trim();
    return text.length > 15 ? `${text.slice(0, 15)}…` : text;
  }

  function activityLine(activity: SocialActivityRecord) {
    const summary = shortActivityText(activity.summary);
    return summary ? `${activity.title} · ${summary}` : activity.title;
  }

  async function loadFriends(showError = options.isActive()) {
    if (!options.isAuthed()) {
      friendsOverview.value = null;
      friendsError.value = "";
      return;
    }
    options.setFriendsBusy(true);
    friendsError.value = "";
    try {
      friendsOverview.value = await request<FriendsOverviewResponse>("/friends");
    } catch (error) {
      friendsError.value = options.getErrorMessage(error);
      friendsOverview.value = null;
      if (showError) {
        options.notify("error", friendsError.value);
      }
    } finally {
      options.setFriendsBusy(false);
    }
  }

  async function loadFriendFeed(showError = options.isActive()) {
    if (!options.isAuthed()) {
      friendFeed.value = [];
      friendFeedError.value = "";
      return;
    }
    options.setFriendFeedBusy(true);
    friendFeedError.value = "";
    try {
      const data = await request<SocialActivityFeedResponse>(
        "/friends/feed?limit=20",
      );
      friendFeed.value = data.list || [];
    } catch (error) {
      friendFeed.value = [];
      friendFeedError.value = options.getErrorMessage(error);
      if (showError) {
        options.notify("error", friendFeedError.value);
      }
    } finally {
      options.setFriendFeedBusy(false);
    }
  }

  async function refreshFriendsSection() {
    await Promise.all([loadFriends(), loadFriendFeed()]);
  }

  async function sendFriendRequest(uid: string) {
    const targetUid = String(uid || "").trim();
    if (!options.isAuthed()) {
      options.notify("error", "请先登录");
      return false;
    }
    if (!targetUid) {
      options.notify("error", "无法添加");
      return false;
    }
    friendActionBusy.value = `send:${targetUid}`;
    try {
      const payload: SendFriendRequestRequest = { uid: targetUid };
      await request<FriendRelationRecord>("/friends/requests", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      options.notify("success", "已申请");
      await Promise.all([loadFriends(false), loadFriendFeed(false)]);
      return true;
    } catch (error) {
      options.notify("error", options.getErrorMessage(error));
      return false;
    } finally {
      friendActionBusy.value = "";
    }
  }

  async function acceptFriendRequest(requestId: number) {
    friendActionBusy.value = `accept:${requestId}`;
    try {
      await request<FriendRelationRecord>(
        `/friends/requests/${requestId}/accept`,
        {
          method: "POST",
        },
      );
      options.notify("success", "已通过");
      await Promise.all([loadFriends(false), loadFriendFeed(false)]);
    } catch (error) {
      options.notify("error", options.getErrorMessage(error));
    } finally {
      friendActionBusy.value = "";
    }
  }

  async function rejectFriendRequest(requestId: number) {
    friendActionBusy.value = `reject:${requestId}`;
    try {
      await request<FriendRelationRecord>(
        `/friends/requests/${requestId}/reject`,
        {
          method: "POST",
        },
      );
      options.notify("success", "已拒绝");
      await Promise.all([loadFriends(false), loadFriendFeed(false)]);
    } catch (error) {
      options.notify("error", options.getErrorMessage(error));
    } finally {
      friendActionBusy.value = "";
    }
  }

  async function cancelFriendRequest(requestId: number) {
    friendActionBusy.value = `cancel:${requestId}`;
    try {
      await request<FriendRelationRecord>(`/friends/requests/${requestId}`, {
        method: "DELETE",
      });
      options.notify("success", "已取消");
      await Promise.all([loadFriends(false), loadFriendFeed(false)]);
    } catch (error) {
      options.notify("error", options.getErrorMessage(error));
    } finally {
      friendActionBusy.value = "";
    }
  }

  async function removeFriend(uid: string) {
    const targetUid = String(uid || "").trim();
    if (!targetUid) {
      return;
    }
    friendActionBusy.value = `remove:${targetUid}`;
    try {
      await request(`/friends/${encodeURIComponent(targetUid)}`, {
        method: "DELETE",
      });
      options.notify("success", "已删除");
      await Promise.all([loadFriends(false), loadFriendFeed(false)]);
    } catch (error) {
      options.notify("error", options.getErrorMessage(error));
    } finally {
      friendActionBusy.value = "";
    }
  }

  async function handleProfileFriendAction() {
    const target = options.getProfileActionTarget();
    const relation = profileFriendRelation.value;
    if (relation?.status === "pending") {
      if (incomingFriendRequests.value.some((item) => item.id === relation.id)) {
        await acceptFriendRequest(relation.id);
      }
      return;
    }
    await sendFriendRequest(target);
  }

  return {
    friendsOverview,
    friendsError,
    friendFeed,
    friendFeedError,
    friendActionBusy,
    friendRows,
    incomingFriendRequests,
    outgoingFriendRequests,
    profileFriendRelation,
    isProfileFriendIncoming,
    isProfileFriendOutgoing,
    showProfileFriendAction,
    profileFriendActionLabel,
    profileFriendStatusLabel,
    profileFriendActionDisabled,
    resetFriends,
    activityUserName,
    activityInitial,
    shortActivityText,
    activityLine,
    loadFriends,
    loadFriendFeed,
    refreshFriendsSection,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    cancelFriendRequest,
    removeFriend,
    handleProfileFriendAction,
  };
}
