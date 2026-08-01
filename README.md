# Dean of Merchants

A chat-driven AI shopping assistant. Tell it what you want to buy, it searches local and
global retailers, shows the real total cost (product price + shipping + tax + our 2.5%
fee on product price only), and — in later phases — buys it on your behalf once you pay.

This repo is a pnpm/Turborepo monorepo:

- `apps/web` — Next.js chat UI
- `apps/api` — NestJS backend (chat orchestration, search, quotes)
- `packages/*` — pricing engine, retailer adapters, AI orchestration, shared types, etc.

See `.claude` plan history or ask in-repo for the fuller architecture writeup; this README
is just enough to get it running.

## Test it in GitHub Codespaces (no local setup)

1. On this repo's GitHub page: **Code → Codespaces → Create codespace on this branch**.
2. Wait for the container to finish setup (installs dependencies, generates the Prisma
   client, and downloads a headless Chromium for the retailer-search adapters — a couple
   of minutes on first run).
3. Once it's up, open a terminal in the Codespace and run:
   ```bash
   pnpm turbo run dev
   ```
4. Codespaces will forward port 3000 (web) and 3001 (api) and should auto-open a preview
   of the chat UI. If it doesn't, open the **Ports** tab and click the globe icon next to
   port 3000.

### Optional: enable real AI chat search

Without an API key for whichever provider is active, the chat UI, `/health`, and the
search/pricing engine (offer cards, cost breakdown) all still work, but sending a chat
message will fail once it tries to call the model — the app will show that as an error in
the UI rather than crashing.

The app supports two AI providers, picked by the `AI_PROVIDER` env var (defaults to
`claude`):

- **Claude (default)** — in this repo's **Settings → Secrets and variables → Codespaces**,
  add a secret named `ANTHROPIC_API_KEY` with your key.
- **Gemini** — add a secret named `GEMINI_API_KEY`, and set `AI_PROVIDER=gemini` (e.g.
  `export AI_PROVIDER=gemini` before `pnpm turbo run dev` in the Codespace terminal, or add
  it as a repository variable). The Gemini integration is newer and hasn't been exercised
  against a real key yet — if chat search errors with Gemini selected, that's useful signal,
  please report exactly what broke.

Either way, new Codespaces created after adding a secret will have it available
automatically; existing ones need to be rebuilt or restarted.

### Note on retailer search reliability

The eBay/Amazon adapters scrape live search-results pages. That's inherently fragile —
retailer markup changes, and Amazon in particular has aggressive anti-bot detection that
can return a CAPTCHA instead of results. A failed or empty result for one retailer is
expected sometimes; it's isolated per-adapter and won't break the rest of the search.

## Running locally instead

Requires Node 20+ and pnpm (`corepack enable` gets you the right pnpm version).

```bash
cp .env.example .env      # fill in ANTHROPIC_API_KEY (or GEMINI_API_KEY + AI_PROVIDER=gemini)
pnpm install
pnpm --filter @dean/db prisma:generate
pnpm exec playwright install --with-deps chromium
pnpm turbo run dev
```

Web runs on http://localhost:3000, API on http://localhost:3001.

Postgres/Redis (`docker-compose -f infra/docker-compose.yml up -d`) aren't required to run
the current chat/search/pricing flow — chat/offer persistence isn't wired up yet (Phase 2).
`DATABASE_URL`/`REDIS_URL` just need to be non-empty strings to pass env validation.

## Verifying it works

```bash
pnpm turbo run build      # builds every package + both apps
pnpm turbo run typecheck
pnpm turbo run test       # pricing-engine, retailer-adapters, ai-orchestration unit tests
```
