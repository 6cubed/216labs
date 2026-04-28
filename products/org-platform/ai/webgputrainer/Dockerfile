FROM node:20-alpine AS builder
WORKDIR /repo

# Copy only what this app needs from the monorepo (local file dependency + app).
COPY packages/errors ./packages/errors
COPY products/org-platform/ai/webgputrainer ./products/org-platform/ai/webgputrainer

WORKDIR /repo/products/org-platform/ai/webgputrainer
RUN npm ci
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /repo/products/org-platform/ai/webgputrainer/.next/standalone ./
COPY --from=builder /repo/products/org-platform/ai/webgputrainer/.next/static ./.next/static
COPY --from=builder /repo/products/org-platform/ai/webgputrainer/public ./public
EXPOSE 3000
CMD ["node", "server.js"]

