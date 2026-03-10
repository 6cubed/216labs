FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      git python3 python3-pip ca-certificates \
    && pip3 install --no-cache-dir semgrep --break-system-packages \
    && npm install -g @ast-grep/cli \
    && apt-get purge -y --auto-remove python3-pip \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /root/.cache

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY tsconfig.json ./
COPY src ./src

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV DATA_DIR=/app/data

CMD ["npx", "tsx", "src/main.ts"]
