FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /repo

COPY packages/errors ./packages/errors
WORKDIR /repo/packages/errors
RUN npm install && npm run build

# Bust stale COPY cache when compose context was sent incrementally (empty app tree).
ARG APP_CONTEXT_BUST=1
COPY products/org-media/RamblingRadio/package.json products/org-media/RamblingRadio/package-lock.json ./products/org-media/RamblingRadio/
COPY products/org-media/RamblingRadio ./products/org-media/RamblingRadio

WORKDIR /repo/products/org-media/RamblingRadio
RUN npm install \
  && rm -rf node_modules/@216labs \
  && mkdir -p node_modules/@216labs \
  && cp -a /repo/packages/errors node_modules/@216labs/errors
ENV NODE_ENV=production
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /repo/products/org-media/RamblingRadio/dist ./dist
COPY --from=builder /repo/products/org-media/RamblingRadio/node_modules ./node_modules
COPY --from=builder /repo/products/org-media/RamblingRadio/package.json ./package.json
ENV NODE_ENV=production
EXPOSE 5000
CMD ["node", "dist/index.cjs"]
