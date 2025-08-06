import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    // Убираем replit-специфичные плагины для продакшена
    ...(process.env.NODE_ENV === "development" && process.env.REPL_ID
      ? [
          // Эти плагины только для replit разработки
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"), // Исправлено для новой структуры
    },
  },
  // Убираем root, так как теперь мы в папке frontend
  build: {
    outDir: "dist", // Исправлено - относительный путь
    emptyOutDir: true,
    sourcemap: false,
    minify: "terser",
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});