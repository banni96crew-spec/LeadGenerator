import { readdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { imageSize } from "image-size";
import type { APIRequestContext, Page } from "playwright";
import {
  MAX_CANDIDATES,
  MAX_PHOTOS,
  MIN_LOGO_BYTES,
  MIN_LOGO_RASTER_BYTES,
  MIN_PHOTO_BYTES,
  MIN_PHOTO_HEIGHT,
  MIN_PHOTO_WIDTH,
  type ImageCandidate,
  hasIconUrlMarker,
  isDataUrl,
  isLogoRasterEligible,
  isPhotoCandidateEligible,
  isSvgUrl,
  resolveExtension,
  sortByAreaDesc,
} from "./assetsHelpers.js";

function clearPreviousAssets(captureDirAbs: string): void {
  for (const name of readdirSync(captureDirAbs)) {
    if (/^(photo-\d+|logo)\./i.test(name)) {
      try {
        unlinkSync(path.join(captureDirAbs, name));
      } catch {
        /* ignore */
      }
    }
  }
}

export type AssetPaths = {
  logo?: string;
  photos: string[];
};

type DomAssetInfo = {
  logo: ImageCandidate | null;
  photos: ImageCandidate[];
};

async function scrollForLazyImages(page: Page): Promise<void> {
  // String evaluate avoids tsx/esbuild `__name` injection in the browser.
  await page.evaluate(`(async () => {
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));
    const height = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    );
    const step = Math.max(400, Math.floor(window.innerHeight * 0.8));
    for (let y = 0; y < height; y += step) {
      window.scrollTo(0, y);
      await delay(120);
    }
    window.scrollTo(0, 0);
    await delay(200);
  })()`);
}

async function fetchBuffer(
  request: APIRequestContext,
  url: string
): Promise<{ buffer: Buffer; contentType: string | null } | null> {
  try {
    const response = await request.get(url, { timeout: 15_000 });
    if (!response.ok()) return null;
    const buffer = Buffer.from(await response.body());
    const contentType = response.headers()["content-type"] ?? null;
    return { buffer, contentType };
  } catch {
    return null;
  }
}

function validatePhotoBuffer(buffer: Buffer, dest: string): boolean {
  if (buffer.length < MIN_PHOTO_BYTES) return false;
  try {
    const dims = imageSize(dest);
    if (
      !dims.width ||
      !dims.height ||
      dims.width < MIN_PHOTO_WIDTH ||
      dims.height < MIN_PHOTO_HEIGHT
    ) {
      return false;
    }
  } catch {
    return false;
  }
  return true;
}

export async function downloadAssets(
  page: Page,
  captureDirAbs: string
): Promise<AssetPaths> {
  const result: AssetPaths = { photos: [] };
  const request = page.request;

  clearPreviousAssets(captureDirAbs);
  await scrollForLazyImages(page);

  // String evaluate avoids tsx/esbuild `__name` injection in the browser.
  // Skip SVG/tiny imgs before the 30-cap so real photos further down still qualify.
  const assetInfo = (await page.evaluate(`(() => {
    const ICON_MARKERS = ["icon","sprite","arrow","chevron","bullet","spacer","1x1","pixel","favicon","emoji"];
    const isSvg = (u) => /\\.svg(\\?|#|$)/i.test(u);
    const hasIcon = (u) => {
      const lower = u.toLowerCase();
      return ICON_MARKERS.some((m) => lower.includes(m));
    };
    const absUrl = (a) => {
      try { return new URL(a, document.baseURI).href; } catch { return a.trim(); }
    };
    const pickUrl = (img) => {
      const attrs = [
        img.currentSrc,
        img.src,
        img.getAttribute("data-src"),
        img.getAttribute("data-lazy-src"),
        img.getAttribute("data-original"),
      ];
      const srcset =
        img.getAttribute("srcset") || img.getAttribute("data-srcset") || "";
      if (srcset) {
        const parts = srcset.split(",").map((p) => p.trim()).filter(Boolean);
        let bestUrl = null;
        let bestScore = -1;
        for (const part of parts) {
          const bits = part.split(/\\s+/);
          const url = bits[0];
          if (!url) continue;
          let score = 0;
          const desc = bits[1] || "";
          const wMatch = /^(\\d+)w$/i.exec(desc);
          const xMatch = /^([\\d.]+)x$/i.exec(desc);
          if (wMatch) score = Number(wMatch[1]);
          else if (xMatch) score = Number(xMatch[1]) * 1000;
          if (score >= bestScore) { bestScore = score; bestUrl = url; }
        }
        if (bestUrl) attrs.unshift(bestUrl);
      }
      for (const a of attrs) {
        if (a && a.trim() && !a.startsWith("data:")) return absUrl(a);
      }
      return null;
    };

    const logoImg =
      Array.from(document.querySelectorAll("img")).find((img) => {
        const src = (img.getAttribute("src") || "").toLowerCase();
        const alt = (img.getAttribute("alt") || "").toLowerCase();
        return src.includes("logo") || alt.includes("logo");
      }) ||
      document.querySelector("header img") ||
      document.querySelector("nav img");

    let logo = null;
    if (logoImg) {
      const url = pickUrl(logoImg);
      if (url) {
        logo = {
          url,
          width: logoImg.naturalWidth || 0,
          height: logoImg.naturalHeight || 0,
          kind: "logo",
        };
      }
    }

    const raw = [];
    const seen = new Set();
    const pushPhoto = (url, width, height) => {
      if (!url || seen.has(url)) return;
      if (isSvg(url) || hasIcon(url)) return;
      const w = width || 0;
      const h = height || 0;
      if (w > 0 && h > 0 && (w < 400 || h < 300)) return;
      seen.add(url);
      raw.push({ url, width: w, height: h, kind: "photo" });
    };

    for (const node of Array.from(document.querySelectorAll("img"))) {
      const url = pickUrl(node);
      if (!url) continue;
      pushPhoto(url, node.naturalWidth || 0, node.naturalHeight || 0);
    }

    for (const el of Array.from(document.querySelectorAll("*"))) {
      const bg = getComputedStyle(el).backgroundImage;
      if (!bg || bg === "none" || !bg.includes("url(")) continue;
      const m = /url\\((['\"]?)([^'\")]+)\\1\\)/.exec(bg);
      if (!m) continue;
      const url = absUrl(m[2]);
      pushPhoto(url, el.clientWidth || 0, el.clientHeight || 0);
    }

    raw.sort((a, b) => (b.width * b.height) - (a.width * a.height));
    return { logo, photos: raw.slice(0, 30) };
  })()`)) as DomAssetInfo;

  if (assetInfo.logo?.url && !isDataUrl(assetInfo.logo.url)) {
    const logoUrl = assetInfo.logo.url;
    const fetched = await fetchBuffer(request, logoUrl);
    if (fetched) {
      const ext = resolveExtension(fetched.contentType, fetched.buffer, logoUrl);
      const isSvg =
        ext === ".svg" ||
        isSvgUrl(logoUrl) ||
        (fetched.contentType ?? "").includes("svg");
      const minBytes = isSvg ? MIN_LOGO_BYTES : MIN_LOGO_RASTER_BYTES;
      const dimsOk =
        isSvg ||
        isLogoRasterEligible(assetInfo.logo.width, assetInfo.logo.height);
      if (fetched.buffer.length >= minBytes && dimsOk && ext !== ".bin") {
        const rel = `capture/logo${ext}`;
        const abs = path.join(captureDirAbs, `logo${ext}`);
        writeFileSync(abs, fetched.buffer);
        if (!isSvg) {
          try {
            const dims = imageSize(abs);
            if (
              dims.width &&
              dims.height &&
              (dims.width < 32 || dims.height < 32)
            ) {
              unlinkSync(abs);
            } else {
              result.logo = rel;
            }
          } catch {
            unlinkSync(abs);
          }
        } else {
          result.logo = rel;
        }
      }
    }
  }

  const photoCandidates = sortByAreaDesc(
    assetInfo.photos
      .filter((c) => c.url !== assetInfo.logo?.url)
      .filter(isPhotoCandidateEligible)
  ).slice(0, MAX_CANDIDATES);

  const seen = new Set<string>();
  if (assetInfo.logo?.url) seen.add(assetInfo.logo.url);

  let photoIndex = 0;
  for (const candidate of photoCandidates) {
    if (photoIndex >= MAX_PHOTOS) break;
    if (seen.has(candidate.url)) continue;
    if (hasIconUrlMarker(candidate.url)) continue;
    seen.add(candidate.url);

    const fetched = await fetchBuffer(request, candidate.url);
    if (!fetched) continue;

    const ext = resolveExtension(
      fetched.contentType,
      fetched.buffer,
      candidate.url
    );
    if (ext === ".svg" || ext === ".bin") continue;
    if ((fetched.contentType ?? "").includes("svg")) continue;

    const fileName = `photo-${photoIndex + 1}${ext}`;
    const abs = path.join(captureDirAbs, fileName);
    writeFileSync(abs, fetched.buffer);

    if (!validatePhotoBuffer(fetched.buffer, abs)) {
      try {
        unlinkSync(abs);
      } catch {
        /* ignore */
      }
      continue;
    }

    result.photos.push(`capture/${fileName}`);
    photoIndex += 1;
  }

  return result;
}
