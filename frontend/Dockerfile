FROM node:18-alpine as build

WORKDIR /app

# Копируем package.json и package-lock.json для лучшего кэширования
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci --only=production=false

# Копируем конфигурационные файлы
COPY vite.config.ts ./
COPY tsconfig.json ./
COPY tailwind.config.ts ./
COPY postcss.config.js ./
COPY components.json ./
COPY index.html ./

# Копируем исходный код и shared схемы
COPY src/ ./src/
COPY shared/ ./shared/

# Собираем проект
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
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