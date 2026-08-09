import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Page } from "playwright";
import { createLogger } from "@dean/logger";

const logger = createLogger("scraping-kernel:debug-capture");

/**
 * Saves a full-page screenshot + HTML dump of the given page when DEBUG_SCRAPE_DIR is set.
 * Adapters call this from their selector-timeout catch blocks so a failed search can be
 * inspected after the fact -- e.g. to tell a real anti-bot block page apart from a stale
 * selector against a page that loaded fine. No-op (and never throws) when the env var is unset,
 * so this is safe to call unconditionally in production.
 */
export async function captureDebugArtifact(page: Page, label: string): Promise<void> {
  const dir = process.env.DEBUG_SCRAPE_DIR;
  if (!dir) return;

  try {
    await mkdir(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const base = join(dir, `${label}-${stamp}`);
    await page.screenshot({ path: `${base}.png`, fullPage: true });
    await writeFile(`${base}.html`, await page.content(), "utf-8");
    logger.warn({ base }, "saved debug artifact for failed scrape");
  } catch (err) {
    logger.warn({ err }, "failed to save debug artifact");
  }
}
