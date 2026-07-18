import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "./paths.js";

export type BrandTokens = {
  primary: string;
  accent_hover: string;
  accent_soft: string;
  ink: string;
  ink_soft: string;
  font: string;
  logo?: string;
};

const DEFAULT_PRIMARY = "#9c7a3c";
const DEFAULT_ACCENT_HOVER = "#856632";
const DEFAULT_ACCENT_SOFT = "#e4c48a";
const DEFAULT_INK = "#14161a";
const DEFAULT_INK_SOFT = "#3a3d44";
const DEFAULT_FONT = "Onest, Manrope, Segoe UI, sans-serif";

function readDesignSystemPrimary(): string {
  const tokensPath = path.join(
    REPO_ROOT,
    "context",
    "design-system",
    "tokens.css"
  );
  if (!existsSync(tokensPath)) return DEFAULT_PRIMARY;
  const css = readFileSync(tokensPath, "utf8");
  const match = css.match(/--color-primary:\s*([^;]+);/);
  return match?.[1]?.trim() || DEFAULT_PRIMARY;
}

function resolveCaptureLogoRel(leadDir: string): string | undefined {
  const metaPath = path.join(leadDir, "capture", "meta.json");
  if (existsSync(metaPath)) {
    try {
      const meta = JSON.parse(readFileSync(metaPath, "utf8")) as {
        assets?: { logo?: string };
      };
      const logo = meta.assets?.logo?.trim();
      if (logo && existsSync(path.join(leadDir, logo))) {
        return logo;
      }
    } catch {
      /* fall through */
    }
  }

  const captureDir = path.join(leadDir, "capture");
  if (!existsSync(captureDir)) return undefined;
  const match = readdirSync(captureDir).find((name) =>
    /^logo\.(png|jpe?g|webp|svg|gif)$/i.test(name)
  );
  return match ? `capture/${match}` : undefined;
}

/**
 * Code-only brand extraction for Design build.json.
 * Logo path from capture/meta.json assets.logo (any extension).
 * Color tokens cascade into fixed sections via :root CSS vars.
 */
export function resolveBrandTokens(leadDir: string): BrandTokens {
  const tokens: BrandTokens = {
    primary: readDesignSystemPrimary(),
    accent_hover: DEFAULT_ACCENT_HOVER,
    accent_soft: DEFAULT_ACCENT_SOFT,
    ink: DEFAULT_INK,
    ink_soft: DEFAULT_INK_SOFT,
    font: DEFAULT_FONT,
  };

  const logoRel = resolveCaptureLogoRel(leadDir);
  if (logoRel) {
    const base = path.basename(logoRel);
    tokens.logo = `assets/${base}`;
  }

  return tokens;
}
