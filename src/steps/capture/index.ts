import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";
import { assertValid } from "../../gates/validate.js";
import { normalizeSiteUrl } from "../../lib/paths.js";
import type { Lead } from "../../lib/types.js";
import { downloadAssets } from "./assets.js";
import { extractPageText, extractSignals } from "./extract.js";
import { dismissCookieBanners, preparePage } from "./screenshots.js";

export type CaptureOptions = {
  attempt?: number;
};

export async function runCapture(
  lead: Lead,
  leadDirPath: string,
  options: CaptureOptions = {}
): Promise<string> {
  const attempt = options.attempt ?? 0;
  const url = normalizeSiteUrl(lead.site ?? "");
  if (!url) {
    throw new Error("lead.site is required for capture");
  }

  const dir = path.join(leadDirPath, "capture");
  mkdirSync(dir, { recursive: true });

  const desktopPath = path.join(dir, "desktop.png");
  const mobilePath = path.join(dir, "mobile.png");
  const textPath = path.join(dir, "text.txt");

  let httpStatus = 0;
  let signals = {
    https: url.startsWith("https://"),
    mobile_friendly: false,
    has_cta: false,
    has_form: false,
  };
  let assets: { logo?: string; photos: string[] } = { photos: [] };
  let pageText = "";

  const browser = await chromium.launch();
  try {
    const desktopContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const desktopPage = await desktopContext.newPage();
    const response = await desktopPage.goto(url, {
      waitUntil: "load",
      timeout: 45_000,
    });
    httpStatus = response?.status() ?? 0;

    await preparePage(desktopPage, attempt);
    pageText = await extractPageText(desktopPage);
    signals = await extractSignals(desktopPage, url);
    assets = await downloadAssets(desktopPage, dir);
    await desktopPage.screenshot({ path: desktopPath, fullPage: true });
    await desktopContext.close();

    const mobileContext = await browser.newContext({
      ...devices["iPhone 13"],
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(url, { waitUntil: "load", timeout: 45_000 });
    await preparePage(mobilePage, attempt);
    await dismissCookieBanners(mobilePage);
    await mobilePage.screenshot({ path: mobilePath, fullPage: true });
    await mobileContext.close();
  } finally {
    await browser.close();
  }

  writeFileSync(textPath, pageText, "utf8");

  const meta = {
    schema_version: "1.0" as const,
    url,
    http_status: httpStatus,
    screenshots: {
      desktop: "capture/desktop.png",
      mobile: "capture/mobile.png",
    },
    extracted_text: "capture/text.txt",
    assets,
    signals,
  };

  const metaPath = path.join(dir, "meta.json");
  assertValid(meta, "capture-meta");
  writeFileSync(metaPath, JSON.stringify(meta, null, 2));

  return "capture/meta.json";
}
