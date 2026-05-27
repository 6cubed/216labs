FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /repo

# Monorepo local dependency @216labs/errors + admin app
COPY scripts/docker-build-errors-package.sh /tmp/docker-build-errors-package.sh
COPY packages/errors ./packages/errors
RUN sh /tmp/docker-build-errors-package.sh

COPY internal/admin ./internal/admin

WORKDIR /repo/internal/admin
# Turbopack does not resolve symlinks outside the app tree; copy the workspace package.
RUN npm install \
  && rm -rf node_modules/@216labs \
  && mkdir -p node_modules/@216labs \
  && cp -a /repo/packages/errors node_modules/@216labs/errors
RUN npm run build

FROM node:20-alpine
# Org metrics reads /workspace via PROJECTS_ROOT (deploy bind-mounts repo).
RUN apk add --no-cache git
WORKDIR /app
COPY --from=builder /repo/internal/admin/.next/standalone ./
COPY --from=builder /repo/internal/admin/.next/static ./.next/static
COPY --from=builder /repo/internal/admin/public ./public
ENV NODE_ENV=production
ENV DATABASE_PATH=/app/216labs.db
EXPOSE 3000
CMD ["node", "server.js"]
