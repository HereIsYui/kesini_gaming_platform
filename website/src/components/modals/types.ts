import type { Component } from "vue";

export type CardDetailRow = {
  label: string;
  value: string;
};

export type CardDetailActionKey =
  | "lock"
  | "upgrade"
  | "reroll"
  | "star"
  | "trade"
  | "recycle"
  | "share"
  | "buy"
  | "synthesize";

export type CardDetailAction = {
  key: CardDetailActionKey;
  label: string;
  icon: Component;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  payload?: unknown;
};

export type CardSharePayload = {
  cardName: string;
  cardDesc?: string | null;
  cardLevel?: string;
  rarity?: string;
  poolId?: number;
};

export type CardIntroTarget = {
  name: string;
  desc: string;
  rarity?: string;
  type?: string;
  extra?: string;
  cardImage?: string | null;
  rows: CardDetailRow[];
  actions: CardDetailAction[];
};

export type CardDetailNavigation = {
  visible: boolean;
  canPrev: boolean;
  canNext: boolean;
  label: string;
};

export type CardDetailInput = {
  name: string;
  desc?: string | null;
  rarity?: string | number | null;
  type?: string | null;
  extra?: string | null;
  cardImage?: string | null;
  poolId?: number | string | null;
  poolName?: string | null;
  obtainedAt?: string | null;
  latestObtainedAt?: string | null;
  cultivationLevel?: number | null;
  starLevel?: number | null;
  starMaxLevel?: number | null;
  power?: number | null;
  locked?: boolean;
  listed?: boolean;
  count?: number | null;
  price?: number | null;
  source?: string;
  statuses?: string[];
  rows?: CardDetailRow[];
  actions?: CardDetailAction[];
};

export type ConfirmDialogVariant = "primary" | "danger";

export type ConfirmDialogTarget = {
  title: string;
  message?: string;
  details?: string[];
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmDialogVariant;
  icon?: Component;
};
