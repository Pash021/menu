import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => {
  // Flask in this repo runs on https://127.0.0.1:81 by default (see app.py)
  // Override if needed: VITE_BACKEND_ORIGIN=http://127.0.0.1:5000
  const backendOrigin = process.env.VITE_BACKEND_ORIGIN || "https://127.0.0.1:81";
  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: backendOrigin,
          changeOrigin: true,
          secure: false,
        },
        "/uploads": {
          target: backendOrigin,
          changeOrigin: true,
          secure: false,
        },
        "/static": {
          target: backendOrigin,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    base: command === "build" ? "/static/react/" : "/",
    build: {
      outDir: path.resolve(__dirname, "../static/react"),
      emptyOutDir: true,
    },
  };
});
