FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /repo

# Monorepo local dependency @216labs/errors + admin app
COPY packages/errors ./packages/errors
COPY internal/admin ./internal/admin

WORKDIR /repo/packages/errors
RUN npm install --omit=dev

WORKDIR /repo/internal/admin
RUN npm install
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /repo/internal/admin/.next/standalone ./
COPY --from=builder /repo/internal/admin/.next/static ./.next/static
COPY --from=builder /repo/internal/admin/public ./public
ENV NODE_ENV=production
ENV DATABASE_PATH=/app/216labs.db
EXPOSE 3000
CMD ["node", "server.js"]
