FROM node:24-alpine AS frontend-builder

WORKDIR /app
COPY ./Frontend/package.json ./Frontend/package-lock.json ./
RUN npm ci
COPY ./Frontend ./
RUN npm run build

FROM node:24-alpine

ENV NODE_ENV=production
WORKDIR /app
COPY ./Backend/package.json ./Backend/package-lock.json ./
RUN npm ci --omit=dev
COPY ./Backend ./
COPY --from=frontend-builder /app/dist /app/public

RUN mkdir -p /app/data && chown node:node /app/data

USER node
VOLUME ["/app/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/health').then(response => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "server.js"]
