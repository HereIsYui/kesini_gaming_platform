export {};

declare global {
  interface Window {
    __KESINI_CONFIG__?: {
      API_BASE?: string;
    };
  }
}
