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

const DEFAULT_TEMPLATE = "atrium-v1";
const HEADER_PARTIAL = "header";
const BODY_PARTIALS = [
  "hero",
  "proof",
  "approach",
  "projects",
  "materials",
  "promise",
  "contact",
  "footer",
] as const;
const DEFAULT_PHOTO_RELS = [
  "assets/hero-house.webp",
  "assets/project-exterior.webp",
  "assets/project-interior.webp",
  "assets/hero-house.webp", // reuse for project3
  "assets/materials-detail.webp",
] as const;
const CONTACT_HOURS = "ежедневно 10:00–20:00";

const DESIGN_SYSTEM_DIR = path.join(REPO_ROOT, "context", "design-system");

type BuildBrandTokens = {
  primary: string;
  font: string;
  logo?: string;
};

export type AssembleDesignResult = {
  template: string;
  brand_tokens: BuildBrandTokens;
  build_dir: "design/dist";
  index_html: string;
  build_json: string;
};

type ContentJson = {
  schema_version: string;
  vertical: string;
  footer_tagline: string;
  sections: {
    hero: {
      headline: string;
      subheadline: string;
      cta_primary: string;
      cta_secondary: string;
    };
    proof: Array<{ value: string; label: string }>;
    approach: {
      eyebrow: string;
      h2: string;
      prose: string;
      steps: Array<{ title: string; text: string }>;
    };
    projects: {
      eyebrow: string;
      h2: string;
      lead: string;
      items: Array<{ title: string; text: string }>;
    };
    materials: {
      eyebrow: string;
      h2: string;
      prose: string;
      items: string[];
    };
  };
  reuse_facts: string[];
};

type LeadJson = {
  name?: string;
  phone?: string;
  geo?: string;
};

function phoneDigits(phone: string): string {
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

  return DEFAULT_TEMPLATE;
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

/** Copy all files under srcDir into destDir (recursive). Prefer per-file copy on Windows. */
function copyDirFiles(srcDir: string, destDir: string): void {
  if (!existsSync(srcDir)) return;
  mkdirSync(destDir, { recursive: true });
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirFiles(src, dest);
    } else if (entry.isFile()) {
      copyFileSync(src, dest);
    }
  }
}

function copyDesignSystem(distDir: string): void {
  if (!existsSync(DESIGN_SYSTEM_DIR)) {
    throw new Error(`design-system missing: ${DESIGN_SYSTEM_DIR}`);
  }

  const shellSrc = path.join(DESIGN_SYSTEM_DIR, "shell.html");
  const tokensSrc = path.join(DESIGN_SYSTEM_DIR, "tokens.css");
  const baseSrc = path.join(DESIGN_SYSTEM_DIR, "base.css");
  const mainJsSrc = path.join(DESIGN_SYSTEM_DIR, "main.js");
  for (const src of [shellSrc, tokensSrc, baseSrc, mainJsSrc]) {
    if (!existsSync(src)) {
      throw new Error(`design-system file missing: ${src}`);
    }
  }

  copyFileSync(tokensSrc, path.join(distDir, "tokens.css"));
  copyFileSync(baseSrc, path.join(distDir, "base.css"));
  copyFileSync(mainJsSrc, path.join(distDir, "main.js"));

  copyDirFiles(
    path.join(DESIGN_SYSTEM_DIR, "fonts"),
    path.join(distDir, "fonts")
  );
  copyDirFiles(
    path.join(DESIGN_SYSTEM_DIR, "assets"),
    path.join(distDir, "assets")
  );
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

/** Pad capture photos to ≥5 non-empty srcs using design-system defaults. */
function padPhotoSrcs(copiedPhotoRels: string[]): string[] {
  const photos = copiedPhotoRels
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const fallback of DEFAULT_PHOTO_RELS) {
    if (photos.length >= 5) break;
    photos.push(fallback);
  }
  return photos;
}

function contactNote(geo: string | undefined): string {
  const trimmed = geo?.trim() ?? "";
  if (trimmed) return `${trimmed} · ${CONTACT_HOURS}`;
  return CONTACT_HOURS;
}

