FROM node:20-alpine AS builder
WORKDIR /repo

COPY packages/errors ./packages/errors
COPY products/org-shopping/valentine ./products/org-shopping/valentine

WORKDIR /repo/products/org-shopping/valentine
RUN npm install
RUN rm -rf node_modules/@216labs \
  && mkdir -p node_modules/@216labs \
  && cp -a /repo/packages/errors node_modules/@216labs/errors
RUN npm run build

FROM node:20-alpine
RUN apk add --no-cache sqlite
WORKDIR /app
COPY --from=builder /repo/products/org-shopping/valentine/.next/standalone ./
COPY --from=builder /repo/products/org-shopping/valentine/.next/static ./.next/static
COPY --from=builder /repo/products/org-shopping/valentine/public ./public
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
