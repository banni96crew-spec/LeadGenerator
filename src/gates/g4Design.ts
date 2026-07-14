import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import path from "node:path";
import { assertValid } from "./validate.js";
import type { GateContext, GateResult } from "../lib/types.js";

const MIN_PREVIEW_BYTES = 5120;
const MIN_CRITIC_SCORE = 4;
const CDN_FONT_RE = /fonts\.googleapis|fonts\.gstatic/i;

function formatGateError(
  ctx: GateContext,
  artifact: string,
  reason: string
): string {
  return `lead_id=${ctx.lead_id} stage=design gate=G4 artifact=${artifact} ${reason}`;
}

function collectDistFiles(distDir: string, exts: Set<string>): string[] {
  if (!existsSync(distDir)) return [];
  const out: string[] = [];
  const stack = [distDir];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, name.name);
      if (name.isDirectory()) {
        stack.push(abs);
      } else if (exts.has(path.extname(name.name).toLowerCase())) {
        out.push(abs);
      }
    }
  }
  return out;
}

function checkAssemblyInvariants(
  ctx: GateContext,
  build: Record<string, unknown>,
  errors: string[]
): void {
  const indexRel = "design/dist/index.html";
  const indexPath = path.join(ctx.leadDir, indexRel);
  const distDir = path.join(ctx.leadDir, "design", "dist");
  const html = readFileSync(indexPath, "utf8");

  if (html.includes("{{")) {
    errors.push(
      formatGateError(ctx, indexRel, "reason=leftover mustache {{ in index.html")
    );
  }

  const textFiles = [
    indexPath,
    ...collectDistFiles(distDir, new Set([".css", ".html"])),
  ];
  const seen = new Set<string>();
  for (const abs of textFiles) {
    if (seen.has(abs)) continue;
    seen.add(abs);
    const text = abs === indexPath ? html : readFileSync(abs, "utf8");
    if (CDN_FONT_RE.test(text)) {
      const rel = path.relative(ctx.leadDir, abs).replace(/\\/g, "/");
      errors.push(
        formatGateError(
          ctx,
          rel,
          "reason=forbidden font CDN (fonts.googleapis / fonts.gstatic)"
        )
      );
    }
  }

  const brandTokens = build.brand_tokens as {
    primary?: string;
    font?: string;
    logo?: string;
  };
  if (brandTokens?.logo) {
    const logoAbs = path.join(distDir, brandTokens.logo);
    if (!existsSync(logoAbs)) {
      errors.push(
        formatGateError(
          ctx,
          `design/dist/${brandTokens.logo}`,
          "reason=brand_tokens.logo file missing under dist"
        )
      );
    }
  }

  const imgSrcRe = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = imgSrcRe.exec(html)) !== null) {
    const src = match[1]!.trim();
    if (!src || /^(https?:|data:|\/\/)/i.test(src)) continue;
    const clean = src.split("?")[0]!.split("#")[0]!;
    const assetAbs = path.join(distDir, clean);
    if (!existsSync(assetAbs)) {
      errors.push(
        formatGateError(
          ctx,
          indexRel,
          `reason=img src missing under dist: ${clean}`
        )
      );
    }
  }

  const cssFiles = collectDistFiles(distDir, new Set([".css"]));
  const cssBlob = cssFiles.map((f) => readFileSync(f, "utf8")).join("\n");
  if (!cssBlob.includes("prefers-reduced-motion")) {
    errors.push(
      formatGateError(
        ctx,
        "design/dist",
        "reason=CSS missing prefers-reduced-motion"
      )
    );
  }
}

export type G4Options = {
  /** When true, skip critic.json checks (code-only pass before critic exists). */
  codeOnly?: boolean;
};

export function runGateG4(
  ctx: GateContext,
  options: G4Options = {}
): GateResult {
  const errors: string[] = [];
  const codeOnly = options.codeOnly === true;

  const indexRel = "design/dist/index.html";
  const indexPath = path.join(ctx.leadDir, indexRel);
  if (!existsSync(indexPath)) {
    return {
      pass: false,
      gate: "G4",
      errors: [formatGateError(ctx, indexRel, "reason=file missing")],
    };
  }

  const buildRel = "design/build.json";
  const buildPath = path.join(ctx.leadDir, buildRel);
  if (!existsSync(buildPath)) {
    return {
      pass: false,
      gate: "G4",
      errors: [formatGateError(ctx, buildRel, "reason=file missing")],
    };
  }

  let build: Record<string, unknown>;
  try {
    build = JSON.parse(readFileSync(buildPath, "utf8"));
    assertValid(build, "design-build");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(formatGateError(ctx, buildRel, `reason=${message}`));
    return { pass: false, gate: "G4", errors };
  }

  checkAssemblyInvariants(ctx, build, errors);

  const screens = build.screens as string[];
  for (const rel of screens) {
    const abs = path.join(ctx.leadDir, rel);
    if (!existsSync(abs)) {
      errors.push(formatGateError(ctx, rel, "reason=file missing"));
      continue;
    }
    const size = statSync(abs).size;
    if (size <= MIN_PREVIEW_BYTES) {
      errors.push(
        formatGateError(
          ctx,
          rel,
          `size=${size} required>${MIN_PREVIEW_BYTES}`
        )
      );
    }
  }

  if (typeof build.console_errors_count === "number") {
    if (build.console_errors_count !== 0) {
      errors.push(
        formatGateError(
          ctx,
          buildRel,
          `console_errors_count=${build.console_errors_count} required=0`
        )
      );
    }
  }

  if (build.overflow_mobile === true) {
    errors.push(
      formatGateError(ctx, buildRel, "reason=overflow_mobile=true")
    );
  }

  if (codeOnly) {
    return {
      pass: errors.length === 0,
      gate: "G4",
      errors,
    };
  }

  const criticRel = "design/critic.json";
  const criticPath = path.join(ctx.leadDir, criticRel);
  if (!existsSync(criticPath)) {
    errors.push(formatGateError(ctx, criticRel, "reason=file missing"));
    return { pass: false, gate: "G4", errors };
  }

  let critic: Record<string, unknown>;
  try {
    critic = JSON.parse(readFileSync(criticPath, "utf8"));
    assertValid(critic, "critic");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(formatGateError(ctx, criticRel, `reason=${message}`));
    return { pass: false, gate: "G4", errors };
  }

  if (critic.pass !== true) {
    errors.push(formatGateError(ctx, criticRel, "reason=pass=false"));
  }

  const scores = critic.scores as Record<string, number>;
  for (const key of ["trust", "modern", "sellable", "readable"] as const) {
    const value = scores[key];
    if (typeof value !== "number" || value < MIN_CRITIC_SCORE) {
      errors.push(
        formatGateError(
          ctx,
          criticRel,
          `score.${key}=${String(value)} required>=${MIN_CRITIC_SCORE}`
        )
      );
    }
  }

  return {
    pass: errors.length === 0,
    gate: "G4",
    errors,
  };
}
