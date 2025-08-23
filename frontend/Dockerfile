# =====================
# Stage 1 — Build
# =====================
FROM node:18-alpine AS build

# Устанавливаем системные зависимости
RUN apk add --no-cache python3 make g++ git

# Оптимизируем параметры для сборки
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV ESBUILD_WORKER_THREADS=1
ENV VITE_THREADS=1
ENV CI=true

# Настройки npm для максимальной стабильности
ENV NPM_CONFIG_REGISTRY=https://registry.npmjs.org/
ENV NPM_CONFIG_FETCH_TIMEOUT=600000
ENV NPM_CONFIG_FETCH_RETRIES=5
ENV NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=10000
ENV NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000
ENV NPM_CONFIG_AUDIT=false
ENV NPM_CONFIG_FUND=false
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./

# Устанавливаем зависимости с максимальной отладкой
RUN set -ex && \
    npm cache clean --force && \
    rm -rf node_modules && \
    rm -f package-lock.json && \
    npm install --verbose --no-optional && \
    npm ls

# Копируем остальные файлы
COPY . .

# Собираем проект
RUN npm run build

# =====================
# Stage 2 — Runtime
# =====================
FROM nginx:alpine AS runtime

# Удаляем дефолтный конфиг nginx
RUN rm -rf /etc/nginx/conf.d/default.conf

# Копируем собранный фронтенд
COPY --from=build /app/dist /usr/share/nginx/html

# Создаем оптимизированный конфиг nginx
COPY <<'EOF' /etc/nginx/conf.d/app.conf
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1000;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;
    
    # Static files caching
    location ~* \.(css|js|jpg|jpeg|png|gif|ico|svg|webp|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
        try_files $uri =404;
    }
    
    # API routes (если есть)
    location /api/ {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    # SPA routing - все остальные запросы идут на index.html
    location / {
        try_files $uri $uri/ @fallback;
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }
    
    location @fallback {
        rewrite ^.*$ /index.html last;
    }
    
    # Health check endpoint
    location /health {
        access_log off;
        return 200 "OK";
        add_header Content-Type text/plain;
    }
    
    # Блокируем доступ к служебным файлам
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
}
EOF

# Создаем пользователя nginx для безопасности
RUN addgroup -g 101 -S nginx && \
    adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx

EXPOSE 80

# Проверяем конфиг nginx при старте
CMD ["sh", "-c", "nginx -t && exec nginx -g 'daemon off;'"]