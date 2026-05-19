FROM node:20-alpine AS builder
WORKDIR /repo
COPY scripts/docker-build-errors-package.sh /tmp/docker-build-errors-package.sh

# Copy only what this app needs from the monorepo (local file dependency + app).
COPY packages/errors ./packages/errors
RUN sh /tmp/docker-build-errors-package.sh

COPY products/org-platform/ai/webgputrainer ./products/org-platform/ai/webgputrainer

WORKDIR /repo/products/org-platform/ai/webgputrainer
RUN npm ci \
  && rm -rf node_modules/@216labs \
  && mkdir -p node_modules/@216labs \
  && cp -a /repo/packages/errors node_modules/@216labs/errors
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /repo/products/org-platform/ai/webgputrainer/.next/standalone ./
COPY --from=builder /repo/products/org-platform/ai/webgputrainer/.next/static ./.next/static
COPY --from=builder /repo/products/org-platform/ai/webgputrainer/public ./public
EXPOSE 3000
CMD ["node", "server.js"]

