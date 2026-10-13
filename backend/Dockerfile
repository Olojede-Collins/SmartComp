FROM node:24.11.1-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
RUN npm ci
COPY backend ./backend
RUN npm run build --workspace backend

FROM node:24.11.1-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
RUN npm ci --omit=dev

COPY --from=build /app/backend/dist ./backend/dist

USER node

EXPOSE 3001

CMD ["node", "backend/dist/server.js"]
