export type NewCardMarkerTarget = {
  uuid?: string | null;
  userCardUuid?: string | null;
  cardId?: number | string | null;
  cardName?: string | null;
  cardLevel?: string | null;
  rarity?: string | null;
  poolId?: number | string | null;
  obtainedAt?: string | null;
  latestObtainedAt?: string | null;
};

const NEW_CARD_WINDOW_MS = 48 * 60 * 60 * 1000;
const NEW_CARD_FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

export function isRecentCardTime(value?: string | null) {
  if (!value) {
    return false;
  }
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) {
    return false;
  }
  const age = Date.now() - time;
  return age >= -NEW_CARD_FUTURE_TOLERANCE_MS && age <= NEW_CARD_WINDOW_MS;
}

export function newCardSeenKey(card?: NewCardMarkerTarget) {
  if (!card) {
    return "";
  }
  const uuid = String(card.uuid || card.userCardUuid || "").trim();
  if (uuid) {
    return `uuid:${uuid}`;
  }
  const obtainedAt = String(card.latestObtainedAt || card.obtainedAt || "").trim();
  if (!obtainedAt) {
    return "";
  }
  return [
    "group",
    card.poolId || "",
    card.cardId || card.cardName || "",
    card.cardLevel || card.rarity || "",
    obtainedAt,
  ].join(":");
}
