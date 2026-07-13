import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { runGateG4 } from "./g4Design.js";

function writeBuild(
  leadDir: string,
  overrides: Record<string, unknown> = {}
): void {
  const designDir = path.join(leadDir, "design");
  const distDir = path.join(designDir, "dist");
  mkdirSync(distDir, { recursive: true });
  writeFileSync(path.join(distDir, "index.html"), "<!doctype html><html><body>ok</body></html>");
  writeFileSync(
    path.join(designDir, "build.json"),
    JSON.stringify(
      {
        schema_version: "1.0",
        template: "renovation-v1",
        brand_tokens: {
          primary: "#1c2b24",
          font: "Manrope, system-ui, sans-serif",
        },
        build_dir: "design/dist",
        screens: ["design/preview-desktop.png", "design/preview-mobile.png"],
        console_errors_count: 0,
        overflow_mobile: false,
        ...overrides,
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
    writeBuild(leadDir);
    writePreviews(leadDir);
    writeCritic(leadDir);
    const result = runGateG4({ lead_id: "t", leadDir });
    assert.equal(result.pass, true);
  });

  it("fails when preview missing", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g4-"));
    writeBuild(leadDir);
    writeCritic(leadDir);
    const result = runGateG4({ lead_id: "t", leadDir });
    assert.equal(result.pass, false);
    assert.ok(result.errors.some((e) => e.includes("preview")));
  });

  it("fails when critic scores < 4", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g4-"));
    writeBuild(leadDir);
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
        template: "renovation-v1",
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
    writeBuild(leadDir, { overflow_mobile: true });
    writePreviews(leadDir);
    writeCritic(leadDir);
    const result = runGateG4({ lead_id: "t", leadDir });
    assert.equal(result.pass, false);
    assert.ok(result.errors.some((e) => e.includes("overflow_mobile")));
  });

  it("codeOnly passes without critic", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g4-"));
    writeBuild(leadDir);
    writePreviews(leadDir);
    const result = runGateG4({ lead_id: "t", leadDir }, { codeOnly: true });
    assert.equal(result.pass, true);
  });
});
