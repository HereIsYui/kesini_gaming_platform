import { inject, type InjectionKey } from "vue";

export type AppContext = Record<string, unknown>;

export const APP_CONTEXT_KEY: InjectionKey<AppContext> = Symbol("AppContext");

export function useAppContext() {
  const context = inject(APP_CONTEXT_KEY);
  if (!context) {
    throw new Error("App context is not available.");
  }
  return context;
}
