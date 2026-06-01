import { ref } from "vue";

export type FeedbackType = "success" | "error" | "info";

export function useFeedback() {
  const feedback = ref<{ type: FeedbackType; text: string } | null>(null);
  let feedbackTimer: number | undefined;

  function notify(type: FeedbackType, text: string) {
    feedback.value = { type, text };
    window.clearTimeout(feedbackTimer);
    feedbackTimer = window.setTimeout(() => {
      feedback.value = null;
    }, 2600);
  }

  return {
    feedback,
    notify,
  };
}
