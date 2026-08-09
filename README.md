# Eldorado

Describe a t-shirt design in chat, AI generates the artwork, you pick a size and check out, and
it gets printed on demand and shipped to you. No inventory, no retailer scraping, no affiliate
approvals -- revenue is a margin on top of the real print/shipping cost.

This repo is a pnpm/Turborepo monorepo:

- `apps/web` — Next.js chat UI (design generation + buy flow)
- `apps/api` — NestJS backend (chat orchestration, design generation, checkout, order fulfillment)
- `packages/*` — pricing (margin calculation), AI orchestration, AI image generation (Imagen),
  print-on-demand fulfillment (Printful), shared types, etc.

## How it works

1. User describes a design in chat. The AI (Claude or Gemini) asks clarifying questions if
   needed, then calls a `generate_design` tool with a precise visual prompt.
2. That prompt goes to Google's Imagen image-generation model, which returns the artwork. The
   image is saved and served from the API (`/designs/<id>.png`) so it has a public URL.
3. The user picks a size/color and quantity, then clicks buy -- this creates a Stripe Checkout
   session (Stripe's own hosted payment page, which also collects the shipping address) priced
   at Printful's base cost plus a margin (`MARGIN_RATE`, default 50%).
4. Once Stripe confirms payment (via webhook), the order is submitted to Printful's API with the
   design image and shipping address. Printful prints and ships it directly to the customer.

## Required accounts

- **Google AI Studio** — for `GEMINI_API_KEY` (used for both chat, if `AI_PROVIDER=gemini`, and
  always for Imagen image generation). Free tier available; https://aistudio.google.com.
- **Printful** — free account at https://www.printful.com. Get a private API token from
  **Settings → Stores → API**, set as `PRINTFUL_API_KEY`.
- **Stripe** — free account at https://stripe.com. Use test-mode keys
  (`STRIPE_SECRET_KEY`) for development. For the webhook, either register a real endpoint in
  the Stripe dashboard pointing at `${API_PUBLIC_URL}/orders/webhook` and copy its signing
  secret into `STRIPE_WEBHOOK_SECRET`, or run `stripe listen --forward-to localhost:3001/orders/webhook`
  locally with the [Stripe CLI](https://stripe.com/docs/stripe-cli) during development, which
  prints a temporary webhook secret to use instead.

### Important: `API_PUBLIC_URL` must be real

Printful's order API fetches the design image by URL when placing an order -- it cannot reach
`http://localhost:3001`. For real order placement to work (not just design generation/preview),
`API_PUBLIC_URL` needs to be set to an address Printful's servers can actually reach: your
Codespaces/production API URL, or a tunnel (e.g. `ngrok http 3001`) during local development.
Without this, design generation and checkout still work, but the final Printful order submission
will fail with an unreachable-image error -- the order stays in `PAID` status instead of
advancing to `SUBMITTED_TO_PRINTFUL`, which is safe (nothing is lost) but needs a manual retry
once the URL is fixed.

## Test it in GitHub Codespaces (no local setup)

1. On this repo's GitHub page: **Code → Codespaces → Create codespace on this branch**.
2. Wait for the container to finish setup (installs dependencies, generates the Prisma client).
3. Add secrets in **Settings → Secrets and variables → Codespaces**: `GEMINI_API_KEY`,
   `PRINTFUL_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (or `ANTHROPIC_API_KEY`
   instead of Gemini for chat, with `AI_PROVIDER=claude`).
4. Once it's up, open a terminal and run:
   ```bash
   pnpm turbo run dev
   ```
5. Codespaces forwards port 3000 (web) and 3001 (api) and should auto-open a preview of the
   chat UI. Port 3001 needs **public** visibility for the browser's background `fetch()` calls
   to work (**Ports tab → right-click port 3001 → Port Visibility → Public** if not already set).
6. Set `API_PUBLIC_URL` (Codespaces repository variable) to the forwarded HTTPS URL for port
   3001 (e.g. `https://<name>-3001.app.github.dev`) if you want real Printful order submission
   to work from inside the Codespace, per the note above.

## Running with Docker

```bash
cp .env.example .env      # fill in GEMINI_API_KEY, PRINTFUL_API_KEY, STRIPE_SECRET_KEY, etc.
docker compose -f infra/docker-compose.yml up --build
```

- Web (chat UI): http://localhost:3000
- API: http://localhost:3001

`DATABASE_URL` and `REDIS_URL` are overridden inside `infra/docker-compose.yml` to point at the
`postgres`/`redis` containers by service name — everything else in `.env` is passed through.

To stop: `Ctrl+C`, then `docker compose -f infra/docker-compose.yml down` (add `-v` to also wipe
the Postgres/Redis volumes).

## Running locally instead

Requires Node 20+ and pnpm (`corepack enable` gets you the right pnpm version).

```bash
cp .env.example .env      # fill in GEMINI_API_KEY, PRINTFUL_API_KEY, STRIPE_SECRET_KEY, etc.
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
