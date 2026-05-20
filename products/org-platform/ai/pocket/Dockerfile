FROM node:20-alpine AS builder
WORKDIR /repo
COPY scripts/docker-build-errors-package.sh /tmp/docker-build-errors-package.sh

COPY packages/errors ./packages/errors
RUN sh /tmp/docker-build-errors-package.sh

WORKDIR /repo
COPY products/org-platform/ai/pocket ./products/org-platform/ai/pocket

WORKDIR /repo/products/org-platform/ai/pocket
RUN npm install --no-audit --no-fund
RUN rm -rf node_modules/@216labs \
  && mkdir -p node_modules/@216labs \
  && cp -a /repo/packages/errors node_modules/@216labs/errors
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
RUN npm prune --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /repo/products/org-platform/ai/pocket/package.json ./
COPY --from=builder /repo/products/org-platform/ai/pocket/server.js ./
COPY --from=builder /repo/products/org-platform/ai/pocket/next.config.js ./
COPY --from=builder /repo/products/org-platform/ai/pocket/node_modules ./node_modules
COPY --from=builder /repo/products/org-platform/ai/pocket/.next ./.next
COPY --from=builder /repo/products/org-platform/ai/pocket/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
