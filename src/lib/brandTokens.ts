import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "./paths.js";

export type BrandTokens = {
  primary: string;
  font: string;
  logo?: string;
};

const DEFAULT_PRIMARY = "#1c2b24";
const DEFAULT_FONT = "Manrope, Segoe UI, system-ui, sans-serif";

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

/**
 * Code-only brand extraction for Design build.json.
 * Prefers capture logo path; primary/font from design-system defaults.
 */
export function resolveBrandTokens(leadDir: string): BrandTokens {
  const tokens: BrandTokens = {
    primary: readDesignSystemPrimary(),
    font: DEFAULT_FONT,
  };

  const logoCapture = path.join(leadDir, "capture", "logo.png");
  if (existsSync(logoCapture)) {
    tokens.logo = "assets/logo.png";
  }

  return tokens;
}
