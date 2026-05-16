import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";

export default defineConfig({
  plugins: [pluginReact()],
  html: {
    title: "Kesini 后台管理",
  },
  source: {
    entry: {
      index: "./src/main.tsx",
    },
  },
  server: {
    port: 5173,
  },
});
