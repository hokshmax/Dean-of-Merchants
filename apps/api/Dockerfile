# Build context is the monorepo root: docker build -f apps/api/Dockerfile .
#
# Base image ships Chromium/Firefox/WebKit + every OS-level dependency they need already
# installed, tagged to match our pinned playwright version exactly (packages/scraping-kernel
# depends on playwright@1.62.0, locked in pnpm-lock.yaml) -- this is what let us skip the
# corepack/sudo/playwright-install-deps dance we had to fight through for GitHub Codespaces;
# the official image is built specifically so `pnpm install` + the matching npm package finds
# the already-installed browsers with no extra install step.
FROM mcr.microsoft.com/playwright:v1.62.0-jammy

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app
COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @dean/db prisma:generate
RUN pnpm turbo run build --filter=@dean/api... --concurrency=1

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "apps/api/dist/main.js"]
