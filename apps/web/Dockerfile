# Build context is the monorepo root: docker build -f apps/web/Dockerfile .
FROM node:20-bookworm-slim

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app
COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@dean/web... --concurrency=1

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

WORKDIR /app/apps/web
CMD ["pnpm", "start"]
