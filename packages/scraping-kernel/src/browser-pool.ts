import { chromium, type Browser, type BrowserContext } from "playwright";
import { createLogger } from "@dean/logger";
import { loadProxyPool, pickProxy, type ProxyConfig } from "./proxy-config";

const logger = createLogger("scraping-kernel");

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export interface AcquireContextOptions {
  /** Per-adapter concurrency cap key, e.g. the retailer id. Used for logging/metrics only here. */
  adapterId: string;
}

/**
 * Centralizes browser lifecycle + proxy/stealth config so every retailer adapter shares one
 * implementation instead of reinventing it. One Chromium instance is reused across contexts;
 * each `acquireContext` call gets an isolated context (own cookies/storage) with a proxy applied.
 */
export class BrowserPool {
  private browser: Browser | undefined;
  private readonly proxyPool: ProxyConfig[];

  constructor(proxyPool: ProxyConfig[] = loadProxyPool()) {
    this.proxyPool = proxyPool;
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      // Lets deployments pin a system-installed Chromium (e.g. in sandboxed CI containers
      // that block Playwright's own browser downloads) instead of Playwright's bundled one.
      const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;
      this.browser = await chromium.launch({ headless: true, executablePath });
    }
    return this.browser;
  }

  async acquireContext(opts: AcquireContextOptions): Promise<BrowserContext> {
    const browser = await this.getBrowser();
    const proxy = pickProxy(this.proxyPool);
    logger.debug({ adapterId: opts.adapterId, proxy: proxy?.server }, "acquiring browser context");

    return browser.newContext({
      userAgent: DEFAULT_USER_AGENT,
      proxy: proxy ? { server: proxy.server, username: proxy.username, password: proxy.password } : undefined,
      viewport: { width: 1280, height: 800 },
      locale: "en-US",
    });
  }

  async releaseContext(context: BrowserContext): Promise<void> {
    await context.close();
  }

  async shutdown(): Promise<void> {
    await this.browser?.close();
    this.browser = undefined;
  }
}

let sharedPool: BrowserPool | undefined;

export function getSharedBrowserPool(): BrowserPool {
  if (!sharedPool) {
    sharedPool = new BrowserPool();
  }
  return sharedPool;
}
