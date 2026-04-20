import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: [react()],

  // GitHub Pages serves the app at /Multi-Model/ — set base in production
  base: mode === "production" ? "/Multi-Model/" : "/",

  server: {
    port: 5173,
    strictPort: false, // fall back to 5174 if 5173 is taken
    proxy: {
      // Proxy API + health to FastAPI during local dev
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
        // Split vendor libraries into a separate chunk for better caching
        manualChunks: {
          vendor: ["react", "react-dom"],
          axios: ["axios"],
        },
      },
    },
  },
}));
