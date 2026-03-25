FROM node:20-alpine AS builder
# better-sqlite3 compiles a native addon; needs a toolchain on Alpine/musl (CI amd64 often compiles).
RUN apk add --no-cache python3 make g++ sqlite-dev
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
ENV NODE_OPTIONS=--max-old-space-size=6144
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache sqlite
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
