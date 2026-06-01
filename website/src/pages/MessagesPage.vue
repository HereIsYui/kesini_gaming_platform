<script setup lang="ts">
import { useAppContext } from "../composables/useAppContext";

const {
  Mail,
  RefreshCw,
  UserRound,
  formatDate,
  formatRewards,
  playerMessages,
  playerMessagesError,
  messageClaimBusy,
  busy,
  isAuthed,
  activeSection,
  unreadMessageCount,
  loadMessages,
  markMessageRead,
  claimMessageReward,
} = useAppContext() as Record<string, any>;
</script>

<template>
<section
  v-if="activeSection === 'messages'"
  class="panel messages-panel"
  data-section="messages"
>
  <div class="section-head">
    <div>
      <p class="eyebrow">消息</p>
      <h2>消息中心</h2>
    </div>
    <div class="section-actions">
      <span v-if="isAuthed" class="type-pill">
        {{ unreadMessageCount > 0 ? `${unreadMessageCount} 未读` : "已读" }}
      </span>
      <button
        v-if="isAuthed"
        class="secondary-action compact"
        type="button"
        :disabled="busy.messages"
        @click="loadMessages()"
      >
        <RefreshCw :size="16" :class="{ spin: busy.messages }" />
        刷新
      </button>
    </div>
  </div>

  <div v-if="!isAuthed" class="empty-state">
    <UserRound :size="30" />
    <strong>请先登录</strong>
    <span>登录后查看</span>
  </div>
  <div v-else-if="busy.messages && playerMessages.length === 0" class="skeleton-grid">
    <span v-for="item in 3" :key="item"></span>
  </div>
  <div v-else-if="playerMessagesError" class="empty-state">
    <Mail :size="30" />
    <strong>消息加载失败</strong>
    <span>{{ playerMessagesError }}</span>
    <button class="secondary-action" type="button" @click="loadMessages()">
      重试
    </button>
  </div>
  <div v-else-if="playerMessages.length === 0" class="empty-state">
    <Mail :size="30" />
    <strong>暂无消息</strong>
    <span>稍后再看</span>
  </div>
  <div v-else class="message-list">
    <article
      v-for="message in playerMessages"
      :key="message.id"
      class="message-card"
      :class="{ unread: !message.read }"
    >
      <div class="message-card-head">
        <div>
          <span class="message-status">{{
            message.read ? "已读" : "未读"
          }}</span>
          <h3>{{ message.title }}</h3>
        </div>
        <time>{{ formatDate(message.createdAt) }}</time>
      </div>
      <p>{{ message.content }}</p>
      <div v-if="message.hasReward" class="message-reward">
        <span>奖励</span>
        <strong>{{ formatRewards(message.rewards || undefined) }}</strong>
        <em>{{ message.claimed ? "已领取" : "待领取" }}</em>
      </div>
      <div
        v-if="!message.read || (message.hasReward && !message.claimed)"
        class="message-actions"
      >
        <button
          v-if="message.hasReward && !message.claimed"
          class="primary-action compact"
          type="button"
          :disabled="messageClaimBusy === message.id"
          @click="claimMessageReward(message)"
        >
          {{ messageClaimBusy === message.id ? "领取中" : "领取" }}
        </button>
        <button
          v-if="!message.read && !message.hasReward"
          class="secondary-action compact"
          type="button"
          @click="markMessageRead(message)"
        >
          标已读
        </button>
      </div>
    </article>
  </div>
</section>
</template>
