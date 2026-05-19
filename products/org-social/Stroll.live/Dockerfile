FROM node:20-alpine AS builder
WORKDIR /repo

COPY packages/errors ./packages/errors
COPY products/org-social/Stroll.live ./products/org-social/Stroll.live

WORKDIR /repo/products/org-social/Stroll.live
RUN npm install \
  && rm -rf node_modules/@216labs \
  && mkdir -p node_modules/@216labs \
  && cp -a /repo/packages/errors node_modules/@216labs/errors
RUN npm run build
RUN npx esbuild server/index.ts --bundle --platform=node --format=esm \
    --outfile=dist/server.mjs \
    --alias:@shared=./shared \
    --external:express --external:cors --external:@libsql/client --external:drizzle-orm

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /repo/products/org-social/Stroll.live/package.json ./package.json
COPY --from=builder /repo/products/org-social/Stroll.live/package-lock.json ./package-lock.json
RUN npm install --omit=dev
COPY --from=builder /repo/products/org-social/Stroll.live/dist ./dist
ENV NODE_ENV=production
EXPOSE 5000
CMD ["node", "dist/server.mjs"]
