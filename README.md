# Dean of Merchants

A chat-driven AI shopping assistant. Tell it what you want to buy, it searches retailers via
their own official APIs and affiliate programs, and shows the best real price (product price +
estimated shipping + estimated tax). Each offer links out to the retailer's own site, where you
complete checkout yourself — Dean of Merchants never processes payment or places an order for
you.

This repo is a pnpm/Turborepo monorepo:

- `apps/web` — Next.js chat UI
- `apps/api` — NestJS backend (chat orchestration, search, quotes)
- `packages/*` — pricing engine, retailer adapters, AI orchestration, shared types, etc.

## Why retailer search uses official APIs, not scraping

Earlier versions of this app scraped retailer search pages directly with a headless browser.
That was tested live (including from a residential IP via Docker on a home machine, not just
from cloud/Codespaces IPs) and every major retailer blocked it outright with an enterprise
anti-bot challenge — eBay served a hard block page, Walmart a "Press & Hold" human-verification
challenge, AliExpress a slider CAPTCHA, Target an unresolving bot-detection loading overlay, and
Temu redirected straight to a forced login wall. These systems (Akamai, PerimeterX/HUMAN,
Cloudflare-style) fingerprint the browser itself, not just the IP, so no amount of proxy
rotation fixes it — and building automated CAPTCHA-solving to defeat them would violate every
one of those retailers' Terms of Service.

So retailer adapters now use each retailer's own official product API or affiliate program
instead. This is slower to add coverage (each retailer needs its own signup/approval), but it's
the only approach that's actually legal, reliable, and won't get the app's IP/account banned.

## Retailer status

| Retailer | Status | What's needed |
|---|---|---|
| eBay | **Live** (once configured) | Free eBay developer keyset — see below |
| Best Buy | **Live** (once configured) | Free Best Buy developer key — see below |
| Walmart | Disabled | Approval into Walmart Creator (Impact.com) |
| Target | Disabled | Approval into the Target Affiliate Program (Impact.com) |
| AliExpress | Disabled | Approval into the AliExpress Affiliate Program |
| noon | Disabled | Approval into noon's affiliate program (commonly via Admitad) |
| Temu | Disabled | Approval into Temu's affiliate/creator program |
| Amazon | Disabled | Amazon Associates account with an existing sales history (Amazon requires ongoing qualifying sales just to keep API access active) — and the Product Advertising API is being deprecated May 15, 2026 in favor of a content-creator-focused Creators API, so this may not be worth pursuing |

Disabled retailers return no results and log a warning naming the env var that would enable
them — they don't attempt scraping or waste time on a failing request.

### Setting up eBay

1. Create a free account at [developer.ebay.com](https://developer.ebay.com) and generate a
   keyset (**My Account → Application Keys**).
2. Set `EBAY_APP_ID` and `EBAY_CERT_ID` to that keyset's Client ID / Client Secret.
3. Optional: apply to the [eBay Partner Network](https://partnernetwork.ebay.com) and set
   `EBAY_CAMPAIGN_ID` to your campaign ID — this tags offer links so purchases the user
   completes on eBay attribute commission back to this app. Without it, search still works;
   links just aren't commission-tracked.

### Setting up Best Buy

1. Create a free account at [developer.bestbuy.com](https://developer.bestbuy.com) and generate
   an API key.
2. Set `BESTBUY_API_KEY` to that key.
3. Optional: apply to the Best Buy Affiliate Program (run via Impact.com) and set
   `BESTBUY_AFFILIATE_LINK_TEMPLATE` to the tracked-link format from your Impact dashboard
   (with `{URL}` as the placeholder for the real product URL) once approved.

## Test it in GitHub Codespaces (no local setup)

1. On this repo's GitHub page: **Code → Codespaces → Create codespace on this branch**.
2. Wait for the container to finish setup (installs dependencies, generates the Prisma
   client — a minute or two on first run).
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

Add `EBAY_APP_ID`/`EBAY_CERT_ID`/`BESTBUY_API_KEY` etc. as Codespaces secrets (**Settings →
Secrets and variables → Codespaces**) the same way as the AI provider keys below.

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

## Running with Docker

```bash
cp .env.example .env      # fill in ANTHROPIC_API_KEY, EBAY_APP_ID/EBAY_CERT_ID, etc.
docker compose -f infra/docker-compose.yml up --build
```

This builds and starts four containers: `postgres`, `redis`, `api` (NestJS), and `web`
(Next.js).

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
cp .env.example .env      # fill in ANTHROPIC_API_KEY, EBAY_APP_ID/EBAY_CERT_ID, etc.
pnpm install
pnpm --filter @dean/db prisma:generate
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
