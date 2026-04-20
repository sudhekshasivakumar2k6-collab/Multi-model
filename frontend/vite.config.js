import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: [react()],

  base: mode === "production" ? "/Multi-Model/" : "/",

  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      "/api": { target: "http://localhost:8000", changeOrigin: true },
      "/health": { target: "http://localhost:8000", changeOrigin: true },
    },
  },

  build: {
    outDir: "dist",
    sourcemap: mode === "development",
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react")) {
              return "vendor-react";
            }
            if (id.includes("axios")) {
              return "vendor-axios";
            }
            return "vendor"; // fallback
          }
        },
      },
    },
  },
}));