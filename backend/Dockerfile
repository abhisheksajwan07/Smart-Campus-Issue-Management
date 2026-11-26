# Multi-stage Dockerfile for Smart Campus Node.js + TypeScript Backend
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package definitions
COPY package*.json tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code and config
COPY src ./src
COPY drizzle.config.ts ./

# Compile TypeScript
RUN npm run build

# -----------------------------------------------------------
# Runner Stage (Clean, minimal production image)
# -----------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled dist and database schemas
COPY --from=builder /app/dist ./dist
COPY drizzle ./drizzle
COPY drizzle.config.ts ./

EXPOSE 5000

CMD ["node", "dist/server.js"]
