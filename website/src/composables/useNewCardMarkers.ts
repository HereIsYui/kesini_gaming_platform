import { ref } from "vue";
import {
  isRecentCardTime,
  newCardSeenKey,
  type NewCardMarkerTarget,
} from "../utils/newCard";
import { getStoredStringSet, persistStringSet } from "../utils/storage";

const NEW_CARD_SEEN_KEY = "kesini_new_card_seen";

export function useNewCardMarkers() {
  const newCardSeenKeys = ref<Set<string>>(
    getStoredStringSet(NEW_CARD_SEEN_KEY),
  );

  function isNewCard(
    card?: NewCardMarkerTarget,
    options: { ignoreSeen?: boolean } = {},
  ) {
    if (!isRecentCardTime(card?.latestObtainedAt || card?.obtainedAt)) {
      return false;
    }
    const key = newCardSeenKey(card);
    return Boolean(options.ignoreSeen || !key || !newCardSeenKeys.value.has(key));
  }

  function markNewCardSeen(card?: NewCardMarkerTarget) {
    const key = newCardSeenKey(card);
    if (!key || newCardSeenKeys.value.has(key)) {
      return;
    }
    const next = new Set(newCardSeenKeys.value);
    next.add(key);
    newCardSeenKeys.value = next;
    persistStringSet(NEW_CARD_SEEN_KEY, next);
  }

  return {
    newCardSeenKeys,
    isNewCard,
    markNewCardSeen,
  };
}
