# =====================
# Stage 1 — Build
# =====================
FROM node:18-alpine AS build

# Устанавливаем необходимые системные зависимости
RUN apk add --no-cache python3 make g++ git

# Параметры для Node и Vite
ENV NODE_OPTIONS="--max-old-space-size=2048"
ENV ESBUILD_WORKER_THREADS=2
ENV VITE_THREADS=2

# Настройки npm для стабильности
ENV NPM_CONFIG_REGISTRY=https://registry.npmjs.org/
ENV NPM_CONFIG_FETCH_TIMEOUT=300000
ENV NPM_CONFIG_FETCH_RETRIES=3
ENV NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=10000
ENV NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=60000

WORKDIR /app

# Копируем package.json и package-lock.json отдельно для кеширования зависимостей
COPY package*.json ./

# Очищаем npm кеш и устанавливаем зависимости
RUN npm cache clean --force && \
    npm ci --only=production --no-audit --no-fund --prefer-offline

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

# Создаем конфиг nginx для SPA
RUN cat > /etc/nginx/conf.d/default.conf << 'EOF'
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    
    # Static assets caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
    
    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache";
    }
    
    # Health check
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]