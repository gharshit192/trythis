FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm install --legacy-peer-deps
COPY backend/src ./src
COPY backend/.env* ./
EXPOSE 4000
CMD ["node", "src/server.js"]
