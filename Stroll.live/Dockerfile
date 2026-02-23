FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build
RUN npx esbuild server/index.ts --bundle --platform=node --format=esm \
    --outfile=dist/server.mjs \
    --alias:@shared=./shared \
    --external:express --external:cors --external:@libsql/client --external:drizzle-orm

FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
ENV NODE_ENV=production
EXPOSE 5000
CMD ["node", "dist/server.mjs"]
