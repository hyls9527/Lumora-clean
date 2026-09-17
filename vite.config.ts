import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_"],
  optimizeDeps: {
    exclude: ["@tauri-apps/api", "@tauri-apps/plugin-dialog", "@tauri-apps/plugin-store", "@tauri-apps/plugin-fs"],
  },
  build: {
    target: ["es2021", "chrome100", "safari13"],
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    rollupOptions: {
      // The standalone measurement page (perf harness) is a dev tool, not a
      // shipping asset. It is built only for the perf run (LUMORA_PERF_BUILD=1)
      // so the shipped bundle stays lean while frame timings still come from a
      // real production build.
      input:
        process.env.LUMORA_PERF_BUILD === "1"
          ? { index: "index.html", "perf-harness": "perf-harness.html" }
          : { index: "index.html" },
    },
  },
});
