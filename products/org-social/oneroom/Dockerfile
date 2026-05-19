FROM node:20-bookworm-slim AS builder
WORKDIR /repo
COPY scripts/docker-build-errors-package.sh /tmp/docker-build-errors-package.sh

COPY packages/errors ./packages/errors
RUN sh /tmp/docker-build-errors-package.sh

COPY products/org-social/oneroom ./products/org-social/oneroom

WORKDIR /repo/products/org-social/oneroom
RUN npm ci --no-audit --no-fund
RUN rm -rf node_modules/@216labs \
  && mkdir -p node_modules/@216labs \
  && cp -a /repo/packages/errors node_modules/@216labs/errors
ENV NODE_OPTIONS=--max-old-space-size=6144
RUN npm run build

FROM node:20-bookworm-slim
WORKDIR /app
COPY --from=builder /repo/products/org-social/oneroom/.next/standalone ./
COPY --from=builder /repo/products/org-social/oneroom/.next/static ./.next/static
RUN mkdir -p ./public
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
