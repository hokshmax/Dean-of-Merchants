import { z } from "zod";

// Devcontainer/Codespaces secret passthrough (`${localEnv:X}`) injects an empty string, not an
// unset variable, when a secret isn't configured -- so a plain `.optional()` isn't enough to
// treat "not configured" as absent. Coerce empty string to undefined before the optional/min
// check runs, for every "secret that's fine to be missing" field below.
const optionalSecret = () => z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional());

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  AI_PROVIDER: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.enum(["claude", "gemini"]).default("claude"),
  ),

  ANTHROPIC_API_KEY: optionalSecret(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-5"),

  // Also used for AI image generation (Imagen) below, regardless of which chat provider is
  // active -- Imagen is only available through Google, so this key does double duty.
  GEMINI_API_KEY: optionalSecret(),
  // "-latest" is a Google-maintained alias that auto-points to the current stable Flash
  // release, so this doesn't go stale the way a pinned dated model (e.g. gemini-2.5-flash,
  // deprecated as of this writing) eventually does.
  GEMINI_MODEL: z.string().default("gemini-flash-latest"),
  IMAGEN_MODEL: z.string().default("imagen-4.0-generate-001"),

  // Where generated design images are written on disk, and served from at
  // `${API_PUBLIC_URL}/designs/<file>`.
  DESIGN_STORAGE_DIR: z.string().default("./data/designs"),
  API_PUBLIC_URL: z.string().default("http://localhost:3001"),
  // Where Stripe Checkout redirects back to after payment succeeds/is canceled.
  WEB_PUBLIC_URL: z.string().default("http://localhost:3000"),

  // Stripe (checkout + payment). Test-mode keys from the Stripe dashboard are fine for
  // development; STRIPE_WEBHOOK_SECRET comes from the webhook endpoint's settings once one is
  // registered (`stripe listen` for local testing).
  STRIPE_SECRET_KEY: optionalSecret(),
  STRIPE_WEBHOOK_SECRET: optionalSecret(),

  // Fulfillment is in-house, not an external print-on-demand API -- this is your own per-shirt
  // production cost (printing + your own shipping), in minor currency units (cents).
  BASE_PRODUCT_COST_MINOR_UNITS: z.coerce.number().int().default(1500),
  // Margin charged on top of that base cost -- this is Eldorado's entire revenue model, no
  // third-party affiliate/commission dependency.
  MARGIN_RATE: z.coerce.number().default(0.5),

  // Shared secret for the admin dashboard (/admin) -- there's no real user/staff account system
  // yet, so this is a single bearer token checked on every admin request. Treat it like a
  // password: set a long random value, never commit it.
  ADMIN_TOKEN: optionalSecret(),

  API_PORT: z.coerce.number().default(3001),
  WEB_PORT: z.coerce.number().default(3000),
});

export type Env = z.infer<typeof envSchema>;
