import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // Bind-mounted volumes (Docker Desktop on Windows) can miss native
    // filesystem change events, so hot reload silently stops working.
    // Polling guarantees Vite actually notices edits made from the host.
    watch: {
      usePolling: true,
      interval: 300,
    },
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET ?? "http://backend:3000",
        changeOrigin: true,
      },
    },
  },
});
