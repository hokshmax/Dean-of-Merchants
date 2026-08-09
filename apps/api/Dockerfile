# Build context is the monorepo root: docker build -f apps/api/Dockerfile .
FROM node:20-bookworm-slim

# node:20-bookworm-slim doesn't include OpenSSL, which Prisma's query engine needs to talk to
# Postgres -- without it Prisma guesses a version ("openssl-1.1.x") that may not match what's
# actually on the system and can fail in subtler ways than a clean startup error.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app
COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @dean/db prisma:generate
RUN pnpm turbo run build --filter=@dean/api... --concurrency=1

ENV NODE_ENV=production
EXPOSE 3001

# Migrations run at container start, not build time -- DATABASE_URL (and a reachable database)
# is only known once the container is actually running, not while the image is being built.
CMD ["sh", "-c", "pnpm --filter @dean/db prisma:migrate:deploy && node apps/api/dist/main.js"]
