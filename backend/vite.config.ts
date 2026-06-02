import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
) as { version?: string };
const appVersion = packageJson.version || "0.0.0";

export default defineConfig({
  plugins: [vue()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  envPrefix: ["VITE_", "PUBLIC_"],
  server: {
    port: 7003,
  },
  preview: {
    port: 7003,
  },
});
