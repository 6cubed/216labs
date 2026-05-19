FROM node:20-alpine AS builder
WORKDIR /repo
COPY scripts/docker-build-errors-package.sh /tmp/docker-build-errors-package.sh

COPY packages/errors ./packages/errors
RUN sh /tmp/docker-build-errors-package.sh

COPY products/org-lifestyle/geo/euromaxxers ./products/org-lifestyle/geo/euromaxxers

WORKDIR /repo/products/org-lifestyle/geo/euromaxxers
RUN npm ci
RUN rm -rf node_modules/@216labs \
  && mkdir -p node_modules/@216labs \
  && cp -a /repo/packages/errors node_modules/@216labs/errors
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /repo/products/org-lifestyle/geo/euromaxxers/.next/standalone ./
COPY --from=builder /repo/products/org-lifestyle/geo/euromaxxers/.next/static ./.next/static
COPY --from=builder /repo/products/org-lifestyle/geo/euromaxxers/public ./public
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
