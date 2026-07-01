<script setup lang="ts">
import { unref } from "vue";
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
  guildSettingsDescription,
  guildJoinMode,
  guildDonateAmount,
  guildActiveTab,
  guildActionBusy,
  busy,
  isAuthed,
  activeSection,
  currentGuild,
  guildMembers,
  guildRows,
  guildRoleLabel,
  guildTabs,
  guildDailyStatus,
  guildActivityChests,
  guildBoss,
  guildRequests,
  guildMessageRows,
  guildLeaderboard,
  guildLeaderboardError,
  guildLeaderboardRows,
  publicProfileRoute,
  guildRoleName,
  guildMemberName,
  guildMemberInitial,
  guildMessageSenderName,
  guildMessageInitial,
  guildLeaderboardInitial,
  formatGuildLeaderboardValue,
  formatRewards,
  loadGuild,
  loadGuildMessages,
  loadGuildLeaderboard,
  createGuild,
  joinGuild,
  leaveGuild,
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
} = useAppContext() as Record<string, any>;

const donateOptions = [100, 500, 1000];

function guildExpPercent(guild: any) {
  const next = Number(guild?.nextLevelExp || 0);
  if (next <= 0) {
    return 100;
  }
  return Math.max(0, Math.min(100, (Number(guild?.exp || 0) / next) * 100));
}

function bossHpPercent(boss: any) {
  const maxHp = Number(boss?.maxHp || 0);
  if (maxHp <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, (Number(boss?.hp || 0) / maxHp) * 100));
}

