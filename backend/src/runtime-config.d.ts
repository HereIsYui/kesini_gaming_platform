export {};

declare global {
  interface ImportMetaEnv {
    readonly PUBLIC_API_BASE?: string;
    readonly VITE_API_BASE?: string;
    readonly DEV?: boolean;
    readonly PROD?: boolean;
    readonly MODE?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }

  interface Window {
    __KESINI_CONFIG__?: {
      API_BASE?: string;
    };
  }
}
