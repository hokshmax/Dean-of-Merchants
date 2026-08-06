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

   Port 3001 (the API) is configured to forward as **public**. This is required, not just a
   preference: the chat page's browser-side `fetch()` call to the API is a background
   cross-origin request, and Codespaces' default **private** port visibility blocks those
   (only interactive top-level navigation completes its auth flow) — you'd otherwise see
   "Failed to fetch" in the chat UI with nothing in the API's logs at all. If you created your
   Codespace before this was added, fix it manually: **Ports tab → right-click port 3001 →
   Port Visibility → Public**.

### Optional: enable real AI chat search

Without an API key for whichever provider is active, the chat UI, `/health`, and the
search/pricing engine (offer cards, cost breakdown) all still work, but sending a chat
message will fail once it tries to call the model — the app will show that as an error in
the UI rather than crashing.

The app supports two AI providers, picked by the `AI_PROVIDER` env var (defaults to
`claude`):

- **Claude (default)** — in this repo's **Settings → Secrets and variables → Codespaces**,
  add a secret named `ANTHROPIC_API_KEY` with your key.
- **Gemini** — add a secret named `GEMINI_API_KEY`. Free-tier Gemini keys are rate-limited
  quite tightly (as low as 20 requests/day for some models) — if you hit a `429
  RESOURCE_EXHAUSTED` error, either wait for the daily quota to reset, switch `GEMINI_MODEL`
  to a different model name (quotas are tracked per-model, so a model you haven't used yet
  has its own fresh allowance), or enable billing on the Google AI Studio project the key
  belongs to. For production use, enable billing rather than relying on the free tier —
  Gemini 3.5 Flash-Lite costs roughly $0.30/$2.50 per million input/output tokens, which
  works out to a few dollars a month at realistic early-stage traffic.

To make a provider *persistent* (survives restarting the dev servers or opening a new
terminal), add a **repository variable** (Settings → Secrets and variables → Codespaces →
**Variables** tab, not Secrets — provider choice isn't sensitive) named `AI_PROVIDER` with
value `claude` or `gemini`. For a one-off test in the current terminal without changing that
default, `export AI_PROVIDER=gemini` before `pnpm turbo run dev` works too, but only for
that session.

New Codespaces created after adding a secret/variable will have it available automatically;
existing ones need to be rebuilt to pick up a new repository variable (a plain restart is
enough for a secret you're already using, but `AI_PROVIDER` itself needs a rebuild since
it's read once at container creation).

### Note on retailer search reliability

The eBay/Amazon adapters scrape live search-results pages. That's inherently fragile —
retailer markup changes, and Amazon in particular has aggressive anti-bot detection that
can return a CAPTCHA instead of results. A failed or empty result for one retailer is
expected sometimes; it's isolated per-adapter and won't break the rest of the search.

## Running with Docker

This is the recommended way to test the app from your own machine — in particular, to check
whether retailer search works from your home/residential IP instead of a cloud datacenter IP
(see "Note on retailer search reliability" above; Codespaces and most cloud VMs get blocked by
retailer anti-bot systems because their IP ranges are flagged as non-residential).

Requires [Docker](https://docs.docker.com/get-docker/) (with Compose v2, bundled with current
Docker Desktop and Docker Engine installs).

```bash
cp .env.example .env      # fill in ANTHROPIC_API_KEY (or GEMINI_API_KEY + AI_PROVIDER=gemini)
docker compose -f infra/docker-compose.yml up --build
```

This builds and starts four containers: `postgres`, `redis`, `api` (NestJS, with Playwright's
Chromium already baked into the image), and `web` (Next.js). First build takes a few minutes —
the `api` image is based on Playwright's official image so no separate browser-download step is
needed.

- Web (chat UI): http://localhost:3000
- API: http://localhost:3001

`DATABASE_URL` and `REDIS_URL` are overridden inside `infra/docker-compose.yml` to point at the
`postgres`/`redis` containers by service name — you don't need to (and shouldn't) change those
two in your `.env` for Docker; everything else in `.env` (API keys, `AI_PROVIDER`, etc.) is
passed through as-is.

To stop: `Ctrl+C`, then `docker compose -f infra/docker-compose.yml down` (add `-v` to also wipe
the Postgres/Redis volumes). To rebuild after changing code: re-run the `up --build` command
above.

## Running locally instead

Requires Node 20+ and pnpm (`corepack enable` gets you the right pnpm version).

```bash
cp .env.example .env      # fill in ANTHROPIC_API_KEY (or GEMINI_API_KEY + AI_PROVIDER=gemini)
pnpm install
pnpm --filter @dean/db prisma:generate
pnpm --filter @dean/scraping-kernel exec playwright install --with-deps chromium
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