function buildView(opts: {
  content: ContentJson;
  brandName: string;
  brand: BrandTokens;
  phone: string;
  geo?: string;
  photoSrcs: string[];
}): Record<string, unknown> {
  const brand: Record<string, unknown> = {
    name: opts.brandName,
    primary: opts.brand.primary,
    accent_hover: opts.brand.accent_hover,
    accent_soft: opts.brand.accent_soft,
    ink: opts.brand.ink,
    ink_soft: opts.brand.ink_soft,
    font: opts.brand.font,
  };
  if (opts.brand.logo) {
    brand.logo = opts.brand.logo;
  }

  const projects = opts.content.sections.projects;
  const materials = opts.content.sections.materials;

  return {
    brand,
    hero: opts.content.sections.hero,
    proof: opts.content.sections.proof,
    approach: opts.content.sections.approach,
    projects: {
      eyebrow: projects.eyebrow,
      h2: projects.h2,
      lead: projects.lead,
      items: projects.items,
    },
    materials: {
      eyebrow: materials.eyebrow,
      h2: materials.h2,
      prose: materials.prose,
      items: materials.items,
    },
    contact: {
      phone: opts.phone,
      phone_digits: phoneDigits(opts.phone),
      note: contactNote(opts.geo),
    },
    footer_tagline: opts.content.footer_tagline,
    photos: opts.photoSrcs.map((src) => ({ src })),
  };
}

function loadPartial(name: string): string {
  const partialPath = path.join(
    DESIGN_SYSTEM_DIR,
    "partials",
    `${name}.html`
  );
  if (!existsSync(partialPath)) {
    throw new Error(`design-system partial missing: ${partialPath}`);
  }
  return readFileSync(partialPath, "utf8").trim();
}

function loadPageTemplate(): string {
  const shellPath = path.join(DESIGN_SYSTEM_DIR, "shell.html");
  const shell = readFileSync(shellPath, "utf8");
  const headerMarker = "<!-- SLOT:header -->";
  const partialsMarker = "<!-- SLOT:partials -->";
  if (!shell.includes(headerMarker)) {
    throw new Error(`shell.html missing marker: ${headerMarker}`);
  }
  if (!shell.includes(partialsMarker)) {
    throw new Error(`shell.html missing marker: ${partialsMarker}`);
  }

  const header = loadPartial(HEADER_PARTIAL);
  const body = BODY_PARTIALS.map((name) => loadPartial(name)).join("\n\n");
  return shell
    .replace(headerMarker, header)
    .replace(partialsMarker, body);
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
  const lead = JSON.parse(readFileSync(leadPath, "utf8")) as LeadJson;
  const brandName = String(lead.name ?? "").trim();
  if (!brandName) {
    throw new Error(`lead.json name missing under ${leadDir}`);
  }
  const phone = String(lead.phone ?? "").trim();
  if (!phone) {
    throw new Error(`lead.phone required for atrium contact`);
  }

  const template = resolveTemplateId(content.vertical);
  const brand = resolveBrandTokens(leadDir);

  const designDir = path.join(leadDir, "design");
  const distDir = path.join(designDir, "dist");
  const assetsDir = path.join(distDir, "assets");

  // 1. Wipe dist
  if (existsSync(distDir)) {
    rmSync(distDir, { recursive: true, force: true });
  }
  mkdirSync(distDir, { recursive: true });

  // 2. Copy design-system defaults onto disk
  copyDesignSystem(distDir);

  // 3. Overlay capture logo/photos into dist/assets/
  const copiedPhotos = copyCaptureAssets(leadDir, assetsDir, brand);

  // 4. Build Mustache view (pad photos)
  const photoSrcs = padPhotoSrcs(copiedPhotos);
  const view = buildView({
    content,
    brandName,
    brand,
    phone,
    geo: lead.geo,
    photoSrcs,
  });

  // 5. Mustache render (SLOT:header + SLOT:partials)
  const shell = loadPageTemplate();
  const html = renderMustache(shell, view);

  // 6. Write index.html + build.json
  const indexRel = "design/dist/index.html";
  const indexAbs = path.join(leadDir, indexRel);
  writeFileSync(indexAbs, html, "utf8");

  const buildTokens: BuildBrandTokens = {
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
