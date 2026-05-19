FROM node:20-alpine AS builder
WORKDIR /repo
COPY scripts/docker-build-errors-package.sh /tmp/docker-build-errors-package.sh

COPY packages/errors ./packages/errors
RUN sh /tmp/docker-build-errors-package.sh

COPY products/org-lifestyle/food/tortellini ./products/org-lifestyle/food/tortellini

WORKDIR /repo/products/org-lifestyle/food/tortellini
RUN npm install --no-audit --no-fund
RUN rm -rf node_modules/@216labs \
  && mkdir -p node_modules/@216labs \
  && cp -a /repo/packages/errors node_modules/@216labs/errors
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /repo/products/org-lifestyle/food/tortellini/.next/standalone ./
COPY --from=builder /repo/products/org-lifestyle/food/tortellini/.next/static ./.next/static
COPY --from=builder /repo/products/org-lifestyle/food/tortellini/public ./public
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
