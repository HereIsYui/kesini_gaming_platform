<script setup lang="ts">
import { useAppContext } from "../composables/useAppContext";

const {
  RefreshCw,
  UserRound,
  UsersRound,
  RouterLink,
  formatDate,
  friendsOverview,
  friendsError,
  friendFeed,
  friendFeedError,
  friendActionBusy,
  busy,
  isAuthed,
  activeSection,
  friendRows,
  incomingFriendRequests,
  outgoingFriendRequests,
  publicPlayerName,
  publicProfileRoute,
  activityUserName,
  activityInitial,
  activityLine,
  loadFriendFeed,
  refreshFriendsSection,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
  removeFriend,
} = useAppContext() as Record<string, any>;
</script>

<template>
<section
  v-if="activeSection === 'friends'"
  class="panel friends-panel"
  data-section="friends"
>
  <div class="section-head">
    <div>
      <p class="eyebrow">好友</p>
      <h2>好友列表</h2>
    </div>
    <div class="section-actions friends-actions">
      <button
        v-if="isAuthed"
        class="secondary-action compact"
        type="button"
        :disabled="busy.friends || busy.friendFeed"
        @click="refreshFriendsSection"
      >
        <RefreshCw
          :size="16"
          :class="{ spin: busy.friends || busy.friendFeed }"
        />
        刷新
      </button>
    </div>
  </div>

  <div v-if="!isAuthed" class="empty-state">
    <UserRound :size="30" />
    <strong>请先登录</strong>
    <span>登录后查看</span>
  </div>
  <div v-else-if="busy.friends && !friendsOverview" class="skeleton-grid">
    <span v-for="item in 3" :key="item"></span>
  </div>
  <div v-else-if="friendsError" class="empty-state">
    <UsersRound :size="30" />
    <strong>好友加载失败</strong>
    <span>{{ friendsError }}</span>
    <button
      class="secondary-action"
      type="button"
      @click="refreshFriendsSection"
    >
      重试
    </button>
  </div>
  <template v-else>
    <div class="friends-summary">
      <article>
        <small>好友</small>
        <strong>{{ friendsOverview?.counts.friends || 0 }}</strong>
      </article>
      <article>
        <small>收到</small>
        <strong>{{ friendsOverview?.counts.incoming || 0 }}</strong>
      </article>
      <article>
        <small>发出</small>
        <strong>{{ friendsOverview?.counts.outgoing || 0 }}</strong>
      </article>
    </div>

    <section class="friends-block friend-feed-block">
      <div class="section-title-row">
        <div>
          <p class="eyebrow">动态</p>
          <h3>好友动态</h3>
        </div>
        <button
          class="secondary-action compact"
          type="button"
          :disabled="busy.friendFeed"
          @click="loadFriendFeed()"
        >
          <RefreshCw :size="15" :class="{ spin: busy.friendFeed }" />
          刷新
        </button>
      </div>
      <div
        v-if="busy.friendFeed && friendFeed.length === 0"
        class="empty-mini"
      >
        正在读取
      </div>
      <div v-else-if="friendFeedError" class="empty-mini">
        动态加载失败
      </div>
      <div v-else-if="friendFeed.length === 0" class="empty-mini">
        暂无动态
      </div>
      <div v-else class="friend-feed-list">
        <RouterLink
          v-for="activity in friendFeed"
          :key="activity.id"
          class="friend-feed-row"
          :to="publicProfileRoute(activity.user)"
        >
          <span class="friend-avatar">
            <img
              v-if="activity.user.avatar"
              :src="activity.user.avatar"
              :alt="activityUserName(activity)"
            />
            <span v-else>{{ activityInitial(activity) }}</span>
          </span>
          <div class="friend-info">
            <strong>{{ activityUserName(activity) }}</strong>
            <span>{{ activityLine(activity) }}</span>
          </div>
          <time>{{ formatDate(activity.createdAt) }}</time>
        </RouterLink>
      </div>
    </section>

    <div class="friends-layout">
      <section class="friends-block">
        <div class="section-title-row">
          <div>
            <p class="eyebrow">好友</p>
            <h3>已添加</h3>
          </div>
        </div>
        <div v-if="friendRows.length === 0" class="empty-mini">
          暂无好友
        </div>
        <div v-else class="friend-list">
          <article
            v-for="friend in friendRows"
            :key="friend.id"
            class="friend-row"
          >
            <span class="friend-avatar">
              <img
                v-if="friend.user.avatar"
                :src="friend.user.avatar"
                :alt="
                  publicPlayerName(friend.user.nickname, friend.user.uid)
                "
              />
              <span v-else>
                {{
                  publicPlayerName(friend.user.nickname, friend.user.uid)
                    .slice(0, 1)
                    .toUpperCase()
                }}
              </span>
            </span>
            <div class="friend-info">
              <strong>{{
                publicPlayerName(friend.user.nickname, friend.user.uid)
              }}</strong>
              <span>已添加</span>
            </div>
            <div class="friend-row-actions">
              <RouterLink
                class="secondary-action compact"
                :to="publicProfileRoute(friend.user)"
              >
                查看
              </RouterLink>
              <button
                class="danger-action compact"
                type="button"
                :disabled="
                  friendActionBusy === `remove:${friend.user.uid}`
                "
                @click="removeFriend(friend.user.uid)"
              >
                删除
              </button>
            </div>
          </article>
        </div>
      </section>

      <section class="friends-block">
        <div class="section-title-row">
          <div>
            <p class="eyebrow">收到</p>
            <h3>好友申请</h3>
          </div>
        </div>
        <div
          v-if="incomingFriendRequests.length === 0"
          class="empty-mini"
        >
          暂无申请
        </div>
        <div v-else class="friend-list">
          <article
            v-for="requestItem in incomingFriendRequests"
            :key="requestItem.id"
            class="friend-row"
          >
            <span class="friend-avatar">
              <img
                v-if="requestItem.user.avatar"
                :src="requestItem.user.avatar"
                :alt="
                  publicPlayerName(
                    requestItem.user.nickname,
                    requestItem.user.uid,
                  )
                "
              />
              <span v-else>
                {{
                  publicPlayerName(
                    requestItem.user.nickname,
                    requestItem.user.uid,
                  )
                    .slice(0, 1)
                    .toUpperCase()
                }}
              </span>
            </span>
            <div class="friend-info">
              <strong>{{
                publicPlayerName(
                  requestItem.user.nickname,
                  requestItem.user.uid,
                )
              }}</strong>
              <span>待处理</span>
            </div>
            <div class="friend-row-actions">
              <RouterLink
                class="secondary-action compact"
                :to="publicProfileRoute(requestItem.user)"
              >
                查看
              </RouterLink>
              <button
                class="primary-action compact"
                type="button"
                :disabled="
                  friendActionBusy === `accept:${requestItem.id}`
                "
                @click="acceptFriendRequest(requestItem.id)"
              >
                通过
              </button>
              <button
                class="secondary-action compact"
                type="button"
                :disabled="
                  friendActionBusy === `reject:${requestItem.id}`
                "
                @click="rejectFriendRequest(requestItem.id)"
              >
                拒绝
              </button>
            </div>
          </article>
        </div>
      </section>

      <section class="friends-block">
        <div class="section-title-row">
          <div>
            <p class="eyebrow">发出</p>
            <h3>等待通过</h3>
          </div>
        </div>
        <div
          v-if="outgoingFriendRequests.length === 0"
          class="empty-mini"
        >
          暂无发出
        </div>
        <div v-else class="friend-list">
          <article
            v-for="requestItem in outgoingFriendRequests"
            :key="requestItem.id"
            class="friend-row"
          >
            <span class="friend-avatar">
              <img
                v-if="requestItem.user.avatar"
                :src="requestItem.user.avatar"
                :alt="
                  publicPlayerName(
                    requestItem.user.nickname,
                    requestItem.user.uid,
                  )
                "
              />
              <span v-else>
                {{
                  publicPlayerName(
                    requestItem.user.nickname,
                    requestItem.user.uid,
                  )
                    .slice(0, 1)
                    .toUpperCase()
                }}
              </span>
            </span>
            <div class="friend-info">
              <strong>{{
                publicPlayerName(
                  requestItem.user.nickname,
                  requestItem.user.uid,
                )
              }}</strong>
              <span>等待中</span>
            </div>
            <div class="friend-row-actions">
              <RouterLink
                class="secondary-action compact"
                :to="publicProfileRoute(requestItem.user)"
              >
                查看
              </RouterLink>
              <button
                class="secondary-action compact"
                type="button"
                :disabled="
                  friendActionBusy === `cancel:${requestItem.id}`
                "
                @click="cancelFriendRequest(requestItem.id)"
              >
                取消
              </button>
            </div>
          </article>
        </div>
      </section>
    </div>
  </template>
</section>
</template>
