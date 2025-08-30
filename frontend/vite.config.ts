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

    // ИСПРАВЛЕНИЕ: Заменяем terser на esbuild - быстрее и стабильнее
    minify: "esbuild",

    // Добавляем оптимизации для предотвращения зависания
    target: 'es2015',
    chunkSizeWarningLimit: 1000,

    // rollupOptions: {
    //   // Ограничиваем параллельные операции для стабильности
    //   maxParallelFileOps: 1,

    //   output: {
    //     // Разделяем большие библиотеки в отдельные chunks
    //     manualChunks: (id) => {
    //       if (id.includes('node_modules')) {
    //         // Группируем vendor библиотеки
    //         if (id.includes('react') || id.includes('react-dom')) {
    //           return 'react-vendor';
    //         }
    //         if (id.includes('@radix-ui')) {
    //           return 'ui-vendor';
    //         }
    //         return 'vendor';
    //       }
    //     },

    //     // Оптимизируем имена файлов
    //     chunkFileNames: (chunkInfo) => {
    //       const facadeModuleId = chunkInfo.facadeModuleId
    //         ? chunkInfo.facadeModuleId.split('/').pop()
    //         : 'chunk';
    //       return `${facadeModuleId}-[hash].js`;
    //     }
    //   }
    // }
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

  // Оптимизируем предварительную сборку зависимостей
  optimizeDeps: {
    include: ['react', 'react-dom'],
    // Исключаем проблемные пакеты
    exclude: ['@esbuild-kit/esm-loader', '@esbuild-kit/core-utils']
  }
});