import { chromium, type Browser } from "playwright";
import { config } from "./config.js";

const PAGE_TIMEOUT_MS = 20_000;
const NAV_TIMEOUT_MS = 15_000;

/** Pocket chat test: two agents join, one pairs, we assert both get ≥2 messages without human intervention. */
const POCKET_JOIN_WAIT_MS = 25_000;  // join + stub "model load"
const POCKET_CHAT_WAIT_MS = 35_000;  // pairing + back-and-forth

/** OfflineLLM test: load app with ?happypath=1, trigger stub model load, assert ready then send one message and get stub reply. */
const OFFLINELLM_LOAD_WAIT_MS = 15_000;  // stub "download & load"
const OFFLINELLM_CHAT_WAIT_MS = 10_000;   // one send + streamed reply

export async function runPocketChatTest(
  browser: Browser,
  baseUrl: string
): Promise<RunResult> {
  const start = Date.now();
  const testUrl = `${baseUrl.replace(/\/$/, "")}?happypath=1`;
  const pageA = await browser.newPage({
    ignoreHTTPSErrors: true,
    javaScriptEnabled: true,
  });
  const pageB = await browser.newPage({
    ignoreHTTPSErrors: true,
    javaScriptEnabled: true,
  });
  pageA.setDefaultTimeout(PAGE_TIMEOUT_MS);
  pageA.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
  pageB.setDefaultTimeout(PAGE_TIMEOUT_MS);
  pageB.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);

  try {
    const [resA, resB] = await Promise.all([
      pageA.goto(testUrl, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS }),
      pageB.goto(testUrl, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS }),
    ]);
    if ((resA && resA.status() >= 400) || (resB && resB.status() >= 400)) {
      return {
        appId: "pocket",
        baseUrl,
        passed: false,
        message: `HTTP ${resA?.status() ?? resB?.status()}`,
        durationMs: Date.now() - start,
      };
    }

    // Both: fill join form and submit (name, mission, then Enter the room)
    await pageA.getByPlaceholder("e.g. Alice").fill("Alice");
    await pageA.getByPlaceholder(/learn what others care about/i).fill("test mission");
    await pageA.getByRole("button", { name: /enter the room/i }).click();

    await pageB.getByPlaceholder("e.g. Alice").fill("Bob");
    await pageB.getByPlaceholder(/learn what others care about/i).fill("test mission");
    await pageB.getByRole("button", { name: /enter the room/i }).click();

    // Wait for both to show "agent ready" (stub model loads in ~2–3s with ?happypath=1)
    await pageA.getByTestId("pocket-agent-ready").waitFor({ state: "visible", timeout: POCKET_JOIN_WAIT_MS });
    await pageB.getByTestId("pocket-agent-ready").waitFor({ state: "visible", timeout: POCKET_JOIN_WAIT_MS });

    // Wait for the other user to appear (WebSocket), then initiator (Alice) pairs with Bob
    await pageA.getByTestId("pocket-pair-Bob").waitFor({ state: "visible", timeout: 10_000 });
    await pageA.getByTestId("pocket-pair-Bob").click();

    // Wait for at least 2 messages on both sides (opening + one reply = agent chat without human intervention)
    const messagesA = pageA.locator("[data-testid=pocket-messages] .msg-in");
    const messagesB = pageB.locator("[data-testid=pocket-messages] .msg-in");
    await messagesA.nth(1).waitFor({ state: "visible", timeout: POCKET_CHAT_WAIT_MS }).catch(() => {});
    await messagesB.nth(1).waitFor({ state: "visible", timeout: POCKET_CHAT_WAIT_MS }).catch(() => {});
    const countA = await messagesA.count();
    const countB = await messagesB.count();

    if (countA >= 2 && countB >= 2) {
      return {
        appId: "pocket",
        baseUrl,
        passed: true,
        message: `OK (${countA}+${countB} messages)`,
        durationMs: Date.now() - start,
      };
    }

    return {
      appId: "pocket",
      baseUrl,
      passed: false,
      message: `Expected ≥2 messages each; got ${countA} and ${countB}`,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      appId: "pocket",
      baseUrl,
      passed: false,
      message: message.slice(0, 200),
      durationMs: Date.now() - start,
    };
  } finally {
    await pageA.close().catch(() => {});
    await pageB.close().catch(() => {});
  }
}

/** OfflineLLM: stub model load (?happypath=1) then one round-trip chat. */
export async function runOfflinellmTest(
  browser: Browser,
  baseUrl: string
): Promise<RunResult> {
  const start = Date.now();
  const testUrl = `${baseUrl.replace(/\/$/, "")}?happypath=1`;
  const page = await browser.newPage({
    ignoreHTTPSErrors: true,
    javaScriptEnabled: true,
  });
  page.setDefaultTimeout(PAGE_TIMEOUT_MS);
  page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);

  try {
    const res = await page.goto(testUrl, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
    if (res && res.status() >= 400) {
      return {
        appId: "offlinellm",
        baseUrl,
        passed: false,
        message: `HTTP ${res.status()}`,
        durationMs: Date.now() - start,
      };
    }

    // Click "Download & load model" (stub runs, no real WebGPU needed)
    await page.getByRole("button", { name: /download & load model/i }).click();
    await page.getByTestId("offlinellm-ready").waitFor({ state: "visible", timeout: OFFLINELLM_LOAD_WAIT_MS });

    // One message and assert we get the stub reply
    await page.getByPlaceholder(/message/i).fill("Hi");
    await page.getByRole("button", { name: /send/i }).click();
    await page.locator("[data-testid=offlinellm-messages]").getByText("happypath test reply").waitFor({ state: "visible", timeout: OFFLINELLM_CHAT_WAIT_MS });

    return {
      appId: "offlinellm",
      baseUrl,
      passed: true,
      message: "OK (stub load + chat)",
      durationMs: Date.now() - start,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      appId: "offlinellm",
      baseUrl,
      passed: false,
      message: message.slice(0, 200),
      durationMs: Date.now() - start,
    };
  } finally {
    await page.close().catch(() => {});
  }
}

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
      const result =
        appId === "pocket"
          ? await runPocketChatTest(browser, baseUrl)
          : appId === "offlinellm"
            ? await runOfflinellmTest(browser, baseUrl)
            : await runTestForApp(browser, appId, baseUrl);
      results.push(result);
      console.log(result.passed ? "pass" : `fail: ${result.message}`);
    }
  } finally {
    await browser.close();
  }

  return results;
}
