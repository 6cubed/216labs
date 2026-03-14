FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++ && rm -rf /var/cache/apk/*
COPY package.json package-lock.json* ./
RUN npm ci --only=production

FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY package.json ./
COPY next.config.js ./
COPY server.js ./
COPY db.js ./
COPY lib/ ./lib/
EXPOSE 3000
ENV CROWDBULK_DB_PATH=/app/data/crowdbulk.db
CMD ["node", "server.js"]
