FROM node:20-alpine AS frontend-builder

WORKDIR /app
COPY ./Frontend/package.json ./Frontend/package-lock.json ./
RUN npm ci
COPY ./Frontend ./
RUN npm run build

FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app
COPY ./Backend/package.json ./Backend/package-lock.json ./
RUN npm ci --omit=dev
COPY ./Backend ./
COPY --from=frontend-builder /app/dist /app/public

VOLUME ["/app/data"]
EXPOSE 3000
CMD ["node", "server.js"]
