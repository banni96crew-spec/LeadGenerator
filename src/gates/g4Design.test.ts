import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { runGateG4 } from "./g4Design.js";

function writePassingDist(
  leadDir: string,
  opts: {
    html?: string;
    css?: string;
    logo?: boolean;
    brandLogo?: string;
    imgSrc?: string;
  } = {}
): void {
  const designDir = path.join(leadDir, "design");
  const distDir = path.join(designDir, "dist");
  const assetsDir = path.join(distDir, "assets");
  mkdirSync(assetsDir, { recursive: true });

  const imgSrc = opts.imgSrc ?? "assets/photo-1.jpg";
  writeFileSync(
    path.join(distDir, "index.html"),
    opts.html ??
      `<!doctype html><html><body><img src="${imgSrc}" alt="" /><p>ok</p></body></html>`
  );
  writeFileSync(
    path.join(distDir, "base.css"),
    opts.css ??
      `@media (prefers-reduced-motion: reduce) { * { animation: none; } }\nbody { color: #111; }\n`
  );
  writeFileSync(path.join(assetsDir, "photo-1.jpg"), Buffer.alloc(100, 1));
  if (opts.logo !== false) {
    writeFileSync(path.join(assetsDir, "logo.svg"), "<svg/>");
  }

  writeFileSync(
    path.join(designDir, "build.json"),
    JSON.stringify(
      {
        schema_version: "1.0",
        template: "atrium-v1",
        brand_tokens: {
          primary: "#1c2b24",
          font: "Manrope, system-ui, sans-serif",
          ...(opts.brandLogo !== undefined
            ? opts.brandLogo
              ? { logo: opts.brandLogo }
              : {}
            : { logo: "assets/logo.svg" }),
        },
        build_dir: "design/dist",
        screens: ["design/preview-desktop.png", "design/preview-mobile.png"],
        console_errors_count: 0,
        overflow_mobile: false,
      },
      null,
      2
    )
  );
}

function writePreviews(leadDir: string): void {
  writeFileSync(
    path.join(leadDir, "design", "preview-desktop.png"),
    Buffer.alloc(6000, 1)
  );
  writeFileSync(
    path.join(leadDir, "design", "preview-mobile.png"),
    Buffer.alloc(6000, 1)
  );
}

function writeCritic(
  leadDir: string,
  overrides: Record<string, unknown> = {}
): void {
  writeFileSync(
    path.join(leadDir, "design", "critic.json"),
    JSON.stringify(
      {
        schema_version: "1.0",
        pass: true,
        gate: "G4",
        scores: { trust: 4, modern: 5, sellable: 4, readable: 5 },
        notes: ["ok"],
        ...overrides,
      },
      null,
      2
    )
  );
}

describe("runGateG4", () => {
  it("passes with build, previews, and critic", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g4-"));
    writePassingDist(leadDir);
    writePreviews(leadDir);
    writeCritic(leadDir);
    const result = runGateG4({ lead_id: "t", leadDir });
    assert.equal(result.pass, true);
  });

  it("fails when preview missing", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g4-"));
    writePassingDist(leadDir);
    writeCritic(leadDir);
    const result = runGateG4({ lead_id: "t", leadDir });
    assert.equal(result.pass, false);
    assert.ok(result.errors.some((e) => e.includes("preview")));
  });

  it("fails when critic scores < 4", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g4-"));
    writePassingDist(leadDir);
    writePreviews(leadDir);
    writeCritic(leadDir, {
      pass: false,
      scores: { trust: 3, modern: 5, sellable: 4, readable: 5 },
    });
    const result = runGateG4({ lead_id: "t", leadDir });
    assert.equal(result.pass, false);
  });

  it("fails when index.html missing", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g4-"));
    const designDir = path.join(leadDir, "design");
    mkdirSync(designDir, { recursive: true });
    writeFileSync(
      path.join(designDir, "build.json"),
      JSON.stringify({
        schema_version: "1.0",
        template: "atrium-v1",
        brand_tokens: { primary: "#111", font: "sans-serif" },
        build_dir: "design/dist",
        screens: ["design/preview-desktop.png", "design/preview-mobile.png"],
      })
    );
    const result = runGateG4({ lead_id: "t", leadDir });
    assert.equal(result.pass, false);
    assert.ok(result.errors.some((e) => e.includes("index.html")));
  });

  it("fails on overflow_mobile=true", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g4-"));
    writePassingDist(leadDir);
    writeFileSync(
      path.join(leadDir, "design", "build.json"),
      JSON.stringify(
        {
          schema_version: "1.0",
          template: "atrium-v1",
          brand_tokens: {
            primary: "#1c2b24",
            font: "Manrope, system-ui, sans-serif",
            logo: "assets/logo.svg",
          },
          build_dir: "design/dist",
          screens: ["design/preview-desktop.png", "design/preview-mobile.png"],
          console_errors_count: 0,
          overflow_mobile: true,
        },
        null,
        2
      )
    );
    writePreviews(leadDir);
    writeCritic(leadDir);
    const result = runGateG4({ lead_id: "t", leadDir });
    assert.equal(result.pass, false);
    assert.ok(result.errors.some((e) => e.includes("overflow_mobile")));
  });

  it("codeOnly passes without critic", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g4-"));
    writePassingDist(leadDir);
    writePreviews(leadDir);
    const result = runGateG4({ lead_id: "t", leadDir }, { codeOnly: true });
    assert.equal(result.pass, true);
  });

  it("fails on leftover mustache slots", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g4-"));
    writePassingDist(leadDir, {
      html: `<!doctype html><html><body>{{hero.headline}}</body></html>`,
    });
    writePreviews(leadDir);
    writeCritic(leadDir);
    const result = runGateG4({ lead_id: "t", leadDir });
    assert.equal(result.pass, false);
    assert.ok(result.errors.some((e) => e.includes("mustache")));
  });

  it("fails on Google Fonts CDN", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g4-"));
    writePassingDist(leadDir, {
      css: `@import url('https://fonts.googleapis.com/css2?family=Inter');\n@media (prefers-reduced-motion: reduce){}\n`,
    });
    writePreviews(leadDir);
    writeCritic(leadDir);
    const result = runGateG4({ lead_id: "t", leadDir });
    assert.equal(result.pass, false);
    assert.ok(result.errors.some((e) => e.includes("font CDN")));
  });

  it("fails when brand_tokens.logo missing under dist", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g4-"));
    writePassingDist(leadDir, { logo: false, brandLogo: "assets/missing.svg" });
    writePreviews(leadDir);
    writeCritic(leadDir);
    const result = runGateG4({ lead_id: "t", leadDir });
    assert.equal(result.pass, false);
    assert.ok(result.errors.some((e) => e.includes("brand_tokens.logo")));
  });

  it("fails when img src asset missing", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g4-"));
    writePassingDist(leadDir, { imgSrc: "assets/nope.jpg" });
    writePreviews(leadDir);
    writeCritic(leadDir);
    const result = runGateG4({ lead_id: "t", leadDir });
    assert.equal(result.pass, false);
    assert.ok(result.errors.some((e) => e.includes("img src missing")));
  });

  it("fails when CSS lacks prefers-reduced-motion", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g4-"));
    writePassingDist(leadDir, { css: `body { color: red; }\n` });
    writePreviews(leadDir);
    writeCritic(leadDir);
    const result = runGateG4({ lead_id: "t", leadDir });
    assert.equal(result.pass, false);
    assert.ok(result.errors.some((e) => e.includes("prefers-reduced-motion")));
  });
});
