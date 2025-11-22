FROM node:20-alpine AS base

# Install pnpm
RUN npm install -g pnpm@8.11.0

WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./

# Copy all packages
COPY packages ./packages
COPY apps/api ./apps/api

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build shared packages
RUN pnpm --filter @unified-memory/shared build
RUN pnpm --filter @unified-memory/db build

# Development stage
FROM base AS development
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["pnpm", "dev"]

# Production build stage
FROM base AS builder
RUN pnpm --filter api build

# Production stage
FROM node:20-alpine AS production
WORKDIR /app
COPY --from=builder /app/apps/api/.next ./apps/api/.next
COPY --from=builder /app/apps/api/public ./apps/api/public
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "apps/api/.next/standalone/server.js"]
