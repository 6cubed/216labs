FROM node:20-alpine AS builder
WORKDIR /repo
COPY scripts/docker-build-errors-package.sh /tmp/docker-build-errors-package.sh

COPY packages/errors ./packages/errors
RUN sh /tmp/docker-build-errors-package.sh

WORKDIR /repo
COPY products/org-lifestyle/play/tigertank ./products/org-lifestyle/play/tigertank

WORKDIR /repo/products/org-lifestyle/play/tigertank
RUN npm install --no-audit --no-fund
RUN rm -rf node_modules/@216labs \
  && mkdir -p node_modules/@216labs \
  && cp -a /repo/packages/errors node_modules/@216labs/errors
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=4096
# Avoid reusing a stale .next from BuildKit cache when only posts/content changed.
RUN rm -rf .next && npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /repo/products/org-lifestyle/play/tigertank/.next/standalone ./
COPY --from=builder /repo/products/org-lifestyle/play/tigertank/.next/static ./.next/static
COPY --from=builder /repo/products/org-lifestyle/play/tigertank/public ./public
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
EXPOSE 3000
CMD ["node", "server.js"]
