<script setup lang="ts">
import { useAppContext } from "../composables/useAppContext";

const {
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  RefreshCw,
  Swords,
  Trophy,
  UserRound,
  bossLabel,
  formatDate,
  formatRewards,
  pveOverview,
  pveStagePage,
  pveStageTotalPages,
  pveStageTotal,
  pveRecords,
  pveRecordPage,
  pveRecordTotalPages,
  pveSweepResult,
  pveAutoBattleResult,
  pveBattleStageId,
  pveBattlePhase,
  pveBattleResult,
  pveBattlePlayerHpPercent,
  pveBattleEnemyHpPercent,
  pveBattlePlayerHpDraining,
  pveBattleEnemyHpDraining,
  pveSweepableCount,
  sweepPveStages,
  autoBattlePve,
  pveHasAutoBattleTarget,
  gameVipLabel,
  gameVipMuted,
  busy,
  isAuthed,
  activeSection,
  pveStages,
  pveFormation,
  pveRecentRecords,
  pveClearedCount,
  loadPveRecords,
  refreshPve,
  challengePveStage,
  changePveStagePage,
  changePveRecordPage,
  pvePowerPercent,
  pveStageLevelLabel,
} = useAppContext() as Record<string, any>;

function pveBattleRewardText(rewards: unknown) {
  const text = formatRewards(rewards || undefined);
  return text === "无奖励" ? "无奖励" : `奖励 ${text}`;
}

function pveRecordModeLabel(record: { mode?: string; success: boolean }) {
  if (record.mode === "sweep") {
    return "扫荡";
  }
  if (record.mode === "auto") {
    return "自动";
  }
  return record.success ? "胜利" : "失败";
}

function pveStars(value?: number) {
  return "★".repeat(Math.max(0, Number(value || 0)));
}
</script>

