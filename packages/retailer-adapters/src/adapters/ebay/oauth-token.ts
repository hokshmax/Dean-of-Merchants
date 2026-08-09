import { createLogger } from "@dean/logger";

const logger = createLogger("retailer-adapters:ebay:oauth");

const TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const SCOPE = "https://api.ebay.com/oauth/api_scope";

let cachedToken: { accessToken: string; expiresAt: number } | undefined;

/**
 * eBay's Browse API uses the OAuth2 client-credentials grant (no user login involved -- this
 * is app-level access to public listing data). Tokens are cached in memory and refreshed a
 * minute before they actually expire so a request never races an expiring token.
 */
export async function getEbayAccessToken(appId: string, certId: string): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) {
    return cachedToken.accessToken;
  }

  const basicAuth = Buffer.from(`${appId}:${certId}`).toString("base64");
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: SCOPE }).toString(),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    logger.error({ status: response.status, body }, "eBay OAuth token request failed");
    throw new Error(`eBay OAuth token request failed with status ${response.status}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: now + (data.expires_in - 60) * 1000,
  };
  return cachedToken.accessToken;
}
