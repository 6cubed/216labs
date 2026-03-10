import { chromium, type Browser } from "playwright";
import { config } from "./config.js";

const PAGE_TIMEOUT_MS = 20_000;
const NAV_TIMEOUT_MS = 15_000;

export interface RunResult {
  appId: string;
  baseUrl: string;
  passed: boolean;
  message: string;
  durationMs: number;
}

/**
 * Common-sense happy path: load homepage, optionally click first in-page link,
 * assert we get a valid page (no crash, no 5xx).
 */
export async function runTestForApp(
  browser: Browser,
  appId: string,
  baseUrl: string
): Promise<RunResult> {
  const start = Date.now();
  const page = await browser.newPage({
    ignoreHTTPSErrors: true,
    javaScriptEnabled: true,
  });
  page.setDefaultTimeout(PAGE_TIMEOUT_MS);
  page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);

  try {
    const response = await page.goto(baseUrl, {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT_MS,
    });

    if (!response) {
      return {
        appId,
        baseUrl,
        passed: false,
        message: "No response from server",
        durationMs: Date.now() - start,
      };
    }

    const status = response.status();
    if (status >= 500) {
      return {
        appId,
        baseUrl,
        passed: false,
        message: `HTTP ${status}`,
        durationMs: Date.now() - start,
      };
    }

    if (status >= 400) {
      return {
        appId,
        baseUrl,
        passed: false,
        message: `HTTP ${status}`,
        durationMs: Date.now() - start,
      };
    }

    // Brief wait for SPAs that might render after load
    await new Promise((r) => setTimeout(r, 1500));

    // Optional: click first visible same-origin link to test one hop
    const firstLink = await page
      .locator('a[href^="/"], a[href^="http"]')
      .first()
      .getAttribute("href")
      .catch(() => null);

    if (firstLink) {
      try {
        const href = firstLink.startsWith("http") ? firstLink : new URL(firstLink, baseUrl).href;
        const sameOrigin =
          new URL(href).origin === new URL(baseUrl).origin;
        if (sameOrigin) {
          const navPromise = page.goto(href, {
            waitUntil: "domcontentloaded",
            timeout: NAV_TIMEOUT_MS,
          });
          const navRes = await navPromise;
          if (navRes && navRes.status() >= 500) {
            return {
              appId,
              baseUrl,
              passed: false,
              message: `Clickthrough returned HTTP ${navRes.status()}`,
              durationMs: Date.now() - start,
            };
          }
        }
      } catch {
        // Ignore clickthrough errors (link might be dynamic); homepage load passed
      }
    }

    return {
      appId,
      baseUrl,
      passed: true,
      message: "OK",
      durationMs: Date.now() - start,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      appId,
      baseUrl,
      passed: false,
      message: message.slice(0, 200),
      durationMs: Date.now() - start,
    };
  } finally {
    await page.close().catch(() => {});
  }
}

export async function runAllTests(
  appIds: string[]
): Promise<RunResult[]> {
  const baseUrlFor = (id: string) =>
    `https://${id}.${config.appHost}`;

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const results: RunResult[] = [];

  try {
    for (const appId of appIds) {
      const baseUrl = baseUrlFor(appId);
      process.stdout.write(`  [${appId}] ... `);
      const result = await runTestForApp(browser, appId, baseUrl);
      results.push(result);
      console.log(result.passed ? "pass" : `fail: ${result.message}`);
    }
  } finally {
    await browser.close();
  }

  return results;
}