<template>
  <section
    v-if="activeSection === 'pve'"
    class="panel pve-panel"
    data-section="pve"
  >
    <div class="section-head">
      <div>
        <p class="eyebrow">轻量关卡</p>
        <h2>星港挑战</h2>
      </div>
      <div class="section-actions">
        <div class="pve-sweep-meta">
          <span class="pve-sweep-count">可扫 {{ pveSweepableCount }}</span>
          <span class="pve-sweep-vip" :class="{ muted: gameVipMuted }">
            {{ gameVipLabel }}
          </span>
        </div>
        <button
          class="secondary-action compact"
          type="button"
          :disabled="
            busy.pve ||
            busy.pveChallenge ||
            pveSweepableCount <= 0 ||
            gameVipMuted
          "
          @click="sweepPveStages"
        >
          <LoaderCircle
            v-if="busy.pveChallenge && pveSweepableCount > 0"
            :size="16"
            class="spin"
          />
          扫荡
        </button>
        <button
          class="secondary-action compact"
          type="button"
          :disabled="busy.pve || busy.pveChallenge || !pveHasAutoBattleTarget"
          @click="autoBattlePve"
        >
          <LoaderCircle
            v-if="busy.pveChallenge && pveHasAutoBattleTarget"
            :size="16"
            class="spin"
          />
          <Swords v-else :size="16" />
          自动
        </button>
        <button
          class="secondary-action compact"
          type="button"
          :disabled="busy.pve || busy.pveRecords"
          @click="refreshPve"
        >
          <RefreshCw
            :size="16"
            :class="{ spin: busy.pve || busy.pveRecords }"
          />
          刷新
        </button>
      </div>
    </div>

    <div v-if="!isAuthed" class="empty-state">
      <UserRound :size="30" />
      <strong>登录后挑战关卡</strong>
      <span>配置阵容后挑战</span>
    </div>
    <div v-else-if="busy.pve && !pveOverview" class="skeleton-grid">
      <span v-for="item in 4" :key="item"></span>
    </div>
    <template v-else>
      <div class="pve-summary">
        <article>
          <small>阵容战力</small>
          <strong>{{ pveFormation.totalPower }}</strong>
        </article>
        <article>
          <small>上阵卡片</small>
          <strong
            >{{ pveFormation.filledCount }} /
            {{ pveFormation.slotCount }}</strong
          >
        </article>
        <article>
          <small>开放关卡</small>
          <strong>{{ pveStageTotal }}</strong>
        </article>
        <article>
          <small>本页胜场</small>
          <strong>{{ pveClearedCount }}</strong>
        </article>
      </div>

      <div v-if="pveSweepResult" class="pve-sweep-result">
        <strong>扫荡 {{ pveSweepResult.swept }} 关</strong>
        <span>跳过 {{ pveSweepResult.skipped.length }} 关</span>
        <small>批量不限</small>
      </div>

      <div v-if="pveAutoBattleResult" class="pve-sweep-result">
        <strong>自动战斗通关 {{ pveAutoBattleResult.cleared }} 关</strong>
        <span>挑战 {{ pveAutoBattleResult.attempted }} 关</span>
        <small>{{ pveAutoBattleResult.stopReason }}</small>
      </div>

      <div v-if="pveStages.length === 0" class="empty-state">
        <Trophy :size="30" />
        <strong>暂无开放关卡</strong>
        <span>稍后再来查看新的挑战。</span>
      </div>
      <div v-else class="pve-stage-grid">
        <article
          v-for="stage in pveStages"
          :key="stage.id"
          class="pve-stage-card"
          :class="{
            'battle-active':
              pveBattleStageId === stage.id && pveBattlePhase === 'fighting',
            'battle-result':
              pveBattleStageId === stage.id && pveBattlePhase === 'result',
            'battle-success':
              pveBattleStageId === stage.id && pveBattleResult?.success,
            'battle-failure':
              pveBattleStageId === stage.id &&
              pveBattleResult?.success === false,
          }"
        >
          <header>
            <span>{{
              bossLabel(stage.bossType, stage.bossName) ||
              (stage.cleared ? "已通关" : pveStageLevelLabel(stage))
            }}</span>
            <b>{{ stage.remainingAttempts }}/{{ stage.dailyLimit }} 次</b>
          </header>
          <h3>{{ stage.name }}</h3>
          <p>
            {{
              stage.description ||
              `第${stage.chapter || 1}章-${stage.stageNo || 1}`
            }}
          </p>
          <div
            v-if="stage.traitLabels?.length || stage.bestStars"
            class="pve-trait-row"
          >
            <span v-for="label in stage.traitLabels || []" :key="label">
              {{ label }}
            </span>
            <span v-if="stage.bestStars">{{ pveStars(stage.bestStars) }}</span>
          </div>

          <div
            class="pve-power-meter"
            :style="{ '--progress': `${pvePowerPercent(stage)}%` }"
          >
            <div>
              <span>我方 {{ pveFormation.totalPower }}</span>
              <span>敌方 {{ stage.enemyPower }}</span>
            </div>
            <i></i>
          </div>

          <div
            v-if="pveBattleStageId === stage.id && pveBattlePhase !== 'idle'"
            class="pve-battle-overlay"
            :class="{
              fighting: pveBattlePhase === 'fighting',
              result: pveBattlePhase === 'result',
              success: pveBattleResult?.success,
              failure: pveBattleResult?.success === false,
            }"
            aria-live="polite"
          >
            <div
              class="pve-battle-board"
              :class="{
                fighting: pveBattlePhase === 'fighting',
                success: pveBattleResult?.success,
                failure: pveBattleResult?.success === false,
              }"
            >
              <div class="pve-battle-side player">
                <span>我方</span>
                <strong>{{ pveFormation.totalPower }}</strong>
                <em class="pve-battle-hp" aria-hidden="true">
                  <i
                    :class="{
                      draining: pveBattlePlayerHpDraining(stage),
                    }"
                    :style="{
                      width: `${pveBattlePlayerHpPercent(stage)}%`,
                    }"
                  ></i>
                </em>
              </div>
              <div class="pve-battle-core">
                <i></i>
                <b>战</b>
              </div>
              <div class="pve-battle-side enemy">
                <span>敌方</span>
                <strong>{{ stage.enemyPower }}</strong>
                <em class="pve-battle-hp" aria-hidden="true">
                  <i
                    :class="{
                      draining: pveBattleEnemyHpDraining(stage),
                    }"
                    :style="{
                      width: `${pveBattleEnemyHpPercent(stage)}%`,
                    }"
                  ></i>
                </em>
              </div>
            </div>

            <div
              v-if="pveBattlePhase === 'result' && pveBattleResult"
              class="pve-battle-result"
              :class="{
                success: pveBattleResult.success,
                failure: !pveBattleResult.success,
              }"
            >
              <strong>{{ pveBattleResult.success ? "胜利" : "失败" }}</strong>
              <span
                >战力 {{ pveBattleResult.formationPower }} /
                {{ pveBattleResult.enemyPower }}</span
              >
              <small>{{
                pveBattleResult.success
                  ? `${pveStars(pveBattleResult.stars)} ${pveBattleRewardText(
                      pveBattleResult.rewards,
                    )}`
                  : "未获奖励"
              }}</small>
              <small v-if="pveBattleResult.battleReport">
                {{ pveBattleResult.battleReport.rounds }}回合
              </small>
              <small v-if="pveBattleResult.starRewards">
                星级 {{ formatRewards(pveBattleResult.starRewards) }}
              </small>
            </div>
          </div>

          <dl class="pve-stage-meta">
            <div>
              <dt>推荐战力</dt>
              <dd>{{ stage.recommendedPower }}</dd>
            </div>
            <div>
              <dt>星级</dt>
              <dd>
                {{ stage.bestStars ? pveStars(stage.bestStars) : "未获" }}
              </dd>
            </div>
            <div>
              <dt>首通</dt>
              <dd>
                {{ formatRewards(stage.firstClearRewards || stage.rewards) }}
              </dd>
            </div>
            <div>
              <dt>重复</dt>
              <dd>{{ formatRewards(stage.repeatRewards) }}</dd>
            </div>
          </dl>

          <button
            class="primary-action wide"
            type="button"
            :disabled="busy.pveChallenge || !stage.canChallenge"
            @click="challengePveStage(stage)"
          >
            <LoaderCircle
              v-if="
                pveBattleStageId === stage.id && pveBattlePhase === 'fighting'
              "
              :size="17"
              class="spin"
            />
            <Swords v-else :size="17" />
            {{
              pveBattleStageId === stage.id && pveBattlePhase === "fighting"
                ? "交锋"
                : stage.canChallenge
                  ? "挑战"
                  : stage.unavailableReason || "不可挑战"
            }}
          </button>
        </article>
      </div>
      <div v-if="pveOverview && pveStageTotalPages > 1" class="pager">
        <button
          class="secondary-action compact"
          type="button"
          :disabled="pveStagePage <= 1 || busy.pve"
          @click="changePveStagePage(-1)"
        >
          <ChevronLeft :size="15" />
          上一页
        </button>
        <span>第 {{ pveStagePage }} / {{ pveStageTotalPages }} 页</span>
        <button
          class="secondary-action compact"
          type="button"
          :disabled="pveStagePage >= pveStageTotalPages || busy.pve"
          @click="changePveStagePage(1)"
        >
          下一页
          <ChevronRight :size="15" />
        </button>
      </div>

      <div class="pve-record-panel">
        <div class="section-subhead">
          <div>
            <p class="eyebrow">挑战记录</p>
            <h3>最近结算</h3>
          </div>
          <button
            class="secondary-action compact"
            type="button"
            :disabled="busy.pveRecords"
            @click="loadPveRecords(1)"
          >
            <RefreshCw :size="15" :class="{ spin: busy.pveRecords }" />
            更新
          </button>
        </div>
        <div v-if="busy.pveRecords && !pveRecords" class="skeleton-grid">
          <span v-for="item in 3" :key="item"></span>
        </div>
        <div v-else-if="pveRecentRecords.length === 0" class="empty-mini">
          暂无挑战记录
        </div>
        <div v-else class="pve-record-list">
          <article
            v-for="record in pveRecentRecords"
            :key="record.id"
            :class="{ success: record.success }"
          >
            <div>
              <strong>{{ record.stageName }}</strong>
              <span
                >{{ pveRecordModeLabel(record) }} ·
                {{ formatDate(record.createdAt) }}</span
              >
            </div>
            <small
              >战力 {{ record.formationPower }} / {{ record.enemyPower }}</small
            >
            <small>{{ record.stars ? pveStars(record.stars) : "无星" }}</small>
            <b>{{
              record.success
                ? formatRewards(record.rewards || undefined)
                : "未获得奖励"
            }}</b>
          </article>
        </div>
        <div v-if="pveRecords" class="pager">
          <button
            class="secondary-action compact"
            type="button"
            :disabled="pveRecordPage <= 1 || busy.pveRecords"
            @click="changePveRecordPage(-1)"
          >
            <ChevronLeft :size="15" />
            上一页
          </button>
          <span>第 {{ pveRecordPage }} / {{ pveRecordTotalPages }} 页</span>
          <button
            class="secondary-action compact"
            type="button"
            :disabled="pveRecordPage >= pveRecordTotalPages || busy.pveRecords"
            @click="changePveRecordPage(1)"
          >
            下一页
            <ChevronRight :size="15" />
          </button>
        </div>
      </div>
    </template>
  </section>
</template>
