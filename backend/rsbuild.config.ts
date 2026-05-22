import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";

export default defineConfig({
  plugins: [pluginReact()],
  html: {
    title: "Kesini 后台管理",
    tags: [
      {
        tag: "script",
        attrs: { src: "/config.js" },
        publicPath: false,
        append: false,
        head: false,
      },
    ],
  },
  source: {
    entry: {
      index: "./src/main.tsx",
    },
  },
  server: {
    port: 7001,
  },
});
