FROM node:20-alpine AS deps
RUN apk add --no-cache python3 make g++ libc6-compat
WORKDIR /repo

COPY packages/errors ./packages/errors
COPY products/org-social/thezurichdatinggame ./products/org-social/thezurichdatinggame

WORKDIR /repo/products/org-social/thezurichdatinggame
RUN npm ci
RUN rm -rf node_modules/@216labs \
  && mkdir -p node_modules/@216labs \
  && cp -a /repo/packages/errors node_modules/@216labs/errors

FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++ libc6-compat
COPY --from=deps /repo/products/org-social/thezurichdatinggame /app
WORKDIR /app
RUN npm run build

FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
RUN mkdir -p /app/data
EXPOSE 3000
CMD ["npm", "start"]
