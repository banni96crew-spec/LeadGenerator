import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { assertValid } from "../../gates/validate.js";
import { resolveBrandTokens, type BrandTokens } from "../../lib/brandTokens.js";
import { REPO_ROOT } from "../../lib/paths.js";
import { renderMustache } from "./mustache.js";

const DEFAULT_TEMPLATE = "renovation-v1";
const DESIGN_SYSTEM_DIR = path.join(REPO_ROOT, "context", "design-system");

export type AssembleDesignResult = {
  template: string;
  brand_tokens: BrandTokens;
  build_dir: "design/dist";
  index_html: string;
  build_json: string;
};

type ContentJson = {
  schema_version: string;
  vertical: string;
  sections: {
    hero: { headline: string; subheadline: string; cta: string };
    benefits: Array<{ title: string; text: string }>;
    social_proof: { reviews?: string[]; cases?: string[] };
    contact: { phone: string; cta: string; phone_digits?: string };
  };
  reuse_facts: string[];
};

function phoneDigits(phone: string, explicit?: string): string {
  if (explicit && explicit.trim()) {
    return explicit.replace(/\D/g, "") || explicit.trim();
  }
  return phone.replace(/\D/g, "");
}

function resolveTemplateId(vertical: string): string {
  const trimmed = vertical.trim();
  if (!trimmed) return DEFAULT_TEMPLATE;

  const mdPath = path.join(
    REPO_ROOT,
    "context",
    "verticals",
    `${trimmed}.md`
  );
  if (existsSync(mdPath)) {
    const text = readFileSync(mdPath, "utf8");
    const match = text.match(/\|\s*`template`\s*\|\s*`([^`]+)`\s*\|/);
    if (match?.[1]?.trim()) return match[1].trim();
  }

  return `${trimmed}-v1`;
}

function readCaptureAssetPaths(leadDir: string): {
  logo?: string;
  photos: string[];
} {
  const metaPath = path.join(leadDir, "capture", "meta.json");
  if (!existsSync(metaPath)) return { photos: [] };
  try {
    const meta = JSON.parse(readFileSync(metaPath, "utf8")) as {
      assets?: { logo?: string; photos?: string[] };
    };
    const logo = meta.assets?.logo?.trim();
    const photos = Array.isArray(meta.assets?.photos)
      ? meta.assets.photos.filter((p) => typeof p === "string" && p.trim())
      : [];
    return {
      logo: logo || undefined,
      photos,
    };
  } catch {
    return { photos: [] };
  }
}

function copyDesignSystem(distDir: string): void {
  if (!existsSync(DESIGN_SYSTEM_DIR)) {
    throw new Error(`design-system missing: ${DESIGN_SYSTEM_DIR}`);
  }

  const shellSrc = path.join(DESIGN_SYSTEM_DIR, "shell.html");
  const tokensSrc = path.join(DESIGN_SYSTEM_DIR, "tokens.css");
  const baseSrc = path.join(DESIGN_SYSTEM_DIR, "base.css");
  for (const src of [shellSrc, tokensSrc, baseSrc]) {
    if (!existsSync(src)) {
      throw new Error(`design-system file missing: ${src}`);
    }
  }

  copyFileSync(tokensSrc, path.join(distDir, "tokens.css"));
  copyFileSync(baseSrc, path.join(distDir, "base.css"));

  const fontsSrc = path.join(DESIGN_SYSTEM_DIR, "fonts");
  if (existsSync(fontsSrc)) {
    const fontsDest = path.join(distDir, "fonts");
    mkdirSync(fontsDest, { recursive: true });
    for (const entry of readdirSync(fontsSrc, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      // Prefer per-file copy: recursive cpSync has crashed on some Windows paths.
      copyFileSync(
        path.join(fontsSrc, entry.name),
        path.join(fontsDest, entry.name)
      );
    }
  }
}

function copyCaptureAssets(
  leadDir: string,
  distAssetsDir: string,
  brand: BrandTokens
): string[] {
  mkdirSync(distAssetsDir, { recursive: true });
  const capture = readCaptureAssetPaths(leadDir);
  const copiedPhotoRels: string[] = [];

  if (brand.logo && capture.logo) {
    const srcAbs = path.join(leadDir, capture.logo);
    if (existsSync(srcAbs)) {
      const destName = path.basename(brand.logo);
      copyFileSync(srcAbs, path.join(distAssetsDir, destName));
    }
  } else if (capture.logo) {
    const srcAbs = path.join(leadDir, capture.logo);
    if (existsSync(srcAbs)) {
      copyFileSync(srcAbs, path.join(distAssetsDir, path.basename(capture.logo)));
    }
  }

  for (const rel of capture.photos) {
    const srcAbs = path.join(leadDir, rel);
    if (!existsSync(srcAbs)) continue;
    const base = path.basename(rel);
    copyFileSync(srcAbs, path.join(distAssetsDir, base));
    copiedPhotoRels.push(`assets/${base}`);
  }

  return copiedPhotoRels;
}

function buildView(opts: {
  content: ContentJson;
  brandName: string;
  brand: BrandTokens;
  photoSrcs: string[];
}): Record<string, unknown> {
  const contact = opts.content.sections.contact;
  const brand: Record<string, unknown> = {
    name: opts.brandName,
    primary: opts.brand.primary,
    font: opts.brand.font,
  };
  if (opts.brand.logo) {
    brand.logo = opts.brand.logo;
  }

  return {
    brand,
    hero: opts.content.sections.hero,
    benefits: opts.content.sections.benefits,
    social_proof: opts.content.sections.social_proof ?? {},
    contact: {
      phone: contact.phone,
      cta: contact.cta,
      phone_digits: phoneDigits(contact.phone, contact.phone_digits),
    },
    photos: opts.photoSrcs.map((src) => ({ src })),
  };
}

/**
 * Mechanical Design assembly: design-system shell + content slots + capture assets.
 */
export async function assembleDesign(
  leadDir: string
): Promise<AssembleDesignResult> {
  const contentPath = path.join(leadDir, "content.json");
  if (!existsSync(contentPath)) {
    throw new Error(`content.json missing under ${leadDir}`);
  }
  const content = JSON.parse(readFileSync(contentPath, "utf8")) as ContentJson;
  assertValid(content, "content");

  const leadPath = path.join(leadDir, "lead.json");
  if (!existsSync(leadPath)) {
    throw new Error(`lead.json missing under ${leadDir}`);
  }
  const lead = JSON.parse(readFileSync(leadPath, "utf8")) as { name?: string };
  const brandName = String(lead.name ?? "").trim();
  if (!brandName) {
    throw new Error(`lead.json name missing under ${leadDir}`);
  }

  const template = resolveTemplateId(content.vertical);
  const brand = resolveBrandTokens(leadDir);

  const designDir = path.join(leadDir, "design");
  const distDir = path.join(designDir, "dist");
  const assetsDir = path.join(distDir, "assets");

  if (existsSync(distDir)) {
    rmSync(distDir, { recursive: true, force: true });
  }
  mkdirSync(distDir, { recursive: true });

  copyDesignSystem(distDir);
  const photoSrcs = copyCaptureAssets(leadDir, assetsDir, brand);

  const shell = readFileSync(
    path.join(DESIGN_SYSTEM_DIR, "shell.html"),
    "utf8"
  );
  const view = buildView({ content, brandName, brand, photoSrcs });
  const html = renderMustache(shell, view);

  const indexRel = "design/dist/index.html";
  const indexAbs = path.join(leadDir, indexRel);
  writeFileSync(indexAbs, html, "utf8");

  const buildTokens: BrandTokens = {
    primary: brand.primary,
    font: brand.font,
  };
  if (brand.logo) {
    buildTokens.logo = brand.logo;
  }

  const build = {
    schema_version: "1.0",
    template,
    brand_tokens: buildTokens,
    build_dir: "design/dist" as const,
    screens: ["design/preview-desktop.png", "design/preview-mobile.png"],
  };
  assertValid(build, "design-build");

  const buildRel = "design/build.json";
  const buildAbs = path.join(leadDir, buildRel);
  mkdirSync(designDir, { recursive: true });
  writeFileSync(buildAbs, JSON.stringify(build, null, 2));

  return {
    template,
    brand_tokens: buildTokens,
    build_dir: "design/dist",
    index_html: indexRel,
    build_json: buildRel,
  };
}
