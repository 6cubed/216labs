FROM node:20-alpine AS builder
WORKDIR /repo
COPY scripts/docker-build-errors-package.sh /tmp/docker-build-errors-package.sh

COPY packages/errors ./packages/errors
COPY packages/ui ./packages/ui
RUN sh /tmp/docker-build-errors-package.sh

WORKDIR /repo/packages/ui
RUN npm install --no-audit --no-fund

COPY products/org-platform/ai/hivefind ./products/org-platform/ai/hivefind

WORKDIR /repo/products/org-platform/ai/hivefind
RUN npm install --no-audit --no-fund
RUN rm -rf node_modules/@216labs \
  && mkdir -p node_modules/@216labs \
  && cp -a /repo/packages/errors node_modules/@216labs/errors \
  && cp -a /repo/packages/ui node_modules/@216labs/ui
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /repo/products/org-platform/ai/hivefind/.next/standalone ./
COPY --from=builder /repo/products/org-platform/ai/hivefind/.next/static ./.next/static
COPY --from=builder /repo/products/org-platform/ai/hivefind/public ./public
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
