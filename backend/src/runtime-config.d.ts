/// <reference types="vite/client" />

export {};

declare global {
  const __APP_VERSION__: string;

  interface ImportMetaEnv {
    readonly PUBLIC_API_BASE?: string;
    readonly PUBLIC_ENABLE_MANUAL_LOGIN?: string;
  }

  interface Window {
    __KESINI_CONFIG__?: {
      API_BASE?: string;
      ENABLE_MANUAL_LOGIN?: boolean | string;
    };
  }
}
