import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { runGateG5 } from "./g5Publish.js";

function writeDeploy(
  leadDir: string,
  checks: Record<string, unknown>
): void {
  writeFileSync(
    path.join(leadDir, "deploy.json"),
    JSON.stringify(
      {
        schema_version: "1.0",
        demo_url: "https://t.leadgenerator-demos.pages.dev",
        checks,
      },
      null,
      2
    )
  );
}

describe("runGateG5", () => {
  it("passes with full checks at threshold", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g5-"));
    writeDeploy(leadDir, {
      http_200: true,
      no_console_errors: true,
      lighthouse_perf: 85,
    });
    const result = runGateG5({ lead_id: "t", leadDir });
    assert.equal(result.pass, true);
    assert.equal(result.gate, "G5");
    assert.equal(result.errors.length, 0);
  });

  it("fails when checks are empty", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g5-"));
    writeDeploy(leadDir, {});
    const result = runGateG5({ lead_id: "t", leadDir });
    assert.equal(result.pass, false);
    assert.ok(result.errors.some((e) => e.includes("checks empty")));
    assert.ok(result.errors.some((e) => e.includes("gate=G5")));
    assert.ok(result.errors.some((e) => e.includes("lead_id=t")));
  });

  it("fails when lighthouse_perf is below threshold", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g5-"));
    writeDeploy(leadDir, {
      http_200: true,
      no_console_errors: true,
      lighthouse_perf: 70,
    });
    const result = runGateG5({ lead_id: "t", leadDir });
    assert.equal(result.pass, false);
    assert.ok(result.errors.some((e) => e.includes("lighthouse_perf=70")));
    assert.ok(result.errors.some((e) => e.includes("required>=85")));
  });

  it("fails when deploy.json is missing", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g5-"));
    const result = runGateG5({ lead_id: "t", leadDir });
    assert.equal(result.pass, false);
    assert.ok(result.errors.some((e) => e.includes("file missing")));
    assert.ok(result.errors.some((e) => e.includes("artifact=deploy.json")));
  });

  it("fails when http_200 is false", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g5-"));
    writeDeploy(leadDir, {
      http_200: false,
      no_console_errors: true,
      lighthouse_perf: 90,
    });
    const result = runGateG5({ lead_id: "t", leadDir });
    assert.equal(result.pass, false);
    assert.ok(result.errors.some((e) => e.includes("http_200=false")));
  });

  it("fails when no_console_errors is false", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g5-"));
    writeDeploy(leadDir, {
      http_200: true,
      no_console_errors: false,
      lighthouse_perf: 90,
    });
    const result = runGateG5({ lead_id: "t", leadDir });
    assert.equal(result.pass, false);
    assert.ok(result.errors.some((e) => e.includes("no_console_errors=false")));
  });
});
