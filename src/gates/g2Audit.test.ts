import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { runGateG2 } from "./g2Audit.js";
import type { GateContext } from "../lib/types.js";

function writeAuditFixture(
  leadDir: string,
  leadId: string,
  findings: Array<Record<string, unknown>>,
  overrides: Record<string, unknown> = {}
): void {
  writeFileSync(
    path.join(leadDir, "audit.json"),
    JSON.stringify(
      {
        schema_version: "1.0",
        lead_id: leadId,
        business_facts: {
          services: ["Услуга"],
          usp_existing: ["УТП"],
          audience: "Аудитория",
        },
        findings,
        money_loss_summary: "Краткое резюме потерь.",
        ...overrides,
      },
      null,
      2
    )
  );
}

function validFindings(): Array<Record<string, unknown>> {
  return [
    {
      id: "a-01",
      category: "доверие",
      claim: "c1",
      evidence: "capture/desktop.png",
      impact: "i1",
      severity: "high",
    },
    {
      id: "a-02",
      category: "контент",
      claim: "c2",
      evidence: "capture/text.txt#L10-L12",
      impact: "i2",
      severity: "medium",
    },
    {
      id: "a-03",
      category: "конверсия",
      claim: "c3",
      evidence: "capture/desktop.png",
      impact: "i3",
      severity: "low",
    },
  ];
}

function setupCaptureEvidence(leadDir: string): void {
  const captureDir = path.join(leadDir, "capture");
  mkdirSync(captureDir, { recursive: true });
  writeFileSync(path.join(captureDir, "desktop.png"), Buffer.alloc(6000, 1));
  writeFileSync(path.join(captureDir, "text.txt"), "x".repeat(250));
}

