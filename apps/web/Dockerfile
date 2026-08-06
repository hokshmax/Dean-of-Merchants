# Build context is the monorepo root: docker build -f apps/web/Dockerfile .
FROM node:20-bookworm-slim

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app
COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@dean/web...

ENV NODE_ENV=production
EXPOSE 3000

WORKDIR /app/apps/web
CMD ["pnpm", "start", "--", "-p", "3000"]
