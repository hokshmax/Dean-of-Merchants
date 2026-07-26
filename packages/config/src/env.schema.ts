import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-5"),

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
