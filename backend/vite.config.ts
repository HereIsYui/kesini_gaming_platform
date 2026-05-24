import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  envPrefix: ["VITE_", "PUBLIC_"],
  server: {
    port: 7003,
  },
  preview: {
    port: 7003,
  },
});
