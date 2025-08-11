# =====================
# Stage 1 — Build
# =====================
FROM node:18-alpine AS build

# Параметры для Node и Vite
ENV NODE_OPTIONS="--max-old-space-size=2048"
ENV ESBUILD_WORKER_THREADS=2
ENV VITE_THREADS=2

WORKDIR /app

# Копируем package.json и package-lock.json отдельно для кеширования зависимостей
COPY package*.json ./

# Устанавливаем зависимости (dev + prod, так как это билд-стадия)
RUN npm ci

# Копируем конфиги и исходники
COPY vite.config.ts ./
COPY tsconfig.json ./
COPY tailwind.config.ts ./
COPY postcss.config.js ./
COPY components.json ./
COPY index.html ./
COPY src/ ./src/
COPY shared/ ./shared/

# Собираем проект
RUN npm run build

# =====================
# Stage 2 — Runtime
# =====================
FROM nginx:alpine

# Копируем собранный фронтенд
COPY --from=build /app/dist /usr/share/nginx/html

# Настраиваем nginx для SPA
COPY <<EOF /etc/nginx/conf.d/default.conf
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
