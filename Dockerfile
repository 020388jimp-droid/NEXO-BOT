# Imagen mínima: el bot solo necesita Node, sin FFmpeg ni navegadores.
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# Las dependencias primero para aprovechar la caché de capas.
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
COPY public ./public

# Cloud Run recomienda ejecutar sin root.
RUN addgroup -S nexo && adduser -S nexo -G nexo && chown -R nexo:nexo /app
USER nexo

ENV PORT=8080
EXPOSE 8080

CMD ["node", "src/server.js"]
