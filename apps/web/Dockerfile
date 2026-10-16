# Stage 1: Build SolidJS static bundle with Bun
FROM oven/bun:1.4-alpine AS builder

WORKDIR /workspace

COPY package.json bun.lock biome.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/argon-orchestrator/package.json ./packages/argon-orchestrator/package.json
COPY apps/web/package.json ./apps/web/package.json

RUN bun install --frozen-lockfile

COPY packages/shared/ ./packages/shared/
COPY apps/web/ ./apps/web/

RUN bun --filter @deepmind/web build

# Stage 2: Ultra-light Nginx runtime for Cloud Run
FROM nginx:1.27-alpine

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /workspace/apps/web/dist /usr/share/nginx/html

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