function pendingRequestId(guildId: number) {
  const overview = unref(guildOverview);
  return (
    (overview?.pendingRequests || []).find(
      (request: any) => Number(request.guildId) === Number(guildId),
    )?.id || 0
  );
}
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
    <div v-if="currentGuild" class="guild-layout guild-play-layout">
      <section class="guild-block guild-current">
        <div class="guild-hero">
          <div>
            <strong>{{ currentGuild.name }}</strong>
            <span>{{ currentGuild.description || "暂无简介" }}</span>
          </div>
          <small>{{ guildRoleLabel }}</small>
        </div>

        <nav class="guild-tabs" aria-label="公会页签">
          <button
            v-for="tab in guildTabs"
            :key="tab"
            type="button"
            :class="{ active: guildActiveTab === tab }"
            @click="guildActiveTab = tab"
          >
            {{ tab }}
          </button>
        </nav>

        <section v-if="guildActiveTab === '总览'" class="guild-tab-panel">
          <div class="guild-stats wide">
            <article>
              <small>等级</small>
              <strong>Lv.{{ currentGuild.level }}</strong>
            </article>
            <article>
              <small>资金</small>
              <strong>{{ currentGuild.fund }}</strong>
            </article>
            <article>
              <small>成员</small>
              <strong>{{ currentGuild.memberCount }}/{{ currentGuild.memberLimit }}</strong>
            </article>
            <article>
              <small>今日</small>
              <strong>{{ guildDailyStatus?.guildActivity || 0 }}</strong>
            </article>
            <article>
              <small>我的</small>
              <strong>{{ guildDailyStatus?.myContributionToday || 0 }}</strong>
            </article>
          </div>

          <div class="guild-progress">
            <span>经验</span>
            <div>
              <i :style="{ width: `${guildExpPercent(currentGuild)}%` }"></i>
            </div>
            <strong>
              {{
                currentGuild.nextLevelExp > 0
                  ? `${currentGuild.exp}/${currentGuild.nextLevelExp}`
                  : "已满"
              }}
            </strong>
          </div>

          <section class="guild-announcement">
            <div>
              <p class="eyebrow">公告</p>
              <h3>公告</h3>
            </div>
            <p>{{ currentGuild.announcement || "暂无公告" }}</p>
          </section>

          <div class="guild-action-grid">
            <article>
              <strong>签到</strong>
              <span>贡献 +10</span>
              <button
                class="primary-action compact"
                type="button"
                :disabled="
                  guildDailyStatus?.checkedIn ||
                  guildActionBusy === 'check-in'
                "
                @click="checkInGuild"
              >
                {{ guildDailyStatus?.checkedIn ? "已签" : "签到" }}
              </button>
            </article>
            <article>
              <strong>捐献</strong>
              <span>
                {{ guildDailyStatus?.donateCount || 0 }}/{{
                  guildDailyStatus?.donateLimit || 3
                }}
              </span>
              <div class="guild-donate-row">
                <select v-model="guildDonateAmount">
                  <option
                    v-for="amount in donateOptions"
                    :key="amount"
                    :value="amount"
                  >
                    {{ amount }}
                  </option>
                </select>
                <button
                  class="primary-action compact"
                  type="button"
                  :disabled="
                    guildActionBusy === 'donate' ||
                    (guildDailyStatus?.donateCount || 0) >=
                      (guildDailyStatus?.donateLimit || 3)
                  "
                  @click="donateGuild(guildDonateAmount)"
                >
                  捐献
                </button>
              </div>
            </article>
          </div>

          <div class="guild-chest-list">
            <article
              v-for="chest in guildActivityChests"
              :key="chest.threshold"
              class="guild-chest"
            >
              <div>
                <strong>{{ chest.threshold }}</strong>
                <span>{{ formatRewards(chest.reward) }}</span>
              </div>
              <button
                class="secondary-action compact"
                type="button"
                :disabled="
                  !chest.available ||
                  chest.claimed ||
                  guildActionBusy === `chest:${chest.threshold}`
                "
                @click="claimGuildChest(chest.threshold)"
              >
                {{ chest.claimed ? "已领" : "领取" }}
              </button>
            </article>
          </div>
        </section>

        <section v-else-if="guildActiveTab === '成员'" class="guild-tab-panel">
          <div class="guild-member-list">
            <article
              v-for="member in guildMembers"
              :key="member.uid"
              class="guild-member-row rich"
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
                <span>
                  {{ guildRoleName(member.role) }} · 贡献
                  {{ member.totalContribution || 0 }}
                </span>
                <small>{{ formatDate(member.joinedAt) }}</small>
              </div>
              <div class="guild-member-actions">
                <RouterLink
                  class="secondary-action compact"
                  :to="publicProfileRoute(member)"
                >
                  主页
                </RouterLink>
                <button
                  v-if="currentGuild.role === 'leader' && member.role === 'member'"
                  class="secondary-action compact"
                  type="button"
                  :disabled="guildActionBusy === 'promote'"
                  @click="promoteGuildMember(member.uid)"
                >
                  任命
                </button>
                <button
                  v-if="currentGuild.role === 'leader' && member.role === 'officer'"
                  class="secondary-action compact"
                  type="button"
                  :disabled="guildActionBusy === 'demote'"
                  @click="demoteGuildMember(member.uid)"
                >
                  降职
                </button>
                <button
                  v-if="currentGuild.role === 'leader' && member.role !== 'leader'"
                  class="secondary-action compact"
                  type="button"
                  :disabled="guildActionBusy === 'transfer'"
                  @click="transferGuildLeader(member.uid)"
                >
                  转让
                </button>
                <button
                  v-if="member.canManage"
                  class="danger-action compact"
                  type="button"
                  :disabled="guildActionBusy === 'kick'"
                  @click="kickGuildMember(member.uid)"
                >
                  移出
                </button>
              </div>
            </article>
          </div>
        </section>

        <section v-else-if="guildActiveTab === '首领'" class="guild-tab-panel">
          <article v-if="guildBoss" class="guild-boss-card">
            <header>
              <div>
                <p class="eyebrow">首领</p>
                <h3>{{ guildBoss.name }}</h3>
              </div>
              <strong>Lv.{{ guildBoss.level }}</strong>
            </header>
            <div class="guild-progress boss">
              <span>血量</span>
              <div>
                <i :style="{ width: `${bossHpPercent(guildBoss)}%` }"></i>
              </div>
              <strong>{{ guildBoss.hp }}/{{ guildBoss.maxHp }}</strong>
            </div>
            <div class="guild-stats">
              <article>
                <small>次数</small>
                <strong>{{ guildBoss.attempts }}/{{ guildBoss.attemptLimit }}</strong>
              </article>
              <article>
                <small>伤害</small>
                <strong>{{ guildBoss.myDamage }}</strong>
              </article>
              <article>
                <small>奖励</small>
                <strong>{{ formatRewards(guildBoss.reward) }}</strong>
              </article>
            </div>
            <div class="guild-boss-actions">
              <button
                class="primary-action compact"
                type="button"
                :disabled="
                  guildBoss.defeated ||
                  guildBoss.attempts >= guildBoss.attemptLimit ||
                  guildActionBusy === 'boss'
                "
                @click="challengeGuildBoss"
              >
                挑战
              </button>
              <button
                class="secondary-action compact"
                type="button"
                :disabled="
                  !guildBoss.canClaim ||
                  guildBoss.rewardClaimed ||
                  guildActionBusy === 'boss-claim'
                "
                @click="claimGuildBossReward"
              >
                {{ guildBoss.rewardClaimed ? "已领" : "领奖" }}
              </button>
            </div>
          </article>
        </section>

        <section v-else-if="guildActiveTab === '排行'" class="guild-tab-panel">
          <div class="section-title-row">
            <div>
              <p class="eyebrow">排行</p>
              <h3>总战力</h3>
            </div>
            <button
              class="secondary-action compact"
              type="button"
              :disabled="busy.guild"
              @click="loadGuildLeaderboard()"
            >
              <RefreshCw :size="15" :class="{ spin: busy.guild }" />
              刷新
            </button>
          </div>
          <div v-if="guildLeaderboardError" class="empty-mini">
            加载失败
          </div>
          <div v-else-if="guildLeaderboardRows.length === 0" class="empty-mini">
            暂无排行
          </div>
          <div v-else class="leaderboard-list guild-rank-list">
            <article
              v-for="entry in guildLeaderboardRows.slice(0, 20)"
              :key="entry.id"
              class="leaderboard-row"
              :class="{ mine: entry.id === currentGuild.id }"
            >
              <b>#{{ entry.rank }}</b>
              <span class="avatar-fallback small">{{
                guildLeaderboardInitial(entry)
              }}</span>
              <div>
                <strong>{{ entry.name }}</strong>
                <span>Lv.{{ entry.level }} · {{ entry.memberCount }}/{{ entry.memberLimit }}</span>
              </div>
              <em>{{ formatGuildLeaderboardValue(entry.value) }}</em>
            </article>
          </div>
          <p v-if="guildLeaderboard?.generatedAt" class="leaderboard-time">
            更新时间：{{ formatDate(guildLeaderboard.generatedAt) }}
          </p>
        </section>

        <section v-else-if="guildActiveTab === '消息'" class="guild-tab-panel">
          <section class="guild-chat">
            <div class="section-title-row">
              <div>
                <p class="eyebrow">消息</p>
                <h3>消息</h3>
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
        </section>

        <section v-else-if="guildActiveTab === '申请'" class="guild-tab-panel">
          <div v-if="guildRequests.length === 0" class="empty-mini">
            暂无申请
          </div>
          <div v-else class="guild-member-list">
            <article
              v-for="request in guildRequests"
              :key="request.id"
              class="guild-request-row"
            >
              <div class="friend-info">
                <strong>{{ request.user?.nickname || "玩家" }}</strong>
                <span>{{ formatDate(request.createdAt) }}</span>
              </div>
              <div class="guild-member-actions">
                <button
                  class="primary-action compact"
                  type="button"
                  :disabled="guildActionBusy === `approve:${request.id}`"
                  @click="approveGuildRequest(request.id)"
                >
                  批准
                </button>
                <button
                  class="secondary-action compact"
                  type="button"
                  :disabled="guildActionBusy === `reject:${request.id}`"
                  @click="rejectGuildRequest(request.id)"
                >
                  拒绝
                </button>
              </div>
            </article>
          </div>
        </section>

        <section v-else-if="guildActiveTab === '设置'" class="guild-tab-panel">
          <form class="guild-settings-form" @submit.prevent="saveGuildSettings">
            <label>
              <span>简介</span>
              <input
                v-model="guildSettingsDescription"
                maxlength="80"
                placeholder="简介"
              />
            </label>
            <label>
              <span>公告</span>
              <textarea
                v-model="guildAnnouncement"
                maxlength="160"
                placeholder="公告"
              ></textarea>
            </label>
            <label>
              <span>加入</span>
              <select v-model="guildJoinMode">
                <option value="open">自由</option>
                <option value="approval">审批</option>
              </select>
            </label>
            <button
              class="primary-action compact"
              type="submit"
              :disabled="guildActionBusy === 'settings'"
            >
              保存
            </button>
          </form>
        </section>
      </section>
    </div>

    <div v-else class="guild-layout">
      <section class="guild-block guild-current">
        <form class="guild-create-form" @submit.prevent="createGuild">
          <div class="empty-mini">尚未加入</div>
          <input v-model="guildName" maxlength="16" placeholder="公会名" />
          <input v-model="guildDescription" maxlength="80" placeholder="简介" />
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
              <span>
                Lv.{{ guild.level }} · {{ guild.memberCount }}/{{
                  guild.memberLimit
                }}
              </span>
            </div>
            <div class="guild-row-meta">
              <span>{{ guild.joinMode === "approval" ? "审批" : "自由" }}</span>
              <button
                v-if="pendingRequestId(guild.id)"
                class="secondary-action compact"
                type="button"
                :disabled="guildActionBusy === `cancel:${pendingRequestId(guild.id)}`"
                @click="cancelGuildRequest(pendingRequestId(guild.id))"
              >
                取消
              </button>
              <button
                v-else
                class="primary-action compact"
                type="button"
                :disabled="guildActionBusy === `join:${guild.id}`"
                @click="joinGuild(guild.id)"
              >
                {{ guild.joinMode === "approval" ? "申请" : "加入" }}
              </button>
            </div>
          </article>
        </div>
      </section>
    </div>
  </template>
</section>
</template>
