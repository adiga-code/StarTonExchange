# Стадия сборки
FROM node:18-alpine as build

# Копируем package.json и package-lock.json в рабочую директорию
# Это позволяет npm устанавливать точные версии зависимостей,
# обеспечивая детерминированную сборку.
COPY package.json package-lock.json ./

# Устанавливаем зависимости npm
# --no-cache-dir: Отключает кэширование пакетов npm, уменьшая размер образа.
RUN npm install

# Копируем остальное содержимое проекта
COPY . .

# Запускаем команду сборки фронтенд-проекта
RUN npm run build

# Продакшн стадия с nginx
FROM nginx:stable-alpine

# Копируем собранные файлы фронтенда в директорию Nginx
COPY --from=build /app/dist /usr/share/nginx/html
# Копируем конфигурацию Nginx
COPY --from=build /app/nginx.conf /etc/nginx/conf.d/default.conf

# Открываем порт 3000 (убедитесь, что это тот порт, который вы хотите использовать)
EXPOSE 3000
# Команда для запуска Nginx в фоновом режиме
CMD [ "nginx", "-g", "daemon off;" ]
