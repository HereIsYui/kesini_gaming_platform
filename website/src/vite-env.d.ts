/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_ENABLE_MANUAL_LOGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  __KESINI_CONFIG__?: {
    API_BASE?: string;
    ENABLE_MANUAL_LOGIN?: boolean | string;
  };
}
