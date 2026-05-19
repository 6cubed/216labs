FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /repo
COPY scripts/verify-errors-node-runtime.sh /tmp/verify-errors-node-runtime.sh
COPY scripts/docker-build-errors-package.sh /tmp/docker-build-errors-package.sh

COPY packages/errors ./packages/errors
RUN sh /tmp/docker-build-errors-package.sh

WORKDIR /repo
COPY products/org-media/RamblingRadio ./products/org-media/RamblingRadio

WORKDIR /repo/products/org-media/RamblingRadio
RUN npm install \
  && rm -rf node_modules/@216labs \
  && mkdir -p node_modules/@216labs \
  && cp -a /repo/packages/errors node_modules/@216labs/errors
ENV NODE_ENV=production
RUN npm run build \
  && sh /tmp/verify-errors-node-runtime.sh .

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /repo/products/org-media/RamblingRadio/dist ./dist
COPY --from=builder /repo/products/org-media/RamblingRadio/node_modules ./node_modules
COPY --from=builder /repo/products/org-media/RamblingRadio/package.json ./package.json
ENV NODE_ENV=production
EXPOSE 5000
CMD ["node", "dist/index.cjs"]
