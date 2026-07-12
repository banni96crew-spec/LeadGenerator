import { writeFileSync } from "node:fs";
import path from "node:path";
import type { Page, APIRequestContext } from "playwright";

const MAX_PHOTOS = 3;

export type AssetPaths = {
  logo?: string;
  photos: string[];
};

async function downloadAsset(
  request: APIRequestContext,
  url: string,
  dest: string
): Promise<boolean> {
  try {
    const response = await request.get(url, { timeout: 15_000 });
    if (!response.ok()) return false;
    const buffer = await response.body();
    if (buffer.length < 100) return false;
    writeFileSync(dest, buffer);
    return true;
  } catch {
    return false;
  }
}

export async function downloadAssets(
  page: Page,
  captureDirAbs: string
): Promise<AssetPaths> {
  const result: AssetPaths = { photos: [] };
  const request = page.request;

  const assetInfo = await page.evaluate(() => {
    const logoImg =
      Array.from(document.querySelectorAll("img")).find((img) => {
        const src = (img.getAttribute("src") ?? "").toLowerCase();
        const alt = (img.getAttribute("alt") ?? "").toLowerCase();
        return src.includes("logo") || alt.includes("logo");
      }) ??
      document.querySelector("header img") ??
      document.querySelector("nav img");

    const photoUrls = Array.from(document.querySelectorAll("img"))
      .map((img) => (img as HTMLImageElement).src)
      .filter((src) => src && !src.startsWith("data:"))
      .slice(0, 5);

    return {
      logoUrl: logoImg ? (logoImg as HTMLImageElement).src : null,
      photoUrls,
    };
  });

  if (assetInfo.logoUrl) {
    const logoPath = path.join(captureDirAbs, "logo.png");
    const ok = await downloadAsset(request, assetInfo.logoUrl, logoPath);
    if (ok) result.logo = "capture/logo.png";
  }

  let photoIndex = 0;
  for (const photoUrl of assetInfo.photoUrls) {
    if (photoIndex >= MAX_PHOTOS) break;
    if (photoUrl === assetInfo.logoUrl) continue;
    const rel = `capture/photo-${photoIndex + 1}.png`;
    const ok = await downloadAsset(
      request,
      photoUrl,
      path.join(captureDirAbs, `photo-${photoIndex + 1}.png`)
    );
    if (ok) {
      result.photos.push(rel);
      photoIndex += 1;
    }
  }

  return result;
}
