export interface ProxyConfig {
  server: string;
  username?: string;
  password?: string;
}

/**
 * Reads a rotating-proxy pool from env (comma-separated `server|username|password` entries)
 * and hands adapters a random entry per browser context, so scraping traffic isn't all
 * exiting the same IP. Empty/unset means "no proxy" (fine for local dev).
 */
export function loadProxyPool(source: NodeJS.ProcessEnv = process.env): ProxyConfig[] {
  const raw = source.SCRAPING_PROXY_POOL;
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [server, username, password] = entry.split("|");
      return { server, username, password };
    });
}

export function pickProxy(pool: ProxyConfig[]): ProxyConfig | undefined {
  if (pool.length === 0) return undefined;
  return pool[Math.floor(Math.random() * pool.length)];
}
