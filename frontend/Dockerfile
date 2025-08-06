FROM node:18-alpine as build

WORKDIR /app

# Устанавливаем только критически важные пакеты
RUN npm install -g vite@latest

# Создаем минимальный package.json
COPY <<EOF package.json
{
  "name": "frontend",
  "type": "module",
  "scripts": {
    "build": "vite build"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.2",
    "vite": "^5.4.19"
  }
}
EOF

RUN npm install

# Копируем минимальные файлы
COPY vite.config.ts .
COPY index.html .
COPY src/ ./src/

# Собираем
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