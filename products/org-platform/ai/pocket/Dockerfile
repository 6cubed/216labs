FROM node:20-alpine AS builder
WORKDIR /repo
COPY scripts/docker-build-errors-package.sh /tmp/docker-build-errors-package.sh

COPY packages/errors ./packages/errors
RUN sh /tmp/docker-build-errors-package.sh

COPY products/org-platform/ai/pocket ./products/org-platform/ai/pocket

WORKDIR /repo/products/org-platform/ai/pocket
RUN npm install --no-audit --no-fund
RUN rm -rf node_modules/@216labs \
  && mkdir -p node_modules/@216labs \
  && cp -a /repo/packages/errors node_modules/@216labs/errors
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS deps
WORKDIR /app
COPY products/org-platform/ai/pocket/package.json products/org-platform/ai/pocket/package-lock.json* ./
RUN npm ci --only=production --no-audit --no-fund

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /repo/products/org-platform/ai/pocket/.next ./.next
COPY --from=builder /repo/products/org-platform/ai/pocket/public ./public
COPY products/org-platform/ai/pocket/package.json products/org-platform/ai/pocket/server.js products/org-platform/ai/pocket/next.config.js ./
EXPOSE 3000
CMD ["node", "server.js"]
