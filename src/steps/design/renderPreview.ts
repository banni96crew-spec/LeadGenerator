import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";
import { assertValid } from "../../gates/validate.js";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

export type RenderPreviewResult = {
  screens: [string, string];
  console_errors_count: number;
  overflow_mobile: boolean;
};

function contentType(filePath: string): string {
  return MIME[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

async function startStaticServer(
  rootDir: string
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    try {
      const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0] || "/");
      let rel = urlPath === "/" ? "/index.html" : urlPath;
      const abs = path.normalize(path.join(rootDir, rel));
      if (!abs.startsWith(path.normalize(rootDir))) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      if (!existsSync(abs) || !statSync(abs).isFile()) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const body = readFileSync(abs);
      res.writeHead(200, { "Content-Type": contentType(abs) });
      res.end(body);
    } catch {
      res.writeHead(500);
      res.end("Error");
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind preview static server");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}/`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

/**
 * Render design/dist to preview PNGs; update build.json screens + console/overflow.
 */
export async function renderPreview(leadDir: string): Promise<RenderPreviewResult> {
  const distDir = path.join(leadDir, "design", "dist");
  const indexPath = path.join(distDir, "index.html");
  if (!existsSync(indexPath)) {
    throw new Error(`design/dist/index.html missing under ${leadDir}`);
  }

  const buildPath = path.join(leadDir, "design", "build.json");
  if (!existsSync(buildPath)) {
    throw new Error(`design/build.json missing under ${leadDir}`);
  }

  const desktopRel = "design/preview-desktop.png";
  const mobileRel = "design/preview-mobile.png";
  const desktopAbs = path.join(leadDir, desktopRel);
  const mobileAbs = path.join(leadDir, mobileRel);

  const server = await startStaticServer(distDir);
  const consoleErrors: string[] = [];
  let overflowMobile = false;

  const browser = await chromium.launch({ headless: true });
  try {
    const desktop = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const mobile = await browser.newContext({
      ...devices["iPhone 13"],
    });

    const desktopPage = await desktop.newPage();
    desktopPage.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    desktopPage.on("pageerror", (err: Error) => {
      consoleErrors.push(err.message);
    });
    await desktopPage.goto(server.baseUrl, {
      waitUntil: "load",
      timeout: 45_000,
    });
    await desktopPage.screenshot({ path: desktopAbs, fullPage: true });

    const mobilePage = await mobile.newPage();
    mobilePage.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    mobilePage.on("pageerror", (err: Error) => {
      consoleErrors.push(err.message);
    });
    await mobilePage.goto(server.baseUrl, {
      waitUntil: "load",
      timeout: 45_000,
    });
    overflowMobile = await mobilePage.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth > doc.clientWidth + 1;
    });
    await mobilePage.screenshot({ path: mobileAbs, fullPage: true });

    await desktop.close();
    await mobile.close();
  } finally {
    await browser.close();
    await server.close();
  }

  const build = JSON.parse(readFileSync(buildPath, "utf8")) as Record<
    string,
    unknown
  >;
  build.screens = [desktopRel, mobileRel];
  build.console_errors_count = consoleErrors.length;
  build.overflow_mobile = overflowMobile;
  assertValid(build, "design-build");
  writeFileSync(buildPath, JSON.stringify(build, null, 2));

  return {
    screens: [desktopRel, mobileRel],
    console_errors_count: consoleErrors.length,
    overflow_mobile: overflowMobile,
  };
}
