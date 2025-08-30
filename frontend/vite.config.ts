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
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    
    // Оптимизации для уменьшения потребления памяти
    minify: "esbuild",
    target: 'es2015',
    chunkSizeWarningLimit: 1000,
    
    rollupOptions: {
      // Ограничиваем параллельные операции для стабильности
      maxParallelFileOps: 1,
      
      output: {
        // Разделяем большие библиотеки в отдельные chunks для уменьшения нагрузки на память
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            // Группируем vendor библиотеки
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            if (id.includes('@radix-ui')) {
              return 'ui-vendor';
            }
            if (id.includes('framer-motion')) {
              return 'animation-vendor';
            }
            if (id.includes('@tanstack') || id.includes('react-query')) {
              return 'query-vendor';
            }
            return 'vendor';
          }
        },
        
        // Оптимизируем имена файлов
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
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
    exclude: ['@esbuild-kit/esm-loader', '@esbuild-kit/core-utils']
  },
  
  // Дополнительные оптимизации для памяти
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' }
  }
});