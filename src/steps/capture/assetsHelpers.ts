/** Pure helpers for Capture asset filtering — unit-tested without Playwright. */

export const MAX_PHOTOS = 3;
export const MAX_CANDIDATES = 30;
export const MIN_PHOTO_BYTES = 20_000;
export const MIN_PHOTO_WIDTH = 400;
export const MIN_PHOTO_HEIGHT = 300;
export const MIN_LOGO_BYTES = 500;
export const MIN_LOGO_RASTER_BYTES = 2_000;
export const MIN_LOGO_RASTER_SIDE = 32;

const ICON_URL_MARKERS = [
  "icon",
  "sprite",
  "arrow",
  "chevron",
  "bullet",
  "spacer",
  "1x1",
  "pixel",
  "favicon",
  "emoji",
];

export type ImageCandidate = {
  url: string;
  width: number;
  height: number;
  kind: "logo" | "photo";
};

export function isDataUrl(url: string): boolean {
  return url.trim().toLowerCase().startsWith("data:");
}

export function isSvgUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return pathname.endsWith(".svg");
  } catch {
    return /\.svg(\?|#|$)/i.test(url);
  }
}

export function hasIconUrlMarker(url: string): boolean {
  const lower = url.toLowerCase();
  return ICON_URL_MARKERS.some((m) => lower.includes(m));
}

export function area(c: ImageCandidate): number {
  return Math.max(0, c.width) * Math.max(0, c.height);
}

export function sortByAreaDesc(candidates: ImageCandidate[]): ImageCandidate[] {
  return [...candidates].sort((a, b) => area(b) - area(a));
}

export function isPhotoCandidateEligible(c: ImageCandidate): boolean {
  if (!c.url || isDataUrl(c.url)) return false;
  if (isSvgUrl(c.url)) return false;
  if (hasIconUrlMarker(c.url)) return false;
  // natural=0 → still download; validate after save
  if (c.width > 0 && c.height > 0) {
    if (c.width < MIN_PHOTO_WIDTH || c.height < MIN_PHOTO_HEIGHT) return false;
  }
  return true;
}

export function isLogoRasterEligible(width: number, height: number): boolean {
  if (width <= 0 || height <= 0) return true; // unknown — check after download
  return width >= MIN_LOGO_RASTER_SIDE && height >= MIN_LOGO_RASTER_SIDE;
}

export function extensionFromContentType(contentType: string | null): string | null {
  if (!contentType) return null;
  const ct = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (ct === "image/jpeg" || ct === "image/jpg") return ".jpg";
  if (ct === "image/png") return ".png";
  if (ct === "image/webp") return ".webp";
  if (ct === "image/gif") return ".gif";
  if (ct === "image/svg+xml") return ".svg";
  return null;
}

export function sniffImageExtension(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return ".jpg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return ".png";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return ".webp";
  }
  if (
    buffer.length >= 6 &&
    (buffer.toString("ascii", 0, 6) === "GIF87a" ||
      buffer.toString("ascii", 0, 6) === "GIF89a")
  ) {
    return ".gif";
  }
  const head = buffer.subarray(0, Math.min(256, buffer.length)).toString("utf8").trimStart();
  if (head.startsWith("<svg") || head.startsWith("<?xml")) {
    return ".svg";
  }
  return null;
}

export function resolveExtension(
  contentType: string | null,
  buffer: Buffer,
  url: string
): string {
  return (
    extensionFromContentType(contentType) ??
    sniffImageExtension(buffer) ??
    (isSvgUrl(url) ? ".svg" : ".bin")
  );
}

export function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    const key = u.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

/** Largest URL from srcset attribute value. */
export function largestFromSrcset(srcset: string): string | null {
  const parts = srcset
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return null;
  let bestUrl: string | null = null;
  let bestScore = -1;
  for (const part of parts) {
    const bits = part.split(/\s+/);
    const url = bits[0];
    if (!url) continue;
    let score = 0;
    const desc = bits[1] ?? "";
    const w = /^(\d+)w$/i.exec(desc);
    const x = /^([\d.]+)x$/i.exec(desc);
    if (w) score = Number(w[1]);
    else if (x) score = Number(x[1]) * 1000;
    if (score >= bestScore) {
      bestScore = score;
      bestUrl = url;
    }
  }
  return bestUrl;
}
