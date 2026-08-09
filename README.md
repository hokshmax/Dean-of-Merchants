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
3. The user picks a size and quantity, fills in their shipping address, then clicks buy -- the
   app creates the order with that address and starts a Tap Payments charge, priced at your own
   production cost (`BASE_PRODUCT_COST_MINOR_UNITS`) plus a margin (`MARGIN_RATE`, default 50%),
   and redirects to Tap's hosted payment page. (Tap, not Stripe, since Stripe doesn't operate in
   the Middle East -- Tap covers UAE/Saudi/Kuwait/Bahrain/Oman/Qatar/Jordan/Egypt with one
   integration. Unlike Stripe Checkout, Tap's hosted page only handles payment, not shipping
   details, which is why the app collects the address itself first.)
4. Once Tap confirms payment (via webhook), the order is marked `PAID` and queued for **manual,
   in-house fulfillment** -- there's no external print-on-demand API. You print, pack, and ship
   it yourself (or your team does), then update its status and tracking info from the admin
   dashboard.
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
- **Tap Payments** — account at https://www.tap.company. Get a secret key from the dashboard
  (**Settings → API Keys**) and set it as `TAP_SECRET_KEY`; test keys are fine for development.
  Register a webhook endpoint pointing at `${API_PUBLIC_URL}/orders/webhook` so payment
  confirmations reach the app -- this needs `API_PUBLIC_URL` to be a real internet-reachable
  address, not `localhost` (a tunnel like `ngrok http 3001` works for local development).

## Test it in GitHub Codespaces (no local setup)

1. On this repo's GitHub page: **Code → Codespaces → Create codespace on this branch**.
2. Wait for the container to finish setup (starts Postgres/Redis, installs dependencies,
   generates the Prisma client, and creates the Design/Order tables).
3. Add secrets in **Settings → Secrets and variables → Codespaces**: `GEMINI_API_KEY`,
   `TAP_SECRET_KEY`, `ADMIN_TOKEN` (or `ANTHROPIC_API_KEY` instead of Gemini for chat, with
   `AI_PROVIDER=claude`).
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
cp .env.example .env      # fill in GEMINI_API_KEY, TAP_SECRET_KEY, ADMIN_TOKEN, etc.
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
cp .env.example .env      # fill in GEMINI_API_KEY, TAP_SECRET_KEY, ADMIN_TOKEN, etc.
pnpm install
pnpm --filter @dean/db prisma:generate
pnpm --filter @dean/db prisma:migrate:deploy   # creates the Design/Order tables
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
