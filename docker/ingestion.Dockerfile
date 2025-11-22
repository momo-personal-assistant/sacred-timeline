FROM node:20-alpine AS base

# Install pnpm
RUN npm install -g pnpm@8.11.0

WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./

# Copy packages
COPY packages ./packages
COPY services/ingestion ./services/ingestion

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build shared packages
RUN pnpm --filter @unified-memory/shared build
RUN pnpm --filter @unified-memory/db build

# Development stage
FROM base AS development
WORKDIR /app/services/ingestion
EXPOSE 3001
CMD ["pnpm", "dev"]

# Production build stage
FROM base AS builder
RUN pnpm --filter ingestion build

# Production stage
FROM node:20-alpine AS production
WORKDIR /app
COPY --from=builder /app/services/ingestion/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3001
CMD ["node", "dist/index.js"]
