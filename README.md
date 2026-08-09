# Eldorado

Describe a t-shirt design in chat, AI generates the artwork, you pick a size and check out, and
it gets printed and shipped by hand. Anyone can also browse designs other users generated on the
home page and buy one directly. Revenue is a margin on top of your own production cost -- no
retailer scraping, no affiliate approvals, no third-party print-on-demand API.

This repo is a pnpm/Turborepo monorepo:

- `apps/web` — Next.js UI: chat (design generation + buy flow), public design gallery, customer
  order tracking, and an admin orders dashboard
- `apps/api` — NestJS backend (chat orchestration, design generation, checkout, order/fulfillment)
- `packages/*` — pricing (margin calculation), AI orchestration, AI image generation (Imagen),
  shared types, etc.

## How it works

1. User describes a design in chat. The AI (Claude or Gemini) asks clarifying questions if
   needed, then calls a `generate_design` tool with a precise visual prompt.
2. That prompt goes to Google's Imagen image-generation model, which returns the artwork. The
   image is saved and served from the API (`/designs/<id>.png`), and shows up in the public
   gallery on the home page for anyone to browse and buy, not just the person who made it.
3. The user picks a size and quantity, then clicks buy -- this creates a Stripe Checkout session
   (Stripe's own hosted payment page, which also collects the shipping address) priced at your
   own production cost (`BASE_PRODUCT_COST_MINOR_UNITS`) plus a margin (`MARGIN_RATE`, default 50%).
4. Once Stripe confirms payment (via webhook), the order is marked `PAID` and queued for
   **manual, in-house fulfillment** -- there's no external print-on-demand API. You print, pack,
   and ship it yourself (or your team does), then update its status and tracking info from the
   admin dashboard.
5. The customer can check status any time at `/order/<id>` (linked automatically after checkout).

## Admin orders dashboard

`/admin` on the web app lists every order (design image, size, shipping address, status) and
lets you update status (`PENDING_PAYMENT` → `PAID` → `IN_PRODUCTION` → `SHIPPED`, or `CANCELED`)
and add carrier/tracking info once it ships. There's no real staff account system yet -- it's
gated by a single shared secret, `ADMIN_TOKEN`. Set a long random value and don't commit it;
anyone with the token can see and edit every order.

## Required accounts

- **Google AI Studio** — for `GEMINI_API_KEY` (used for both chat, if `AI_PROVIDER=gemini`, and
  always for Imagen image generation). Free tier available; https://aistudio.google.com.
- **Stripe** — free account at https://stripe.com. Use test-mode keys
  (`STRIPE_SECRET_KEY`) for development. For the webhook, either register a real endpoint in
  the Stripe dashboard pointing at `${API_PUBLIC_URL}/orders/webhook` and copy its signing
  secret into `STRIPE_WEBHOOK_SECRET`, or run `stripe listen --forward-to localhost:3001/orders/webhook`
  locally with the [Stripe CLI](https://stripe.com/docs/stripe-cli) during development, which
  prints a temporary webhook secret to use instead.

## Test it in GitHub Codespaces (no local setup)

1. On this repo's GitHub page: **Code → Codespaces → Create codespace on this branch**.
2. Wait for the container to finish setup (installs dependencies, generates the Prisma client).
3. Add secrets in **Settings → Secrets and variables → Codespaces**: `GEMINI_API_KEY`,
   `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ADMIN_TOKEN` (or `ANTHROPIC_API_KEY` instead of
   Gemini for chat, with `AI_PROVIDER=claude`).
4. Once it's up, open a terminal and run:
   ```bash
   pnpm turbo run dev
   ```
5. Codespaces forwards port 3000 (web) and 3001 (api) and should auto-open a preview of the
   chat UI. Port 3001 needs **public** visibility for the browser's background `fetch()` calls
   to work (**Ports tab → right-click port 3001 → Port Visibility → Public** if not already set).
6. Set `API_PUBLIC_URL` (Codespaces repository variable) to the forwarded HTTPS URL for port
   3001 (e.g. `https://<name>-3001.app.github.dev`) so design images load correctly for anyone
   outside your own Codespace.

## Running with Docker

```bash
cp .env.example .env      # fill in GEMINI_API_KEY, STRIPE_SECRET_KEY, ADMIN_TOKEN, etc.
docker compose -f infra/docker-compose.yml up --build
```

- Web: http://localhost:3000 (chat at `/chat`, gallery at `/`, admin at `/admin`)
- API: http://localhost:3001

`DATABASE_URL` and `REDIS_URL` are overridden inside `infra/docker-compose.yml` to point at the
`postgres`/`redis` containers by service name — everything else in `.env` is passed through.

To stop: `Ctrl+C`, then `docker compose -f infra/docker-compose.yml down` (add `-v` to also wipe
the Postgres/Redis volumes).

## Running locally instead

Requires Node 20+ and pnpm (`corepack enable` gets you the right pnpm version).

```bash
cp .env.example .env      # fill in GEMINI_API_KEY, STRIPE_SECRET_KEY, ADMIN_TOKEN, etc.
pnpm install
pnpm --filter @dean/db prisma:generate
pnpm turbo run dev
```

Web runs on http://localhost:3000, API on http://localhost:3001. Postgres/Redis
(`docker-compose -f infra/docker-compose.yml up -d`) are required this time -- designs and
orders are persisted.

## Verifying it works

```bash
pnpm turbo run build      # builds every package + both apps
pnpm turbo run typecheck
pnpm turbo run test       # pricing-engine, ai-orchestration unit tests
```
