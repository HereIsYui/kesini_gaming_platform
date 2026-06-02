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
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }
          const normalized = id.replace(/\\/g, "/");
          if (
            normalized.includes("/node_modules/vue/") ||
            normalized.includes("/node_modules/@vue/")
          ) {
            return "vendor-vue";
          }
          if (normalized.includes("/node_modules/@element-plus/icons-vue/")) {
            return "vendor-icons";
          }
          if (normalized.includes("/node_modules/dayjs/")) {
            return "vendor-dayjs";
          }
          return "vendor";
        },
      },
    },
  },
  envPrefix: ["VITE_", "PUBLIC_"],
  server: {
    port: 7003,
  },
  preview: {
    port: 7003,
  },
});
