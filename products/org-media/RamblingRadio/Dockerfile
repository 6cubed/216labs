FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /repo

COPY packages/errors ./packages/errors
WORKDIR /repo/packages/errors
RUN npm install && npm run build

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
