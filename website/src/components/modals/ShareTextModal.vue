<script setup lang="ts">
const props = defineProps<{
  text: string;
}>();

const emit = defineEmits<{
  close: [];
  copy: [];
}>();
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.text"
      class="result-modal-backdrop share-modal-backdrop"
      role="presentation"
      @click.self="emit('close')"
    >
      <section
        class="trade-listing-modal share-text-modal"
        role="dialog"
        aria-modal="true"
        aria-label="分享文案"
      >
        <header class="result-modal-head">
          <div>
            <p class="eyebrow">分享</p>
            <h2>分享文案</h2>
          </div>
          <button class="modal-close" type="button" @click="emit('close')">
            关闭
          </button>
        </header>
        <div class="trade-listing-body">
          <textarea
            class="share-textarea"
            readonly
            :value="props.text"
          ></textarea>
        </div>
        <footer class="result-modal-actions">
          <button class="secondary-action" type="button" @click="emit('close')">
            关闭
          </button>
          <button class="primary-action" type="button" @click="emit('copy')">
            复制
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
