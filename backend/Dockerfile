FROM python:3.11-slim

WORKDIR /app

# Копируем requirements.txt
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем все файлы backend
COPY . .

# Создаем директорию для базы данных
RUN mkdir -p /app/data

# Делаем start.sh исполнимым
RUN chmod +x start.sh

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]