describe("runGateG2", () => {
  it("passes on valid audit with >=3 findings and existing evidence", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g2-"));
    setupCaptureEvidence(leadDir);
    writeAuditFixture(leadDir, "test-co", [
      {
        id: "a-01",
        category: "доверие",
        claim: "c1",
        evidence: "capture/desktop.png",
        impact: "i1",
        severity: "high",
      },
      {
        id: "a-02",
        category: "контент",
        claim: "c2",
        evidence: "capture/text.txt#L10-L12",
        impact: "i2",
        severity: "medium",
      },
      {
        id: "a-03",
        category: "конверсия",
        claim: "c3",
        evidence: "capture/desktop.png",
        impact: "i3",
        severity: "low",
      },
    ]);
    const ctx: GateContext = { lead_id: "test-co", leadDir };
    const result = runGateG2(ctx, "has_website");
    assert.equal(result.pass, true);
    assert.equal(result.gate, "G2");
  });

  it("fails when findings < 3", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g2-"));
    setupCaptureEvidence(leadDir);
    writeAuditFixture(leadDir, "test-co", [
      {
        id: "a-01",
        category: "доверие",
        claim: "c1",
        evidence: "capture/desktop.png",
        impact: "i1",
        severity: "high",
      },
      {
        id: "a-02",
        category: "контент",
        claim: "c2",
        evidence: "capture/text.txt#L10-L12",
        impact: "i2",
        severity: "medium",
      },
    ]);
    const result = runGateG2({ lead_id: "test-co", leadDir }, "has_website");
    assert.equal(result.pass, false);
    assert.match(result.errors.join(" "), /must NOT have fewer than 3 items/);
  });

  it("fails when evidence file missing", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g2-"));
    setupCaptureEvidence(leadDir);
    writeAuditFixture(leadDir, "test-co", [
      {
        id: "a-01",
        category: "доверие",
        claim: "c1",
        evidence: "capture/desktop.png",
        impact: "i1",
        severity: "high",
      },
      {
        id: "a-02",
        category: "контент",
        claim: "c2",
        evidence: "capture/text.txt#L10-L12",
        impact: "i2",
        severity: "medium",
      },
      {
        id: "a-03",
        category: "конверсия",
        claim: "c3",
        evidence: "capture/text.txt#L10-L12",
        impact: "i3",
        severity: "low",
      },
    ]);
    // Break evidence by deleting the file after writing audit.json (schema stays valid).
    const captureDir = path.join(leadDir, "capture");
    unlinkSync(path.join(captureDir, "desktop.png"));
    const result = runGateG2({ lead_id: "test-co", leadDir }, "has_website");
    assert.equal(result.pass, false);
    assert.match(result.errors.join(" "), /file missing/);
  });

  it("fails on lead_id mismatch", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g2-"));
    setupCaptureEvidence(leadDir);
    writeAuditFixture(leadDir, "other-co", [
      {
        id: "a-01",
        category: "доверие",
        claim: "c1",
        evidence: "capture/desktop.png",
        impact: "i1",
        severity: "high",
      },
      {
        id: "a-02",
        category: "контент",
        claim: "c2",
        evidence: "capture/text.txt#L10-L12",
        impact: "i2",
        severity: "medium",
      },
      {
        id: "a-03",
        category: "конверсия",
        claim: "c3",
        evidence: "capture/desktop.png",
        impact: "i3",
        severity: "low",
      },
    ]);
    const result = runGateG2({ lead_id: "test-co", leadDir }, "has_website");
    assert.equal(result.pass, false);
    assert.match(result.errors.join(" "), /lead_id=other-co expected=test-co/);
  });

  it("fails on invalid evidence path prefix", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g2-"));
    setupCaptureEvidence(leadDir);
    writeAuditFixture(leadDir, "test-co", [
      {
        id: "a-01",
        category: "доверие",
        claim: "c1",
        evidence: "../audit.json",
        impact: "i1",
        severity: "high",
      },
      {
        id: "a-02",
        category: "контент",
        claim: "c2",
        evidence: "capture/text.txt#L10-L12",
        impact: "i2",
        severity: "medium",
      },
      {
        id: "a-03",
        category: "конверсия",
        claim: "c3",
        evidence: "capture/desktop.png",
        impact: "i3",
        severity: "low",
      },
    ]);
    const result = runGateG2({ lead_id: "test-co", leadDir }, "has_website");
    assert.equal(result.pass, false);
    assert.match(result.errors.join(" "), /must match a schema in anyOf/);
  });

  it("returns research branch not in M2 for no_website", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g2-"));
    const result = runGateG2({ lead_id: "test-co", leadDir }, "no_website");
    assert.equal(result.pass, false);
    assert.match(result.errors.join(" "), /research branch not in M2/);
  });

  it("passes when abbreviation is expanded on first use", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g2-"));
    setupCaptureEvidence(leadDir);
    writeAuditFixture(leadDir, "test-co", [
      {
        id: "a-01",
        category: "конверсия",
        claim: "Главный CTA (призыв к действию) теряется среди блоков.",
        evidence: "capture/desktop.png",
        impact: "Часть людей не понимает, куда нажать.",
        severity: "high",
      },
      ...validFindings().slice(1),
    ]);
    const result = runGateG2({ lead_id: "test-co", leadDir }, "has_website");
    assert.equal(result.pass, true);
  });

  it("fails when abbreviation is not expanded", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g2-"));
    setupCaptureEvidence(leadDir);
    writeAuditFixture(leadDir, "test-co", [
      {
        id: "a-01",
        category: "конверсия",
        claim: "Главный CTA теряется среди блоков.",
        evidence: "capture/desktop.png",
        impact: "Часть людей не понимает, куда нажать.",
        severity: "high",
      },
      ...validFindings().slice(1),
    ]);
    const result = runGateG2({ lead_id: "test-co", leadDir }, "has_website");
    assert.equal(result.pass, false);
    assert.match(result.errors.join(" "), /abbreviation not expanded token=CTA/);
  });

  it("fails on anglicism in client text", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g2-"));
    setupCaptureEvidence(leadDir);
    writeAuditFixture(leadDir, "test-co", [
      {
        id: "a-01",
        category: "контент",
        claim: "На landing странице мало конкретики.",
        evidence: "capture/desktop.png",
        impact: "Люди уходят без заявки.",
        severity: "high",
      },
      ...validFindings().slice(1),
    ]);
    const result = runGateG2({ lead_id: "test-co", leadDir }, "has_website");
    assert.equal(result.pass, false);
    assert.match(result.errors.join(" "), /anglicism detected word=landing/);
  });

  it("fails on AI marker in client text", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g2-"));
    setupCaptureEvidence(leadDir);
    writeAuditFixture(leadDir, "test-co", [
      {
        id: "a-01",
        category: "доверие",
        claim: "Текст написан как модель, поэтому не убеждает с первого экрана.",
        evidence: "capture/desktop.png",
        impact: "Часть людей уходит без заявки.",
        severity: "high",
      },
      ...validFindings().slice(1),
    ]);
    const result = runGateG2({ lead_id: "test-co", leadDir }, "has_website");
    assert.equal(result.pass, false);
    assert.match(result.errors.join(" "), /ai_marker detected/);
  });

  it("fails on banned phrase", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g2-"));
    setupCaptureEvidence(leadDir);
    writeAuditFixture(leadDir, "test-co", validFindings(), {
      money_loss_summary: "В целом сайт можно усилить.",
    });
    const result = runGateG2({ lead_id: "test-co", leadDir }, "has_website");
    assert.equal(result.pass, false);
    assert.match(result.errors.join(" "), /banned_phrase detected phrase=в целом/);
  });
});
