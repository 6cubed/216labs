FROM node:20-bookworm-slim AS builder
WORKDIR /repo
COPY scripts/docker-build-errors-package.sh /tmp/docker-build-errors-package.sh

COPY packages/errors ./packages/errors
RUN sh /tmp/docker-build-errors-package.sh

COPY products/org-shopping/onefit ./products/org-shopping/onefit

WORKDIR /repo/products/org-shopping/onefit
RUN npm ci --no-audit --no-fund
ENV NODE_OPTIONS=--max-old-space-size=6144
RUN npm install \
  && rm -rf node_modules/@216labs \
  && mkdir -p node_modules/@216labs \
  && cp -a /repo/packages/errors node_modules/@216labs/errors
RUN npm run build

FROM node:20-bookworm-slim
WORKDIR /app
COPY --from=builder /repo/products/org-shopping/onefit/.next/standalone ./
COPY --from=builder /repo/products/org-shopping/onefit/.next/static ./.next/static
# public/ is optional for this app
RUN mkdir -p ./public
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
