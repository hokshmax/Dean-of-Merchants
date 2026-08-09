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

  GEMINI_API_KEY: optionalSecret(),
  // "-latest" is a Google-maintained alias that auto-points to the current stable Flash
  // release, so this doesn't go stale the way a pinned dated model (e.g. gemini-2.5-flash,
  // deprecated as of this writing) eventually does.
  GEMINI_MODEL: z.string().default("gemini-flash-latest"),

  NOWPAYMENTS_API_KEY: z.string().optional(),
  NOWPAYMENTS_IPN_SECRET: z.string().optional(),
  PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),
  PAYPAL_ENV: z.enum(["sandbox", "live"]).default("sandbox"),

  // Retailer search now goes through each retailer's own official API/affiliate program
  // instead of scraping (which every retailer's anti-bot protection blocked outright, even
  // from a residential IP -- confirmed via debug screenshots). Adapters read these directly
  // from process.env rather than through the parsed Env object; they're declared here purely
  // as the documented list of what this app can be configured with. Retailers without a public
  // API (Walmart, Target, AliExpress, noon, Temu, Amazon) stay disabled until their affiliate
  // programs are approved and a real integration is written against real credentials.
  EBAY_APP_ID: optionalSecret(),
  EBAY_CERT_ID: optionalSecret(),
  EBAY_CAMPAIGN_ID: z.string().optional(),
  BESTBUY_API_KEY: optionalSecret(),
  BESTBUY_AFFILIATE_LINK_TEMPLATE: z.string().optional(),

  // The app no longer processes payment or charges a platform fee -- it earns affiliate
  // commission from retailers instead, invisible to the user. Kept configurable rather than
  // deleted in case a future direct-checkout retailer integration needs it again.
  PLATFORM_FEE_RATE: z.coerce.number().default(0),

  API_PORT: z.coerce.number().default(3001),
  WEB_PORT: z.coerce.number().default(3000),
});

export type Env = z.infer<typeof envSchema>;
