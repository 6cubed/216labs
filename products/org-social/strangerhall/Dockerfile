FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY server ./server
COPY public ./public
ENV NODE_ENV=production
ENV PORT=3050
EXPOSE 3050
CMD ["node", "server/index.js"]
