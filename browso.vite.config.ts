import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: {
      "process.env.BROWSO_RENDERER_URL": "process.env.ELECTRON_RENDERER_URL",
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    define: {
      "process.env.BROWSO_RENDERER_URL": "process.env.ELECTRON_RENDERER_URL",
    },
    build: {
      rollupOptions: {
        input: {
          topbar: resolve(__dirname, "src/preload/topbar.ts"),
          sidebar: resolve(__dirname, "src/preload/sidebar.ts"),
          settings: resolve(__dirname, "src/preload/settings.ts"),
        },
      },
    },
  },
  renderer: {
    root: "src/renderer",
    publicDir: resolve("resources"),
    build: {
      rollupOptions: {
        input: {
          topbar: resolve(__dirname, "src/renderer/topbar/index.html"),
          sidebar: resolve(__dirname, "src/renderer/sidebar/index.html"),
          settings: resolve(__dirname, "src/renderer/settings/index.html"),
        },
      },
    },
    resolve: {
      alias: {
        "@renderer": resolve("src/renderer/src"),
        "@common": resolve("src/renderer/common"),
      },
    },
    plugins: [react()],
    server: {
      fs: {
        allow: [".."],
      },
    },
  },
});
