<script setup lang="ts">
import { useAppContext } from "../composables/useAppContext";

const {
  CalendarCheck,
  CalendarDays,
  Gift,
  ListChecks,
  LoaderCircle,
  RefreshCw,
  formatRewards,
  tasksOverview,
  taskScope,
  busy,
  isAuthed,
  activeSection,
  activeTaskOverview,
  activeTaskList,
  activeTaskMilestones,
  taskCompletedCount,
  taskClaimedCount,
  taskActivityPercent,
  loadTasks,
  claimTaskReward,
  claimActivityReward,
  taskProgressPercent,
  taskProgressText,
  taskPeriodText,
} = useAppContext() as Record<string, any>;
</script>

<template>
<section
  v-if="activeSection === 'tasks'"
  class="panel task-panel"
  data-section="tasks"
>
  <div class="section-head">
    <div>
      <p class="eyebrow">任务中心</p>
      <h2>日常与周常</h2>
    </div>
    <div class="section-actions">
      <button
        class="secondary-action compact"
        type="button"
        :disabled="busy.tasks"
        @click="loadTasks"
      >
        <RefreshCw :size="16" :class="{ spin: busy.tasks }" />
        刷新
      </button>
    </div>
  </div>

  <div v-if="!isAuthed" class="empty-state">
    <ListChecks :size="30" />
    <strong>登录后查看任务</strong>
    <span>日常周常在这里</span>
  </div>
  <div
    v-else-if="busy.tasks && !tasksOverview"
    class="skeleton-grid achievement-skeleton"
  >
    <span v-for="item in 6" :key="item"></span>
  </div>
  <div v-else-if="!activeTaskOverview" class="empty-state">
    <ListChecks :size="30" />
    <strong>任务正在整理</strong>
    <span>稍后刷新即可查看。</span>
  </div>
  <div v-else class="task-content">
    <div class="task-toolbar">
      <div class="segmented-control task-scope-switch">
        <button
          type="button"
          :class="{ active: taskScope === 'daily' }"
          @click="taskScope = 'daily'"
        >
          <CalendarCheck :size="15" />
          日常
        </button>
        <button
          type="button"
          :class="{ active: taskScope === 'weekly' }"
          @click="taskScope = 'weekly'"
        >
          <CalendarDays :size="15" />
          周常
        </button>
      </div>
      <span>{{ taskPeriodText(activeTaskOverview) }}</span>
    </div>

    <div class="achievement-summary task-summary">
      <article>
        <small>已完成</small>
        <strong
          >{{ taskCompletedCount }}/{{ activeTaskList.length }}</strong
        >
      </article>
      <article>
        <small>已领取</small>
        <strong>{{ taskClaimedCount }}</strong>
      </article>
      <article>
        <small>活跃度</small>
        <strong>{{ activeTaskOverview.activity }}</strong>
      </article>
    </div>

    <section
      class="task-activity"
      :style="{ '--progress': `${taskActivityPercent}%` }"
    >
      <header>
        <div>
          <strong>{{ activeTaskOverview.label }}活跃度</strong>
          <span>
            {{ activeTaskOverview.activity }} /
            {{ activeTaskOverview.maxActivity }}
          </span>
        </div>
        <b>{{ taskActivityPercent }}%</b>
      </header>
      <div class="achievement-progress task-activity-progress">
        <i></i>
      </div>
      <div class="task-milestones">
        <button
          v-for="milestone in activeTaskMilestones"
          :key="`${activeTaskOverview.scope}-${milestone.threshold}`"
          type="button"
          :class="{
            claimed: milestone.claimed,
            available: milestone.available,
          }"
          :disabled="
            busy.claimTask || milestone.claimed || !milestone.available
          "
          @click="claimActivityReward(milestone)"
        >
          <Gift :size="15" />
          <span>{{ milestone.threshold }}</span>
          <small>{{ formatRewards(milestone.rewards) }}</small>
        </button>
      </div>
    </section>

    <div class="achievement-grid task-grid">
      <article
        v-for="task in activeTaskList"
        :key="task.id"
        class="achievement-card task-card"
        :class="{ achieved: task.claimed, completed: task.completed }"
        :style="{ '--progress': `${taskProgressPercent(task)}%` }"
      >
        <header>
          <span class="achievement-icon">
            <ListChecks :size="17" />
          </span>
          <div>
            <strong>{{ task.name }}</strong>
            <small>活跃度 +{{ task.activityPoints }}</small>
          </div>
          <b>{{
            task.claimed ? "已领取" : task.completed ? "可领取" : "进行中"
          }}</b>
        </header>
        <p>{{ task.description }}</p>
        <div class="achievement-meta">
          <span>{{ taskProgressText(task) }}</span>
          <span>奖励 {{ formatRewards(task.rewards) }}</span>
        </div>
        <div class="achievement-progress" aria-hidden="true">
          <i></i>
        </div>
        <footer>
          <button
            class="primary-action wide"
            type="button"
            :disabled="busy.claimTask || task.claimed || !task.completed"
            @click="claimTaskReward(task)"
          >
            <LoaderCircle
              v-if="busy.claimTask && task.completed && !task.claimed"
              :size="17"
              class="spin"
            />
            <Gift v-else :size="17" />
            {{
              task.claimed
                ? "已领取"
                : task.completed
                  ? "领取奖励"
                  : "未完成"
            }}
          </button>
        </footer>
      </article>
    </div>
  </div>
</section>
</template>
