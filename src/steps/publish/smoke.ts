import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { launch as launchChrome } from "chrome-launcher";
import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";
import { chromium } from "playwright";
import { assertValid } from "../../gates/validate.js";
import type { DeployArtifact } from "./index.js";
import { loadPublishEnv } from "./env.js";

export type SmokeChecks = {
  http_200: boolean;
  no_console_errors: boolean;
  lighthouse_perf: number;
};

export type SmokeResult = {
  pass: boolean;
  checks: SmokeChecks;
  errors: string[];
};

const HTTP_READY_ATTEMPTS = 8;
const HTTP_READY_DELAY_MS = 2_000;

function isPlaceholderUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host === "example.com" ||
      host.endsWith(".example.com") ||
      host === "localhost" ||
      host === "127.0.0.1"
    );
  } catch {
    return true;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkHttp200(url: string): Promise<{ ok: boolean; status: number; error?: string }> {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    return { ok: res.status === 200, status: res.status };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Retry briefly after deploy while branch alias / DNS propagates. */
async function waitForHttp200(
  url: string
): Promise<{ ok: boolean; status: number; error?: string; attempts: number }> {
  let last = await checkHttp200(url);
  for (let attempt = 1; attempt < HTTP_READY_ATTEMPTS; attempt += 1) {
    if (last.ok) {
      return { ...last, attempts: attempt };
    }
    await sleep(HTTP_READY_DELAY_MS);
    last = await checkHttp200(url);
  }
  return { ...last, attempts: HTTP_READY_ATTEMPTS };
}

async function checkConsoleErrors(url: string): Promise<{ ok: boolean; errors: string[] }> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      consoleErrors.push(err.message);
    });
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    return { ok: consoleErrors.length === 0, errors: consoleErrors };
  } finally {
    await browser.close();
  }
}

/**
 * Run Lighthouse performance via Playwright Chromium (chromePath).
 * Fail-loud if Chromium binary or Lighthouse cannot launch — no skip stub.
 */
async function runLighthousePerf(url: string): Promise<number> {
  let chromePath: string;
  try {
    chromePath = chromium.executablePath();
  } catch (err) {
    throw new Error(
      `Lighthouse requires Playwright Chromium executablePath(); failed: ${
        err instanceof Error ? err.message : String(err)
      }. Run: npx playwright install chromium`
    );
  }

  if (!chromePath || !existsSync(chromePath)) {
    throw new Error(
      `Playwright Chromium not found at ${chromePath || "(empty path)"}. Run: npx playwright install chromium`
    );
  }

  if (typeof lighthouse !== "function") {
    throw new Error(
      "lighthouse package did not export a callable default. Ensure dependency `lighthouse` is installed."
    );
  }

  let chrome: Awaited<ReturnType<typeof launchChrome>> | undefined;
  try {
    chrome = await launchChrome({
      chromePath,
      chromeFlags: ["--headless=new", "--disable-gpu", "--no-sandbox"],
    });
  } catch (err) {
    throw new Error(
      `Failed to launch Playwright Chromium for Lighthouse (chromePath=${chromePath}): ${
        err instanceof Error ? err.message : String(err)
      }. Run: npx playwright install chromium`
    );
  }

  try {
    // Desktop config for static Pages demos (default mobile throttle is not the M4 target).
    const runnerResult = await lighthouse(
      url,
      {
        port: chrome.port,
        logLevel: "error",
        output: "json",
        onlyCategories: ["performance"],
      },
      desktopConfig
    );

    if (!runnerResult?.lhr?.categories?.performance) {
      throw new Error("Lighthouse completed but performance category is missing from results");
    }

    const score01 = runnerResult.lhr.categories.performance.score;
    if (score01 == null || !Number.isFinite(score01)) {
      const runtimeError = runnerResult.lhr.runtimeError;
      const detail = runtimeError
        ? ` runtimeError=${runtimeError.code}: ${runtimeError.message}`
        : "";
      throw new Error(`Lighthouse performance score is null or invalid.${detail}`);
    }

    return Math.round(score01 * 100);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Failed to launch")) {
      throw err;
    }
    if (err instanceof Error && err.message.startsWith("Lighthouse")) {
      throw err;
    }
    throw new Error(
      `Lighthouse run failed: ${err instanceof Error ? err.message : String(err)}`
    );
  } finally {
    await chrome.kill();
  }
}

/**
 * Post-deploy smoke for G5: HTTP 200, Playwright console errors, required Lighthouse.
 * Merges checks into deploy.json and validates schema. Does not touch state.json.
 */
export async function smokeTestUrl(url: string, leadDir: string): Promise<SmokeResult> {
  const trimmed = url.trim();
  const errors: string[] = [];

  if (!trimmed) {
    throw new Error(`smokeTestUrl: empty url (leadDir=${leadDir})`);
  }
  if (!trimmed.startsWith("https://")) {
    throw new Error(`smokeTestUrl: demo_url must be https (got ${trimmed})`);
  }
  if (isPlaceholderUrl(trimmed)) {
    throw new Error(`smokeTestUrl: refusing placeholder demo_url ${trimmed}`);
  }

  const deployPath = path.join(leadDir, "deploy.json");
  if (!existsSync(deployPath)) {
    throw new Error(`smokeTestUrl: missing deploy.json at ${deployPath}`);
  }

  const env = loadPublishEnv();

  const http = await waitForHttp200(trimmed);
  const http_200 = http.ok;
  if (!http_200) {
    errors.push(
      http.error
        ? `http_200: fetch failed after ${http.attempts} attempts (${http.error})`
        : `http_200: expected 200 got ${http.status} after ${http.attempts} attempts`
    );
  }

  let no_console_errors = false;
  try {
    const consoleCheck = await checkConsoleErrors(trimmed);
    no_console_errors = consoleCheck.ok;
    if (!no_console_errors) {
      errors.push(
        `no_console_errors: ${consoleCheck.errors.slice(0, 5).join(" | ") || "console errors present"}`
      );
    }
  } catch (err) {
    throw new Error(
      `smokeTestUrl: Playwright console check failed: ${
        err instanceof Error ? err.message : String(err)
      }. Ensure Playwright Chromium is installed (npx playwright install chromium).`
    );
  }

  // Lighthouse is required — but only after the URL is reachable. Running LH on
  // HTTP 404 yields categories.performance.score=null (runtimeError), which
  // previously masked the real deploy URL / readiness failure.
  if (!http_200) {
    throw new Error(
      `smokeTestUrl: demo_url not HTTP 200 after ${http.attempts} attempts ` +
        `(${http.error ?? `status=${http.status}`}); refusing Lighthouse on unreachable URL: ${trimmed}`
    );
  }

  const lighthouse_perf = await runLighthousePerf(trimmed);
  if (lighthouse_perf < env.lighthousePerfMin) {
    errors.push(
      `lighthouse_perf: ${lighthouse_perf} < LIGHTHOUSE_PERF_MIN=${env.lighthousePerfMin}`
    );
  }

  const checks: SmokeChecks = {
    http_200,
    no_console_errors,
    lighthouse_perf,
  };

  const existing = JSON.parse(readFileSync(deployPath, "utf8")) as DeployArtifact;
  const next: DeployArtifact = {
    schema_version: "1.0",
    demo_url: existing.demo_url || trimmed,
    checks,
  };

  assertValid(next, "deploy");
  writeFileSync(deployPath, JSON.stringify(next, null, 2), "utf8");

  const pass =
    http_200 &&
    no_console_errors &&
    lighthouse_perf >= env.lighthousePerfMin;

  return { pass, checks, errors };
}
