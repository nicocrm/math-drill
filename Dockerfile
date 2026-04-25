# Single image: Coolify sets CMD to `node dist/server/api.js` or `node dist/server/worker.js`.
FROM node:22-alpine AS builder
WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json packages/core/
RUN pnpm install --frozen-lockfile
COPY . .
# VITE_* must be build args in Coolify (e.g. VITE_CLERK_PUBLISHABLE_KEY).
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=${VITE_CLERK_PUBLISHABLE_KEY}
RUN pnpm run build && pnpm run build:server

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core ./packages/core
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /app/dist ./dist
EXPOSE 3001
