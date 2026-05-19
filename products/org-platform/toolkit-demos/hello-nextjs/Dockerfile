FROM node:20-bookworm-slim AS builder
WORKDIR /repo
COPY scripts/docker-build-errors-package.sh /tmp/docker-build-errors-package.sh

COPY packages/errors ./packages/errors
RUN sh /tmp/docker-build-errors-package.sh

COPY products/org-platform/toolkit-demos/hello-nextjs ./products/org-platform/toolkit-demos/hello-nextjs

WORKDIR /repo/products/org-platform/toolkit-demos/hello-nextjs
RUN npm ci --no-audit --no-fund
RUN npm install \
  && rm -rf node_modules/@216labs \
  && mkdir -p node_modules/@216labs \
  && cp -a /repo/packages/errors node_modules/@216labs/errors
RUN npm run build

FROM node:20-bookworm-slim
WORKDIR /app
COPY --from=builder /repo/products/org-platform/toolkit-demos/hello-nextjs/.next/standalone ./
COPY --from=builder /repo/products/org-platform/toolkit-demos/hello-nextjs/.next/static ./.next/static
COPY --from=builder /repo/products/org-platform/toolkit-demos/hello-nextjs/public ./public
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
