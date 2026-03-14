# Build for linux/amd64 so native better-sqlite3 runs on typical droplets when built from Mac.
FROM --platform=linux/amd64 node:20-alpine
WORKDIR /app
RUN apk add --no-cache python3 make g++ && rm -rf /var/cache/apk/*
COPY package.json package-lock.json* ./
RUN npm ci --only=production
COPY . .
ENV NODE_ENV=production
ENV DATABASE_PATH=/app/216labs.db
CMD ["node", "index.js"]
