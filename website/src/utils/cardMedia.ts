import { getApiBase } from "../api";

export function cardMediaUrl(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  if (/^(https?:|data:|blob:)/i.test(raw)) {
    return raw;
  }
  return `${getApiBase()}${raw.startsWith("/") ? raw : `/${raw}`}`;
}

export function isCardVideo(value?: string | null) {
  return /\.(mp4|webm)(?:[?#]|$)/i.test(String(value || "").trim());
}

export function hasCardMedia(value?: string | null) {
  return Boolean(cardMediaUrl(value));
}

export function hideBrokenCardMedia(event: Event) {
  const media = event.target as HTMLImageElement | HTMLVideoElement | null;
  if (media) {
    media.hidden = true;
    media.closest(".card-media-frame")?.classList.remove("has-media");
  }
}
