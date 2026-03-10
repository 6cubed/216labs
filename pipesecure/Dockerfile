FROM node:20-slim

# Install system deps: git for cloning, python3+pip for semgrep
RUN apt-get update && apt-get install -y --no-install-recommends \
    git python3 python3-pip ca-certificates \
    && pip3 install semgrep --break-system-packages \
    && npm install -g @ast-grep/cli \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY src ./src

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV PORT=3000

EXPOSE 3000

CMD ["npx", "tsx", "src/server.ts"]
