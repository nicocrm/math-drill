# Single image: Coolify sets CMD to `node dist/server/api.js` or `node dist/server/worker.js`.
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# VITE_* must be build args in Coolify (e.g. VITE_CLERK_PUBLISHABLE_KEY).
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=${VITE_CLERK_PUBLISHABLE_KEY}
RUN npm run build && npm run build:server

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3001
