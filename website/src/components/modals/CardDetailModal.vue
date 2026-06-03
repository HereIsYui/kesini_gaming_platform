<script setup lang="ts">
import {
  cardMediaUrl,
  hasCardMedia,
  hideBrokenCardMedia,
  isCardVideo,
} from "../../utils/cardMedia";
import { rarityClass } from "../../utils/rarity";
import type { CardDetailAction, CardIntroTarget } from "./types";

const props = defineProps<{
  target: CardIntroTarget | null;
}>();

const emit = defineEmits<{
  close: [];
  action: [action: CardDetailAction];
}>();

function actionClass(action: CardDetailAction) {
  return action.variant === "primary" ? "primary-action" : "secondary-action";
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.target"
      class="result-modal-backdrop"
      role="presentation"
      @click.self="emit('close')"
    >
      <section
        class="trade-listing-modal card-intro-modal"
        role="dialog"
        aria-modal="true"
        aria-label="卡片详情"
      >
        <header class="result-modal-head">
          <div>
            <p class="eyebrow">卡片详情</p>
            <h2>{{ props.target.name }}</h2>
            <span>
              {{
                [props.target.rarity, props.target.type, props.target.extra]
                  .filter(Boolean)
                  .join(" · ")
              }}
            </span>
          </div>
          <button class="modal-close" type="button" @click="emit('close')">
            关闭
          </button>
        </header>
        <div class="trade-listing-body card-intro-body card-detail-body">
          <div
            class="card-detail-preview"
            :class="rarityClass(props.target.rarity || '')"
          >
            <div
              class="card-media-frame"
              :class="{ 'has-media': hasCardMedia(props.target.cardImage) }"
            >
              <video
                v-if="isCardVideo(props.target.cardImage)"
                class="card-art-media"
                :src="cardMediaUrl(props.target.cardImage)"
                muted
                loop
                autoplay
                playsinline
                @error="hideBrokenCardMedia"
              />
              <img
                v-else-if="cardMediaUrl(props.target.cardImage)"
                class="card-art-media"
                :src="cardMediaUrl(props.target.cardImage)"
                :alt="props.target.name"
                @error="hideBrokenCardMedia"
              />
              <div class="card-sigil"></div>
              <div class="result-card-top">
                <span v-if="props.target.rarity" class="rarity-badge">
                  {{ props.target.rarity }}
                </span>
                <span v-if="props.target.type" class="card-type-pill">
                  {{ props.target.type }}
                </span>
              </div>
            </div>
          </div>
          <div class="card-detail-info">
            <p>{{ props.target.desc }}</p>
            <dl v-if="props.target.rows.length" class="card-detail-meta">
              <div v-for="row in props.target.rows" :key="row.label">
                <dt>{{ row.label }}</dt>
                <dd>{{ row.value }}</dd>
              </div>
            </dl>
          </div>
        </div>
        <footer
          v-if="props.target.actions.length"
          class="result-modal-actions card-detail-actions"
        >
          <button
            v-for="action in props.target.actions"
            :key="action.key"
            :class="actionClass(action)"
            type="button"
            :disabled="action.disabled"
            @click="emit('action', action)"
          >
            <component :is="action.icon" :size="16" />
            {{ action.label }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
