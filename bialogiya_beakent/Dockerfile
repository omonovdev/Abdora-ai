FROM node:22-alpine

# Prisma engines need openssl on musl; tini gives us proper PID-1 signal handling.
RUN apk add --no-cache openssl tini

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

RUN mkdir -p uploads && chown -R node:node /app

ENV NODE_ENV=production \
    PORT=5000

USER node
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:5000/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
