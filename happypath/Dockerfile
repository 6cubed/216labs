# Node + Playwright with Chromium for headless browser tests
FROM node:20-bookworm

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Install Playwright's Chromium and system dependencies
RUN npx playwright install chromium --with-deps

COPY tsconfig.json ./
COPY src ./src

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV PORT=3000

EXPOSE 3000

CMD ["npx", "tsx", "src/main.ts"]
