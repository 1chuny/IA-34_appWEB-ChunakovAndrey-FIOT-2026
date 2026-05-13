# 1. Беремо легку версію Node.js
FROM node:18-alpine

# 2. Створюємо робочу папку всередині контейнера
WORKDIR /app

# 3. Копіюємо файли з пакетами і встановлюємо їх
COPY package*.json ./
RUN npm install

# 4. Копіюємо весь інший код (server.js тощо)
COPY . .

# 5. Відкриваємо порт 3000
EXPOSE 3000

# 6. Команда для запуску
CMD ["node", "server.js"]