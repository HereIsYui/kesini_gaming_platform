<script setup lang="ts">
import type { Announcement } from "../../types";
import { formatDate } from "../../utils/format";

const props = defineProps<{
  open: boolean;
  announcements: Announcement[];
  selected: Announcement | null;
  summary: (content: string) => string;
  isRead: (item: Announcement) => boolean;
}>();

const emit = defineEmits<{
  close: [];
  select: [item: Announcement];
  back: [];
  hide: [item: Announcement];
}>();
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.open"
      class="result-modal-backdrop"
      role="presentation"
      @click.self="emit('close')"
    >
      <section
        class="announcement-modal"
        role="dialog"
        aria-modal="true"
        aria-label="公告"
      >
        <header class="result-modal-head">
          <div>
            <p class="eyebrow">公告</p>
            <h2>{{ props.selected?.title || "公告" }}</h2>
            <span v-if="props.selected">
              {{ props.selected.active !== false ? "进行中" : "已归档" }}
              · {{ formatDate(props.selected.createdAt) }}
            </span>
            <span v-else>{{ props.announcements.length }} 条</span>
          </div>
          <button class="modal-close" type="button" @click="emit('close')">
            关闭
          </button>
        </header>

        <div class="announcement-modal-body">
          <article v-if="props.selected" class="announcement-detail-card">
            <p>{{ props.selected.content }}</p>
            <dl>
              <div>
                <dt>时间</dt>
                <dd>
                  {{ formatDate(props.selected.startsAt) }} 至
                  {{ formatDate(props.selected.endsAt) }}
                </dd>
              </div>
              <div>
                <dt>状态</dt>
                <dd>
                  {{ props.selected.active !== false ? "进行中" : "已归档" }}
                </dd>
              </div>
            </dl>
          </article>
          <div v-else class="announcement-list">
            <button
              v-for="item in props.announcements"
              :key="item.id"
              class="announcement-list-item"
              :class="{ read: props.isRead(item) }"
              type="button"
              @click="emit('select', item)"
            >
              <span class="announcement-status">
                {{ item.active !== false ? "进行中" : "已归档" }}
              </span>
              <strong>{{ item.title }}</strong>
              <span>{{ props.summary(item.content) }}</span>
              <small>{{ props.isRead(item) ? "已读" : "未读" }}</small>
            </button>
          </div>
        </div>

        <footer class="result-modal-actions">
          <button
            v-if="props.selected"
            class="secondary-action"
            type="button"
            @click="emit('back')"
          >
            返回
          </button>
          <button
            v-if="props.selected"
            class="secondary-action"
            type="button"
            @click="emit('hide', props.selected)"
          >
            隐藏
          </button>
          <button class="primary-action" type="button" @click="emit('close')">
            关闭
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
