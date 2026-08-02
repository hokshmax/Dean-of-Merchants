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
    z.enum(["claude", "gemini", "ollama"]).default("claude"),
  ),

  ANTHROPIC_API_KEY: optionalSecret(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-5"),

  GEMINI_API_KEY: optionalSecret(),
  // "-latest" is a Google-maintained alias that auto-points to the current stable Flash
  // release, so this doesn't go stale the way a pinned dated model (e.g. gemini-2.5-flash,
  // deprecated as of this writing) eventually does.
  GEMINI_MODEL: z.string().default("gemini-flash-latest"),

  // Local model via Ollama (no API key -- self-hosted, free, no external rate limit; see
  // .devcontainer/devcontainer.json for how it gets installed and started in Codespaces).
  OLLAMA_BASE_URL: z.string().default("http://localhost:11434"),
  OLLAMA_MODEL: z.string().default("qwen3:7b"),

  NOWPAYMENTS_API_KEY: z.string().optional(),
  NOWPAYMENTS_IPN_SECRET: z.string().optional(),
  PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),
  PAYPAL_ENV: z.enum(["sandbox", "live"]).default("sandbox"),

  PLATFORM_FEE_RATE: z.coerce.number().default(0.025),

  API_PORT: z.coerce.number().default(3001),
  WEB_PORT: z.coerce.number().default(3000),
});

export type Env = z.infer<typeof envSchema>;
