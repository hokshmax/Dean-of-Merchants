import { createLogger } from "@dean/logger";

const logger = createLogger("api:tap");

const API_BASE = "https://api.tap.company/v2";

export interface TapChargeCustomer {
  firstName: string;
  lastName?: string;
  email: string;
}

export interface CreateChargeInput {
  /** Major currency units (e.g. 24.99), not minor units -- Tap's amount field isn't cents, since
   * some currencies it supports (KWD, BHD, OMR) use 3 decimal places rather than 2. */
  amount: number;
  currency: string;
  customer: TapChargeCustomer;
  redirectUrl: string;
  postUrl: string;
  orderReference: string;
}

export interface TapCharge {
  id: string;
  status: string;
  redirectUrl?: string;
}

interface RawTapCharge {
  id: string;
  status: string;
  transaction?: { url?: string };
}

/**
 * Thin wrapper over Tap Payments' v2 Charges REST API (api.tap.company) -- the hosted-checkout
 * payment gateway used across the GCC/MENA in place of Stripe, which doesn't operate there.
 * Built to Tap's documented v2 Charges shape; unverified against a live account since no real
 * TAP_SECRET_KEY exists yet to test with.
 *
 * Unlike Stripe Checkout, Tap's hosted page only collects payment details, not a shipping
 * address -- the caller must collect that itself before creating the charge.
 */
export function createTapClient(secretKey: string) {
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });

    const body = (await response.json()) as T & { errors?: unknown };
    if (!response.ok) {
      logger.error({ path, status: response.status, errors: (body as { errors?: unknown }).errors }, "Tap API request failed");
      throw new Error(`Tap API request to ${path} failed with status ${response.status}`);
    }
    return body;
  }

  return {
    async createCharge(input: CreateChargeInput): Promise<TapCharge> {
      const raw = await request<RawTapCharge>("/charges", {
        method: "POST",
        body: JSON.stringify({
          amount: input.amount,
          currency: input.currency,
          customer_initiated: true,
          threeDSecure: true,
          save_card: false,
          reference: { order: input.orderReference },
          customer: {
            first_name: input.customer.firstName,
            last_name: input.customer.lastName,
            email: input.customer.email,
          },
          source: { id: "src_all" },
          redirect: { url: input.redirectUrl },
          post: { url: input.postUrl },
        }),
      });
      return { id: raw.id, status: raw.status, redirectUrl: raw.transaction?.url };
    },

    async getCharge(chargeId: string): Promise<TapCharge> {
      const raw = await request<RawTapCharge>(`/charges/${chargeId}`);
      return { id: raw.id, status: raw.status, redirectUrl: raw.transaction?.url };
    },
  };
}

/** Tap's customer object wants first/last name separately; the app only collects one full-name field. */
export function splitFullName(name: string): { firstName: string; lastName?: string } {
  const [firstName, ...rest] = name.trim().split(/\s+/);
  return { firstName: firstName || name, lastName: rest.length > 0 ? rest.join(" ") : undefined };
}
