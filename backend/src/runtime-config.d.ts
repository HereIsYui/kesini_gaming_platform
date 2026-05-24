/// <reference types="vite/client" />

export {};

declare global {
  interface ImportMetaEnv {
    readonly PUBLIC_API_BASE?: string;
  }

  interface Window {
    __KESINI_CONFIG__?: {
      API_BASE?: string;
    };
  }
}
