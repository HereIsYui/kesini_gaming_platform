<script setup lang="ts">
import { useAppContext } from "../composables/useAppContext";

const {
  RefreshCw,
  UserRound,
  UsersRound,
  RouterLink,
  formatDate,
  guildOverview,
  guildError,
  guildMessageError,
  guildMessageText,
  guildName,
  guildDescription,
  guildAnnouncement,
  guildActionBusy,
  busy,
  isAuthed,
  activeSection,
  currentGuild,
  guildMembers,
  guildRows,
  guildRoleLabel,
  guildMessageRows,
  publicProfileRoute,
  guildRoleName,
  guildMemberName,
  guildMemberInitial,
  guildMessageSenderName,
  guildMessageInitial,
  loadGuild,
  loadGuildMessages,
  createGuild,
  joinGuild,
  leaveGuild,
  saveGuildAnnouncement,
  sendGuildMessage,
} = useAppContext() as Record<string, any>;
</script>

<template>
<section
  v-if="activeSection === 'guild'"
  class="panel guild-panel"
  data-section="guild"
>
  <div class="section-head">
    <div>
      <p class="eyebrow">公会</p>
      <h2>公会</h2>
    </div>
    <div class="section-actions">
      <button
        v-if="isAuthed"
        class="secondary-action compact"
        type="button"
        :disabled="busy.guild"
        @click="loadGuild()"
      >
        <RefreshCw :size="16" :class="{ spin: busy.guild }" />
        刷新
      </button>
    </div>
  </div>

  <div v-if="!isAuthed" class="empty-state">
    <UserRound :size="30" />
    <strong>请先登录</strong>
    <span>登录后查看</span>
  </div>
  <div v-else-if="busy.guild && !guildOverview" class="skeleton-grid">
    <span v-for="item in 3" :key="item"></span>
  </div>
  <div v-else-if="guildError" class="empty-state">
    <UsersRound :size="30" />
    <strong>加载失败</strong>
    <span>{{ guildError }}</span>
    <button class="secondary-action" type="button" @click="loadGuild()">
      重试
    </button>
  </div>
  <template v-else>
    <div class="guild-layout">
      <section class="guild-block guild-current">
        <div class="section-title-row">
          <div>
            <p class="eyebrow">我的</p>
            <h3>{{ currentGuild?.name || "未加入" }}</h3>
          </div>
          <button
            v-if="currentGuild"
            class="danger-action compact"
            type="button"
            :disabled="guildActionBusy === 'leave'"
            @click="leaveGuild"
          >
            退出
          </button>
        </div>

        <template v-if="currentGuild">
          <div class="guild-hero">
            <div>
              <strong>{{ currentGuild.name }}</strong>
              <span>{{ currentGuild.description || "暂无简介" }}</span>
            </div>
            <small>{{ guildRoleLabel }}</small>
          </div>
          <section class="guild-announcement">
            <div>
              <p class="eyebrow">公告</p>
              <h3>公会公告</h3>
            </div>
            <form
              v-if="currentGuild.role === 'leader'"
              class="guild-announcement-form"
              @submit.prevent="saveGuildAnnouncement"
            >
              <textarea
                v-model="guildAnnouncement"
                maxlength="160"
                placeholder="公告"
              ></textarea>
              <button
                class="primary-action compact"
                type="submit"
                :disabled="guildActionBusy === 'announcement'"
              >
                保存
              </button>
            </form>
            <p v-else>{{ currentGuild.announcement || "暂无公告" }}</p>
          </section>
          <div class="guild-stats">
            <article>
              <small>成员</small>
              <strong>{{ currentGuild.memberCount }}</strong>
            </article>
            <article>
              <small>身份</small>
              <strong>{{ guildRoleLabel }}</strong>
            </article>
          </div>
          <section class="guild-chat">
            <div class="section-title-row">
              <div>
                <p class="eyebrow">频道</p>
                <h3>公会消息</h3>
              </div>
              <button
                class="secondary-action compact"
                type="button"
                :disabled="busy.guildMessages"
                @click="loadGuildMessages()"
              >
                <RefreshCw
                  :size="15"
                  :class="{ spin: busy.guildMessages }"
                />
                刷新
              </button>
            </div>
            <div
              v-if="busy.guildMessages && guildMessageRows.length === 0"
              class="empty-mini"
            >
              正在读取
            </div>
            <div v-else-if="guildMessageError" class="empty-mini">
              消息失败
            </div>
            <div
              v-else-if="guildMessageRows.length === 0"
              class="empty-mini"
            >
              暂无消息
            </div>
            <div v-else class="guild-message-list">
              <article
                v-for="message in guildMessageRows"
                :key="message.id"
                class="guild-message-row"
              >
                <span class="friend-avatar small">
                  <img
                    v-if="message.sender.avatar"
                    :src="message.sender.avatar"
                    :alt="guildMessageSenderName(message)"
                  />
                  <span v-else>{{ guildMessageInitial(message) }}</span>
                </span>
                <div class="guild-message-body">
                  <header>
                    <strong>{{ guildMessageSenderName(message) }}</strong>
                    <time>{{ formatDate(message.createdAt) }}</time>
                  </header>
                  <p>{{ message.content }}</p>
                </div>
              </article>
            </div>
            <form
              class="guild-message-form"
              @submit.prevent="sendGuildMessage"
            >
              <input
                v-model="guildMessageText"
                maxlength="120"
                placeholder="说点什么"
              />
              <button
                class="primary-action compact"
                type="submit"
                :disabled="busy.guildSending"
              >
                发送
              </button>
            </form>
          </section>
          <div class="section-title-row compact-title">
            <div>
              <p class="eyebrow">成员</p>
              <h3>成员</h3>
            </div>
          </div>
          <div class="guild-member-list">
            <article
              v-for="member in guildMembers"
              :key="member.uid"
              class="guild-member-row"
            >
              <span class="friend-avatar">
                <img
                  v-if="member.avatar"
                  :src="member.avatar"
                  :alt="guildMemberName(member)"
                />
                <span v-else>{{ guildMemberInitial(member) }}</span>
              </span>
              <div class="friend-info">
                <strong>{{ guildMemberName(member) }}</strong>
                <span>{{ guildRoleName(member.role) }}</span>
              </div>
              <RouterLink
                class="secondary-action compact"
                :to="publicProfileRoute(member)"
              >
                主页
              </RouterLink>
            </article>
          </div>
        </template>

        <form
          v-else
          class="guild-create-form"
          @submit.prevent="createGuild"
        >
          <div class="empty-mini">尚未加入</div>
          <input
            v-model="guildName"
            maxlength="16"
            placeholder="公会名"
          />
          <input
            v-model="guildDescription"
            maxlength="60"
            placeholder="简介"
          />
          <button
            class="primary-action"
            type="submit"
            :disabled="busy.guild || guildActionBusy === 'create'"
          >
            创建
          </button>
        </form>
      </section>

      <section class="guild-block">
        <div class="section-title-row">
          <div>
            <p class="eyebrow">列表</p>
            <h3>公会列表</h3>
          </div>
        </div>
        <div v-if="guildRows.length === 0" class="empty-mini">
          暂无公会
        </div>
        <div v-else class="guild-list">
          <article
            v-for="guild in guildRows"
            :key="guild.id"
            class="guild-row"
          >
            <div class="guild-row-main">
              <strong>{{ guild.name }}</strong>
              <span>{{ guild.description || "暂无简介" }}</span>
            </div>
            <div class="guild-row-meta">
              <span>{{ guild.memberCount }} 人</span>
              <button
                v-if="!currentGuild"
                class="primary-action compact"
                type="button"
                :disabled="guildActionBusy === `join:${guild.id}`"
                @click="joinGuild(guild.id)"
              >
                加入
              </button>
              <button
                v-else
                class="secondary-action compact"
                type="button"
                disabled
              >
                {{ guild.joined ? "当前" : "已入会" }}
              </button>
            </div>
          </article>
        </div>
      </section>
    </div>
  </template>
</section>
</template>
